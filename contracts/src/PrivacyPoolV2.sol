// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./UltraVerifier.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PrivacyPoolV2 - ZK privacy pool with offchain Poseidon2 Merkle tree
/// @notice Merkle tree is maintained offchain by a relayer. Roots are submitted on-chain.
///         2-stage withdrawal: ZK proof -> operator attestation OR timeout claim.
contract PrivacyPoolV2 {
    uint256 public constant ATTESTATION_WINDOW = 24 hours;

    IVerifier public immutable verifier;
    IERC20 public immutable token;
    address public operator;
    address public relayer;

    // --- Commitment queue (offchain tree) ---
    uint256 public commitmentCount;
    mapping(uint256 => bytes32) public commitments;

    // --- Root management ---
    mapping(bytes32 => bool) public knownRoots;
    bytes32 public currentRoot;
    uint256 public lastProcessedIndex;

    // --- Dual-approval root (relayer proposes, operator confirms) ---
    struct PendingRoot {
        bytes32 root;
        uint256 processedUpTo;
        bool proposed;
    }

    PendingRoot public pendingRoot;

    // --- Nullifier tracking ---
    mapping(bytes32 => bool) public nullifiers;

    // --- Registration root (KYC-bound NPK tree) ---
    mapping(bytes32 => bool) public knownRegistrationRoots;
    bytes32 public currentRegistrationRoot;

    // --- 2-Stage Withdrawal ---
    struct PendingWithdrawal {
        address recipient;
        uint256 amount;
        bytes32 complianceHash;
        uint256 deadline;
        bool completed;
    }

    mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;

    // --- Events ---
    event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp);
    event EncryptedNote(uint256 indexed leafIndex, bytes encryptedNote);
    event RootProposed(bytes32 indexed newRoot, uint256 processedUpTo);
    event RootConfirmed(bytes32 indexed newRoot, uint256 processedUpTo);
    event WithdrawalInitiated(
        bytes32 indexed nullifier, address indexed recipient, uint256 amount, bytes32 complianceHash
    );
    event WithdrawalAttested(bytes32 indexed nullifier);
    event WithdrawalClaimed(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bool attested);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event RegistrationRootUpdated(bytes32 indexed newRoot);

    constructor(address _verifier, address _token, address _operator, address _relayer) {
        require(_verifier != address(0), "Zero verifier");
        require(_token != address(0), "Zero token");
        require(_operator != address(0), "Zero operator");
        require(_relayer != address(0), "Zero relayer");
        verifier = IVerifier(_verifier);
        token = IERC20(_token);
        operator = _operator;
        relayer = _relayer;
    }

    /// @notice Deposit tokens into the privacy pool
    /// @param commitment Poseidon2 commitment (Field element as bytes32)
    /// @param amount Token amount to deposit
    /// @param encryptedNote ECIES-encrypted note data for the recipient
    function deposit(bytes32 commitment, uint256 amount, bytes calldata encryptedNote) external {
        require(amount > 0, "Zero deposit");

        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 leafIndex = commitmentCount;
        commitments[leafIndex] = commitment;
        commitmentCount++;

        emit Deposit(commitment, leafIndex, amount, block.timestamp);
        emit EncryptedNote(leafIndex, encryptedNote);
    }

    /// @notice Relayer proposes a new Merkle root (Stage 1 of dual-approval)
    /// @param newRoot Poseidon2 Merkle root
    /// @param processedUpTo Index of last commitment included (exclusive)
    function proposeRoot(bytes32 newRoot, uint256 processedUpTo) external {
        require(msg.sender == relayer, "Only relayer");
        require(processedUpTo > lastProcessedIndex, "No new commitments");
        require(processedUpTo <= commitmentCount, "Exceeds commitments");
        require(!pendingRoot.proposed, "Pending root exists");

        pendingRoot = PendingRoot(newRoot, processedUpTo, true);

        emit RootProposed(newRoot, processedUpTo);
    }

    /// @notice Operator confirms the proposed root (Stage 2 of dual-approval)
    /// @dev Operator must independently compute the Merkle tree and verify the root matches
    /// @param expectedRoot The root the operator expects (must match proposed root)
    /// @param expectedProcessedUpTo The processedUpTo the operator expects
    function confirmRoot(bytes32 expectedRoot, uint256 expectedProcessedUpTo) external {
        require(msg.sender == operator, "Only operator");
        require(pendingRoot.proposed, "No pending root");
        require(pendingRoot.root == expectedRoot, "Root mismatch");
        require(pendingRoot.processedUpTo == expectedProcessedUpTo, "ProcessedUpTo mismatch");

        currentRoot = pendingRoot.root;
        knownRoots[pendingRoot.root] = true;
        lastProcessedIndex = pendingRoot.processedUpTo;
        pendingRoot.proposed = false;

        emit RootConfirmed(pendingRoot.root, pendingRoot.processedUpTo);
    }

    /// @notice Cancel a proposed root (relayer can re-propose if needed)
    function cancelProposedRoot() external {
        require(msg.sender == relayer || msg.sender == operator, "Only relayer or operator");
        require(pendingRoot.proposed, "No pending root");
        pendingRoot.proposed = false;
    }

    /// @notice Operator submits a new registration root after adding/removing KYC'd users
    /// @param newRoot Poseidon2 Merkle root of the registration tree (depth 16)
    function updateRegistrationRoot(bytes32 newRoot) external {
        require(msg.sender == operator, "Only operator");
        currentRegistrationRoot = newRoot;
        knownRegistrationRoots[newRoot] = true;
        emit RegistrationRootUpdated(newRoot);
    }

    /// @notice Initiate a withdrawal with ZK proof (Stage 1)
    /// @dev Public inputs layout: [root, nullifier, amount, recipient, compliance_hash, registration_root, ...aggregation]
    ///      The first 6 are user inputs; remaining are passed through to the verifier.
    /// @param proof Honk ZK proof bytes
    /// @param publicInputs Public inputs (>= 6 user Fields + optional aggregation object)
    function initiateWithdrawal(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(publicInputs.length >= 6, "Too few public inputs");

        // Extract 6 user-level public inputs
        bytes32 root = publicInputs[0];
        bytes32 nullifier = publicInputs[1];
        uint256 amount = uint256(publicInputs[2]);
        address recipient = address(uint160(uint256(publicInputs[3])));
        bytes32 complianceHash = publicInputs[4];
        bytes32 registrationRoot = publicInputs[5];

        // State checks (before expensive proof verification)
        require(knownRoots[root], "Unknown root");
        require(knownRegistrationRoots[registrationRoot], "Unknown registration root");
        require(!nullifiers[nullifier], "Nullifier used");

        // Verify ZK proof
        verifier.verify(proof, publicInputs);

        // Mark nullifier
        nullifiers[nullifier] = true;

        // Store pending withdrawal
        pendingWithdrawals[nullifier] = PendingWithdrawal({
            recipient: recipient,
            amount: amount,
            complianceHash: complianceHash,
            deadline: block.timestamp + ATTESTATION_WINDOW,
            completed: false
        });

        emit WithdrawalInitiated(nullifier, recipient, amount, complianceHash);
    }

    /// @notice Operator attests withdrawal - immediate fund release (Stage 2a)
    function attestWithdrawal(bytes32 nullifier) external {
        require(msg.sender == operator, "Only operator");
        PendingWithdrawal storage pw = pendingWithdrawals[nullifier];
        require(pw.recipient != address(0), "No pending withdrawal");
        require(!pw.completed, "Already completed");

        pw.completed = true;
        require(token.transfer(pw.recipient, pw.amount), "Transfer failed");

        emit WithdrawalAttested(nullifier);
        emit WithdrawalClaimed(nullifier, pw.recipient, pw.amount, true);
    }

    /// @notice Transfer relayer role to a new address (e.g. EOA -> multisig migration)
    function setRelayer(address newRelayer) external {
        require(msg.sender == relayer, "Only relayer");
        require(newRelayer != address(0), "Zero address");
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    /// @notice Claim withdrawal after attestation window expires (Stage 2b)
    /// @dev Anyone can call - censorship resistance
    function claimWithdrawal(bytes32 nullifier) external {
        PendingWithdrawal storage pw = pendingWithdrawals[nullifier];
        require(pw.recipient != address(0), "No pending withdrawal");
        require(!pw.completed, "Already completed");
        require(block.timestamp >= pw.deadline, "Window active");

        pw.completed = true;
        require(token.transfer(pw.recipient, pw.amount), "Transfer failed");

        emit WithdrawalClaimed(nullifier, pw.recipient, pw.amount, false);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./UltraVerifier.sol";
import {IncrementalMerkleTree} from "./MerkleTree.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PrivacyPoolV2 - ZK privacy pool with on-chain Poseidon2 Merkle tree
/// @notice On-chain incremental Merkle tree (depth 20, rotating). No relayer trust for roots.
///         Supports both privacy (1-tx immediate) and compliance (2-stage attested) withdrawals.
contract PrivacyPoolV2 is IncrementalMerkleTree {
    uint256 public constant ATTESTATION_WINDOW = 24 hours;

    IVerifier public immutable privacyVerifier;
    IVerifier public immutable complianceVerifier;
    IERC20 public immutable token;
    address public operator;
    address public relayer;

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

    // --- Denomination ---
    mapping(uint256 => bool) public isDenomination;

    // --- Events ---
    event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp);
    event EncryptedNote(uint256 indexed leafIndex, bytes encryptedNote);
    event Withdrawn(bytes32 indexed nullifier, address indexed recipient, uint256 amount);
    event WithdrawalInitiated(
        bytes32 indexed nullifier, address indexed recipient, uint256 amount, bytes32 complianceHash
    );
    event WithdrawalAttested(bytes32 indexed nullifier);
    event WithdrawalClaimed(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bool attested);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event RegistrationRootUpdated(bytes32 indexed newRoot);

    /// @param _privacyVerifier Verifier for privacy circuit (4 public inputs). address(0) to disable.
    /// @param _complianceVerifier Verifier for compliance circuit (6 public inputs). address(0) to disable.
    /// @param _token ERC20 token address
    /// @param _operator Operator address for compliance features. address(0) for privacy-only.
    /// @param _relayer Relayer address (API server for proof queries, no root submission)
    constructor(
        address _privacyVerifier,
        address _complianceVerifier,
        address _token,
        address _operator,
        address _relayer
    ) {
        require(_privacyVerifier != address(0) || _complianceVerifier != address(0), "No verifier");
        require(_token != address(0), "Zero token");
        require(_relayer != address(0), "Zero relayer");
        if (_complianceVerifier != address(0)) {
            require(_operator != address(0), "Compliance requires operator");
        }
        privacyVerifier = IVerifier(_privacyVerifier);
        complianceVerifier = IVerifier(_complianceVerifier);
        token = IERC20(_token);
        operator = _operator;
        relayer = _relayer;

        // Initialize zero hashes for Merkle tree (deployer pays gas)
        _initZeros();

        // Initialize denominations
        isDenomination[10_000] = true;
        isDenomination[100_000] = true;
        isDenomination[1_000_000] = true;
        isDenomination[10_000_000] = true;
        isDenomination[100_000_000] = true;
        isDenomination[1_000_000_000] = true;
    }

    // ============================================================
    // Deposit (on-chain tree insert)
    // ============================================================

    /// @notice Deposit tokens into the privacy pool. Commitment is inserted into the
    ///         on-chain Merkle tree and root is updated immediately.
    function deposit(bytes32 commitment, uint256 amount, bytes calldata encryptedNote) external {
        require(isDenomination[amount], "Invalid denomination");

        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Insert commitment into on-chain Merkle tree
        (, uint256 leafIndex) = _insert(uint256(commitment));

        emit Deposit(commitment, leafIndex, amount, block.timestamp);
        emit EncryptedNote(leafIndex, encryptedNote);
    }

    /// @notice Batch deposit multiple commitments in a single transaction.
    ///         Saves gas by performing only one ERC20 transferFrom.
    function batchDeposit(
        bytes32[] calldata _commitments,
        uint256[] calldata _amounts,
        bytes[] calldata _encryptedNotes
    ) external {
        uint256 len = _commitments.length;
        require(len == _amounts.length && len == _encryptedNotes.length, "Length mismatch");
        require(len > 0, "Empty batch");

        uint256 totalAmount;
        for (uint256 i = 0; i < len; i++) {
            require(isDenomination[_amounts[i]], "Invalid denomination");
            totalAmount += _amounts[i];
        }

        require(token.transferFrom(msg.sender, address(this), totalAmount), "Transfer failed");

        for (uint256 i = 0; i < len; i++) {
            (, uint256 leafIndex) = _insert(uint256(_commitments[i]));
            emit Deposit(_commitments[i], leafIndex, _amounts[i], block.timestamp);
            emit EncryptedNote(leafIndex, _encryptedNotes[i]);
        }
    }

    // ============================================================
    // Registration (requires operator)
    // ============================================================

    /// @notice Operator submits a new registration root after adding/removing KYC'd users
    function updateRegistrationRoot(bytes32 newRoot) external {
        require(operator != address(0), "No operator");
        require(msg.sender == operator, "Only operator");
        currentRegistrationRoot = newRoot;
        knownRegistrationRoots[newRoot] = true;
        emit RegistrationRootUpdated(newRoot);
    }

    // ============================================================
    // Withdrawal -- privacy mode (1-tx immediate)
    // ============================================================

    /// @notice Withdraw with ZK proof -- immediate transfer
    /// @dev Public inputs layout: [root, nullifier, amount, recipient, ...aggregation]
    function withdraw(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(address(privacyVerifier) != address(0), "Privacy verifier not set");
        require(publicInputs.length >= 4, "Too few public inputs");

        bytes32 root = publicInputs[0];
        bytes32 nullifier = publicInputs[1];
        uint256 amount = uint256(publicInputs[2]);
        address recipient = address(uint160(uint256(publicInputs[3])));

        require(knownRoots[root], "Unknown root");
        require(!nullifiers[nullifier], "Nullifier used");

        privacyVerifier.verify(proof, publicInputs);

        nullifiers[nullifier] = true;

        require(token.transfer(recipient, amount), "Transfer failed");

        emit Withdrawn(nullifier, recipient, amount);
    }

    /// @notice Withdraw multiple notes in a single transaction.
    /// @dev Public inputs layout: [root, null_0, null_1, null_2, null_3, totalAmount, recipient]
    function withdrawMulti(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(address(privacyVerifier) != address(0), "Privacy verifier not set");
        require(publicInputs.length >= 7, "Too few public inputs");

        bytes32 root = publicInputs[0];
        uint256 totalAmount = uint256(publicInputs[5]);
        address recipient = address(uint160(uint256(publicInputs[6])));

        require(knownRoots[root], "Unknown root");

        for (uint256 i = 1; i <= 4; i++) {
            if (publicInputs[i] != bytes32(0)) {
                require(!nullifiers[publicInputs[i]], "Nullifier used");
                nullifiers[publicInputs[i]] = true;
            }
        }

        privacyVerifier.verify(proof, publicInputs);

        require(token.transfer(recipient, totalAmount), "Transfer failed");

        for (uint256 i = 1; i <= 4; i++) {
            if (publicInputs[i] != bytes32(0)) {
                emit Withdrawn(publicInputs[i], recipient, totalAmount);
            }
        }
    }

    // ============================================================
    // Withdrawal -- compliance mode (2-stage)
    // ============================================================

    /// @notice Initiate a withdrawal with ZK proof (Stage 1)
    /// @dev Public inputs: [root, nullifier, amount, recipient, compliance_hash, registration_root, ...aggregation]
    function initiateWithdrawal(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(address(complianceVerifier) != address(0), "Compliance verifier not set");
        require(publicInputs.length >= 6, "Too few public inputs");

        bytes32 root = publicInputs[0];
        bytes32 nullifier = publicInputs[1];
        uint256 amount = uint256(publicInputs[2]);
        address recipient = address(uint160(uint256(publicInputs[3])));
        bytes32 complianceHash = publicInputs[4];
        bytes32 registrationRoot = publicInputs[5];

        require(knownRoots[root], "Unknown root");
        require(knownRegistrationRoots[registrationRoot], "Unknown registration root");
        require(!nullifiers[nullifier], "Nullifier used");

        complianceVerifier.verify(proof, publicInputs);

        nullifiers[nullifier] = true;

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

    // ============================================================
    // Admin
    // ============================================================

    /// @notice Transfer relayer role to a new address
    function setRelayer(address newRelayer) external {
        require(msg.sender == relayer, "Only relayer");
        require(newRelayer != address(0), "Zero address");
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }
}

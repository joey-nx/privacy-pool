// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PrivacyPoolV2} from "../src/PrivacyPoolV2.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {IVerifier} from "../src/UltraVerifier.sol";

/// @dev Mock verifier that always succeeds
contract MockVerifier is IVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

/// @dev Mock verifier that always reverts
contract RevertingVerifier is IVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        revert("proof invalid");
    }
}

contract PrivacyPoolV2Test is Test {
    PrivacyPoolV2 public pool;
    MockUSDT public usdt;
    MockVerifier public mockVerifier;

    address operator = address(0xBEEF);
    address relayerAddr = address(0xBE1A);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant DEPOSIT_AMOUNT = 1_000_000;

    // Deterministic test values (matching Field-level public inputs)
    bytes32 constant TEST_COMMITMENT = bytes32(uint256(0x1234));
    bytes32 constant TEST_ROOT = bytes32(uint256(0xABCD));
    bytes32 constant TEST_NULLIFIER = bytes32(uint256(0x5678));
    bytes32 constant TEST_COMPLIANCE_HASH = bytes32(uint256(0x9ABC));
    bytes32 constant TEST_REGISTRATION_ROOT = bytes32(uint256(0xDEF0));

    function setUp() public {
        mockVerifier = new MockVerifier();
        usdt = new MockUSDT();
        pool = new PrivacyPoolV2(address(mockVerifier), address(usdt), operator, relayerAddr);
    }

    // ============================================================
    // Constructor Tests
    // ============================================================

    function test_constructorSetsImmutables() public view {
        assertEq(address(pool.verifier()), address(mockVerifier));
        assertEq(address(pool.token()), address(usdt));
        assertEq(pool.operator(), operator);
        assertEq(pool.relayer(), relayerAddr);
    }

    function test_constructorInitialState() public view {
        assertEq(pool.commitmentCount(), 0);
        assertEq(pool.lastProcessedIndex(), 0);
        assertEq(pool.currentRoot(), bytes32(0));
        assertEq(pool.currentRegistrationRoot(), bytes32(0));
    }

    function test_constructorRevertsZeroVerifier() public {
        vm.expectRevert("Zero verifier");
        new PrivacyPoolV2(address(0), address(usdt), operator, relayerAddr);
    }

    function test_constructorRevertsZeroToken() public {
        vm.expectRevert("Zero token");
        new PrivacyPoolV2(address(mockVerifier), address(0), operator, relayerAddr);
    }

    function test_constructorRevertsZeroOperator() public {
        vm.expectRevert("Zero operator");
        new PrivacyPoolV2(address(mockVerifier), address(usdt), address(0), relayerAddr);
    }

    function test_constructorRevertsZeroRelayer() public {
        vm.expectRevert("Zero relayer");
        new PrivacyPoolV2(address(mockVerifier), address(usdt), operator, address(0));
    }

    // ============================================================
    // Deposit Tests
    // ============================================================

    function test_depositStoresCommitment() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");

        assertEq(pool.commitmentCount(), 1);
        assertEq(pool.commitments(0), TEST_COMMITMENT);
        assertEq(usdt.balanceOf(address(pool)), DEPOSIT_AMOUNT);
        assertEq(usdt.balanceOf(alice), 0);
    }

    function test_depositEmitsEvents() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PrivacyPoolV2.Deposit(TEST_COMMITMENT, 0, DEPOSIT_AMOUNT, block.timestamp);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");
    }

    function test_depositEmitsEncryptedNote() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit PrivacyPoolV2.EncryptedNote(0, hex"cafe");
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");
    }

    function test_depositRevertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Zero deposit");
        pool.deposit(TEST_COMMITMENT, 0, hex"");
    }

    function test_depositRevertsInsufficientAllowance() public {
        usdt.mint(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert("ERC20: insufficient allowance");
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");
    }

    function test_multipleDepositsIncrementCount() public {
        for (uint256 i = 0; i < 3; i++) {
            _mintAndApprove(alice, DEPOSIT_AMOUNT);
            vm.prank(alice);
            pool.deposit(bytes32(uint256(i + 1)), DEPOSIT_AMOUNT, hex"");
        }
        assertEq(pool.commitmentCount(), 3);
        assertEq(usdt.balanceOf(address(pool)), DEPOSIT_AMOUNT * 3);
    }

    function test_depositDoesNotUpdateRoot() public {
        bytes32 rootBefore = pool.currentRoot();

        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        assertEq(pool.currentRoot(), rootBefore, "Root should not change on deposit");
    }

    // ============================================================
    // proposeRoot Tests
    // ============================================================

    function test_proposeRootByRelayer() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        (bytes32 root, uint256 processedUpTo, bool proposed) = pool.pendingRoot();
        assertEq(root, TEST_ROOT);
        assertEq(processedUpTo, 1);
        assertTrue(proposed);

        // Root not yet active
        assertFalse(pool.knownRoots(TEST_ROOT));
        assertEq(pool.currentRoot(), bytes32(0));
    }

    function test_proposeRootEmitsEvent() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        vm.expectEmit(true, false, false, true);
        emit PrivacyPoolV2.RootProposed(TEST_ROOT, 1);
        pool.proposeRoot(TEST_ROOT, 1);
    }

    function test_proposeRootRevertsNonRelayer() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert("Only relayer");
        pool.proposeRoot(TEST_ROOT, 1);
    }

    function test_proposeRootRevertsNoNewCommitments() public {
        vm.prank(relayerAddr);
        vm.expectRevert("No new commitments");
        pool.proposeRoot(TEST_ROOT, 0);
    }

    function test_proposeRootRevertsExceedsCommitments() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        vm.expectRevert("Exceeds commitments");
        pool.proposeRoot(TEST_ROOT, 2);
    }

    function test_proposeRootRevertsPendingExists() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        // Cannot propose again while pending
        vm.prank(relayerAddr);
        vm.expectRevert("Pending root exists");
        pool.proposeRoot(bytes32(uint256(0x999)), 2);
    }

    // ============================================================
    // confirmRoot Tests
    // ============================================================

    function test_confirmRootByOperator() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);

        assertEq(pool.currentRoot(), TEST_ROOT);
        assertTrue(pool.knownRoots(TEST_ROOT));
        assertEq(pool.lastProcessedIndex(), 1);
    }

    function test_confirmRootEmitsEvent() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit PrivacyPoolV2.RootConfirmed(TEST_ROOT, 1);
        pool.confirmRoot(TEST_ROOT, 1);
    }

    function test_confirmRootRevertsNonOperator() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(alice);
        vm.expectRevert("Only operator");
        pool.confirmRoot(TEST_ROOT, 1);
    }

    function test_confirmRootRevertsNoPending() public {
        vm.prank(operator);
        vm.expectRevert("No pending root");
        pool.confirmRoot(TEST_ROOT, 1);
    }

    function test_confirmRootRevertsRootMismatch() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        bytes32 wrongRoot = bytes32(uint256(0xDEAD));
        vm.prank(operator);
        vm.expectRevert("Root mismatch");
        pool.confirmRoot(wrongRoot, 1);
    }

    function test_confirmRootRevertsProcessedUpToMismatch() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(operator);
        vm.expectRevert("ProcessedUpTo mismatch");
        pool.confirmRoot(TEST_ROOT, 2);
    }

    function test_dualApprovalMultipleTimes() public {
        // 3 deposits
        for (uint256 i = 0; i < 3; i++) {
            _doDeposit(alice, DEPOSIT_AMOUNT);
        }

        bytes32 root1 = bytes32(uint256(0x111));
        bytes32 root2 = bytes32(uint256(0x222));

        // Process first 2
        vm.prank(relayerAddr);
        pool.proposeRoot(root1, 2);
        vm.prank(operator);
        pool.confirmRoot(root1, 2);
        assertEq(pool.lastProcessedIndex(), 2);

        // Process remaining 1
        vm.prank(relayerAddr);
        pool.proposeRoot(root2, 3);
        vm.prank(operator);
        pool.confirmRoot(root2, 3);
        assertEq(pool.lastProcessedIndex(), 3);

        // Both roots known
        assertTrue(pool.knownRoots(root1));
        assertTrue(pool.knownRoots(root2));
        assertEq(pool.currentRoot(), root2);
    }

    // ============================================================
    // cancelProposedRoot Tests
    // ============================================================

    function test_cancelByRelayer() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(relayerAddr);
        pool.cancelProposedRoot();

        (,, bool proposed) = pool.pendingRoot();
        assertFalse(proposed);
    }

    function test_cancelByOperator() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(operator);
        pool.cancelProposedRoot();

        (,, bool proposed) = pool.pendingRoot();
        assertFalse(proposed);
    }

    function test_cancelRevertsUnauthorized() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(alice);
        vm.expectRevert("Only relayer or operator");
        pool.cancelProposedRoot();
    }

    function test_cancelRevertsNoPending() public {
        vm.prank(relayerAddr);
        vm.expectRevert("No pending root");
        pool.cancelProposedRoot();
    }

    function test_reproposAfterCancel() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(relayerAddr);
        pool.cancelProposedRoot();

        // Can re-propose after cancel
        bytes32 newRoot = bytes32(uint256(0xBBBB));
        vm.prank(relayerAddr);
        pool.proposeRoot(newRoot, 1);

        (bytes32 root,, bool proposed) = pool.pendingRoot();
        assertEq(root, newRoot);
        assertTrue(proposed);
    }

    // ============================================================
    // initiateWithdrawal Tests
    // ============================================================

    function test_initiateWithdrawalStoresPending() public {
        _depositAndSetRoot();

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);

        (address recipient, uint256 amount,, uint256 deadline, bool completed) = pool.pendingWithdrawals(TEST_NULLIFIER);

        assertEq(recipient, bob);
        assertEq(amount, DEPOSIT_AMOUNT);
        assertEq(deadline, block.timestamp + 24 hours);
        assertFalse(completed);
    }

    function test_initiateWithdrawalMarksNullifier() public {
        _depositAndSetRoot();

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);

        assertTrue(pool.nullifiers(TEST_NULLIFIER));
    }

    function test_initiateWithdrawalDoesNotTransferFunds() public {
        _depositAndSetRoot();

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);

        assertEq(usdt.balanceOf(bob), 0, "Funds should remain in contract");
        assertEq(usdt.balanceOf(address(pool)), DEPOSIT_AMOUNT);
    }

    function test_initiateWithdrawalRevertsDuplicateNullifier() public {
        _depositAndSetRoot();

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);

        // Second deposit for funds (root already known, re-use TEST_ROOT)
        _doDeposit(alice, DEPOSIT_AMOUNT);
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 2);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 2);

        vm.expectRevert("Nullifier used");
        pool.initiateWithdrawal(hex"", pi);
    }

    function test_initiateWithdrawalRevertsTooFewPI() public {
        bytes32[] memory shortPi = new bytes32[](5);
        vm.expectRevert("Too few public inputs");
        pool.initiateWithdrawal(hex"", shortPi);
    }

    function test_initiateWithdrawalRevertsUnknownRoot() public {
        _depositAndSetRoot();

        bytes32 fakeRoot = bytes32(uint256(0xDEAD));
        bytes32[] memory pi = _buildPublicInputs(fakeRoot, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);

        vm.expectRevert("Unknown root");
        pool.initiateWithdrawal(hex"", pi);
    }

    function test_initiateWithdrawalRevertsIfVerifierFails() public {
        RevertingVerifier rv = new RevertingVerifier();
        PrivacyPoolV2 rvPool = new PrivacyPoolV2(address(rv), address(usdt), operator, relayerAddr);

        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        usdt.approve(address(rvPool), DEPOSIT_AMOUNT);

        vm.prank(alice);
        rvPool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        vm.prank(relayerAddr);
        rvPool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        rvPool.confirmRoot(TEST_ROOT, 1);

        vm.prank(operator);
        rvPool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);

        vm.expectRevert("proof invalid");
        rvPool.initiateWithdrawal(hex"", pi);
    }

    function test_initiateWithdrawalRevertsUnknownRegistrationRoot() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);
        // Note: no updateRegistrationRoot called

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        vm.expectRevert("Unknown registration root");
        pool.initiateWithdrawal(hex"", pi);
    }

    // ============================================================
    // updateRegistrationRoot Tests
    // ============================================================

    function test_updateRegistrationRoot() public {
        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        assertEq(pool.currentRegistrationRoot(), TEST_REGISTRATION_ROOT);
        assertTrue(pool.knownRegistrationRoots(TEST_REGISTRATION_ROOT));
    }

    function test_updateRegistrationRootEmitsEvent() public {
        vm.prank(operator);
        vm.expectEmit(true, false, false, false);
        emit PrivacyPoolV2.RegistrationRootUpdated(TEST_REGISTRATION_ROOT);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);
    }

    function test_updateRegistrationRootRevertsNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Only operator");
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);
    }

    function test_updateRegistrationRootMultipleTimes() public {
        bytes32 root1 = bytes32(uint256(0xF001));
        bytes32 root2 = bytes32(uint256(0xF002));

        vm.prank(operator);
        pool.updateRegistrationRoot(root1);

        vm.prank(operator);
        pool.updateRegistrationRoot(root2);

        // Both roots remain known
        assertTrue(pool.knownRegistrationRoots(root1));
        assertTrue(pool.knownRegistrationRoots(root2));
        assertEq(pool.currentRegistrationRoot(), root2);
    }

    // ============================================================
    // attestWithdrawal Tests
    // ============================================================

    function test_attestWithdrawalTransfersFunds() public {
        _depositInitiateFlow();

        vm.prank(operator);
        pool.attestWithdrawal(TEST_NULLIFIER);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
        assertEq(usdt.balanceOf(address(pool)), 0);
    }

    function test_attestWithdrawalMarksCompleted() public {
        _depositInitiateFlow();

        vm.prank(operator);
        pool.attestWithdrawal(TEST_NULLIFIER);

        (,,,, bool completed) = pool.pendingWithdrawals(TEST_NULLIFIER);
        assertTrue(completed);
    }

    function test_attestWithdrawalRevertsNonOperator() public {
        _depositInitiateFlow();

        vm.prank(alice);
        vm.expectRevert("Only operator");
        pool.attestWithdrawal(TEST_NULLIFIER);
    }

    function test_attestWithdrawalRevertsNoPending() public {
        vm.prank(operator);
        vm.expectRevert("No pending withdrawal");
        pool.attestWithdrawal(bytes32(uint256(0x999)));
    }

    function test_attestWithdrawalRevertsAlreadyCompleted() public {
        _depositInitiateFlow();

        vm.prank(operator);
        pool.attestWithdrawal(TEST_NULLIFIER);

        vm.prank(operator);
        vm.expectRevert("Already completed");
        pool.attestWithdrawal(TEST_NULLIFIER);
    }

    // ============================================================
    // claimWithdrawal Tests
    // ============================================================

    function test_claimWithdrawalAfterTimeout() public {
        _depositInitiateFlow();

        vm.warp(block.timestamp + 24 hours);
        pool.claimWithdrawal(TEST_NULLIFIER);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
        (,,,, bool completed) = pool.pendingWithdrawals(TEST_NULLIFIER);
        assertTrue(completed);
    }

    function test_claimWithdrawalRevertsBeforeTimeout() public {
        _depositInitiateFlow();

        vm.expectRevert("Window active");
        pool.claimWithdrawal(TEST_NULLIFIER);
    }

    function test_claimWithdrawalRevertsNoPending() public {
        vm.expectRevert("No pending withdrawal");
        pool.claimWithdrawal(bytes32(uint256(0x999)));
    }

    function test_claimWithdrawalRevertsAlreadyCompleted() public {
        _depositInitiateFlow();

        vm.prank(operator);
        pool.attestWithdrawal(TEST_NULLIFIER);

        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert("Already completed");
        pool.claimWithdrawal(TEST_NULLIFIER);
    }

    function test_claimWithdrawalCallableByAnyone() public {
        _depositInitiateFlow();

        vm.warp(block.timestamp + 24 hours);

        address random = address(0xDEAD);
        vm.prank(random);
        pool.claimWithdrawal(TEST_NULLIFIER);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
        assertEq(usdt.balanceOf(random), 0);
    }

    // ============================================================
    // Dual-Approval Security Scenarios
    // ============================================================

    /// @dev Relayer cannot confirm their own proposed root
    function test_relayerCannotConfirmOwnProposal() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(relayerAddr);
        vm.expectRevert("Only operator");
        pool.confirmRoot(TEST_ROOT, 1);
    }

    /// @dev Operator cannot propose a root (only relayer can)
    function test_operatorCannotPropose() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(operator);
        vm.expectRevert("Only relayer");
        pool.proposeRoot(TEST_ROOT, 1);
    }

    /// @dev Proposed-but-unconfirmed root cannot be used for withdrawals
    function test_withdrawalFailsWithUnconfirmedRoot() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        // Propose but do NOT confirm
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        vm.expectRevert("Unknown root");
        pool.initiateWithdrawal(hex"", pi);
    }

    /// @dev pendingRoot is cleared after confirmation
    function test_pendingRootClearedAfterConfirm() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);

        // Cannot confirm again
        vm.prank(operator);
        vm.expectRevert("No pending root");
        pool.confirmRoot(TEST_ROOT, 1);
    }

    /// @dev Cancel then confirm should revert
    function test_cancelThenConfirmReverts() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(relayerAddr);
        pool.cancelProposedRoot();

        vm.prank(operator);
        vm.expectRevert("No pending root");
        pool.confirmRoot(TEST_ROOT, 1);
    }

    /// @dev Cancel does not affect previously confirmed roots
    function test_cancelDoesNotAffectConfirmedRoots() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        // Confirm first root
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);

        // Second deposit, propose and cancel
        _doDeposit(alice, DEPOSIT_AMOUNT);
        bytes32 root2 = bytes32(uint256(0xBBBB));
        vm.prank(relayerAddr);
        pool.proposeRoot(root2, 2);
        vm.prank(operator);
        pool.cancelProposedRoot();

        // First root is still valid
        assertTrue(pool.knownRoots(TEST_ROOT));
        assertEq(pool.currentRoot(), TEST_ROOT);
        // Cancelled root is NOT in knownRoots
        assertFalse(pool.knownRoots(root2));
    }

    /// @dev New deposits arriving between propose and confirm don't invalidate proposal
    function test_confirmWorksAfterNewDeposits() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        // New deposit arrives while proposal pending
        _doDeposit(alice, DEPOSIT_AMOUNT);
        assertEq(pool.commitmentCount(), 2);

        // Operator can still confirm the original proposal
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);

        assertEq(pool.currentRoot(), TEST_ROOT);
        assertEq(pool.lastProcessedIndex(), 1);
    }

    /// @dev Historical roots remain valid after new confirmations
    function test_historicalRootsStillUsable() public {
        // Deposit 1, confirm root1
        _doDeposit(alice, DEPOSIT_AMOUNT);
        bytes32 root1 = bytes32(uint256(0x111));
        vm.prank(relayerAddr);
        pool.proposeRoot(root1, 1);
        vm.prank(operator);
        pool.confirmRoot(root1, 1);

        // Deposit 2, confirm root2
        _doDeposit(alice, DEPOSIT_AMOUNT);
        bytes32 root2 = bytes32(uint256(0x222));
        vm.prank(relayerAddr);
        pool.proposeRoot(root2, 2);
        vm.prank(operator);
        pool.confirmRoot(root2, 2);

        // Both roots are usable
        assertTrue(pool.knownRoots(root1));
        assertTrue(pool.knownRoots(root2));
        assertEq(pool.currentRoot(), root2);
    }

    /// @dev Propose with processedUpTo == lastProcessedIndex must revert
    function test_proposeRootBoundaryNoProgress() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        // Confirm first root
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);

        // Try to propose with same processedUpTo (no progress)
        vm.prank(relayerAddr);
        vm.expectRevert("No new commitments");
        pool.proposeRoot(bytes32(uint256(0x999)), 1);
    }

    /// @dev Propose with processedUpTo == commitmentCount (exact boundary)
    function test_proposeRootExactBoundary() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        _doDeposit(alice, DEPOSIT_AMOUNT);
        assertEq(pool.commitmentCount(), 2);

        // processedUpTo exactly equals commitmentCount
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 2);

        (bytes32 root, uint256 processedUpTo, bool proposed) = pool.pendingRoot();
        assertEq(root, TEST_ROOT);
        assertEq(processedUpTo, 2);
        assertTrue(proposed);
    }

    /// @dev processedUpTo = commitmentCount + 1 must revert
    function test_proposeRootExceedsBoundary() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        assertEq(pool.commitmentCount(), 1);

        vm.prank(relayerAddr);
        vm.expectRevert("Exceeds commitments");
        pool.proposeRoot(TEST_ROOT, 2);
    }

    // ============================================================
    // setRelayer Tests
    // ============================================================

    function test_setRelayerByRelayer() public {
        address newRelayer = address(0xC0DE);

        vm.prank(relayerAddr);
        pool.setRelayer(newRelayer);

        assertEq(pool.relayer(), newRelayer);
    }

    function test_setRelayerEmitsEvent() public {
        address newRelayer = address(0xC0DE);

        vm.prank(relayerAddr);
        vm.expectEmit(true, true, false, false);
        emit PrivacyPoolV2.RelayerUpdated(relayerAddr, newRelayer);
        pool.setRelayer(newRelayer);
    }

    function test_setRelayerRevertsNonRelayer() public {
        vm.prank(alice);
        vm.expectRevert("Only relayer");
        pool.setRelayer(address(0xC0DE));

        vm.prank(operator);
        vm.expectRevert("Only relayer");
        pool.setRelayer(address(0xC0DE));
    }

    function test_setRelayerRevertsZeroAddress() public {
        vm.prank(relayerAddr);
        vm.expectRevert("Zero address");
        pool.setRelayer(address(0));
    }

    /// @dev After relayer change, old relayer cannot propose, new relayer can
    function test_setRelayerIntegrationWithDualApproval() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        address newRelayer = address(0xC0DE);

        vm.prank(relayerAddr);
        pool.setRelayer(newRelayer);

        // Old relayer cannot propose
        vm.prank(relayerAddr);
        vm.expectRevert("Only relayer");
        pool.proposeRoot(TEST_ROOT, 1);

        // New relayer can propose
        vm.prank(newRelayer);
        pool.proposeRoot(TEST_ROOT, 1);

        (bytes32 root,, bool proposed) = pool.pendingRoot();
        assertEq(root, TEST_ROOT);
        assertTrue(proposed);
    }

    /// @dev Relayer change while proposal pending: old relayer can't cancel
    function test_setRelayerPendingProposalAuth() public {
        _doDeposit(alice, DEPOSIT_AMOUNT);

        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);

        // Change relayer
        address newRelayer = address(0xC0DE);
        vm.prank(relayerAddr);
        pool.setRelayer(newRelayer);

        // Old relayer cannot cancel
        vm.prank(relayerAddr);
        vm.expectRevert("Only relayer or operator");
        pool.cancelProposedRoot();

        // New relayer can cancel
        vm.prank(newRelayer);
        pool.cancelProposedRoot();

        (,, bool proposed) = pool.pendingRoot();
        assertFalse(proposed);
    }

    // ============================================================
    // Helpers
    // ============================================================

    function _mintAndApprove(address user, uint256 amount) internal {
        usdt.mint(user, amount);
        vm.prank(user);
        usdt.approve(address(pool), amount);
    }

    function _doDeposit(address user, uint256 amount) internal {
        _mintAndApprove(user, amount);
        vm.prank(user);
        pool.deposit(TEST_COMMITMENT, amount, hex"");
    }

    function _depositAndSetRoot() internal {
        _doDeposit(alice, DEPOSIT_AMOUNT);
        vm.prank(relayerAddr);
        pool.proposeRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.confirmRoot(TEST_ROOT, 1);
        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);
    }

    /// @dev Full flow: deposit -> updateRoot -> initiateWithdrawal
    function _depositInitiateFlow() internal {
        _depositAndSetRoot();
        bytes32[] memory pi = _buildPublicInputs(TEST_ROOT, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);
    }

    /// @dev Build 6-element public inputs array
    function _buildPublicInputs(
        bytes32 root,
        bytes32 nullifier,
        uint256 amount,
        address recipient,
        bytes32 complianceHash
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory pi = new bytes32[](6);
        pi[0] = root;
        pi[1] = nullifier;
        pi[2] = bytes32(amount);
        pi[3] = bytes32(uint256(uint160(recipient)));
        pi[4] = complianceHash;
        pi[5] = TEST_REGISTRATION_ROOT;
        return pi;
    }
}

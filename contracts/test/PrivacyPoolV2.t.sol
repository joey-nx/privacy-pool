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

// ============================================================
// Dual-mode Tests (privacy + compliance verifiers, operator set)
// ============================================================

contract PrivacyPoolV2DualModeTest is Test {
    PrivacyPoolV2 public pool;
    MockUSDT public usdt;
    MockVerifier public privacyV;
    MockVerifier public complianceV;

    address operator = address(0xBEEF);
    address relayerAddr = address(0xBE1A);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant DEPOSIT_AMOUNT = 1_000_000;

    bytes32 constant TEST_COMMITMENT = bytes32(uint256(0x1234));
    bytes32 constant TEST_NULLIFIER = bytes32(uint256(0x5678));
    bytes32 constant TEST_COMPLIANCE_HASH = bytes32(uint256(0x9ABC));
    bytes32 constant TEST_REGISTRATION_ROOT = bytes32(uint256(0xDEF0));

    function setUp() public {
        privacyV = new MockVerifier();
        complianceV = new MockVerifier();
        usdt = new MockUSDT();
        pool = new PrivacyPoolV2(address(privacyV), address(complianceV), address(usdt), operator, relayerAddr);
    }

    // --- Constructor ---

    function test_constructorSetsImmutables() public view {
        assertEq(address(pool.privacyVerifier()), address(privacyV));
        assertEq(address(pool.complianceVerifier()), address(complianceV));
        assertEq(address(pool.token()), address(usdt));
        assertEq(pool.operator(), operator);
        assertEq(pool.relayer(), relayerAddr);
    }

    function test_constructorInitialState() public view {
        assertEq(pool.totalLeaves(), 0);
        assertEq(pool.currentTreeIndex(), 0);
    }

    function test_constructorRevertsNoVerifier() public {
        vm.expectRevert("No verifier");
        new PrivacyPoolV2(address(0), address(0), address(usdt), operator, relayerAddr);
    }

    function test_constructorRevertsZeroToken() public {
        vm.expectRevert("Zero token");
        new PrivacyPoolV2(address(privacyV), address(complianceV), address(0), operator, relayerAddr);
    }

    function test_constructorRevertsComplianceWithoutOperator() public {
        vm.expectRevert("Compliance requires operator");
        new PrivacyPoolV2(address(privacyV), address(complianceV), address(usdt), address(0), relayerAddr);
    }

    function test_constructorRevertsZeroRelayer() public {
        vm.expectRevert("Zero relayer");
        new PrivacyPoolV2(address(privacyV), address(complianceV), address(usdt), operator, address(0));
    }

    // --- Deposit (on-chain tree) ---

    function test_depositUpdatesTreeAndRoot() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        bytes32 rootBefore = pool.currentRoot();

        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");

        assertEq(pool.totalLeaves(), 1);
        assertTrue(pool.currentRoot() != rootBefore, "Root should change after deposit");
        assertTrue(pool.knownRoots(pool.currentRoot()), "New root should be known");
        assertEq(usdt.balanceOf(address(pool)), DEPOSIT_AMOUNT);
    }

    function test_depositEmitsEvents() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PrivacyPoolV2.Deposit(TEST_COMMITMENT, 0, DEPOSIT_AMOUNT, block.timestamp);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");
    }

    function test_depositRevertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Zero deposit");
        pool.deposit(TEST_COMMITMENT, 0, hex"");
    }

    function test_multipleDepositsProduceDifferentRoots() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(bytes32(uint256(1)), DEPOSIT_AMOUNT, hex"");
        bytes32 root1 = pool.currentRoot();

        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(bytes32(uint256(2)), DEPOSIT_AMOUNT, hex"");
        bytes32 root2 = pool.currentRoot();

        assertTrue(root1 != root2);
        assertTrue(pool.knownRoots(root1), "Historical root should remain known");
        assertTrue(pool.knownRoots(root2));
        assertEq(pool.totalLeaves(), 2);
    }

    function test_rootAvailableImmediatelyAfterDeposit() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        // Root is immediately usable for withdrawal
        bytes32 root = pool.currentRoot();
        assertTrue(pool.knownRoots(root));
    }

    // --- Privacy withdraw (uses on-chain root) ---

    function test_privacyWithdrawAfterDeposit() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        bytes32 root = pool.currentRoot();
        bytes32[] memory pi = _buildPrivacyPI(root, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob);
        pool.withdraw(hex"", pi);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
        assertTrue(pool.nullifiers(TEST_NULLIFIER));
    }

    function test_withdrawRevertsUnknownRoot() public {
        bytes32 fakeRoot = bytes32(uint256(0xDEAD));
        bytes32[] memory pi = _buildPrivacyPI(fakeRoot, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob);
        vm.expectRevert("Unknown root");
        pool.withdraw(hex"", pi);
    }

    function test_withdrawRevertsDuplicateNullifier() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT * 2);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");
        vm.prank(alice);
        pool.deposit(bytes32(uint256(0x9999)), DEPOSIT_AMOUNT, hex"");

        bytes32 root = pool.currentRoot();
        bytes32[] memory pi = _buildPrivacyPI(root, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob);
        pool.withdraw(hex"", pi);

        vm.expectRevert("Nullifier used");
        pool.withdraw(hex"", pi);
    }

    // --- Compliance initiateWithdrawal ---

    function test_complianceWithdrawalFlow() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        bytes32 root = pool.currentRoot();
        bytes32[] memory pi = _buildCompliancePI(root, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);

        (address recipient, uint256 amount,, uint256 deadline, bool completed) = pool.pendingWithdrawals(TEST_NULLIFIER);
        assertEq(recipient, bob);
        assertEq(amount, DEPOSIT_AMOUNT);
        assertEq(deadline, block.timestamp + 24 hours);
        assertFalse(completed);
        assertEq(usdt.balanceOf(bob), 0); // Funds still in pool
    }

    function test_attestWithdrawalTransfersFunds() public {
        _setupComplianceWithdrawal();

        vm.prank(operator);
        pool.attestWithdrawal(TEST_NULLIFIER);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
    }

    function test_claimWithdrawalAfterTimeout() public {
        _setupComplianceWithdrawal();

        vm.warp(block.timestamp + 24 hours);
        pool.claimWithdrawal(TEST_NULLIFIER);

        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
    }

    function test_claimWithdrawalRevertsBeforeTimeout() public {
        _setupComplianceWithdrawal();

        vm.expectRevert("Window active");
        pool.claimWithdrawal(TEST_NULLIFIER);
    }

    // --- Registration ---

    function test_updateRegistrationRoot() public {
        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        assertEq(pool.currentRegistrationRoot(), TEST_REGISTRATION_ROOT);
        assertTrue(pool.knownRegistrationRoots(TEST_REGISTRATION_ROOT));
    }

    function test_updateRegistrationRootRevertsNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Only operator");
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);
    }

    // --- Verifier failure ---

    function test_withdrawRevertsIfVerifierFails() public {
        RevertingVerifier rv = new RevertingVerifier();
        PrivacyPoolV2 rvPool = new PrivacyPoolV2(address(rv), address(complianceV), address(usdt), operator, relayerAddr);

        usdt.mint(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        usdt.approve(address(rvPool), DEPOSIT_AMOUNT);
        vm.prank(alice);
        rvPool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        bytes32 root = rvPool.currentRoot();
        bytes32[] memory pi = _buildPrivacyPI(root, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob);
        vm.expectRevert("proof invalid");
        rvPool.withdraw(hex"", pi);
    }

    // --- setRelayer ---

    function test_setRelayerByRelayer() public {
        address newRelayer = address(0xC0DE);
        vm.prank(relayerAddr);
        pool.setRelayer(newRelayer);
        assertEq(pool.relayer(), newRelayer);
    }

    // --- Gas measurement ---

    function test_depositGas() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);

        uint256 gasBefore = gasleft();
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"cafe");
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("deposit gas (with on-chain tree)", gasUsed);
    }

    // --- Helpers ---

    function _mintAndApprove(address user, uint256 amount) internal {
        usdt.mint(user, amount);
        vm.prank(user);
        usdt.approve(address(pool), amount);
    }

    function _setupComplianceWithdrawal() internal {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        vm.prank(operator);
        pool.updateRegistrationRoot(TEST_REGISTRATION_ROOT);

        bytes32 root = pool.currentRoot();
        bytes32[] memory pi = _buildCompliancePI(root, TEST_NULLIFIER, DEPOSIT_AMOUNT, bob, TEST_COMPLIANCE_HASH);
        pool.initiateWithdrawal(hex"", pi);
    }

    function _buildPrivacyPI(bytes32 root, bytes32 nullifier, uint256 amount, address recipient)
        internal pure returns (bytes32[] memory)
    {
        bytes32[] memory pi = new bytes32[](4);
        pi[0] = root;
        pi[1] = nullifier;
        pi[2] = bytes32(amount);
        pi[3] = bytes32(uint256(uint160(recipient)));
        return pi;
    }

    function _buildCompliancePI(
        bytes32 root, bytes32 nullifier, uint256 amount, address recipient, bytes32 complianceHash
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

// ============================================================
// Privacy-Only Mode Tests (no compliance verifier, no operator)
// ============================================================

contract PrivacyPoolV2PrivacyOnlyTest is Test {
    PrivacyPoolV2 public pool;
    MockUSDT public usdt;
    MockVerifier public privacyV;

    address relayerAddr = address(0xBE1A);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant DEPOSIT_AMOUNT = 1_000_000;

    bytes32 constant TEST_COMMITMENT = bytes32(uint256(0x1234));
    bytes32 constant TEST_NULLIFIER = bytes32(uint256(0x5678));

    function setUp() public {
        privacyV = new MockVerifier();
        usdt = new MockUSDT();
        pool = new PrivacyPoolV2(address(privacyV), address(0), address(usdt), address(0), relayerAddr);
    }

    function test_privacyOnlyConfig() public view {
        assertEq(address(pool.privacyVerifier()), address(privacyV));
        assertEq(address(pool.complianceVerifier()), address(0));
        assertEq(pool.operator(), address(0));
    }

    function test_depositAndWithdrawImmediate() public {
        _mintAndApprove(alice, DEPOSIT_AMOUNT);
        vm.prank(alice);
        pool.deposit(TEST_COMMITMENT, DEPOSIT_AMOUNT, hex"");

        bytes32 root = pool.currentRoot();
        bytes32[] memory pi = new bytes32[](4);
        pi[0] = root;
        pi[1] = TEST_NULLIFIER;
        pi[2] = bytes32(DEPOSIT_AMOUNT);
        pi[3] = bytes32(uint256(uint160(bob)));

        pool.withdraw(hex"", pi);
        assertEq(usdt.balanceOf(bob), DEPOSIT_AMOUNT);
    }

    function test_initiateWithdrawalRevertsNoComplianceVerifier() public {
        bytes32[] memory pi = new bytes32[](6);
        vm.expectRevert("Compliance verifier not set");
        pool.initiateWithdrawal(hex"", pi);
    }

    function test_updateRegistrationRootRevertsNoOperator() public {
        vm.expectRevert("No operator");
        pool.updateRegistrationRoot(bytes32(uint256(0xDEF0)));
    }

    function _mintAndApprove(address user, uint256 amount) internal {
        usdt.mint(user, amount);
        vm.prank(user);
        usdt.approve(address(pool), amount);
    }
}

// ============================================================
// On-chain Tree Tests
// ============================================================

contract MerkleTreeTest is Test {
    PrivacyPoolV2 public pool;
    MockUSDT public usdt;
    MockVerifier public privacyV;

    address relayerAddr = address(0xBE1A);
    address alice = address(0xA11CE);

    function setUp() public {
        privacyV = new MockVerifier();
        usdt = new MockUSDT();
        pool = new PrivacyPoolV2(address(privacyV), address(0), address(usdt), address(0), relayerAddr);
    }

    function test_treeDepthAndMaxLeaves() public view {
        assertEq(pool.TREE_DEPTH(), 20);
        assertEq(pool.MAX_LEAVES(), 1 << 20);
    }

    function test_consecutiveDepositsProduceDifferentRoots() public {
        bytes32[] memory roots = new bytes32[](5);
        for (uint256 i = 0; i < 5; i++) {
            usdt.mint(alice, 100);
            vm.prank(alice);
            usdt.approve(address(pool), 100);
            vm.prank(alice);
            pool.deposit(bytes32(uint256(i + 1)), 100, hex"");
            roots[i] = pool.currentRoot();
        }

        // All roots must be different
        for (uint256 i = 0; i < 4; i++) {
            for (uint256 j = i + 1; j < 5; j++) {
                assertTrue(roots[i] != roots[j], "Roots must differ");
            }
        }

        // All roots remain known
        for (uint256 i = 0; i < 5; i++) {
            assertTrue(pool.knownRoots(roots[i]), "Historical root must be known");
        }

        assertEq(pool.totalLeaves(), 5);
    }

    function test_historicalRootUsableForWithdrawal() public {
        // Deposit 1
        usdt.mint(alice, 100);
        vm.prank(alice);
        usdt.approve(address(pool), 100);
        vm.prank(alice);
        pool.deposit(bytes32(uint256(0x1111)), 100, hex"");
        bytes32 root1 = pool.currentRoot();

        // Deposit 2 (changes root)
        usdt.mint(alice, 100);
        vm.prank(alice);
        usdt.approve(address(pool), 100);
        vm.prank(alice);
        pool.deposit(bytes32(uint256(0x2222)), 100, hex"");

        // root1 is still usable
        assertTrue(pool.knownRoots(root1), "Old root should still be valid");
    }

    function test_remainingCapacity() public view {
        assertEq(pool.remainingCapacity(), 1 << 20);
    }
}

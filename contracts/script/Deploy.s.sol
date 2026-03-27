// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/UltraVerifier.sol";
import "../src/PrivacyPoolV2.sol";

/// @notice Deploy Verifier + PrivacyPoolV2 with on-chain Merkle tree.
contract Deploy is Script {
    /// @dev CROSSD token on CROSS Testnet (already deployed, 18 decimals)
    address constant CROSSD = 0x9364ea6790f6E0EcFaa5164085f2a7de34EC55Fb;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address operatorAddr = vm.envAddress("OPERATOR_ADDRESS");
        address relayerAddr = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // Deploy separate verifiers for privacy and compliance circuits
        // TODO: replace with circuit-specific verifiers once compiled
        HonkVerifier verifier = new HonkVerifier();
        PrivacyPoolV2 pool = new PrivacyPoolV2(
            address(verifier),  // privacyVerifier
            address(verifier),  // complianceVerifier
            CROSSD,
            operatorAddr,
            relayerAddr
        );

        vm.stopBroadcast();

        console.log("PRIVACY_VERIFIER=%s", address(verifier));
        console.log("COMPLIANCE_VERIFIER=%s", address(verifier));
        console.log("TOKEN=%s", CROSSD);
        console.log("POOL=%s", address(pool));
    }
}

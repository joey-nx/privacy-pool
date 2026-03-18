// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/UltraVerifier.sol";

contract VerifierTest is Test {
    HonkVerifier public verifier;

    function setUp() public {
        verifier = new HonkVerifier();
    }

    /// @notice Load public inputs from binary file as bytes32[]
    function _loadPublicInputs() internal view returns (bytes32[] memory) {
        bytes memory raw = vm.readFileBinary("../circuits/target/proof/public_inputs");
        uint256 count = raw.length / 32;
        bytes32[] memory inputs = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 val;
            assembly {
                val := mload(add(raw, add(32, mul(i, 32))))
            }
            inputs[i] = val;
        }
        return inputs;
    }

    /// @notice Valid proof should verify successfully
    function test_validProofVerifies() public view {
        bytes memory proof = vm.readFileBinary("../circuits/target/proof/proof");
        bytes32[] memory publicInputs = _loadPublicInputs();

        bool result = verifier.verify(proof, publicInputs);
        assertTrue(result, "Valid proof should verify");
    }

    /// @notice Tampered proof should revert
    function test_tamperedProofReverts() public {
        bytes memory proof = vm.readFileBinary("../circuits/target/proof/proof");
        bytes32[] memory publicInputs = _loadPublicInputs();

        // Tamper with the proof (flip a byte)
        proof[100] = bytes1(uint8(proof[100]) ^ 0xff);

        vm.expectRevert();
        verifier.verify(proof, publicInputs);
    }

    /// @notice Wrong public inputs should revert
    function test_wrongPublicInputsReverts() public {
        bytes memory proof = vm.readFileBinary("../circuits/target/proof/proof");
        bytes32[] memory publicInputs = _loadPublicInputs();

        // Tamper with a public input (change the first byte of expected_root)
        publicInputs[0] = bytes32(uint256(publicInputs[0]) ^ 1);

        vm.expectRevert();
        verifier.verify(proof, publicInputs);
    }
}

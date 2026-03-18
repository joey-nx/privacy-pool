/**
 * Contract ABIs for PrivacyPoolV2 and ERC20.
 *
 * Matches contracts/src/PrivacyPoolV2.sol
 */

export const POOL_ABI = [
  // --- Write ---
  "function deposit(bytes32 commitment, uint256 amount, bytes calldata encryptedNote) external",
  "function initiateWithdrawal(bytes calldata proof, bytes32[] calldata publicInputs) external",
  "function claimWithdrawal(bytes32 nullifier) external",

  // --- Read ---
  "function commitmentCount() view returns (uint256)",
  "function commitments(uint256) view returns (bytes32)",
  "function currentRoot() view returns (bytes32)",
  "function lastProcessedIndex() view returns (uint256)",
  "function knownRoots(bytes32) view returns (bool)",
  "function nullifiers(bytes32) view returns (bool)",
  "function pendingWithdrawals(bytes32) view returns (address recipient, uint256 amount, bytes32 complianceHash, uint256 deadline, bool completed)",
  "function token() view returns (address)",
  "function operator() view returns (address)",
  "function relayer() view returns (address)",
  "function ATTESTATION_WINDOW() view returns (uint256)",

  // --- Events ---
  "event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp)",
  "event EncryptedNote(uint256 indexed leafIndex, bytes encryptedNote)",
  "event RootUpdated(bytes32 indexed newRoot, uint256 processedUpTo)",
  "event WithdrawalInitiated(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bytes32 complianceHash)",
  "event WithdrawalAttested(bytes32 indexed nullifier)",
  "event WithdrawalClaimed(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bool attested)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

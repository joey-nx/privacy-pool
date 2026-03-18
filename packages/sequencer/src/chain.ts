/**
 * Chain synchronization: deposit fetching, root submission, reorg detection.
 *
 * Dual-trigger batch strategy:
 *   - Count trigger: submit when `batchSize` deposits accumulate
 *   - Time trigger: submit after `batchTimeout`ms with >= 1 pending deposit
 */

import { ethers } from "ethers";
import { IncrementalMerkleTree } from "./tree.js";
import { Store } from "./store.js";
import type { SequencerConfig, SyncState } from "./types.js";

// Minimal ABI for PrivacyPoolV2
export const POOL_ABI = [
  "event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp)",
  "event EncryptedNote(uint256 indexed leafIndex, bytes encryptedNote)",
  "event WithdrawalInitiated(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bytes32 complianceHash)",
  "event WithdrawalAttested(bytes32 indexed nullifier)",
  "event WithdrawalClaimed(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bool attested)",
  "function commitmentCount() view returns (uint256)",
  "function commitments(uint256) view returns (bytes32)",
  "function lastProcessedIndex() view returns (uint256)",
  "function currentRoot() view returns (bytes32)",
  "function relayer() view returns (address)",
  "function operator() view returns (address)",
  "function proposeRoot(bytes32 newRoot, uint256 processedUpTo) external",
  "function confirmRoot(bytes32 expectedRoot, uint256 expectedProcessedUpTo) external",
  "function pendingRoot() view returns (bytes32 root, uint256 processedUpTo, bool proposed)",
  "function attestWithdrawal(bytes32 nullifier) external",
  "function updateRegistrationRoot(bytes32 newRoot) external",
];

export interface ChainSyncState {
  lastProcessedIndex: number;
  pendingDeposits: number;
  lastBatchTime: number;
}

export class ChainSync {
  readonly provider: ethers.JsonRpcProvider;
  readonly wallet: ethers.Wallet;
  readonly contract: ethers.Contract;
  private readonly config: SequencerConfig;

  syncState: ChainSyncState;

  constructor(
    config: SequencerConfig,
    private readonly tree: IncrementalMerkleTree,
    private readonly store: Store,
  ) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpc);

    // Force legacy (type 0) transactions — some chains (e.g. CROSS Testnet)
    // reject EIP-1559 txs with insufficient maxPriorityFeePerGas.
    const origGetFeeData = this.provider.getFeeData.bind(this.provider);
    this.provider.getFeeData = async () => {
      const fee = await origGetFeeData();
      const gasPrice = fee.gasPrice ?? 2_000_000_000n;
      return new ethers.FeeData(gasPrice);
    };

    this.wallet = new ethers.Wallet(config.relayerKey, this.provider);
    this.contract = new ethers.Contract(config.pool, POOL_ABI, this.wallet);
    this.syncState = {
      lastProcessedIndex: 0,
      pendingDeposits: 0,
      lastBatchTime: Date.now(),
    };
  }

  /** Fetch and insert new commitments from the contract. */
  async syncCommitments(): Promise<number> {
    const onChainCount = Number(await this.contract.commitmentCount());
    const localCount = this.tree.leafCount;

    if (onChainCount <= localCount) return 0;

    let newCount = 0;
    for (let i = localCount; i < onChainCount; i++) {
      const commitment: string = await this.contract.commitments(i);
      this.tree.insert(BigInt(commitment));
      newCount++;
    }

    if (newCount > 0) {
      this.syncState.pendingDeposits += newCount;
      console.log(
        `[chain] Synced ${newCount} commitments (total: ${this.tree.leafCount})`,
      );
    }

    return newCount;
  }

  /** Submit the current root to the contract if batch conditions are met. */
  async maybeSubmitRoot(force: boolean = false): Promise<boolean> {
    if (this.syncState.pendingDeposits === 0) return false;

    const countTrigger = this.syncState.pendingDeposits >= this.config.batchSize;
    const elapsed = Date.now() - this.syncState.lastBatchTime;
    const timeTrigger = elapsed >= this.config.batchTimeout;

    if (!force && !countTrigger && !timeTrigger) return false;

    return this.submitRoot();
  }

  /** Check if a pending root exists on-chain (awaiting operator confirmation). */
  async hasPendingRoot(): Promise<boolean> {
    try {
      const [, , proposed] = await this.contract.pendingRoot();
      return proposed;
    } catch {
      return false;
    }
  }

  /** Force submit root to the contract. */
  async submitRoot(): Promise<boolean> {
    const processedUpTo = this.tree.leafCount;
    if (processedUpTo <= this.syncState.lastProcessedIndex) return false;

    // Skip if a pending root is already waiting for operator confirmation
    if (await this.hasPendingRoot()) {
      console.log("[chain] Pending root exists, skipping proposal (awaiting operator confirmation)");
      return false;
    }

    const rootHex =
      "0x" + this.tree.root.toString(16).padStart(64, "0");

    console.log(
      `[chain] Submitting root (leaves: ${processedUpTo}, pending: ${this.syncState.pendingDeposits})...`,
    );

    try {
      const tx = await this.contract.proposeRoot(rootHex, processedUpTo);
      const receipt = await tx.wait();
      this.syncState.lastProcessedIndex = processedUpTo;
      this.syncState.pendingDeposits = 0;
      this.syncState.lastBatchTime = Date.now();
      console.log(`[chain] Root proposed (tx: ${receipt.hash}, awaiting operator confirmation)`);

      // Persist state
      this.persistState();
      return true;
    } catch (err: any) {
      console.error(`[chain] Failed to submit root: ${err.message}`);
      // Sync local state with on-chain to avoid retry loops
      // (e.g. "No new commitments" means contract already processed these)
      await this.resyncProcessedIndex();
      return false;
    }
  }

  /** Re-read on-chain lastProcessedIndex and reconcile local state. */
  async resyncProcessedIndex(): Promise<void> {
    try {
      const onChain = Number(await this.contract.lastProcessedIndex());
      if (onChain > this.syncState.lastProcessedIndex) {
        console.log(
          `[chain] Resynced lastProcessedIndex: ${this.syncState.lastProcessedIndex} → ${onChain}`,
        );
        this.syncState.lastProcessedIndex = onChain;
        // Recalculate pending: only leaves beyond what the contract processed
        this.syncState.pendingDeposits = Math.max(
          0,
          this.tree.leafCount - onChain,
        );
        this.syncState.lastBatchTime = Date.now();
        this.persistState();
      }
    } catch (e: any) {
      console.error(`[chain] resyncProcessedIndex failed: ${e.message}`);
    }
  }

  /** Initialize sync state from on-chain data or persisted state. */
  async initialize(persistedSync?: SyncState): Promise<void> {
    const onChainLastProcessed = Number(
      await this.contract.lastProcessedIndex(),
    );

    if (persistedSync) {
      this.syncState.lastProcessedIndex = persistedSync.lastProcessedIndex;
      console.log(
        `[chain] Restored sync state (lastProcessed: ${persistedSync.lastProcessedIndex})`,
      );

      // Check for gap between persisted and on-chain
      if (onChainLastProcessed > persistedSync.lastProcessedIndex) {
        console.log(
          `[chain] On-chain ahead (${onChainLastProcessed} vs ${persistedSync.lastProcessedIndex}), using on-chain`,
        );
        this.syncState.lastProcessedIndex = onChainLastProcessed;
      }
    } else {
      this.syncState.lastProcessedIndex = onChainLastProcessed;
      console.log(
        `[chain] On-chain lastProcessedIndex: ${onChainLastProcessed}`,
      );
    }

    this.syncState.lastBatchTime = Date.now();
  }

  /** Persist tree + sync state to disk. */
  persistState(): void {
    this.store.saveState({
      tree: this.tree.export(),
      sync: {
        lastSyncedBlock: 0, // Updated by scanner
        lastProcessedIndex: this.syncState.lastProcessedIndex,
      },
    });
  }
}

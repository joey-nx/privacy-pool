/**
 * Operator Service — attestation processing + compliance data decryption.
 *
 * Watches WithdrawalInitiated events, manages a pending withdrawal queue,
 * and provides manual/auto attestation.
 *
 * Security: operator endpoints require --operator-key to be configured.
 * Auto-attest mode (--auto-attest) is for testnet only.
 */

import { ethers } from "ethers";
import { decryptNote, decryptOperatorNote, computeComplianceHash, addressToField, REGISTRATION_DEPTH } from "./crypto.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import { IncrementalMerkleTree } from "./tree.js";
import { Store } from "./store.js";
import type { MerkleProof, PendingWithdrawalInfo, RegisteredUser, StoredEncryptedNote, WithdrawalStatus, ComplianceVerificationResult } from "./types.js";

export class OperatorService {
  private withdrawals: Map<string, PendingWithdrawalInfo> = new Map();
  private operatorWallet: ethers.Wallet | null = null;
  private autoAttest: boolean = false;
  private lastWithdrawalScannedBlock: number = 0;

  // KYC DB: address (lowercase) → RegisteredUser
  private usersByAddress: Map<string, RegisteredUser> = new Map();
  // KYC DB: npk → RegisteredUser (for recipient lookup)
  private usersByNpk: Map<string, RegisteredUser> = new Map();

  // Registration tree: NPK Merkle tree (depth 16, in-memory only)
  private registrationTree: IncrementalMerkleTree = new IncrementalMerkleTree(REGISTRATION_DEPTH);
  // NPK (string) → leaf index in registration tree
  private npkToLeafIndex: Map<string, number> = new Map();

  // Operator secrets: deposit leafIndex → decrypted secret (memory-only, never persisted)
  private operatorSecrets: Map<number, bigint> = new Map();

  constructor(
    private readonly contract: ethers.Contract,
    private readonly store: Store,
    private readonly provider: ethers.JsonRpcProvider,
  ) {}

  /** Initialize with operator key and auto-attest config. */
  async init(operatorKey?: string, autoAttest: boolean = false): Promise<void> {
    if (operatorKey) {
      this.operatorWallet = new ethers.Wallet(operatorKey, this.provider);
      console.log(
        `[operator] Initialized (address: ${this.operatorWallet.address}, auto-attest: ${autoAttest})`,
      );
    } else {
      console.log("[operator] No operator key provided — operator features disabled");
    }

    this.autoAttest = autoAttest;

    // Load persisted withdrawals
    const persisted = this.store.loadWithdrawals();
    for (const w of persisted) {
      this.withdrawals.set(w.nullifier, w);
    }
    if (persisted.length > 0) {
      this.lastWithdrawalScannedBlock = Math.max(
        ...persisted.filter((w) => w.initiatedAt).map((w) => w.initiatedAt!),
        0,
      );
      console.log(`[operator] Loaded ${persisted.length} withdrawals from disk (last block: ${this.lastWithdrawalScannedBlock})`);
    } else {
      // No prior withdrawals: start scanning from current block to avoid genesis query
      this.lastWithdrawalScannedBlock = await this.provider.getBlockNumber();
    }

    // Load persisted users and rebuild registration tree
    const users = this.store.loadUsers();
    for (const u of users) {
      this.usersByAddress.set(u.address.toLowerCase(), u);
      this.usersByNpk.set(u.npk, u);
      // Rebuild registration tree in insertion order
      const leafIndex = this.registrationTree.leafCount;
      this.registrationTree.insert(BigInt(u.npk));
      this.npkToLeafIndex.set(u.npk, leafIndex);
    }
    if (users.length > 0) {
      const rootHex = "0x" + this.registrationTree.root.toString(16).padStart(64, "0");
      console.log(
        `[operator] Rebuilt registration tree from ${users.length} users (root: ${rootHex})`,
      );
      // Submit rebuilt root on-chain to ensure consistency after restart
      await this.submitRegistrationRoot();
    }
  }

  get isEnabled(): boolean {
    return this.operatorWallet !== null;
  }

  /** Scan for new WithdrawalInitiated events. */
  async scanWithdrawals(fromBlock?: number, notes?: StoredEncryptedNote[]): Promise<number> {
    if (!this.isEnabled) return 0;

    const startBlock = fromBlock ?? (this.lastWithdrawalScannedBlock > 0 ? this.lastWithdrawalScannedBlock + 1 : 0);
    const filter = this.contract.filters.WithdrawalInitiated();
    let events: ethers.EventLog[];
    try {
      const rawEvents = await this.contract.queryFilter(filter, startBlock);
      events = rawEvents.filter(
        (e): e is ethers.EventLog => e instanceof ethers.EventLog,
      );
    } catch (err: any) {
      console.error(`[operator] Failed to query events: ${err.message}`);
      return 0;
    }

    // Batch-fetch block timestamps for new events
    const newEventsList = events.filter((e) => !this.withdrawals.has(e.args[0] as string));
    const blockNumbers = new Set(newEventsList.map((e) => e.blockNumber));
    const blockTimestamps = new Map<number, number>();
    await Promise.all(
      Array.from(blockNumbers).map(async (bn) => {
        try {
          const block = await this.provider.getBlock(bn);
          if (block) blockTimestamps.set(bn, block.timestamp * 1000);
        } catch { /* ignore */ }
      }),
    );

    let newCount = 0;
    for (const event of events) {
      const nullifier = event.args[0] as string;
      if (this.withdrawals.has(nullifier)) continue;

      const recipient = event.args[1] as string;
      const amount = (event.args[2] as bigint).toString();
      const complianceHash = event.args[3] as string;

      const info: PendingWithdrawalInfo = {
        nullifier,
        recipient,
        amount,
        complianceHash,
        deadline: 0, // Will be read from contract if needed
        status: "pending",
        initiatedAt: event.blockNumber,
        txHash: event.transactionHash,
        timestamp: blockTimestamps.get(event.blockNumber),
      };

      this.withdrawals.set(nullifier, info);
      newCount++;

      console.log(
        `[compliance] Withdrawal detected | nullifier=${nullifier} recipient=${recipient} amount=${amount} complianceHash=${complianceHash} block=${event.blockNumber} tx=${event.transactionHash}`,
      );

      if (this.autoAttest) {
        const verification = this.verifyCompliance(info, notes);
        if (verification.result === "verified") {
          console.log(`[operator] Auto-attesting ${nullifier} (compliance verified, leaf=${verification.leafIndex})...`);
          await this.attest(nullifier, notes);
        } else {
          console.warn(
            `[compliance] Auto-attest BLOCKED for ${nullifier} | reason=${verification.result}`,
          );
        }
      }
    }

    if (events.length > 0) {
      this.lastWithdrawalScannedBlock = Math.max(
        ...events.map((e) => e.blockNumber),
      );
    }

    if (newCount > 0) {
      this.persist();
      console.log(`[operator] Found ${newCount} new withdrawals (total: ${this.withdrawals.size})`);
    }

    return newCount;
  }

  /** Attest a pending withdrawal. Requires compliance verification to pass. */
  async attest(nullifier: string, notes?: StoredEncryptedNote[]): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.operatorWallet) {
      return { success: false, error: "Operator not configured" };
    }

    const info = this.withdrawals.get(nullifier);
    if (!info) {
      return { success: false, error: "Withdrawal not found" };
    }
    if (info.status !== "pending") {
      return { success: false, error: `Withdrawal status is '${info.status}', not 'pending'` };
    }

    // Compliance gate: verify complianceHash before attesting
    const verification = this.verifyCompliance(info, notes);
    if (verification.result !== "verified") {
      console.warn(
        `[compliance] Attest REJECTED for ${nullifier} | reason=${verification.result}`,
      );
      return { success: false, error: `Compliance verification failed: ${verification.result}` };
    }

    console.log(
      `[compliance] Attesting withdrawal | nullifier=${nullifier} recipient=${info.recipient} amount=${info.amount} leaf=${verification.leafIndex}`,
    );

    try {
      const operatorContract = this.contract.connect(this.operatorWallet) as ethers.Contract;
      const tx = await operatorContract.attestWithdrawal(nullifier);
      const receipt = await tx.wait();

      info.status = "attested";
      this.persist();
      console.log(`[operator] Attested ${nullifier} (tx: ${receipt.hash})`);

      return { success: true, txHash: receipt.hash };
    } catch (err: any) {
      console.error(`[operator] Attestation failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /** Get operator's ECIES encryption public key (compressed, hex). */
  getEncPubKey(): string | null {
    if (!this.operatorWallet) return null;
    const privKey = hexToBytes(this.operatorWallet.privateKey);
    const pubKey = secp256k1.getPublicKey(privKey, true);
    return "0x" + Buffer.from(pubKey).toString("hex");
  }

  /** Decrypt operator note to recover the secret field. */
  decryptOperatorSecret(
    ciphertext: Uint8Array,
    ephemeralPubKey: Uint8Array,
    mac: Uint8Array,
  ): bigint | null {
    if (!this.operatorWallet) return null;

    try {
      const operatorPrivKey = hexToBytes(this.operatorWallet.privateKey);
      return decryptOperatorNote(operatorPrivKey, ciphertext, ephemeralPubKey, mac);
    } catch (err: any) {
      console.error(`[operator] Operator note decryption failed: ${err.message}`);
      return null;
    }
  }

  /** Decrypt compliance data using the operator's ECIES key. */
  decryptCompliance(
    ciphertext: Uint8Array,
    ephemeralPubKey: Uint8Array,
    mac: Uint8Array,
  ): { depositor: bigint; amount: bigint; blockNumber: bigint; secret: bigint } | null {
    if (!this.operatorWallet) return null;

    try {
      const operatorPrivKey = hexToBytes(this.operatorWallet.privateKey);
      const result = decryptNote(operatorPrivKey, ciphertext, ephemeralPubKey, mac);

      const depositorHex = "0x" + (result.depositor & ((1n << 160n) - 1n)).toString(16).padStart(40, "0");
      console.log(
        `[compliance] Compliance decrypted | depositor=${depositorHex} amount=${result.amount} blockNumber=${result.blockNumber}`,
      );

      return result;
    } catch (err: any) {
      console.error(`[operator] Decryption failed: ${err.message}`);
      return null;
    }
  }

  /** Get all withdrawals. */
  getWithdrawals(): PendingWithdrawalInfo[] {
    return Array.from(this.withdrawals.values());
  }

  /** Get withdrawals by status. */
  getWithdrawalsByStatus(status: WithdrawalStatus): PendingWithdrawalInfo[] {
    return this.getWithdrawals().filter((w) => w.status === status);
  }

  /** Get a specific withdrawal by nullifier. */
  getWithdrawal(nullifier: string): PendingWithdrawalInfo | undefined {
    return this.withdrawals.get(nullifier);
  }

  /** Update withdrawal status (used when monitoring Claimed events). */
  updateStatus(nullifier: string, status: WithdrawalStatus): void {
    const info = this.withdrawals.get(nullifier);
    if (info) {
      info.status = status;
      this.persist();
    }
  }

  // ============================================================
  // KYC User Registration
  // ============================================================

  /** Register a KYC-verified user. Inserts NPK into registration tree and submits root on-chain. */
  async registerUser(
    address: string,
    npk: string,
    encPubKey: string,
  ): Promise<{ success: boolean; registrationRoot?: string; error?: string }> {
    const key = address.toLowerCase();

    const existingByAddress = this.usersByAddress.get(key);
    if (existingByAddress) {
      if (existingByAddress.npk === npk) {
        return { success: false, error: "Address already registered" };
      }
      // NPK changed (e.g. cache cleared, re-derived keys) — update registration
      console.log(
        `[operator] NPK changed for ${address}, updating registration (old: ${existingByAddress.npk.slice(0, 10)}..., new: ${npk.slice(0, 10)}...)`,
      );
      this.usersByNpk.delete(existingByAddress.npk);
      // Old leaf in tree is orphaned but harmless — tree is append-only
    } else if (this.usersByNpk.has(npk)) {
      return { success: false, error: "NPK already registered" };
    }

    const user: RegisteredUser = {
      address: ethers.getAddress(address), // checksummed
      npk,
      encPubKey,
      registeredAt: Date.now(),
    };

    this.usersByAddress.set(key, user);
    this.usersByNpk.set(npk, user);

    // Insert NPK into registration tree
    const leafIndex = this.registrationTree.leafCount;
    this.registrationTree.insert(BigInt(npk));
    this.npkToLeafIndex.set(npk, leafIndex);

    this.persistUsers();

    const rootHex = "0x" + this.registrationTree.root.toString(16).padStart(64, "0");
    console.log(
      `[operator] Registered user ${user.address} (npk: ${npk.slice(0, 10)}..., leaf: ${leafIndex}, root: ${rootHex})`,
    );

    // Submit registration root on-chain
    await this.submitRegistrationRoot();

    return { success: true, registrationRoot: rootHex };
  }

  /** Check if an address is registered. */
  isAddressRegistered(address: string): boolean {
    return this.usersByAddress.has(address.toLowerCase());
  }

  /** Check if an NPK is registered. */
  isNpkRegistered(npk: string): boolean {
    return this.usersByNpk.has(npk);
  }

  /** Get user by address. */
  getUser(address: string): RegisteredUser | undefined {
    return this.usersByAddress.get(address.toLowerCase());
  }

  /** Get all registered users. */
  getUsers(): RegisteredUser[] {
    return Array.from(this.usersByAddress.values());
  }

  // ============================================================
  // Registration Tree
  // ============================================================

  /** Get the current registration tree root. */
  getRegistrationRoot(): { root: string; leafCount: number } {
    return {
      root: this.registrationTree.root.toString(),
      leafCount: this.registrationTree.leafCount,
    };
  }

  /** Get a registration Merkle proof for the given NPK. */
  getRegistrationProof(npk: string): MerkleProof | null {
    const leafIndex = this.npkToLeafIndex.get(npk);
    if (leafIndex === undefined) return null;
    return this.registrationTree.getProof(leafIndex);
  }

  /** Confirm a pending root on-chain (dual-approval: relayer proposes, operator confirms). */
  async confirmRoot(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.operatorWallet) {
      return { success: false, error: "Operator not configured" };
    }

    try {
      const operatorContract = this.contract.connect(this.operatorWallet) as ethers.Contract;
      const pending = await operatorContract.pendingRoot();
      const [root, processedUpTo, proposed] = pending;

      if (!proposed) {
        return { success: false, error: "No pending root to confirm" };
      }

      console.log(
        `[operator] Confirming root (root: ${root}, processedUpTo: ${processedUpTo}, operator: ${this.operatorWallet.address})`,
      );

      // Verify on-chain operator address matches before sending tx
      const onChainOperator = await this.contract.operator();
      if (onChainOperator.toLowerCase() !== this.operatorWallet.address.toLowerCase()) {
        return { success: false, error: `Operator mismatch: contract=${onChainOperator}, wallet=${this.operatorWallet.address}` };
      }

      const tx = await operatorContract.confirmRoot(root, processedUpTo);
      const receipt = await tx.wait();
      console.log(
        `[operator] Root confirmed on-chain (root: ${root}, processedUpTo: ${processedUpTo}, tx: ${receipt.hash})`,
      );

      return { success: true, txHash: receipt.hash };
    } catch (err: any) {
      console.error(`[operator] confirmRoot failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /** Submit the current registration root on-chain via updateRegistrationRoot(). */
  private async submitRegistrationRoot(): Promise<void> {
    if (!this.operatorWallet) {
      console.log("[operator] No operator wallet — skipping registration root submission");
      return;
    }

    const rootHex = "0x" + this.registrationTree.root.toString(16).padStart(64, "0");

    try {
      const operatorContract = this.contract.connect(this.operatorWallet) as ethers.Contract;
      const tx = await operatorContract.updateRegistrationRoot(rootHex);
      const receipt = await tx.wait();
      console.log(`[operator] Registration root submitted on-chain (tx: ${receipt.hash})`);
    } catch (err: any) {
      console.error(`[operator] Failed to submit registration root: ${err.message}`);
    }
  }

  // ============================================================
  // Compliance Verification
  // ============================================================

  /**
   * Verify complianceHash by recomputing H(depositor, recipient, amount, secret)
   * against all known operator secrets until a match is found.
   *
   * Iterates (leafIndex, secret) pairs. For each, looks up depositor from notes.
   * If H(depositor, recipient, amount, secret) == on-chain complianceHash → verified.
   */
  verifyCompliance(
    withdrawal: PendingWithdrawalInfo,
    notes?: StoredEncryptedNote[],
  ): ComplianceVerificationResult {
    if (this.operatorSecrets.size === 0) {
      return { result: "no_secret" };
    }

    const onChainHash = BigInt(withdrawal.complianceHash);
    const recipient = addressToField(withdrawal.recipient);
    const amount = BigInt(withdrawal.amount);

    // Build leafIndex → depositor lookup from notes
    const depositorByLeaf = new Map<number, string>();
    if (notes) {
      for (const note of notes) {
        if (note.depositor) {
          depositorByLeaf.set(note.leafIndex, note.depositor);
        }
      }
    }

    for (const [leafIndex, secret] of this.operatorSecrets) {
      const depositorAddr = depositorByLeaf.get(leafIndex);
      if (!depositorAddr) continue;

      const depositor = addressToField(depositorAddr);
      const computed = computeComplianceHash(depositor, recipient, amount, secret);

      if (computed === onChainHash) {
        return { result: "verified", leafIndex };
      }
    }

    // Check if we had any depositor data at all
    let hasAnyDepositor = false;
    for (const [leafIndex] of this.operatorSecrets) {
      if (depositorByLeaf.has(leafIndex)) {
        hasAnyDepositor = true;
        break;
      }
    }

    if (!hasAnyDepositor) {
      return { result: "no_depositor" };
    }

    return { result: "mismatch" };
  }

  /**
   * Rebuild operator secrets from persisted notes (used after restart).
   * Re-decrypts operator notes to recover secrets into memory.
   */
  rebuildSecrets(notes: StoredEncryptedNote[]): void {
    if (!this.operatorWallet) return;

    let count = 0;
    for (const note of notes) {
      // Skip if already in memory
      if (this.operatorSecrets.has(note.leafIndex)) continue;

      try {
        const bytes = hexToBytes(note.encryptedNote);
        if (bytes.length < 291) continue;

        const ephemeralPubKey = bytes.slice(194, 227);
        const ciphertext = bytes.slice(227, 259);
        const mac = bytes.slice(259, 291);

        const operatorPrivKey = hexToBytes(this.operatorWallet.privateKey);
        const secret = decryptOperatorNote(operatorPrivKey, ciphertext, ephemeralPubKey, mac);
        this.operatorSecrets.set(note.leafIndex, secret);
        count++;
      } catch {
        // Decryption failure is expected for notes not encrypted to this operator
      }
    }

    if (count > 0) {
      console.log(`[compliance] Rebuilt ${count} operator secrets from ${notes.length} notes`);
    }
  }

  /** Get operator secrets count (for testing/monitoring). */
  get secretCount(): number {
    return this.operatorSecrets.size;
  }

  /**
   * Try to decrypt the operator note from a raw EncryptedNote payload and log compliance data.
   *
   * On-chain format (291B):
   *   [recipientNote(194B) | opEphPubKey(33B) | opCiphertext(32B) | opMac(32B)]
   *
   * Only logs MAC verification success/failure — secret is NEVER logged.
   */
  tryDecryptOperatorNote(encryptedNoteHex: string, leafIndex: number): void {
    if (!this.operatorWallet) return;

    try {
      const bytes = hexToBytes(encryptedNoteHex);

      if (bytes.length < 291) {
        console.log(`[compliance] Note leaf=${leafIndex} has no operator note (${bytes.length}B payload)`);
        return;
      }

      const ephemeralPubKey = bytes.slice(194, 227);
      const ciphertext = bytes.slice(227, 259);
      const mac = bytes.slice(259, 291);

      const operatorPrivKey = hexToBytes(this.operatorWallet.privateKey);
      const secret = decryptOperatorNote(operatorPrivKey, ciphertext, ephemeralPubKey, mac);

      // Store secret in memory for compliance verification (never logged, never persisted)
      this.operatorSecrets.set(leafIndex, secret);

      console.log(`[compliance] Operator note verified | leaf=${leafIndex} (MAC valid, secret stored)`);
    } catch (err: any) {
      console.error(`[compliance] Operator note decrypt failed | leaf=${leafIndex}: ${err.message}`);
    }
  }

  private persist(): void {
    this.store.saveWithdrawals(Array.from(this.withdrawals.values()));
  }

  private persistUsers(): void {
    this.store.saveUsers(Array.from(this.usersByAddress.values()));
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * LatentClient — unified facade for the Latent Privacy Pool SDK.
 *
 * Single entry point for frontend applications. Orchestrates wallet connection,
 * key derivation, note scanning, deposit, withdrawal, and claim flows.
 */

import type { Signer, Provider } from "ethers";
import { initCrypto, computeCommitment, computeNullifier, computeComplianceHash, encryptNote, encryptOperatorNote } from "./core/crypto.js";
import { deriveKeys, cacheKeys, loadCachedKeys, clearCachedKeys } from "./core/keys.js";
import { scanNotes, computeBalance } from "./core/notes.js";
import { initWitness, generateWitness } from "./proving/witness.js";
import { initProver, generateProof, disposeProver } from "./proving/prover.js";
import { SequencerClient } from "./api/sequencer.js";
import { connectWallet, reconnectWallet, onWalletChange, type WalletState } from "./chain/wallet.js";
import * as contracts from "./chain/contracts.js";
import {
  type LatentKeys,
  type OwnedNote,
  type DepositParams,
  type WithdrawParams,
  type DepositResult,
  type WithdrawalResult,
  type ProofStage,
  type HistoryResponse,
  addressToField,
  bytesToHex,
  fieldToHex,
  hexToBytes,
} from "./core/types.js";

export interface LatentClientConfig {
  sequencerUrl: string;
  poolAddress: string;
  tokenAddress: string;
  /** URL to fetch compiled circuit JSON. Default: "/circuit/latent_circuit.json" */
  circuitUrl?: string;
  /** Operator's ECIES encryption public key (hex, 33B compressed). */
  operatorEncPubKey?: string;
}

const BN254_FR_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export class LatentClient {
  private readonly config: LatentClientConfig;
  private readonly sequencer: SequencerClient;

  private walletState: WalletState | null = null;
  private keys: LatentKeys | null = null;
  private cryptoReady = false;
  private proverReady = false;

  constructor(config: LatentClientConfig) {
    this.config = config;
    this.sequencer = new SequencerClient(config.sequencerUrl);
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize crypto (Poseidon2 WASM). Call once at app startup.
   * Prover is lazy-loaded when first proof is needed.
   */
  async init(): Promise<void> {
    await initCrypto();
    this.cryptoReady = true;
  }

  /**
   * Dispose WASM resources. Call when done to free memory.
   */
  async dispose(): Promise<void> {
    await disposeProver();
    this.proverReady = false;
  }

  // ============================================================
  // Wallet
  // ============================================================

  /**
   * Connect MetaMask and return the connected address.
   */
  async connect(): Promise<string> {
    this.walletState = await connectWallet();
    // Try loading cached keys
    this.keys = loadCachedKeys(this.walletState.address);
    return this.walletState.address;
  }

  /**
   * Silently reconnect if MetaMask already has an authorized account.
   * No popup is shown. Returns the address if reconnected, null otherwise.
   */
  async reconnect(): Promise<string | null> {
    const state = await reconnectWallet();
    if (!state) return null;
    this.walletState = state;
    this.keys = loadCachedKeys(state.address);
    return state.address;
  }

  /**
   * Derive Latent keys from MetaMask signature.
   * Returns cached keys if available, otherwise prompts for signature.
   */
  async deriveKeys(): Promise<LatentKeys> {
    this.requireWallet();

    if (this.keys) return this.keys;

    this.keys = await deriveKeys(this.walletState!.signer);
    cacheKeys(this.walletState!.address, this.keys);
    return this.keys;
  }

  /**
   * Register the current user with the sequencer operator.
   *
   * MVP: KYC 미연동 — 키 생성 후 자동 등록. 이미 등록된 경우 무시.
   * TODO: 추후 KYC 프로세스 연동 시 KYC 승인 후에만 호출되도록 변경
   */
  async register(): Promise<void> {
    this.requireKeys();

    const address = this.walletState!.address;
    const npk = this.keys!.npk.toString();
    const encPubKey = bytesToHex(this.keys!.encPubKey);

    try {
      await this.sequencer.registerUser(address, npk, encPubKey);
    } catch (err: any) {
      // 409 = already registered — not an error
      if (!err.message?.includes("409")) {
        throw err;
      }
    }
  }

  isConnected(): boolean {
    return this.walletState !== null;
  }

  getAddress(): string | null {
    return this.walletState?.address ?? null;
  }

  getChainId(): number | null {
    return this.walletState?.chainId ?? null;
  }

  getKeys(): LatentKeys | null {
    return this.keys;
  }

  /**
   * Listen for account/chain changes. Returns unsubscribe function.
   */
  onAccountChange(cb: (address: string | null) => void): () => void {
    return onWalletChange((state) => {
      this.walletState = state;
      if (state) {
        this.keys = loadCachedKeys(state.address);
        cb(state.address);
      } else {
        this.keys = null;
        cb(null);
      }
    });
  }

  /**
   * Disconnect: clear wallet state and cached keys.
   */
  disconnect(): void {
    if (this.walletState) {
      clearCachedKeys(this.walletState.address);
    }
    this.walletState = null;
    this.keys = null;
  }

  // ============================================================
  // Balance
  // ============================================================

  /**
   * Scan sequencer for encrypted notes belonging to this wallet.
   * Filters out already-spent notes by checking nullifiers on-chain.
   *
   * MVP: 전체(0~leafCount)를 스캔하지 않고 최신 노트부터 scanWindow 개만 조회.
   * @param scanWindow 최근 몇 개의 leaf를 스캔할지 (기본 100)
   */
  async scanMyNotes(scanWindow = 100): Promise<OwnedNote[]> {
    this.requireKeys();

    const { leafCount } = await this.sequencer.getRoot();
    if (leafCount === 0) return [];

    const from = Math.max(0, leafCount - scanWindow);
    const encNotes = await this.sequencer.getNotes(from, leafCount);
    const owned = scanNotes(encNotes, this.keys!.encPrivKey, this.keys!.npk);

    if (owned.length === 0 || !this.walletState) return owned;

    // Filter out spent notes by checking nullifiers on-chain
    const pool = contracts.getPoolContract(
      this.config.poolAddress,
      this.walletState.provider,
    );
    const nsk = this.keys!.nsk;
    const checks = await Promise.all(
      owned.map(async (note) => {
        const nullifier = computeNullifier(note.secret, nsk);
        const nullifierHex = fieldToHex(nullifier);
        const isSpent: boolean = await pool.nullifiers(nullifierHex);
        return !isSpent;
      }),
    );
    const unspent = owned.filter((_, i) => checks[i]);

    // Fetch block timestamps for remaining notes
    if (unspent.length > 0) {
      const provider = this.walletState.provider;
      const uniqueBlocks = [...new Set(unspent.map((n) => Number(n.blockNumber)))];
      const timestamps = new Map<number, number>();
      await Promise.all(
        uniqueBlocks.map(async (bn) => {
          try {
            const block = await provider.getBlock(bn);
            if (block) timestamps.set(bn, block.timestamp * 1000);
          } catch { /* ignore — timestamp will be undefined */ }
        }),
      );
      for (const note of unspent) {
        note.timestamp = timestamps.get(Number(note.blockNumber));
      }
    }

    return unspent;
  }

  /**
   * Total privacy balance (sum of owned note amounts).
   */
  async getPrivacyBalance(): Promise<bigint> {
    const notes = await this.scanMyNotes();
    return computeBalance(notes);
  }

  /**
   * ERC20 token balance of the connected wallet.
   */
  async getTokenBalance(): Promise<bigint> {
    this.requireWallet();
    return contracts.getTokenBalance(
      this.walletState!.provider,
      this.config.tokenAddress,
      this.walletState!.address,
    );
  }

  // ============================================================
  // Deposit
  // ============================================================

  /**
   * Deposit tokens into the privacy pool for a recipient.
   */
  async deposit(params: DepositParams): Promise<DepositResult> {
    this.requireWallet();
    this.requireCrypto();

    const onProgress = params.onProgress;

    const signer = this.walletState!.signer;
    const depositorAddress = this.walletState!.address;

    // Step 1: Prepare
    onProgress?.({ step: "prepare", message: "Preparing deposit" });

    const provider = this.walletState!.provider;
    const currentBlock = await provider.getBlockNumber();
    const blockNumber = BigInt(currentBlock + 1);

    const secret = this.generateRandomSecret();

    const depositor = addressToField(depositorAddress);

    // Step 2: Encrypt
    onProgress?.({ step: "encrypt", message: "Encrypting notes" });

    const commitment = computeCommitment(
      secret,
      params.recipientNpk,
      params.amount,
      blockNumber,
      depositor,
    );

    const encrypted = encryptNote(params.recipientEncPubKey, {
      secret,
      amount: params.amount,
      blockNumber,
      depositor,
    });

    const operatorNote = this.config.operatorEncPubKey
      ? encryptOperatorNote(hexToBytes(this.config.operatorEncPubKey), secret)
      : undefined;

    // Step 3: Approve + Submit (handled inside contracts.deposit)
    onProgress?.({ step: "approve", message: "Approving token transfer" });

    const result = await contracts.deposit(
      signer,
      this.config.poolAddress,
      this.config.tokenAddress,
      commitment,
      params.amount,
      encrypted,
      operatorNote,
      (stage) => {
        if (stage === "submit") {
          onProgress?.({ step: "submit", message: "Submitting deposit transaction" });
        } else if (stage === "confirm") {
          onProgress?.({ step: "confirm", message: "Waiting for confirmation" });
        }
      },
    );

    return {
      txHash: result.txHash,
      leafIndex: result.leafIndex,
      commitment,
    };
  }

  // ============================================================
  // Withdraw
  // ============================================================

  /**
   * Full withdrawal flow: compute inputs → generate witness → prove → submit.
   *
   * The onProgress callback reports each stage for UI display.
   */
  async withdraw(params: WithdrawParams): Promise<WithdrawalResult> {
    this.requireWallet();
    this.requireKeys();
    this.requireCrypto();

    const { note, amount, recipientAddress, onProgress } = params;
    const nsk = this.keys!.nsk;
    const npk = this.keys!.npk;
    const signer = this.walletState!.signer;

    // Ensure withdrawer is registered (idempotent — 409 if already registered)
    await this.register();

    // Stage 1: Fetch Merkle proof + registration proof
    onProgress?.({ step: "merkle", message: "Merkle proof 조회 중..." });
    const [merkleProof, regProof] = await Promise.all([
      this.sequencer.getProof(note.leafIndex),
      this.sequencer.getRegistrationProof(npk.toString()),
    ]);

    // Stage 2: Compute circuit inputs
    onProgress?.({ step: "compute", message: "회로 입력값 계산 중..." });

    const recipient = addressToField(recipientAddress);
    const nullifier = computeNullifier(note.secret, nsk);
    const complianceHash = computeComplianceHash(
      note.depositor,
      recipient,
      amount,
      note.secret,
    );

    const withdrawalInputs = {
      secret: note.secret,
      nullifierSecretKey: nsk,
      nullifierPubKey: npk,
      merkleSiblings: merkleProof.siblings.map(BigInt),
      pathIndices: merkleProof.pathIndices,
      noteAmount: note.amount,
      noteBlockNumber: note.blockNumber,
      noteDepositor: note.depositor,
      transferAmount: amount,
      registrationSiblings: regProof.siblings.map(BigInt),
      registrationPathIndices: regProof.pathIndices,
      expectedRoot: BigInt(merkleProof.root),
      nullifier,
      amount,
      recipient,
      complianceHash,
      expectedRegistrationRoot: BigInt(regProof.root),
    };

    // Stage 3: Generate witness
    onProgress?.({ step: "witness", message: "Witness 생성 중..." });
    await this.ensureProverReady();
    const witness = await generateWitness(withdrawalInputs);

    // Stage 4: Generate proof
    onProgress?.({ step: "prove", message: "ZK 증명 생성 중... (약 30-60초)" });
    const proofResult = await generateProof(witness);

    // Stage 5: Submit transaction
    onProgress?.({ step: "submit", message: "트랜잭션 제출 중..." });
    const { txHash } = await contracts.initiateWithdrawal(
      signer,
      this.config.poolAddress,
      proofResult.proof,
      proofResult.publicInputs,
    );

    return { txHash, nullifier };
  }

  // ============================================================
  // Claim
  // ============================================================

  /**
   * Claim a withdrawal after the 24h attestation window.
   */
  async claimWithdrawal(nullifierHex: string): Promise<{ txHash: string }> {
    this.requireWallet();
    return contracts.claimWithdrawal(
      this.walletState!.signer,
      this.config.poolAddress,
      nullifierHex,
    );
  }

  /**
   * Check the on-chain status of a pending withdrawal.
   */
  async getWithdrawalStatus(nullifierHex: string) {
    this.requireWallet();
    return contracts.getWithdrawalStatus(
      this.walletState!.provider,
      this.config.poolAddress,
      nullifierHex,
    );
  }

  // ============================================================
  // Public Key Sharing (Option B: link-based)
  // ============================================================

  /**
   * Generate a payment link containing this wallet's Latent public keys.
   * The recipient can share this link for others to deposit to them.
   */
  generatePaymentLink(baseUrl: string): string {
    this.requireKeys();
    const npk = this.keys!.npk.toString();
    const enc = bytesToHex(this.keys!.encPubKey);
    return `${baseUrl}?npk=${npk}&enc=${enc}`;
  }

  /**
   * Parse a payment link to extract recipient public keys.
   */
  static parsePaymentLink(url: string): {
    recipientNpk: bigint;
    recipientEncPubKey: Uint8Array;
  } {
    const parsed = new URL(url);
    const npk = parsed.searchParams.get("npk");
    const enc = parsed.searchParams.get("enc");
    if (!npk || !enc) {
      throw new Error("Invalid payment link: missing npk or enc parameter");
    }
    const cleaned = enc.startsWith("0x") ? enc.slice(2) : enc;
    const encPubKey = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < encPubKey.length; i++) {
      encPubKey[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
    }
    return {
      recipientNpk: BigInt(npk),
      recipientEncPubKey: encPubKey,
    };
  }

  // ============================================================
  // History
  // ============================================================

  /**
   * Fetch transaction history for an address from the sequencer.
   * If no address is provided, uses the currently connected wallet address.
   */
  async getHistory(address?: string): Promise<HistoryResponse> {
    const addr = address ?? this.walletState?.address;
    if (!addr) {
      throw new Error("No address provided and wallet not connected.");
    }
    return this.sequencer.getHistory(addr);
  }

  // ============================================================
  // Sequencer API passthrough
  // ============================================================

  getSequencer(): SequencerClient {
    return this.sequencer;
  }

  // ============================================================
  // Prover preload
  // ============================================================

  /**
   * WASM 모듈(noir_js + bb.js)을 사전 로드한다.
   * 키 생성 직후 호출하면 출금 시 witness/proof 단계가 즉시 시작된다.
   */
  async preloadProver(): Promise<void> {
    await this.ensureProverReady();
  }

  // ============================================================
  // Internals
  // ============================================================

  private async ensureProverReady(): Promise<void> {
    if (this.proverReady) return;

    const circuitUrl =
      this.config.circuitUrl ?? "/circuit/latent_circuit.json";
    const circuit = await fetch(circuitUrl).then((r) => r.json());

    await initWitness(circuit);
    await initProver(circuit.bytecode);
    this.proverReady = true;
  }

  private requireWallet(): void {
    if (!this.walletState) {
      throw new Error("Wallet not connected. Call connect() first.");
    }
  }

  private requireKeys(): void {
    this.requireWallet();
    if (!this.keys) {
      throw new Error("Keys not derived. Call deriveKeys() first.");
    }
  }

  private requireCrypto(): void {
    if (!this.cryptoReady) {
      throw new Error("Crypto not initialized. Call init() first.");
    }
  }

  private generateRandomSecret(): bigint {
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    let secret = 0n;
    for (const b of secretBytes) secret = (secret << 8n) | BigInt(b);
    return secret % BN254_FR_ORDER;
  }
}

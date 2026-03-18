/**
 * Note Scanner — EncryptedNote event collection.
 *
 * Collects EncryptedNote(leafIndex, encryptedNote) events from the contract
 * and provides raw encrypted data via query APIs.
 *
 * Security: The server only stores encrypted data. View tag filtering and
 * ECIES decryption are performed client-side in the SDK.
 */

import { ethers } from "ethers";
import { Store } from "./store.js";
import type { StoredEncryptedNote } from "./types.js";

export class NoteScanner {
  private notes: StoredEncryptedNote[] = [];
  private lastScannedBlock: number = 0;

  constructor(
    private readonly contract: ethers.Contract,
    private readonly store: Store,
    private readonly provider: ethers.JsonRpcProvider,
  ) {}

  /** Load persisted notes from disk. */
  async init(): Promise<void> {
    this.notes = this.store.loadNotes();
    if (this.notes.length > 0) {
      this.lastScannedBlock = Math.max(
        ...this.notes.map((n) => n.blockNumber),
      );
      console.log(
        `[scanner] Loaded ${this.notes.length} notes (last block: ${this.lastScannedBlock})`,
      );
    } else if (this.provider) {
      // No prior notes: start from current block to avoid genesis query
      this.lastScannedBlock = await this.provider.getBlockNumber();
    }
  }

  /** Scan for new EncryptedNote events from the chain. */
  async scan(fromBlock?: number): Promise<number> {
    const startBlock = fromBlock ?? this.lastScannedBlock + 1;

    const filter = this.contract.filters.EncryptedNote();
    let events: ethers.EventLog[];
    try {
      const rawEvents = await this.contract.queryFilter(filter, startBlock);
      events = rawEvents.filter(
        (e): e is ethers.EventLog => e instanceof ethers.EventLog,
      );
    } catch (err: any) {
      console.error(`[scanner] Failed to query events: ${err.message}`);
      return 0;
    }

    if (events.length === 0) return 0;

    // Fetch Deposit events in the same block range for amount matching
    let depositEvents: ethers.EventLog[] = [];
    try {
      const depositFilter = this.contract.filters.Deposit();
      const rawDeposits = await this.contract.queryFilter(depositFilter, startBlock);
      depositEvents = rawDeposits.filter(
        (e): e is ethers.EventLog => e instanceof ethers.EventLog,
      );
    } catch (err: any) {
      console.error(`[scanner] Failed to query Deposit events: ${err.message}`);
    }

    // Index Deposit events by leafIndex for O(1) lookup
    // Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp)
    const depositByLeaf = new Map<number, ethers.EventLog>();
    for (const de of depositEvents) {
      const depLeaf = Number(de.args[1]);
      depositByLeaf.set(depLeaf, de);
    }

    let newCount = 0;
    // Collect new events for batch block/tx lookups
    const newEvents: { event: ethers.EventLog; depositEvent?: ethers.EventLog }[] = [];
    for (const event of events) {
      const leafIndex = Number(event.args[0]);

      // Skip if already stored
      if (this.notes.some((n) => n.leafIndex === leafIndex)) continue;

      newEvents.push({ event, depositEvent: depositByLeaf.get(leafIndex) });
    }

    // Batch-fetch unique blocks and transactions for new events
    const blockNumbers = new Set<number>();
    const txHashes = new Set<string>();
    for (const { event, depositEvent } of newEvents) {
      blockNumbers.add(event.blockNumber);
      if (depositEvent) {
        txHashes.add(depositEvent.transactionHash);
      }
    }

    const blockTimestamps = new Map<number, number>();
    const txDepositors = new Map<string, string>();

    await Promise.all([
      // Fetch block timestamps
      ...Array.from(blockNumbers).map(async (bn) => {
        try {
          const block = await this.provider.getBlock(bn);
          if (block) blockTimestamps.set(bn, block.timestamp * 1000);
        } catch { /* ignore */ }
      }),
      // Fetch tx.from (depositor) from Deposit event transactions
      ...Array.from(txHashes).map(async (hash) => {
        try {
          const tx = await this.provider.getTransaction(hash);
          if (tx) txDepositors.set(hash, tx.from);
        } catch { /* ignore */ }
      }),
    ]);

    for (const { event, depositEvent } of newEvents) {
      const leafIndex = Number(event.args[0]);
      const encryptedNote: string = event.args[1];

      const note: StoredEncryptedNote = {
        leafIndex,
        encryptedNote,
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        timestamp: blockTimestamps.get(event.blockNumber),
      };

      if (depositEvent) {
        note.amount = (depositEvent.args[2] as bigint).toString();
        note.depositor = txDepositors.get(depositEvent.transactionHash);
      }

      this.notes.push(note);
      newCount++;
    }

    if (newCount > 0) {
      this.lastScannedBlock = Math.max(
        ...events.map((e) => e.blockNumber),
      );
      this.store.saveNotes(this.notes);
      console.log(
        `[scanner] Found ${newCount} new encrypted notes (total: ${this.notes.length})`,
      );
    }

    return newCount;
  }

  /** Get encrypted notes in a leaf index range. */
  getNotes(from: number, to: number): StoredEncryptedNote[] {
    return this.notes.filter(
      (n) => n.leafIndex >= from && n.leafIndex <= to,
    );
  }

  /** Get all stored notes. */
  getAllNotes(): StoredEncryptedNote[] {
    return this.notes;
  }

  get noteCount(): number {
    return this.notes.length;
  }
}

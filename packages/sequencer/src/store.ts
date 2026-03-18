/**
 * JSON file-based persistence with atomic writes (write temp → rename).
 *
 * Data directory structure:
 *   data/sequencer/
 *     state.json            - Tree nodes + sync progress
 *     commitments.json      - Commitment metadata for API
 *     encrypted-notes.json  - EncryptedNote events
 *     withdrawals.json      - PendingWithdrawal states
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join, dirname } from "path";
import type {
  PersistedState,
  StoredEncryptedNote,
  PendingWithdrawalInfo,
  RegisteredUser,
} from "./types.js";

export class Store {
  private readonly dataDir: string;
  private readonly statePath: string;
  private readonly notesPath: string;
  private readonly withdrawalsPath: string;
  private readonly usersPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.statePath = join(dataDir, "state.json");
    this.notesPath = join(dataDir, "encrypted-notes.json");
    this.withdrawalsPath = join(dataDir, "withdrawals.json");
    this.usersPath = join(dataDir, "registered-users.json");
  }

  /** Ensure data directory exists. */
  init(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  // ============================================================
  // Tree + Sync State
  // ============================================================

  loadState(): PersistedState | null {
    return this.readJson<PersistedState>(this.statePath);
  }

  saveState(state: PersistedState): void {
    this.writeJson(this.statePath, state);
  }

  // ============================================================
  // Encrypted Notes
  // ============================================================

  loadNotes(): StoredEncryptedNote[] {
    return this.readJson<StoredEncryptedNote[]>(this.notesPath) ?? [];
  }

  saveNotes(notes: StoredEncryptedNote[]): void {
    this.writeJson(this.notesPath, notes);
  }

  // ============================================================
  // Withdrawals
  // ============================================================

  loadWithdrawals(): PendingWithdrawalInfo[] {
    return this.readJson<PendingWithdrawalInfo[]>(this.withdrawalsPath) ?? [];
  }

  saveWithdrawals(withdrawals: PendingWithdrawalInfo[]): void {
    this.writeJson(this.withdrawalsPath, withdrawals);
  }

  // ============================================================
  // Registered Users (KYC)
  // ============================================================

  loadUsers(): RegisteredUser[] {
    return this.readJson<RegisteredUser[]>(this.usersPath) ?? [];
  }

  saveUsers(users: RegisteredUser[]): void {
    this.writeJson(this.usersPath, users);
  }

  // ============================================================
  // Atomic JSON I/O
  // ============================================================

  private readJson<T>(path: string): T | null {
    if (!existsSync(path)) return null;
    try {
      const data = readFileSync(path, "utf-8");
      return JSON.parse(data) as T;
    } catch (err) {
      console.error(`[store] Failed to read ${path}:`, err);
      return null;
    }
  }

  private writeJson(path: string, data: unknown): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmpPath = path + `.tmp.${Date.now()}`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    renameSync(tmpPath, path);
  }
}

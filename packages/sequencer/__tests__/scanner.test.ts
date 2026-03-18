/**
 * Note Scanner tests.
 *
 * Verifies:
 * - Note range queries
 * - Note storage and retrieval
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NoteScanner } from "../src/scanner.js";
import { Store } from "../src/store.js";
import type { StoredEncryptedNote } from "../src/types.js";

// Minimal mock store that doesn't touch filesystem
class MockStore {
  private notes: StoredEncryptedNote[] = [];

  loadNotes(): StoredEncryptedNote[] {
    return this.notes;
  }

  saveNotes(notes: StoredEncryptedNote[]): void {
    this.notes = notes;
  }
}

describe("NoteScanner", () => {
  let scanner: NoteScanner;
  let mockStore: MockStore;

  beforeEach(() => {
    mockStore = new MockStore();
    // Scanner with null contract (we test offline methods only)
    scanner = new NoteScanner(null as any, mockStore as unknown as Store, null as any);
  });

  describe("range queries", () => {
    it("should return notes within the specified range", async () => {
      const notes: StoredEncryptedNote[] = Array.from(
        { length: 5 },
        (_, i) => ({
          leafIndex: i,
          encryptedNote: "0x" + "00".repeat(162),
          blockNumber: i + 1,
          txHash: `0x${i}`,
        }),
      );

      mockStore.saveNotes(notes);
      await scanner.init();

      const result = scanner.getNotes(1, 3);
      expect(result.length).toBe(3);
      expect(result.map((n) => n.leafIndex)).toEqual([1, 2, 3]);
    });

    it("should return empty array for out-of-range query", async () => {
      const notes: StoredEncryptedNote[] = Array.from(
        { length: 3 },
        (_, i) => ({
          leafIndex: i,
          encryptedNote: "0x" + "00".repeat(162),
          blockNumber: i + 1,
          txHash: `0x${i}`,
        }),
      );

      mockStore.saveNotes(notes);
      await scanner.init();

      const result = scanner.getNotes(10, 20);
      expect(result.length).toBe(0);
    });
  });

  describe("note count", () => {
    it("should track note count after init", async () => {
      const notes: StoredEncryptedNote[] = Array.from(
        { length: 7 },
        (_, i) => ({
          leafIndex: i,
          encryptedNote: "0x" + "00".repeat(162),
          blockNumber: i + 1,
          txHash: `0x${i}`,
        }),
      );

      mockStore.saveNotes(notes);
      await scanner.init();

      expect(scanner.noteCount).toBe(7);
    });

    it("should return 0 for empty scanner", async () => {
      await scanner.init();
      expect(scanner.noteCount).toBe(0);
    });
  });
});

/**
 * Note scanning and management.
 *
 * Scans encrypted notes from the sequencer, filters by view tag,
 * decrypts matching notes, and computes privacy balance.
 */

import { decryptNote, computeViewTag, computeCommitment } from "./crypto.js";
import {
  type StoredEncryptedNote,
  type OwnedNote,
  hexToBytes,
} from "./types.js";

/**
 * Parse a stored encrypted note's hex payload into its components.
 *
 * Format (194B): [ephPubKey(33B) | ciphertext(128B) | mac(32B) | viewTag(1B)]
 * With operator (291B): [recipientNote(194B) | opEphPubKey(33B) | opCiphertext(32B) | opMac(32B)]
 */
function parseEncryptedNote(hex: string): {
  ephemeralPubKey: Uint8Array;
  ciphertext: Uint8Array;
  mac: Uint8Array;
  viewTag: number;
  operatorNote?: { ephemeralPubKey: Uint8Array; ciphertext: Uint8Array; mac: Uint8Array };
} {
  const bytes = hexToBytes(hex);
  const result: {
    ephemeralPubKey: Uint8Array;
    ciphertext: Uint8Array;
    mac: Uint8Array;
    viewTag: number;
    operatorNote?: { ephemeralPubKey: Uint8Array; ciphertext: Uint8Array; mac: Uint8Array };
  } = {
    ephemeralPubKey: bytes.slice(0, 33),
    ciphertext: bytes.slice(33, 161),
    mac: bytes.slice(161, 193),
    viewTag: bytes[193],
  };

  // 291B = recipient note (194B) + operator note (97B)
  if (bytes.length >= 291) {
    result.operatorNote = {
      ephemeralPubKey: bytes.slice(194, 227),
      ciphertext: bytes.slice(227, 259),
      mac: bytes.slice(259, 291),
    };
  }

  return result;
}

/**
 * Scan encrypted notes and return those belonging to the given key pair.
 *
 * 1. Filter by view tag (eliminates ~99.6% of non-matching notes)
 * 2. Attempt full ECIES decryption on matches
 * 3. Verify commitment to confirm ownership
 */
export function scanNotes(
  encryptedNotes: StoredEncryptedNote[],
  encPrivKey: Uint8Array,
  npk: bigint,
): OwnedNote[] {
  const owned: OwnedNote[] = [];

  for (const stored of encryptedNotes) {
    const note = tryDecryptNote(stored, encPrivKey, npk);
    if (note) owned.push(note);
  }

  return owned;
}

/**
 * Try to decrypt a single encrypted note.
 * Returns OwnedNote if the note belongs to us, null otherwise.
 */
export function tryDecryptNote(
  stored: StoredEncryptedNote,
  encPrivKey: Uint8Array,
  npk: bigint,
): OwnedNote | null {
  try {
    const { ephemeralPubKey, ciphertext, mac, viewTag } = parseEncryptedNote(
      stored.encryptedNote,
    );

    // View tag filter: cheap check before expensive ECDH
    const expectedTag = computeViewTag(encPrivKey, ephemeralPubKey);
    if (expectedTag !== viewTag) return null;

    // Full decryption (MAC verified inside)
    const noteData = decryptNote(encPrivKey, ciphertext, ephemeralPubKey, mac);

    // Verify commitment matches
    const commitment = computeCommitment(
      noteData.secret,
      npk,
      noteData.amount,
      noteData.blockNumber,
      noteData.depositor,
    );

    return {
      leafIndex: stored.leafIndex,
      secret: noteData.secret,
      amount: noteData.amount,
      blockNumber: noteData.blockNumber,
      depositor: noteData.depositor,
      commitment,
    };
  } catch {
    // Decryption failed — not our note
    return null;
  }
}

/**
 * Compute total privacy balance from owned notes.
 */
export function computeBalance(notes: OwnedNote[]): bigint {
  return notes.reduce((sum, note) => sum + note.amount, 0n);
}

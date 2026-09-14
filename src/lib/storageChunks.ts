/**
 * One stored value, split across several keys.
 *
 * Android's AsyncStorage reads a value through a SQLite cursor window of 2 MB,
 * and a row bigger than the window cannot be read back at all: `getItem`
 * rejects with "Row too big to fit into CursorWindow". The write before it
 * succeeds without complaint, so nothing warns until the next launch.
 *
 * Measured on the emulator on 2026-09-14 with the screenshot history copied
 * back in time: 210 logged sessions (1.7 MB) opened on Home, 273 sessions
 * (2.2 MB) opened on the welcome screen as a new install, with every byte still
 * on disk underneath. The database grows by about 8 KB a session and is never
 * trimmed, so a year of training at four or five sessions a week reaches the
 * limit — and a Hevy import of a few hundred workouts reaches it in one tap.
 *
 * The planning here is pure; `src/storage/largeItem.ts` does the reads and
 * writes.
 */

/**
 * The most UTF-16 code units one part holds.
 *
 * The window counts UTF-8 bytes, which is at most three per code unit (a
 * surrogate pair is four bytes for two units), so a part tops out at 768 KB —
 * well inside 2 MB, with room left for a phone that ships a smaller window.
 */
export const STORAGE_CHUNK_CHARS = 256_000;

/**
 * What the base key holds when the value is split.
 *
 * Every value stored this way is JSON and starts with `{`, so a head that
 * starts with this prefix cannot be mistaken for an unsplit value.
 */
const MANIFEST_PREFIX = 'vinha-chunks:';
const MANIFEST_PATTERN = /^vinha-chunks:(\d+):(\d+)$/;

export interface ChunkManifest {
  /** How many parts follow the base key, as `${key}#0` … `${key}#${count - 1}`. */
  count: number;
  /** The joined length, so a part that came back short is caught, not parsed. */
  length: number;
}

export function chunkKey(key: string, index: number) {
  return `${key}#${index}`;
}

/** The part index when `candidate` is one of `key`'s parts, otherwise null. */
export function chunkIndexOf(key: string, candidate: string): number | null {
  const prefix = `${key}#`;
  if (!candidate.startsWith(prefix)) {
    return null;
  }
  const rest = candidate.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff;
}

/**
 * The value in order, each part at most `maxChars` long.
 *
 * A cut never lands between the two halves of a surrogate pair: the bridge
 * encodes each part to UTF-8 on its own, and half an emoji in a session note
 * would come back as two replacement characters.
 */
export function splitStoredText(text: string, maxChars: number = STORAGE_CHUNK_CHARS): string[] {
  // Two is the floor, not one: a one-unit part could never hold a whole pair,
  // and backing off the cut would never move forward.
  const size = Math.max(2, Math.floor(maxChars));
  if (text.length <= size) {
    return [text];
  }

  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) {
      end -= 1;
    }
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

export function encodeChunkManifest(manifest: ChunkManifest) {
  return `${MANIFEST_PREFIX}${manifest.count}:${manifest.length}`;
}

/** The manifest a head value names, or null when the head is the value itself. */
export function readChunkManifest(head: string): ChunkManifest | null {
  if (!head.startsWith(MANIFEST_PREFIX)) {
    return null;
  }
  const match = MANIFEST_PATTERN.exec(head);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  const length = Number(match[2]);
  return count > 0 ? { count, length } : null;
}

/**
 * The parts joined back into the value, or null when any is missing or the
 * result is not the length the manifest wrote down.
 */
export function joinStoredChunks(manifest: ChunkManifest, parts: ReadonlyArray<string | null | undefined>): string | null {
  if (parts.length !== manifest.count) {
    return null;
  }
  let joined = '';
  for (const part of parts) {
    if (typeof part !== 'string') {
      return null;
    }
    joined += part;
  }
  return joined.length === manifest.length ? joined : null;
}

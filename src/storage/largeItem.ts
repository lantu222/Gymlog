/**
 * AsyncStorage reads and writes for values that can outgrow one row.
 *
 * Android cannot read a row bigger than its 2 MB cursor window, so a value
 * near that size is split across `${key}#0`, `${key}#1`, … and the base key
 * holds a manifest naming the parts. Anything smaller is written exactly as
 * before, and a value stored before this existed reads back unchanged. The why
 * and the measurements are in `lib/storageChunks`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createSerialTaskQueue, RunExclusive } from '../lib/serialTaskQueue';
import {
  chunkIndexOf,
  chunkKey,
  describeIncompleteChunks,
  encodeChunkManifest,
  joinStoredChunks,
  readChunkManifest,
  splitStoredText,
} from '../lib/storageChunks';

/**
 * Reads and writes of one key run one after another.
 *
 * A write is a set followed by a sweep of the parts it no longer needs, and the
 * sweep goes by index: a short write's sweep landing after a longer write's set
 * would delete parts the manifest still names. A read is a head followed by its
 * parts, and a write landing between them would hand back parts from two
 * different saves.
 */
const keyQueues = new Map<string, RunExclusive>();

function inTurn<T>(key: string, task: () => Promise<T>): Promise<T> {
  let runExclusive = keyQueues.get(key);
  if (!runExclusive) {
    runExclusive = createSerialTaskQueue();
    keyQueues.set(key, runExclusive);
  }
  return runExclusive(task);
}

/**
 * For each key, a part index nothing at or past is on disk.
 *
 * The workout bundle is saved once a second during a session, and a sweep is a
 * `getAllKeys` round trip. Knowing the bound lets a write skip the sweep when
 * it cannot have left anything behind: a write of at least that many parts
 * has just overwritten every one there was. Absent means unknown — the first
 * write after launch — and unknown always sweeps.
 */
const partCounts = new Map<string, number>();

/**
 * A split value came back without every part.
 *
 * `readable` is what is left, in a form no JSON parser accepts, so a loader
 * can set it aside the same way it sets aside a blob that will not parse.
 */
export class MissingPartsError extends Error {
  readonly readable: string;

  constructor(key: string, readable: string) {
    super(`Stored value ${key} is missing parts`);
    this.name = 'MissingPartsError';
    this.readable = readable;
  }
}

export function getLargeItem(key: string): Promise<string | null> {
  return inTurn(key, () => readLargeItem(key));
}

async function readLargeItem(key: string): Promise<string | null> {
  const head = await AsyncStorage.getItem(key);
  if (head === null) {
    return null;
  }
  const manifest = readChunkManifest(head);
  if (!manifest) {
    return head;
  }

  // One read per part rather than one multiGet: each part is sized to fit a
  // cursor window alone, and nothing is gained by asking for them together.
  const parts: Array<string | null> = [];
  for (let index = 0; index < manifest.count; index += 1) {
    parts.push(await AsyncStorage.getItem(chunkKey(key, index)));
  }
  const joined = joinStoredChunks(manifest, parts);
  if (joined === null) {
    throw new MissingPartsError(key, describeIncompleteChunks(head, parts));
  }
  return joined;
}

export function setLargeItem(key: string, value: string): Promise<void> {
  return inTurn(key, async () => {
    const parts = splitStoredText(value);
    if (parts.length === 1) {
      await AsyncStorage.setItem(key, value);
    } else {
      // One multiSet is one SQLite transaction on Android, so the manifest and
      // every part it names land together or not at all. A crash mid-write
      // leaves the previous value whole, never a manifest pointing at parts
      // from two different saves.
      await AsyncStorage.multiSet([
        [key, encodeChunkManifest({ count: parts.length, length: value.length })],
        ...parts.map((part, index) => [chunkKey(key, index), part] as const),
      ]);
    }

    const count = parts.length === 1 ? 0 : parts.length;
    const before = partCounts.get(key);
    if (before !== undefined && before <= count) {
      // Every part the last write left has just been overwritten.
      partCounts.set(key, count);
      return;
    }
    await sweepParts(key, count);
  });
}

export function removeLargeItem(key: string): Promise<void> {
  return inTurn(key, async () => {
    await AsyncStorage.removeItem(key);
    await sweepParts(key, 0);
  });
}

/**
 * Remove the parts from `firstUnused` on.
 *
 * Leftovers are unreachable — the manifest does not name them — so a sweep
 * that fails costs storage, not data, and must not turn a finished write into
 * a reported failure. The bound stays where it was, which is still true, so
 * the next write that could leave parts behind sweeps again.
 */
async function sweepParts(key: string, firstUnused: number) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const unused = keys.filter((candidate) => {
      const index = chunkIndexOf(key, candidate);
      return index !== null && index >= firstUnused;
    });
    if (unused.length > 0) {
      await AsyncStorage.multiRemove(unused);
    }
    partCounts.set(key, firstUnused);
  } catch (error) {
    console.warn(`Could not sweep unused parts of ${key}`, error);
  }
}

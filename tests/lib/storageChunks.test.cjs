const assert = require('node:assert/strict');

const {
  STORAGE_CHUNK_CHARS,
  chunkIndexOf,
  chunkKey,
  encodeChunkManifest,
  joinStoredChunks,
  readChunkManifest,
  splitStoredText,
} = require('../../.test-dist/lib/storageChunks');

const CURSOR_WINDOW_BYTES = 2 * 1024 * 1024;

/** A string survives UTF-8 on its own only when no surrogate is left alone. */
function isWellFormed(text) {
  return Buffer.from(text, 'utf8').toString('utf8') === text;
}

module.exports = [
  {
    name: 'storage chunks: a value that fits is one part, untouched',
    run() {
      const value = JSON.stringify({ workoutSessions: [], note: 'kyykky' });
      assert.deepEqual(splitStoredText(value), [value]);
      assert.deepEqual(splitStoredText('x'.repeat(STORAGE_CHUNK_CHARS)), ['x'.repeat(STORAGE_CHUNK_CHARS)]);
    },
  },
  {
    name: 'storage chunks: every part fits a cursor window even when every character is three bytes',
    run() {
      // '€' is three bytes in UTF-8: the worst a part can do without surrogates.
      const value = '€'.repeat(STORAGE_CHUNK_CHARS * 3 + 17);
      const parts = splitStoredText(value);

      assert.equal(parts.length, 4);
      assert.equal(parts.join(''), value);
      for (const part of parts) {
        assert.ok(part.length <= STORAGE_CHUNK_CHARS);
        assert.ok(
          Buffer.byteLength(part, 'utf8') < CURSOR_WINDOW_BYTES,
          `a part is ${Buffer.byteLength(part, 'utf8')} bytes, which the phone cannot read back`,
        );
      }
    },
  },
  {
    name: 'storage chunks: a cut never separates the two halves of an emoji',
    run() {
      // The pair straddles the boundary: its high half is the last unit that
      // would fit.
      const value = 'a'.repeat(STORAGE_CHUNK_CHARS - 1) + '💪' + 'b'.repeat(10);
      const parts = splitStoredText(value);

      assert.equal(parts.join(''), value);
      for (const part of parts) {
        assert.ok(isWellFormed(part), 'a part ends in half a surrogate pair and comes back as replacement characters');
      }
      assert.equal(parts[0].length, STORAGE_CHUNK_CHARS - 1);

      // A size too small to hold a pair still moves forward.
      const tiny = splitStoredText('💪💪x', 1);
      assert.equal(tiny.join(''), '💪💪x');
      assert.ok(tiny.every(isWellFormed));
    },
  },
  {
    name: 'storage chunks: the manifest reads back, and a stored value is never taken for one',
    run() {
      const manifest = { count: 9, length: 2213327 };
      assert.deepEqual(readChunkManifest(encodeChunkManifest(manifest)), manifest);

      assert.equal(readChunkManifest('{"workoutSessions":[]}'), null);
      assert.equal(readChunkManifest(''), null);
      assert.equal(readChunkManifest('vinha-chunks:'), null);
      assert.equal(readChunkManifest('vinha-chunks:x:1'), null);
      assert.equal(readChunkManifest('vinha-chunks:0:0'), null, 'a manifest naming no parts is not a value');
    },
  },
  {
    name: 'storage chunks: a missing, extra or short part joins to nothing rather than to half a value',
    run() {
      const manifest = { count: 3, length: 9 };
      assert.equal(joinStoredChunks(manifest, ['abc', 'def', 'ghi']), 'abcdefghi');
      assert.equal(joinStoredChunks(manifest, ['abc', null, 'ghi']), null);
      assert.equal(joinStoredChunks(manifest, ['abc', 'def']), null);
      assert.equal(joinStoredChunks(manifest, ['abc', 'def', 'ghi', 'jkl']), null);
      assert.equal(joinStoredChunks(manifest, ['abc', 'de', 'ghi']), null);
    },
  },
  {
    name: 'storage chunks: part keys belong to exactly one base key',
    run() {
      const key = '@vinha/database/v1';
      assert.equal(chunkKey(key, 4), '@vinha/database/v1#4');
      assert.equal(chunkIndexOf(key, chunkKey(key, 4)), 4);
      assert.equal(chunkIndexOf(key, chunkKey(key, 12)), 12);

      assert.equal(chunkIndexOf(key, key), null);
      assert.equal(chunkIndexOf(key, `${key}#`), null);
      assert.equal(chunkIndexOf(key, `${key}#2x`), null);
      assert.equal(chunkIndexOf(key, '@vinha/database/corrupt#0'), null);
      assert.equal(chunkIndexOf(key, '@vinha/database/v10#0'), null);
      assert.equal(chunkIndexOf('@vinha/workout/v1', chunkKey(key, 0)), null);
    },
  },
];

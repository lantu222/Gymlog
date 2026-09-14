/**
 * Base64 for bytes, in plain TypeScript.
 *
 * Hermes has `btoa`/`atob` on some builds and not others, and both work on
 * binary strings a byte at a time. This is the same on the phone, in the Node
 * tests and on the endpoint.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const DECODE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < ALPHABET.length; index += 1) {
    table[ALPHABET.charCodeAt(index)] = index;
  }
  return table;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  // Built in chunks rather than one character at a time: a backup is hundreds
  // of kilobytes, and one string per group would be a million allocations.
  const CHUNK_BYTES = 3 * 4096;
  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += CHUNK_BYTES) {
    const end = Math.min(chunkStart + CHUNK_BYTES, bytes.length);
    let chunk = '';
    for (let index = chunkStart; index < end; index += 3) {
      const a = bytes[index];
      const b = index + 1 < end ? bytes[index + 1] : 0;
      const c = index + 2 < end ? bytes[index + 2] : 0;
      const triple = (a << 16) | (b << 8) | c;
      chunk +=
        ALPHABET[(triple >> 18) & 63] +
        ALPHABET[(triple >> 12) & 63] +
        (index + 1 < end ? ALPHABET[(triple >> 6) & 63] : '=') +
        (index + 2 < end ? ALPHABET[triple & 63] : '=');
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

/** The bytes, or null when `text` is not well-formed base64. */
export function base64ToBytes(text: string): Uint8Array | null {
  if (text.length % 4 !== 0) {
    return null;
  }
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  const dataEnd = text.length - padding;
  let out = 0;
  let triple = 0;
  for (let index = 0; index < text.length; index += 1) {
    let value = 0;
    if (index < dataEnd) {
      const code = text.charCodeAt(index);
      value = code < 128 ? DECODE[code] : -1;
      if (value < 0) {
        // Includes an '=' anywhere but the end.
        return null;
      }
    }
    triple = (triple << 6) | value;
    if (index % 4 === 3) {
      if (out < bytes.length) bytes[out++] = (triple >> 16) & 255;
      if (out < bytes.length) bytes[out++] = (triple >> 8) & 255;
      if (out < bytes.length) bytes[out++] = triple & 255;
      triple = 0;
    }
  }
  return bytes;
}

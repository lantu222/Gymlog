/**
 * Text to UTF-8 bytes, correct for emoji whatever the runtime.
 *
 * fflate's `strToU8` hands off to `TextEncoder` when there is one and falls
 * back to its own loop when there is not, and that loop gets characters
 * outside the Basic Multilingual Plane wrong: "💪" in a session note came back
 * as "𝢪" (measured 2026-09-14 against fflate 0.8.3 with the codecs removed).
 * Hermes has shipped with and without `TextEncoder`, so the fallback here is
 * one that pairs surrogates properly, and the tests run it with the global
 * removed.
 */
export function utf8Encode(text: string): Uint8Array {
  const Encoder = (globalThis as { TextEncoder?: new () => { encode(input: string): Uint8Array } }).TextEncoder;
  if (typeof Encoder === 'function') {
    return new Encoder().encode(text);
  }
  return utf8EncodeFallback(text);
}

/** Exported for the tests; call `utf8Encode`. */
export function utf8EncodeFallback(text: string): Uint8Array {
  // Worst case three bytes per UTF-16 unit; trimmed to length at the end.
  const bytes = new Uint8Array(text.length * 3);
  let out = 0;
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      }
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      // A lone surrogate is not a character; encode it as U+FFFD, the way
      // TextEncoder does.
      code = 0xfffd;
    }
    if (code < 0x80) {
      bytes[out++] = code;
    } else if (code < 0x800) {
      bytes[out++] = 0xc0 | (code >> 6);
      bytes[out++] = 0x80 | (code & 63);
    } else if (code < 0x10000) {
      bytes[out++] = 0xe0 | (code >> 12);
      bytes[out++] = 0x80 | ((code >> 6) & 63);
      bytes[out++] = 0x80 | (code & 63);
    } else {
      bytes[out++] = 0xf0 | (code >> 18);
      bytes[out++] = 0x80 | ((code >> 12) & 63);
      bytes[out++] = 0x80 | ((code >> 6) & 63);
      bytes[out++] = 0x80 | (code & 63);
    }
  }
  return bytes.subarray(0, out);
}

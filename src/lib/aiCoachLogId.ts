/**
 * The random label a reader's kept coach copies are filed under.
 *
 * Its own module because several places need it and none owns it: the screen
 * that mints it on the first yes, the server routes that accept it, the
 * endpoint that reads kept copies back, and the tests that check its shape.
 * Pure, so it belongs in lib rather than in a screen or a function.
 *
 * Unguessable, not merely unique: the label is also the only thing the
 * withdrawal route asks for, so whoever can produce it can delete what is
 * filed under it (security review, 2026-09-14). The platform's random source
 * when there is one — Hermes and Node both have `crypto.getRandomValues` —
 * and `Math.random` only where there is none. It is never sent to Anthropic,
 * never joined to an account, and never reused after a withdrawal — turning
 * the last line off clears it, and the next yes mints a new one, so two
 * stretches of consent cannot be joined into one history.
 */
export function randomLogId(): string {
  return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;
}

/**
 * The shape a label may take.
 *
 * It ends up in a filename, so anything with a slash or a dot in it would be
 * a path the caller chose rather than a label. Declared here, once, for every
 * place that accepts one or reads one back: the advice body, the image body
 * and the forget route in api/ai-coach.ts, and the reader endpoint.
 */
export const LOG_ID_PATTERN = /^[a-f0-9-]{8,64}$/;

/**
 * The label a kept copy is filed under, read back out of its path
 * (`transcripts/<day>/<label>--<time>.json`), or null for an entry written
 * before labels existed, whose name has no `--`.
 */
export function logIdFromTranscriptPath(pathname: string): string | null {
  const match = /\/([^/]+?)--[^/]*$/.exec(pathname);
  return match && LOG_ID_PATTERN.test(match[1]) ? match[1] : null;
}

/**
 * A key that sorts kept copies by when they were written.
 *
 * The path alone does not: a labelled name puts the random label before the
 * time (`<day>/<label>--<time>`), so within a day a plain sort orders copies
 * by label, and "the newest twenty" came back as twenty arbitrary ones. The
 * day and the time part are joined instead; an unlabelled name already starts
 * with its time.
 */
export function transcriptTimeKey(pathname: string): string {
  const slash = pathname.lastIndexOf('/');
  const dir = pathname.slice(0, slash + 1);
  const name = pathname.slice(slash + 1);
  const cut = name.indexOf('--');
  return dir + (cut >= 0 ? name.slice(cut + 2) : name);
}

/** One stored coach copy, as the reader endpoint hands it back. */
export interface ShapedTranscriptEntry {
  [field: string]: unknown;
  pathname: string;
  label: string | null;
  /** Present when the stored entry holds an email the endpoint did not return. */
  withheld?: true;
  /** How much base64 a kept photo holds, when the photo itself was left out. */
  photoChars?: number;
}

export interface ShapeTranscriptOptions {
  /** Keep a stored photo's data. Only for one entry asked for by path. */
  withPhoto?: boolean;
}

/**
 * A stored entry, made fit to show.
 *
 * Entries written before 2026-09-16 may hold the signed-in email as
 * `reporter`. They stay in the store (user decision, 2026-09-16) on the
 * condition that nothing shows them to anyone, so the value is dropped here
 * and only the fact of it is kept: `withheld` is what lets the release
 * cleanup find those entries without anyone reading an address. The label
 * comes from the path, and the fields this function sets are written last so
 * a stored field of the same name cannot stand in for them.
 *
 * A kept photo is up to 2.8 MB of base64, and the list handed every one back
 * whole: a few of them pushed the response past the platform's 4.5 MB limit
 * and the whole list failed (backfill review of #92, 2026-09-16). So the list
 * says how big a photo is, and the photo itself comes only with one entry
 * asked for by path.
 */
export function shapeTranscriptEntry(
  pathname: string,
  stored: unknown,
  options: ShapeTranscriptOptions = {},
): ShapedTranscriptEntry {
  const record =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  // `withheld` and `photoChars` are taken out as well: only this function
  // may say them.
  const { reporter, withheld: _stored, photoChars: _chars, dataBase64, ...rest } = record;
  const heldAnEmail = typeof reporter === 'string' && reporter.length > 0;
  const photo = typeof dataBase64 === 'string' ? dataBase64 : null;
  return {
    ...rest,
    ...(photo === null ? {} : options.withPhoto ? { dataBase64: photo } : { photoChars: photo.length }),
    pathname,
    label: logIdFromTranscriptPath(pathname),
    ...(heldAnEmail ? { withheld: true as const } : {}),
  };
}

/**
 * Whether a path names one kept copy, for the reader's single-entry request.
 *
 * The store is keyed, not a file system, but the endpoint still reads only
 * the shape the writer makes: `transcripts/<day>/<name>.json`, where the name
 * is a label and a time, or a time and a suffix for the entries from before
 * labels.
 */
export function isTranscriptPath(pathname: string): boolean {
  const parts = pathname.split('/');
  return (
    parts.length === 3
    && parts[0] === 'transcripts'
    && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])
    && /^[\w-]{1,200}\.json$/.test(parts[2])
  );
}

type RandomSource = { getRandomValues?: (array: Uint8Array) => Uint8Array };

/** `length` hex characters from the strongest source at hand. */
export function randomHex(length: number, source: RandomSource | undefined = (globalThis as { crypto?: RandomSource }).crypto): string {
  if (source?.getRandomValues) {
    const bytes = source.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

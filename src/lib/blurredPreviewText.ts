/**
 * SVG has no automatic text wrapping: every line of a <Text> element has to be
 * positioned by hand. The blurred Pro preview draws REAL sentences, so the
 * wrapping has to happen before the draw — here, as a pure function, rather
 * than inside the component where it could not be tested.
 *
 * The measurement is in characters, not pixels. That is deliberate: the text is
 * about to be gaussian-blurred past legibility, so a line that runs a few
 * percent long costs nothing, while pulling a real font measurement into a pure
 * module would cost React Native.
 */

/**
 * Greedy word wrap. Words are never split unless a single word is longer than
 * the whole line, in which case it is hard-broken so it cannot overflow the
 * card silently.
 */
export function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  const limit = Math.max(1, Math.floor(maxCharsPerLine));
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    if (word.length > limit) {
      pushCurrent();
      for (let index = 0; index < word.length; index += limit) {
        lines.push(word.slice(index, index + limit));
      }
      continue;
    }
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    pushCurrent();
    current = word;
  }
  pushCurrent();

  return lines;
}

/**
 * How many characters fit on one line at a given width and font size.
 *
 * 0.54 is the average advance width of the app's sans stack as a fraction of
 * font size, measured across the Finnish and English UI strings. It only has to
 * be close: see the note at the top of the file.
 */
export function charsPerLine(widthPx: number, fontSize: number): number {
  if (widthPx <= 0 || fontSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(widthPx / (fontSize * 0.54)));
}

/**
 * Wrap to the width, then keep only as many lines as the block is tall enough
 * to hold. A blurred block that overflows its card looks like a layout bug even
 * when nobody can read the words.
 */
export function layoutBlurredLines({
  text,
  widthPx,
  fontSize,
  lineHeight,
  heightPx,
}: {
  text: string;
  widthPx: number;
  fontSize: number;
  lineHeight: number;
  heightPx: number;
}): string[] {
  const lines = splitIntoLines(text, charsPerLine(widthPx, fontSize));
  if (lineHeight <= 0) {
    return lines;
  }
  const maxLines = Math.max(1, Math.floor(heightPx / lineHeight));
  return lines.slice(0, maxLines);
}

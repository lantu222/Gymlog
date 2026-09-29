/**
 * Shared, quote-aware CSV text handling.
 *
 * Splitting either importer's text on every raw line break tore a quoted cell
 * that itself contained one — an Excel cell wrapped with Alt+Enter, a Hevy
 * note written on two lines, a model-returned exercise name that copied a
 * spreadsheet's own line wrap — into two records. Neither half then parsed:
 * hevyImport.ts used to drop the whole workout, and csvProgramImport.ts used
 * to drop the exercise and point its error at a row number the reader's sheet
 * does not have. One record boundary, used by both.
 */

/** `splitCsvRecords`'s result: the records, plus where recovery kicked in. */
export interface CsvRecordSplit {
  records: string[];
  /**
   * 1-based position in `records` (matching the "row" numbers callers already
   * report) where a quote was opened but never closed, or null when every
   * quote closed. Set only for the first such quote — a file with more than
   * one is already broken enough that naming the first is what lets the
   * reader find their sheet's actual mistake.
   */
  unterminatedQuoteRow: number | null;
}

/**
 * The file → records, where a record ends at a line break outside quotes.
 *
 * A quote opens a quoted field only where a field starts — right after the
 * delimiter, at the very start of the text, or (for a writer that puts a
 * space before a quoted field) after leading spaces there. A quote inside an
 * unquoted field, `6" box jump`, is part of its text and must not flip the
 * scanner into "inside quotes" for the rest of the file.
 *
 * A quote that DOES open a field but never closes — a stray `"` typed where
 * one wasn't meant, a copy-paste that dropped the closing mark — used to do
 * exactly that anyway: reaching EOF still "inside quotes" swallowed every
 * following line into one record, so the CSV programme import and the Hevy
 * import silently lost every row after it, one line's damage turned into the
 * whole file's (#228 regression, recheck round 2026-09-29). Recovery below
 * confines it back to the one record: the record where the quote opened is
 * re-split on raw line breaks (the quote becomes a literal character), and
 * ordinary quote-aware splitting resumes right after it — so a LATER,
 * legitimately quoted multi-line cell still parses correctly.
 */
export function splitCsvRecords(text: string, delimiter: string): CsvRecordSplit {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  let atFieldStart = true;
  let recordStart = 0;
  let openQuoteRecordStart = -1;
  let openQuoteRow = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      current += char;
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      }
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      records.push(current);
      current = '';
      atFieldStart = true;
      recordStart = i + 1;
      continue;
    }
    if (char === '"' && atFieldStart) {
      inQuotes = true;
      openQuoteRecordStart = recordStart;
      openQuoteRow = records.length + 1;
    }
    current += char;
    atFieldStart = char === delimiter || (atFieldStart && (char === ' ' || char === '\t'));
  }

  if (inQuotes) {
    // The record holding the unclosed quote, and everything after it, raw —
    // split on real line breaks instead of trusting quotes at all, since the
    // one quote we trusted here is exactly the one that lied.
    const rest = text.slice(openQuoteRecordStart);
    const rawLines = rest.split(/\r\n|\r|\n/);
    records.push(rawLines[0]);
    // Everything past the offending line may still hold a genuine quoted
    // field (including one that wraps a line) — hand it back through the
    // ordinary quote-aware parser rather than staying in raw-line mode for
    // the rest of the file.
    const remainder = rawLines.slice(1).join('\n');
    const recovered = splitCsvRecords(remainder, delimiter);
    records.push(...recovered.records);
    return { records, unterminatedQuoteRow: openQuoteRow };
  }

  records.push(current);
  return { records, unterminatedQuoteRow: null };
}

/**
 * Collapses any run of whitespace — including a line break wrapped into a
 * cell — to one space, and trims the ends.
 *
 * A spreadsheet cell wrapped across two lines is still one name, not two
 * lines of one; a model asked to copy that cell verbatim copies the wrap too.
 * Used wherever a day or exercise name is finalised, on both the CSV path and
 * the photo path that produces the CSV the parser reads.
 */
export function collapseCellWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

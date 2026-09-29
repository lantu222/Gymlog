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

/**
 * The file → records, where a record ends at a line break outside quotes.
 *
 * A quote opens a quoted field only where a field starts — right after the
 * delimiter, at the very start of the text, or (for a writer that puts a
 * space before a quoted field) after leading spaces there. A quote inside an
 * unquoted field, `6" box jump`, is part of its text and must not flip the
 * scanner into "inside quotes" for the rest of the file.
 */
export function splitCsvRecords(text: string, delimiter: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  let atFieldStart = true;
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
      continue;
    }
    if (char === '"' && atFieldStart) {
      inQuotes = true;
    }
    current += char;
    atFieldStart = char === delimiter || (atFieldStart && (char === ' ' || char === '\t'));
  }
  records.push(current);
  return records;
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

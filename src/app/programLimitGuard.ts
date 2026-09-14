import { ProgramLimitReachedError } from '../lib/programSlots';

/**
 * Create a programme, or show the limit sheet when the free limit refuses it.
 *
 * The provider throws `ProgramLimitReachedError` so that no caller can quietly
 * hand out a slot — but a caller that does not catch it fails just as quietly
 * the other way. A CSV import at the limit awaited the throw, reset its
 * spinner and sat there with nothing said (found 2026-09-14). Resolves to the
 * new template id, or null when the sheet was shown instead; any other failure
 * still rejects.
 */
export async function createUnlessAtLimit(
  create: () => Promise<string>,
  showLimit: () => void,
): Promise<string | null> {
  try {
    return await create();
  } catch (error) {
    if (error instanceof ProgramLimitReachedError) {
      showLimit();
      return null;
    }
    throw error;
  }
}

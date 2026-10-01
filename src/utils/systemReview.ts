/**
 * The system's own review prompt (iPhone): App Review allows no custom one in
 * front of it (guideline 5.6.1). The system decides whether it actually
 * shows — at most three times a year — and never says whether it did.
 *
 * Lazy, like the other optional native modules: a build without it does
 * nothing rather than crash.
 */
export async function requestSystemReview(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StoreReview = require('expo-store-review') as {
      isAvailableAsync(): Promise<boolean>;
      requestReview(): Promise<void>;
    };
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch {
    // Asking for a review is never worth interrupting the reader over.
  }
}

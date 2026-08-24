/**
 * TEMPORARY development switch: log coach transcripts on the server.
 *
 * The privacy policy says the endpoint does not log prompts, and that is the
 * shipped truth. During development the only account is the developer's own,
 * and reading the real conversations back is how the coach gets better — so
 * for now the endpoint may log question + answer (never the training
 * context) when BOTH this constant and the AI_COACH_DEBUG_TRANSCRIPTS
 * environment variable are on.
 *
 * tests/releaseReadiness.test.cjs fails while this is true: the log cannot
 * reach Play by being forgotten. Flip to false (or delete the file) before
 * release, and unset the variable in Vercel.
 */
export const AI_COACH_DEBUG_TRANSCRIPTS = true;

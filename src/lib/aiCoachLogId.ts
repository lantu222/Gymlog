/**
 * The random label a reader's kept coach copies are filed under.
 *
 * Its own module because two places need it and neither owns it: the screen
 * that mints it on the first yes, and the tests that check its shape. Pure,
 * so it belongs in lib rather than in a screen.
 *
 * `Math.random` is enough, the same call the analytics install id makes: this
 * has to be unique among a handful of readers, not unguessable. It is never
 * sent to Anthropic, never joined to an account, and never reused after a
 * withdrawal — turning the last line off clears it, and the next yes mints a
 * new one, so two stretches of consent cannot be joined into one history.
 */
export function randomLogId(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

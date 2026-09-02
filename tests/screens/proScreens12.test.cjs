const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const unlock = read('src', 'screens', 'PremiumUnlockScreen.tsx');
const end = read('src', 'screens', 'MembershipEndScreen.tsx');
const tab = read('src', 'app', 'renderProfileTab.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/**
 * GAINER Pro screens, parts 01 and 02 (design 2026-09-02). One grammar: a
 * list of before → after, one filled action per screen, state in violet,
 * the destructive choice a text line under the safe one. Gold, green and
 * filled red are out.
 */
module.exports = [
  {
    name: 'pro live: a violet state badge that names the moment, violet chips, one action and a quiet link',
    run() {
      // The green pip is gone with its glyph; the badge says when.
      assert.doesNotMatch(unlock, /promo\.proOn|statusDot|CheckGlyph|theme\.green|theme\.gold|HIGHLIGHT_INK/);
      assert.match(unlock, /'unlock\.state\.liveSince', \{ time: formatTime\(liveSince, language\) \}/);
      assert.match(unlock, /stateBadge: \{[^}]*backgroundColor: theme\.purpleLight/s);
      assert.match(unlock, /nowChip: \{[^}]*backgroundColor: theme\.purpleLight/s);
      // The headline's count is derived and spelled: "Five caps just came off".
      assert.match(unlock, /'unlock\.headline', \{ count: countWord\(PRO_UNLOCK_CARDS\.length, language\) \}/);
      // One filled action in the accent, then the quiet link to the whole list.
      assert.match(unlock, /cta: \{[^}]*backgroundColor: theme\.highlight/s);
      assert.equal((unlock.match(/styles\.cta,/g) ?? []).length, 1, 'one filled button');
      assert.match(unlock, /onPress=\{onSeeEverything\}[\s\S]{0,200}'unlock\.seeEverything'/);
      assert.match(tab, /onSeeEverything=\{\(\) => navigate\(\{ tab: 'profile', screen: 'premium' \}\)\}/);
      // No purchase record, no invented time: the badge drops to a bare "live".
      assert.match(tab, /liveSince=\{preferences\.mockSubscriptionPurchasedAt \?\? null\}/);
      assert.doesNotMatch(tab, /liveSince=\{[^}]*new Date\(\)/);
      for (const key of ['unlock.state.liveSince', 'unlock.seeEverything', 'unlock.headline']) {
        assert.equal(i18n.split(`'${key}': '`).length - 1, 2, `${key} in EN and FI`);
      }
      assert.ok(i18n.includes("'unlock.cta': 'Back to the app'"));
    },
  },
  {
    name: 'end membership: the rows run backwards in violet → grey, Keep is the only button, ending is a dated red line',
    run() {
      // Chips, not struck text: what you have (violet) → what it becomes (grey).
      assert.match(end, /haveChip: \{[^}]*backgroundColor: theme\.purpleLight/s);
      assert.match(end, /becomesChip: \{[^}]*backgroundColor: theme\.surfaceSoft/s);
      assert.doesNotMatch(end, /endButton: \{|lossNow: \{|lossWas: \{/);
      // The safe choice is the filled button and sits first; ending is a text
      // line beneath it that names the date.
      const footer = end.slice(end.indexOf('styles.footer'), end.indexOf('function vars'));
      const keep = footer.indexOf('styles.keepButton');
      const endLink = footer.indexOf('styles.endLink');
      assert.ok(keep > 0 && endLink > keep, 'Keep first, the end line under it');
      assert.match(footer, /'subs\.end\.ctaOn', \{ date: formatDate\(endsAt, language\) \}/);
      assert.match(end, /endLinkText: \{[^}]*color: theme\.danger/s);
      assert.match(end, /keepButton: \{[^}]*backgroundColor: theme\.highlight/s);
      // No filled red anywhere, and no fixed red: the danger token is themed
      // text, so the line clears contrast on the dark surface too.
      assert.doesNotMatch(end, /DANGER_FILL|backgroundColor: theme\.danger|#DC2626/i);
      // The lead names the count from the list, not a typed "five" — and
      // lower-case, because it sits mid-sentence ("these five go back").
      assert.match(end, /count: countWord\(PRO_UNLOCK_CARDS\.length, language, 'inline'\)/);
      // The end date is counted from the purchase instant, like the
      // subscription screen's — two screens must not name two dates.
      assert.match(tab, /periodEndsAt=\{nextChargeAt\(\s*preferences\.mockSubscriptionTerm,\s*preferences\.mockSubscriptionPurchasedAt \?\? MOCK_BILLING\.lastChargedAt,\s*\)\}/);
      assert.ok(i18n.includes("'subs.end.keeps': 'Your log, your programmes and your records stay. Nothing is deleted — only these go quiet.'"));
      for (const key of ['subs.end.paidUntil', 'subs.end.ctaOn', 'subs.end.title']) {
        assert.equal(i18n.split(`'${key}': '`).length - 1, 2, `${key} in EN and FI`);
      }
    },
  },
];

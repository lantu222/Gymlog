const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { darkTheme, lightTheme } = require('../../.test-dist/theming.js');
const { HG } = require('../../.test-dist/lightTheme.js');
const { resolveThemeName, resolveThemeRowState } = require('../../.test-dist/lib/themePreference.js');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

module.exports = [
  {
    name: 'theming: the light theme is the palette, not a copy of it',
    run() {
      // A copy would drift the moment someone edits one and not the other —
      // which is exactly how nine screens ended up with a stale background.
      assert.equal(lightTheme, HG, 'lightTheme must be the same object as HG');
    },
  },
  {
    name: 'theming: every Theme token exists in the palette and vice versa',
    run() {
      // The Theme interface is what components read. If the palette grows a
      // token the interface does not declare, the first component to want it
      // has to reach around the theme — and that is how a second source of
      // truth starts.
      const source = read('src/theming.ts');
      const body = /export interface Theme \{([\s\S]*?)\n\}/.exec(source);
      assert.ok(body, 'Theme interface not found');

      const declared = [...body[1].matchAll(/^\s*(\w+):\s*string;/gm)].map((match) => match[1]).sort();
      const palette = Object.keys(HG).sort();

      assert.deepEqual(declared, palette);
    },
  },
  {
    name: 'theming: the dark theme fills exactly the same token shape',
    run() {
      // A missing token is an `undefined` colour, which React Native renders as
      // transparent rather than throwing — so it would ship as an invisible
      // element, not a crash. This is the check that cannot be skipped.
      assert.deepEqual(Object.keys(darkTheme).sort(), Object.keys(HG).sort());
      for (const [token, value] of Object.entries(darkTheme)) {
        assert.equal(typeof value, 'string', `${token} must be a colour string`);
        // Hex for solid tokens, rgba() for the washes that have to blend with
        // whatever is behind them (highlightSoft over the tab bar's pill).
        assert.match(
          value,
          /^(#[0-9A-Fa-f]{6}|rgba\([\d\s.,]+\))$/,
          `${token} must be a hex or rgba colour`,
        );
      }
    },
  },
  {
    name: 'theming: the two themes actually differ where it matters',
    run() {
      // Guards against a dark palette that was copied from the light one and
      // never finished — the failure mode would be a "dark" theme that is
      // simply the light one with a different name.
      for (const token of ['bg', 'surface', 'ink', 'muted', 'border', 'purple']) {
        assert.notEqual(darkTheme[token], HG[token], `${token} must not be shared`);
      }
      // ink/surface are an inverting pair: a black button becomes a white one.
      // If they stopped inverting, every ink-filled button would go unreadable.
      assert.ok(HG.ink < HG.surface, 'light: ink darker than surface');
      assert.ok(darkTheme.ink > darkTheme.surface, 'dark: ink lighter than surface');
    },
  },
  {
    name: 'theming: choosing a theme goes through the Pro gate, never the provider',
    run() {
      // The provider takes a theme; it does not decide one. Keeping the
      // entitlement out of this file is what lets a screen be rendered under
      // either theme in a test without faking a subscription.
      const source = read('src/theming.ts');
      assert.doesNotMatch(source, /isProUnlocked|promoProUntil|AppPreferences/);
      assert.match(source, /theme = lightTheme/);

      const resolver = read('src/lib/themePreference.ts');
      assert.match(resolver, /isProUnlocked/);
      assert.match(resolver, /darkThemeEnabled && isProUnlocked/);

      // The vestigial preference is still gone: it was typed as the single
      // value 'dark', stored 'dark', and read by nothing.
      const models = read('src/types/models.ts');
      assert.doesNotMatch(models, /ThemePreference/);
    },
  },
  {
    name: 'theming: dark is gated on Pro and the choice survives losing it',
    run() {
      const free = { darkThemeEnabled: true, promoProUntil: null, adaptiveCoachPremiumUnlocked: false };
      assert.equal(resolveThemeName(free), 'light', 'free users must not get the paid theme');
      assert.deepEqual(resolveThemeRowState(free), { locked: true, value: false });

      const pro = { ...free, adaptiveCoachPremiumUnlocked: true };
      assert.equal(resolveThemeName(pro), 'dark');
      assert.deepEqual(resolveThemeRowState(pro), { locked: false, value: true });

      // Pro but toggled off stays light, and the stored choice is never
      // rewritten — losing Pro must not silently erase what the user picked.
      assert.equal(resolveThemeName({ ...pro, darkThemeEnabled: false }), 'light');
      assert.equal(free.darkThemeEnabled, true);
    },
  },
  {
    name: 'theming: style factories are built per theme, not per render',
    run() {
      const source = read('src/theming.ts');
      assert.match(source, /WeakMap/, 'styles should be cached per factory');
      assert.match(source, /useMemo/);
    },
  },
];

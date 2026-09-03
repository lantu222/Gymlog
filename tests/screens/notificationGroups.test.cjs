const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const screen = read('src', 'screens', 'NotificationsScreen.tsx');
const settings = read('src', 'screens', 'SettingsScreen.tsx');
const profile = read('src', 'screens', 'ProfileScreen.tsx');
const tab = read('src', 'app', 'renderProfileTab.tsx');
const i18n = read('src', 'lib', 'i18n.ts');

/** Slices between two anchors, failing loudly when one is missing. */
function between(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0, `anchor missing: ${from}`);
  assert.ok(end > start, `anchor missing after ${from}: ${to}`);
  return source.slice(start, end);
}

/**
 * Settings / Notifications / My data (design 2026-09-03). Settings and My data
 * are marked unchanged in the design except for one row; the work is the
 * Notifications restructure.
 */
module.exports = [
  {
    name: 'notifications: the flat lists are gone and the three groups render from the lib',
    run() {
      // The two old section labels and their hand-rolled arrays.
      assert.doesNotMatch(screen, /REST_TOGGLES|TRAINING_TOGGLES/);
      assert.doesNotMatch(screen, /'notif\.rest\.section'|'notif\.training'/);
      assert.match(screen, /NOTIFICATION_GROUPS\.map\(renderGroup\)/);
      assert.match(screen, /<SectionLabel label=\{t\(language, 'notif\.section\.what'\)\} \/>/);
      // The reading, the summary and the toggle all come from the lib rather
      // than being recomputed in the view.
      assert.match(screen, /readNotificationGroup\(group, prefs\)/);
      assert.match(screen, /notificationGroupSummary\(group, prefs, language, t\)/);
      assert.match(screen, /toggleNotificationGroup\(group, next, next \? memos\[group\.key\] \?\? null : null\)/);
      assert.match(screen, /rememberNotificationGroup\(group, prefs\)/);
    },
  },
  {
    name: 'notifications: every switch is still reachable, one tap in, and still writes its own field',
    run() {
      // Details opens the same switches; the row toggle writes the switch's
      // own patch, not a group-level guess.
      assert.match(screen, /group\.switches\.map\(\(item, index\) =>/);
      assert.match(screen, /onChange=\{\(next\) => handleSwitchToggle\(group, item, next\)\}/);
      assert.match(screen, /onChange\(item\.patch\(next\)\)/);
      assert.match(screen, /value=\{effectiveEnabled && item\.isOn\(prefs\)\}/);
      // Turning off the last switch by hand empties the group, which closes
      // the card — so it remembers first, or the next group-on would restore
      // the defaults over the reader's own choices.
      const emptying = between(screen, 'const handleSwitchToggle', 'const remindersWithoutDays');
      assert.match(emptying, /readNotificationGroup\(group, prefs\)\.onCount === 1 && item\.isOn\(prefs\)/);
      assert.match(emptying, /rememberNotificationGroup\(group, prefs\)/);
      assert.match(screen, /'notif\.group\.details'/);
      assert.match(screen, /'notif\.group\.hide'/);
      // The pickers that belong to a switch moved with it.
      assert.match(screen, /item\.key === 'sessionReminders' && prefs\.sessionReminders/);
      assert.match(screen, /item\.key === 'measurement' && measureKind/);
      assert.match(screen, /'notif\.noDaysTitle'/);
      assert.match(screen, /REMINDER_TIMES\.map/);
      assert.match(screen, /MEASUREMENT_REMINDER_KINDS\.map/);
      assert.match(screen, /WEEKDAY_KEYS\.map/);
    },
  },
  {
    name: 'notifications: the master switch still gates everything, and a break still reads as off',
    run() {
      // The permission rules are untouched by the restructure.
      assert.match(screen, /const effectiveEnabled = prefs\.pushEnabled && !onTrainingBreak/);
      assert.match(screen, /void requestPermission\(\)\.then\(\(granted\) => \{/);
      assert.match(screen, /onChange\(\{ pushEnabled: granted \}\)/);
      assert.match(screen, /checkPermission\(\)\.then\(\(granted\) => \{/);
      assert.match(screen, /pointerEvents=\{effectiveEnabled \? 'auto' : 'none'\}/);
      // A group card reads off during a break, like the switches inside it.
      assert.match(screen, /const groupOn = effectiveEnabled && reading\.isOn/);
      assert.match(screen, /'notif\.breakNote'/);
    },
  },
  {
    name: 'notifications: the level is one segmented control, not three radio rows',
    run() {
      assert.match(screen, /import \{ Seg \} from '\.\.\/components\/Seg'/);
      const level = between(screen, "t(language, 'notif.howMuch')", "styles.footer");
      assert.match(level, /<Seg\s+grow/);
      assert.match(level, /value=\{prefs\.level\}/);
      assert.match(level, /onChange=\{\(next\) => onChange\(\{ level: next \}\)\}/);
      assert.match(level, /'notif\.level\.restNote'/);
      // The hand-built radio is gone.
      assert.doesNotMatch(screen, /RadioDot|radioOuter|radioInner/);
    },
  },
  {
    name: 'settings: Rate Vinha leaves the About card for Send feedback, and keeps its place on the Profile',
    run() {
      const about = between(settings, "t(language, 'settings.section.about')", "'settings.section.dangerZone'");
      assert.match(about, /'settings\.feedback'/);
      assert.match(about, /buildFeedbackMailto\(language, appInfo\.version\)/);
      assert.doesNotMatch(about, /settings\.rate|onOpenRating/);
      // The star is not gone from the app — the Profile still offers it.
      assert.match(profile, /t\(language, 'settings\.rate'\)/);
      assert.match(tab, /onOpenRating=\{\(\) => setRatingSheetVisible\(true\)\}/);
      // And Settings no longer asks for a prop it does not use.
      assert.doesNotMatch(settings, /onOpenRating/);
      // The rating row's subtitle went with it rather than lingering unused.
      assert.equal(i18n.includes("'settings.rate.sub'"), false);
      // Both languages carry the new row.
      assert.equal((i18n.match(/'settings\.feedback':/g) ?? []).length, 2);
      assert.equal((i18n.match(/'notif\.group\.workout':/g) ?? []).length, 2);
    },
  },
];

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
const screen = read('src', 'screens', 'MilestonesScreen.tsx');
const profile = read('src', 'screens', 'ProfileScreen.tsx');
const tab = read('src', 'app', 'renderProfileTab.tsx');
const app = read('App.tsx');
const routes = read('src', 'navigation', 'routes.ts');
const bar = read('src', 'components', 'BottomTabBar.tsx');

/** Slices between two anchors, failing loudly when one is missing. */
function between(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0, `anchor missing: ${from}`);
  assert.ok(end > start, `anchor missing after ${from}: ${to}`);
  return source.slice(start, end);
}

/**
 * The milestones page (user 2026-09-03): the reached rungs collected on a
 * page of their own, opened from the Profile's NEXT MILESTONE card.
 */
module.exports = [
  {
    name: 'milestones: the route exists, the tab renders it, and back returns to the Profile',
    run() {
      assert.match(routes, /tab: 'profile';\s*\/\*\*[^*]*\*\/\s*screen: 'milestones';/);
      assert.match(tab, /import \{ MilestonesScreen \} from '\.\.\/screens\/MilestonesScreen'/);
      const branch = between(tab, "if (route.screen === 'milestones')", "if (route.screen === 'promo')");
      assert.match(branch, /<MilestonesScreen/);
      assert.match(branch, /ledger=\{milestoneLedger\}/);
      assert.match(branch, /lifetime=\{lifetimeSummary\}/);
      assert.match(branch, /onBack=\{\(\) => navigateBack\(\{ tab: 'profile', screen: 'list' \}\)\}/);
    },
  },
  {
    name: 'milestones: the facts are read once in App and the ledger is built from them in the unit the reader lifts in',
    run() {
      assert.match(app, /import \{ buildMilestoneLedger, getMilestoneFacts \} from '\.\/src\/lib\/milestoneFacts'/);
      assert.match(app, /const milestoneFacts = useMemo\(\s*\(\) => getMilestoneFacts\(database, lifetimeSummary, recordDates\)/);
      assert.match(app, /const milestoneLedger = useMemo\(\(\) => buildMilestoneLedger\(milestoneFacts, unitPreference\), \[milestoneFacts, unitPreference\]\)/);
      // One date per lift, the earliest of its kinds — the same lifts distinctRecordCount counts.
      const dates = between(app, 'const recordDates = useMemo', 'const milestoneFacts');
      assert.match(dates, /personalRecords\.weight, \.\.\.personalRecords\.reps, \.\.\.personalRecords\.volume/);
      assert.match(dates, /Date\.parse\(record\.performedAt\) < Date\.parse\(known\)/);
      // Both travel to the tab.
      const deps = between(app, 'lifetimeSummary,\n      milestoneFacts,', 'distinctRecordCount,\n    });');
      assert.match(deps, /milestoneLedger,/);
      assert.match(tab, /milestoneFacts: React\.ComponentProps<typeof ProfileScreen>\['milestoneFacts'\]/);
      assert.match(tab, /milestoneLedger: React\.ComponentProps<typeof MilestonesScreen>\['ledger'\]/);
    },
  },
  {
    name: 'milestones: the Profile card presses through to the page and its footer counts the fallen rungs',
    run() {
      assert.match(tab, /milestoneFacts=\{milestoneFacts\}/);
      assert.match(tab, /reachedMilestoneCount=\{milestoneLedger\.reachedCount\}/);
      assert.match(tab, /onOpenMilestones=\{\(\) => navigate\(\{ tab: 'profile', screen: 'milestones' \}\)\}/);
      const block = between(profile, "t(language, 'profile.section.nextMilestone')", '{/* PERSONAL RECORDS');
      assert.match(block, /<Pressable\s+accessibilityRole="button"\s+accessibilityLabel=\{t\(language, 'milestones\.title'\)\}\s+onPress=\{onOpenMilestones\}/);
      assert.match(block, /milestoneCardFooter\(reachedMilestoneCount, language\)/);
      // The newer families' figures reach the card.
      assert.match(profile, /totals: milestoneFacts \? totalsFromFacts\(milestoneFacts\) : undefined/);
      // The label keeps no right action: the card itself is the door.
      assert.match(profile, /<SectionLabel label=\{t\(language, 'profile\.section\.nextMilestone'\)\} \/>/);
    },
  },
  {
    name: 'milestones: the page lists the reached rungs first, with a day each, and the ladder\'s front row below',
    run() {
      assert.match(screen, /import \{ ScreenHeaderTitle \} from '\.\.\/components\/ScreenHeaderTitle'/);
      assert.match(screen, /<ScreenHeaderTitle title=\{t\(language, 'milestones\.title'\)\} \/>/);
      assert.match(screen, /buildMilestoneLedgerRows\(\{ ledger, lifetime, unitPreference, language \}\)/);
      const reached = screen.indexOf("'milestones.section.reached'");
      const upNext = screen.indexOf("'milestones.section.upNext'");
      assert.ok(reached > 0 && upNext > reached, 'reached before up next');
      const reachedBlock = screen.slice(reached, upNext);
      assert.match(reachedBlock, /rows\.reached\.length === 0/);
      assert.match(reachedBlock, /'milestones\.emptyTitle'/);
      assert.match(reachedBlock, /rows\.reached\.map/);
      // Nothing on the page is greyed out, locked, or a badge.
      assert.doesNotMatch(screen, /locked|opacity: 0\.[0-4]|badge|trophy/i);
      // Same bar rule as the card: nearest in the accent, the rest violet.
      assert.match(screen, /index === 0 \? theme\.highlight : theme\.purpleBright/);
      assert.match(screen, /paddingBottom: layout\.bottomTabBarReserve/);
    },
  },
  {
    name: 'tab bar: in light the AI orb is deep violet with a white label; dark keeps its dark orb',
    run() {
      // User 2026-09-03: "tumma purppura ympyrä ja ai teksti olisi vaalea".
      assert.match(bar, /: \[theme\.purpleBright, theme\.purple, theme\.purpleDark\]/);
      assert.match(bar, /const aiCircleBackground = aiDark \? '#1B1530' : theme\.purpleDark/);
      assert.match(bar, /const aiLabelColor = aiDark \? theme\.highlight : theme\.onHighlight/);
      assert.doesNotMatch(bar, /'#6D28D9'|'#E3D4FF'|'#F2ECFF'/);
    },
  },
];

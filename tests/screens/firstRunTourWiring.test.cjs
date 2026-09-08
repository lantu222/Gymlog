const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The first-run tour touches six files that Node cannot run. These guards
 * read them, and each one claims a sliced region rather than a whole file,
 * so a comment cannot satisfy its own guard (feedback-guards-that-pass-themselves).
 */
const ROOT = path.join(__dirname, '..', '..');
// Working copies are CRLF on Windows (core.autocrlf); the markers below are LF.
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const tourSource = read('src/components/FirstRunTour.tsx');
const homeSource = read('src/screens/HomeScreen.tsx');
const progressSource = read('src/screens/ProgressScreen.tsx');
const profileSource = read('src/screens/ProfileScreen.tsx');
const barSource = read('src/components/BottomTabBar.tsx');
const shellSource = read('src/components/AppShell.tsx');
const appSource = read('App.tsx');
const settingsSource = read('src/screens/SettingsScreen.tsx');
const databaseSource = read('src/storage/database.ts');

/** The JSX the layer returns while a beat is showing. */
function tourRender() {
  const start = tourSource.indexOf('  return (\n    <View ref={rootRef}');
  const end = tourSource.indexOf('const styles = StyleSheet.create', start);
  assert.ok(start > 0 && end > start, 'tour render block not found');
  return stripComments(tourSource.slice(start, end));
}

module.exports = [
  {
    name: 'first-run tour: the layer never blocks — box-none root, no scrim, no full-screen pressable',
    run() {
      const render = tourRender();
      assert.match(render, /<View ref=\{rootRef\} pointerEvents="box-none" style=\{StyleSheet\.absoluteFill\}/);
      // Only the callout takes touches; the ring is inert.
      assert.match(render, /pointerEvents="none"[\s\S]{0,200}styles\.ring/);
      assert.doesNotMatch(render, /scrim|Scrim|dim=|AdvanceScrim/);
      // Nothing in the render fills the screen with something pressable.
      assert.doesNotMatch(render, /<Pressable[^>]*StyleSheet\.absoluteFill/);
    },
  },
  {
    name: 'first-run tour: every beat advances from its own button, and the way out is on every beat',
    run() {
      const render = tourRender();
      assert.match(render, /onPress=\{advance\}/);
      assert.match(render, /onPress=\{finish\}[\s\S]{0,400}'tour\.skip'/);
      // A 44 dp target on a small underlined link: padding plus hitSlop.
      assert.match(render, /hitSlop=\{\{ top: 12, bottom: 12, left: 12, right: 12 \}\}/);
      assert.match(render, /'tour\.done' : 'tour\.next'/);
    },
  },
  {
    name: 'first-run tour: the accent is the theme\'s pressable colour, and its ink comes with it',
    run() {
      const body = stripComments(tourSource);
      assert.match(body, /const accent = theme\.highlight;/);
      // The button is the shared cut button in its accent variant, which
      // pairs theme.highlight with theme.onHighlight in one place.
      assert.match(tourRender(), /<CutButton size="md" variant="accent"/);
      const cutButton = stripComments(read('src/components/CutButton.tsx'));
      assert.match(cutButton, /variant === 'accent'\s*\?\s*theme\.highlight/);
      assert.match(cutButton, /variant === 'accent'\s*\?\s*theme\.onHighlight/);
      // The light callout is the app's own dark-violet layer; dark lifts.
      assert.match(body, /theme\.proSheetTop/);
      assert.match(body, /theme\.purpleLight/);
      assert.doesNotMatch(body, /#FF8A4C|#6D28D9/, 'no hex accents — the theme decides');
    },
  },
  {
    name: 'first-run tour: the bar sweep runs on the bar\'s own highlight and hands it back when done',
    run() {
      const bar = stripComments(barSource);
      assert.match(bar, /const activeKey = sweep \? sideTabs\.find\(\(tab\) => tab\.stop === sweep\)\?\.key \?\? null : routeKey;/);
      assert.match(bar, /const aiLit = aiActive \|\| sweep === 'ai';/);
      for (const id of ['bar.pill', 'bar.ai']) {
        assert.match(bar, new RegExp(`tourTargets\\?\\.register\\('${id.replace('.', '\\.')}', node\\)`), id);
      }
      assert.match(bar, /onRef=\{\(node\) => tourTargets\?\.register\(`bar\.\$\{tab\.stop\}`, node\)\}/);
      // The layer tells the bar to let go on every exit.
      const layer = stripComments(tourSource);
      assert.match(layer, /onSweep\(null\);\s*setPhase\('done'\)/);
    },
  },
  {
    name: 'first-run tour: leaving counts as seen only once a callout has been on screen',
    run() {
      // PR #83 review: unmounting during the start delay marked the surface
      // seen with nothing shown, so flicking through the tabs on a first open
      // burned all three tours. The unmount path is gated on a shown flag
      // that the enter effect sets.
      const layer = stripComments(tourSource);
      const unmount = layer.slice(layer.indexOf('const shownRef = useRef(false);'), layer.indexOf('// Reduced motion decides'));
      assert.match(unmount, /if \(shownRef\.current\) \{\s*finishRef\.current\(\);\s*\}/);
      assert.doesNotMatch(unmount, /\(\) => \(\) => finishRef\.current\(\)/, 'no unconditional finish on unmount');
      const enter = layer.slice(layer.indexOf('pendingShowRef.current = null;'), layer.indexOf('Animated.parallel([', layer.indexOf('pendingShowRef.current = null;')));
      assert.match(enter, /shownRef\.current = true;/);
    },
  },
  {
    name: 'first-run tour: Home registers its four targets and its scroller',
    run() {
      const home = stripComments(homeSource);
      for (const id of ['home.week', 'home.hero', 'home.program', 'home.cards']) {
        assert.match(home, new RegExp(`register\\('${id.replace('.', '\\.')}', node\\)`), id);
      }
      // Without a plan the start row is the hero; with one, the session box is.
      assert.match(home, /ref=\{heroStartsSession \? undefined : \(node\) => tourTargets\?\.register\('home\.hero', node\)\}/);
      assert.match(home, /useTourScroller\('home', tourTargets\)/);
      assert.match(home, /onScroll=\{tourScroller\.onScroll\}/);
    },
  },
  {
    name: 'first-run tour: Progress and Profile register two targets each and their scrollers',
    run() {
      const progress = stripComments(progressSource);
      assert.match(progress, /register\('progress\.chart', node\)/);
      assert.match(progress, /register\('progress\.calendar', node\)/);
      assert.match(progress, /useTourScroller\('progress', tourTargets\)/);
      assert.match(progress, /onScroll=\{tourScroller\.onScroll\}/);
      const profile = stripComments(profileSource);
      assert.match(profile, /register\('profile\.milestone', node\)/);
      assert.match(profile, /register\('profile\.settings', node\)/);
      assert.match(profile, /useTourScroller\('profile', tourTargets\)/);
      assert.match(profile, /onScroll=\{tourScroller\.onScroll\}/);
      // The one hook is where the scroller is registered and the offset kept.
      const hook = stripComments(read('src/features/tour/useTourScroller.ts'));
      assert.match(hook, /tourTargets\.registerScroller\(surface, \{/);
      assert.match(hook, /offsetRef\.current = event\.nativeEvent\.contentOffset\.y;\s*tourTargets\?\.notifyScroll\(\);/);
    },
  },
  {
    name: 'first-run tour: the layer is drawn above the bar, only on a due surface, and goes first in Home\'s prompt queue',
    run() {
      const shell = stripComments(shellSource);
      assert.match(shell, /\{tabBar\}\s*\{overlay\}/);
      const app = stripComments(appSource);
      assert.match(app, /overlay=\{tourElement\}/);
      const trigger = app.slice(app.indexOf('const tourActive ='), app.indexOf('const homeTourActive'));
      assert.match(trigger, /brandSplashDone/);
      assert.match(trigger, /!onboardingActive/);
      assert.match(trigger, /!setupHandoffActive/);
      assert.match(trigger, /isTourDue\(preferences\.firstRunToursSeen, tourSurface\)/);
      // The three Home cards wait for the tour: the two queued ones through
      // the queue itself (lib/homePrompts), the widget card at its own gate.
      const queue = app.slice(app.indexOf('const homePrompt = resolveHomePrompt('), app.indexOf('});', app.indexOf('const homePrompt = resolveHomePrompt(')));
      assert.match(queue, /tourActive: homeTourActive/);
      const homeJsx = app.slice(app.indexOf('<HomeScreen'), app.indexOf('<NewProgramSheet'));
      assert.match(homeJsx, /!homeTourActive && homeWidgetState\?\.supported/);
      assert.match(homeJsx, /tourTargets=\{tourRegistry\}/);
      const prompts = stripComments(read('src/lib/homePrompts.ts'));
      assert.match(prompts, /if \(input\.tourActive\) \{\s*return null;\s*\}/);
    },
  },
  {
    name: 'first-run tour: Settings offers the replay, and the loader normalises the seen-list through lib',
    run() {
      const settings = stripComments(settingsSource);
      assert.match(settings, /'settings\.replayTour'[\s\S]{0,300}onPress=\{onReplayTour\}/);
      const loader = stripComments(databaseSource);
      assert.match(loader, /firstRunToursSeen: normalizeFirstRunToursSeen\(input\?\.preferences\?\.firstRunToursSeen\)/);
    },
  },
];

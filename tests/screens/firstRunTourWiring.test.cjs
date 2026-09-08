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
    /**
     * This guard used to assert the opposite, and the reversal is the point.
     * Round 1's layer never blocked; round 2's walk on the phone showed what
     * that costs, because the page moves under a beat for reasons the layer
     * cannot see, and a day block folded open is taller than the whole band —
     * there is nowhere for its callout to stand. The reader chose a tour that
     * simply runs (2026-09-08). So the dim doubles as a shield.
     */
    name: 'first-run tour: the layer is guided — it dims the page and takes its touches',
    run() {
      const render = tourRender();
      assert.match(render, /<View ref=\{rootRef\} pointerEvents="box-none" style=\{StyleSheet\.absoluteFill\}/);
      // The shield: full screen, the responder for anything that reaches it,
      // and the ring's shape cut out so the beat's subject still shows.
      assert.match(
        render,
        /pointerEvents="auto"\s*onStartShouldSetResponder=\{\(\) => true\}\s*style=\{\[StyleSheet\.absoluteFill, dimStyle\]\}/,
      );
      assert.match(render, /dimCutoutPath\(size, ring, spot\.shape\)/);
      assert.match(render, /fillRule="evenodd"/);
      // Not a Pressable: a shield is not a control and must not be announced
      // as one, nor take a press the reader meant for the page.
      assert.doesNotMatch(render, /<Pressable[^>]*StyleSheet\.absoluteFill/);
      // The ring is inert; the shield beneath it is what blocks.
      assert.match(render, /pointerEvents="none"[\s\S]{0,200}styles\.ring/);
      // Two views reading one value through two style objects — never one
      // interpolated node handed to two views (ref-animated-node-one-view).
      const body = stripComments(tourSource);
      assert.match(body, /const dimStyle = useRef\(\{ opacity: ringAnim \}\)\.current;/);
    },
  },
  {
    /**
     * A shield makes every imperative in the copy a lie: nothing on the page
     * can be tapped while a beat is up. The three Home beats used to open
     * with one ("Napauta viikkoriviä...", "Tap to see today's exercises"),
     * so they say what is there instead of what to do.
     */
    name: 'first-run tour: no beat tells the reader to tap something the shield refuses',
    run() {
      const dict = read('src/lib/i18n.ts');
      const lines = dict.split('\n').filter((line) => /'tour\.home\.(week|hero|cards|program)':/.test(line));
      assert.equal(lines.length, 8, 'four Home beats in two dictionaries, one line each');
      for (const line of lines) {
        assert.doesNotMatch(line, /: ['"](Napauta|Tap )/, line.trim());
        assert.doesNotMatch(line, /(Lisää kortti mistä|Add a card for)/, line.trim());
      }
      // The way out is still one tap, and it is on every beat — a guided tour
      // that could not be left would be a trap.
      assert.match(tourRender(), /onPress=\{finish\}[\s\S]{0,400}'tour\.skip'/);
    },
  },
  {
    /**
     * Three of the reader's five reports were the same bug: the page moved
     * under a beat — a month panel opening into the week card, a workout list
     * folding — and the ring stayed where it was first measured. Scroll events
     * do not report any of that, so the beat re-measures on a tick.
     */
    name: 'first-run tour: a section beat keeps measuring its target, and only writes when it moved',
    run() {
      const layer = stripComments(tourSource);
      const follow = layer.slice(layer.indexOf('const sync = () => {'), layer.indexOf('clearInterval(timer);'));
      assert.ok(follow.length > 80, 'the follow effect moved - recheck by hand');
      assert.match(follow, /setInterval\(sync, TOUR_REMEASURE_MS\)/);
      assert.match(follow, /readSpot\(beat, \{ fallback: false \}\)/);
      // And not before the beat's own opening scroll has landed its first
      // reading: a ring measured mid-scroll sits across two sections.
      assert.match(follow, /if \(cancelled \|\| inFlight \|\| !beatReadyRef\.current\)/);
      // The tick is the only measurement clock: measuring on the scroll event
      // as well re-rendered a full-screen path thirty times a second. The
      // subscription is there to note when the reader last touched the page.
      assert.match(follow, /registry\.subscribeScroll\(\(\) => \{\s*lastScrollAtRef\.current = Date\.now\(\);\s*\}\);/);
      assert.match(follow, /sameSpot\(current, next\) \? current : next/, 'an unchanged rect is not a re-render');

      // And what a measurement is: the ring's target, the callout's anchor,
      // with the anchor standing in when the fine target is not on screen.
      const read = layer.slice(layer.indexOf('const readSpot = useCallback('), layer.indexOf('const finish = useCallback('));
      assert.match(read, /registry\.measure\(beat\.target\)/);
      assert.match(read, /registry\.measure\(beat\.anchor as TourTargetId\)/);
      assert.match(read, /const ringWindow = targetRect \?\? anchorRect;/);
      // ...but only when a beat opens. A ref re-attaching mid-render answers
      // nothing for a frame, and a partial reading on the tick would make the
      // ring flit between the chevron and the whole block.
      assert.match(
        read,
        /if \(!options\.fallback && \(!targetRect \|\| \(wantsAnchor && !anchorRect\)\)\) \{\s*return null;/,
      );
      assert.match(read, /sectionRingShape\(beat, targetRect !== null\)/);

      // A callout clamped back over its target buys exactly one more scroll.
      const rescroll = layer.slice(layer.indexOf('if (!calloutCoversTarget('), layer.indexOf('const ringShape = spot?.shape'));
      assert.match(rescroll, /rescrolledForRef\.current === spot\.anchor\.height/);
      assert.match(rescroll, /Date\.now\(\) - lastScrollAtRef\.current < TOUR_RESCROLL_QUIET_MS/);
    },
  },
  {
    /**
     * The hero beat rings the workout row's fold and asks to be tapped, so the
     * ring breathes — and the block is shut before the beat starts, through a
     * prop rather than the layer reaching into a screen's state.
     */
    name: 'first-run tour: the hero beat rings the workout fold, which pulses, on a block the screen has shut',
    run() {
      const home = stripComments(homeSource);
      assert.match(home, /register\('home\.workoutChevron', node\)/);
      const fold = home.slice(home.indexOf("if (tourFocus !== 'home.hero') {"), home.indexOf('}, [tourFocus]);'));
      assert.ok(fold.length > 40, "Home's tour fold moved - recheck by hand");
      assert.match(fold, /setWorkoutListOpen\(false\);/);
      assert.match(fold, /setOpenBlock\(null\);/);

      const app = stripComments(appSource);
      assert.match(app, /onBeatChange=\{setTourFocus\}/);
      assert.match(app, /tourFocus=\{tourFocus\}/);

      const layer = stripComments(tourSource);
      const pulse = layer.slice(layer.indexOf('const ringShape = spot?.shape ?? null;'), layer.indexOf('const advance = useCallback('));
      assert.ok(pulse.length > 80, 'the pulse effect moved - recheck by hand');
      assert.match(pulse, /ringShape !== 'chevron'/);
      assert.match(pulse, /reduceMotion !== false/, 'no loop under reduced motion');
      assert.match(pulse, /Animated\.loop\(/);
      assert.match(pulse, /loop\.stop\(\);/, 'the loop is stopped when the beat leaves');
      // Its own value, on the ring's own view, resting at 0 so the transform
      // is never conditional (ref-animated-node-one-view).
      assert.match(layer, /const pulseAnim = useRef\(new Animated\.Value\(0\)\)\.current;/);
      assert.match(layer, /outputRange: \[1, RING_PULSE_SCALE\]/);
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
      // The layer hands back everything it borrowed on every exit: the
      // bar's highlight, and the screen's knowledge of which beat is on.
      const layer = stripComments(tourSource);
      assert.match(layer, /onSweep\(null\);\s*onBeatChange\?\.\(null\);\s*setPhase\('done'\)/);
      assert.match(layer, /useEffect\(\(\) => \(\) => beatChangeRef\.current\?\.\(null\), \[\]\);/);
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
      // The last section has nothing under it to be lifted against, so the
      // scroller can also just go to the end of the list.
      const hook = stripComments(read('src/features/tour/useTourScroller.ts'));
      assert.match(hook, /scrollToEnd: \(animated\) => ref\.current\?\.scrollToEnd\(\{ animated \}\)/);
      const registry = stripComments(read('src/features/tour/tourTargets.ts'));
      assert.match(registry, /if \(mode === 'end'\) \{\s*scroller\.scrollToEnd\(animated\);/);
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

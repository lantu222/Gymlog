const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

const root = path.join(__dirname, '..', '..');
/** Comments out, so a guard is matched against code and not against its own explanation. */
const code = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => code(fs.readFileSync(path.join(root, ...parts), 'utf8'));

/**
 * History's list re-scrolled to the top every time a reader came back from a
 * session, because the list and the session detail share one screen and one
 * native ScrollView (HistoryScreen.tsx) — opening the shorter detail content
 * snaps the shared scroll offset to 0, and it stays there on the way back
 * (#bugs 2026-09-29). The remembered offset has to be held above the screen,
 * the same way Settings' scroll position already is, so this pins the wiring
 * end to end rather than only the pure clamp helper (tests/lib/historyScrollMemory).
 *
 * The remembered value carries the search/filter it was captured under, not
 * just a bare number: a tab switch away from History and back remounts the
 * screen with its search box reset to "", and a bare offset restored onto
 * that fresh list anyway landed the reader partway down rows they had never
 * scrolled past (recheck round 2026-09-29).
 */
module.exports = [
  {
    name: 'history scroll wiring: App.tsx owns the remembered offset and hands it to renderHomeScreens',
    run() {
      const app = code(readAppWiring());
      assert.match(
        app,
        /const historyScrollOffsetRef = useRef<HistoryScrollMemory \| null>\(null\);/,
        'no shell-owned ref to remember the list offset (and what it was scrolled under) across a session visit',
      );
      // Passed by shorthand into the same call every home sub-screen renders through.
      assert.match(
        app,
        /content = renderHomeScreens\(\{[\s\S]*?historyScrollOffsetRef,[\s\S]*?\}\);/,
        'historyScrollOffsetRef never reaches renderHomeScreens',
      );
    },
  },
  {
    name: 'history scroll wiring: renderHomeScreens feeds the remembered offset into HistoryScreen and writes back on scroll',
    run() {
      const renderHome = read('src', 'app', 'renderHomeScreens.tsx');
      assert.match(
        renderHome,
        /historyScrollOffsetRef: React\.MutableRefObject<HistoryScreenProps\['initialScrollMemory'\]>;/,
        'HomeScreensDeps dropped the ref type',
      );
      const historyBlock = renderHome.slice(
        renderHome.indexOf("if (route.screen === 'history' || route.screen === 'session')"),
        renderHome.indexOf('onSelectSession={'),
      );
      assert.match(historyBlock, /initialScrollMemory=\{historyScrollOffsetRef\.current\}/);
      assert.match(
        historyBlock,
        /onScrollOffsetChange=\{\(memory\) => \{\s*historyScrollOffsetRef\.current = memory;\s*\}\}/,
        'the list scroll is not written back to the shell ref',
      );
    },
  },
  {
    name: 'history scroll wiring: the list restores the remembered offset once, only when the search/filter still match, clamped, and forgets it while a session is open',
    run() {
      const historyScreen = read('src', 'screens', 'HistoryScreen.tsx');
      assert.match(
        historyScreen,
        /import \{ clampHistoryScrollOffset, historyScrollMemoryMatches, HistoryScrollMemory \} from '\.\.\/lib\/historyScrollMemory';/,
        'the restore skipped the pure clamp helper, or the match check that keys it to the current search/filter',
      );

      // The detail branch (returned first) must clear the "already restored"
      // flag, or the list only ever restores once per mount instead of every
      // time the reader comes back from a session. Anchored on the list's
      // own ScrollView rather than the (comment-only, stripped-out) section
      // marker between them.
      const detailBlock = historyScreen.slice(
        historyScreen.indexOf('if (selectedSession) {'),
        historyScreen.indexOf('ref={listScrollRef}'),
      );
      assert.match(detailBlock, /listRestoredRef\.current = false;/);

      // The list's own ScrollView: captured on scroll (with what it was
      // scrolled under), restored on content growth only when that still
      // matches what is on screen now, clamped to what the list can show.
      const listScrollView = historyScreen.slice(
        historyScreen.indexOf('ref={listScrollRef}'),
        historyScreen.indexOf('<Text style={styles.pageTitle}>'),
      );
      assert.match(listScrollView, /ref=\{listScrollRef\}/);
      assert.match(
        listScrollView,
        /onScroll=\{\(event\) =>\s*onScrollOffsetChange\?\.\(\{\s*offsetY: event\.nativeEvent\.contentOffset\.y,\s*searchQuery,\s*filter: historyFilter,\s*\}\)/,
        'the scroll write-back dropped the search/filter it was captured under',
      );
      assert.match(
        listScrollView,
        /if \(listRestoredRef\.current\) \{\s*return;\s*\}\s*listRestoredRef\.current = true;\s*if \(!historyScrollMemoryMatches\(initialScrollMemory, \{ searchQuery, filter: historyFilter \}\)\) \{/,
        'the restore no longer checks the remembered offset was captured under the same search/filter',
      );
      assert.match(
        listScrollView,
        /const target = clampHistoryScrollOffset\(\s*initialScrollMemory!\.offsetY,\s*height,\s*listViewportHeightRef\.current,\s*\);\s*listScrollRef\.current\?\.scrollTo\(\{ y: target, animated: false \}\);/,
      );

      // The detail's own ScrollView is untouched: it always opens at the top.
      // (detailBlock already stops right before the list section starts.)
      assert.doesNotMatch(
        detailBlock,
        /initialScrollMemory|onScrollOffsetChange|listScrollRef/,
        "the session detail must not inherit the list's remembered offset",
      );
    },
  },
];

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
 */
module.exports = [
  {
    name: 'history scroll wiring: App.tsx owns the remembered offset and hands it to renderHomeScreens',
    run() {
      const app = code(readAppWiring());
      assert.match(
        app,
        /const historyScrollOffsetRef = useRef\(0\);/,
        'no shell-owned ref to remember the list offset across a session visit',
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
        /historyScrollOffsetRef: React\.MutableRefObject<number>;/,
        'HomeScreensDeps dropped the ref type',
      );
      const historyBlock = renderHome.slice(
        renderHome.indexOf("if (route.screen === 'history' || route.screen === 'session')"),
        renderHome.indexOf('onSelectSession={'),
      );
      assert.match(historyBlock, /initialScrollOffset=\{historyScrollOffsetRef\.current\}/);
      assert.match(
        historyBlock,
        /onScrollOffsetChange=\{\(offsetY\) => \{\s*historyScrollOffsetRef\.current = offsetY;\s*\}\}/,
        'the list scroll is not written back to the shell ref',
      );
    },
  },
  {
    name: 'history scroll wiring: the list restores the remembered offset once, clamped, and forgets it while a session is open',
    run() {
      const historyScreen = read('src', 'screens', 'HistoryScreen.tsx');
      assert.match(
        historyScreen,
        /import \{ clampHistoryScrollOffset \} from '\.\.\/lib\/historyScrollMemory';/,
        'the restore skipped the pure clamp helper — a deleted session could scroll past the new bottom',
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

      // The list's own ScrollView: captured on scroll, restored on content
      // growth, clamped to what is actually on screen right now.
      const listScrollView = historyScreen.slice(
        historyScreen.indexOf('ref={listScrollRef}'),
        historyScreen.indexOf('<Text style={styles.pageTitle}>'),
      );
      assert.match(listScrollView, /ref=\{listScrollRef\}/);
      assert.match(
        listScrollView,
        /onScroll=\{\(event\) => onScrollOffsetChange\?\.\(event\.nativeEvent\.contentOffset\.y\)\}/,
      );
      assert.match(
        listScrollView,
        /if \(!listRestoredRef\.current && initialScrollOffset > 0\) \{\s*listRestoredRef\.current = true;\s*const target = clampHistoryScrollOffset\(initialScrollOffset, height, listViewportHeightRef\.current\);\s*listScrollRef\.current\?\.scrollTo\(\{ y: target, animated: false \}\);/,
      );

      // The detail's own ScrollView is untouched: it always opens at the top.
      // (detailBlock already stops right before the list section starts.)
      assert.doesNotMatch(
        detailBlock,
        /initialScrollOffset|onScrollOffsetChange|listScrollRef/,
        "the session detail must not inherit the list's remembered offset",
      );
    },
  },
];

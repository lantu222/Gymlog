const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { readAppWiring } = require('../helpers/appWiringSource.cjs');

const root = path.join(__dirname, '..', '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');
// Comments out first: the notes explaining each guard name the fields they
// guard, and a guard its own explanation can satisfy proves nothing.
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * One press, one write (double-tap audit, 2026-09-21).
 *
 * A button whose write is not idempotent has to stop the second press before
 * the first one's await, and with a ref: the second press can arrive before a
 * re-render could disable anything. These are source-level because each guard
 * lives in a screen; the writes they protect are tested where they are pure.
 */
module.exports = [
  {
    name: 'one press: saving a new programme twice saves it once',
    run() {
      const screen = strip(read('src', 'screens', 'CreateTemplateScreen.tsx'));
      assert.match(
        screen,
        /async function handleSave\(\) \{\s*if \(!canSave \|\| savingRef\.current\) \{\s*return;\s*\}\s*savingRef\.current = true;\s*setSaving\(true\);\s*try \{\s*await onSave\(/,
      );
      // Released only after the save settles, so a refused save can be retried.
      assert.match(screen, /\} finally \{\s*savingRef\.current = false;\s*setSaving\(false\);\s*\}/);
      // Both save buttons, the header's and the bottom one, go quiet meanwhile.
      assert.match(screen, /onRightActionPress=\{canSave && !saving \? \(\) => void handleSave\(\) : undefined\}/);
      assert.match(screen, /onPress=\{canSave && !saving \? \(\) => void handleSave\(\) : undefined\}/);
    },
  },
  {
    name: 'one press: the coach logs a reading once, however fast "log it" is tapped',
    run() {
      const screen = strip(read('src', 'screens', 'AICoachChatScreen.tsx'));
      assert.match(
        screen,
        /const resolveOfferOnce = useCallback\(\s*async \(\.\.\.args: Parameters<typeof resolveOffer>\) => \{\s*const \[messageId\] = args;\s*if \(resolvingOfferIdsRef\.current\.has\(messageId\)\) \{\s*return;\s*\}\s*resolvingOfferIdsRef\.current\.add\(messageId\);\s*try \{\s*await resolveOffer\(\.\.\.args\);\s*\} finally \{\s*resolvingOfferIdsRef\.current\.delete\(messageId\);/,
      );
      // Every button answers through the guarded door.
      assert.doesNotMatch(screen, /void resolveOffer\(/);
      assert.equal((screen.match(/void resolveOfferOnce\(/g) ?? []).length, 2);
    },
  },
  {
    name: 'one press: an edit queued behind the one that copied a ready programme does not navigate again',
    run() {
      const app = strip(readAppWiring());
      // The copy is recorded where it is made, before the navigation to it.
      const made = app.indexOf('copiedInThisEditBurst.current.add(programId);');
      assert.ok(made > 0, 'the copy is not recorded');
      assert.ok(
        made < app.indexOf("screen: 'programDay',", made),
        'recorded after the navigation, so an edit settling in between would miss it',
      );
      // And forgotten once the queue drains, so a later visit is still told.
      assert.match(app, /pendingProgramEdits\.current \+= 1;/);
      assert.match(
        app,
        /pendingProgramEdits\.current -= 1;\s*if \(pendingProgramEdits\.current === 0\) \{\s*copiedInThisEditBurst\.current\.clear\(\);/,
      );
      assert.match(app, /void next\.then\(settle, settle\);/);
    },
  },
  {
    name: 'one press: a freestyle workout is finished once',
    run() {
      const screen = strip(read('src', 'screens', 'EmptyWorkoutScreen.tsx'));
      assert.match(
        screen,
        /const handleFinish = async \(\) => \{\s*if \(!canFinish \|\| finishingRef\.current\) \{\s*return;\s*\}\s*finishingRef\.current = true;\s*setIsSaving\(true\);/,
      );
      // A failed save hands the button back.
      assert.match(screen, /\} catch \{\s*finishingRef\.current = false;\s*setIsSaving\(false\);/);
    },
  },
  {
    name: 'hand-off: "sign in with Google" on the last page signs in',
    run() {
      // The button set the answer in state and finished in the same handler,
      // and `finish` read the state of the render before: false. On a phone
      // where sign-in is the last page, the sign-in was skipped.
      const screen = strip(read('src', 'screens', 'SetupHandoffScreen.tsx'));
      assert.match(screen, /setSignInForBackup\(true\);\s*advance\(true\);/);
      assert.match(
        screen,
        /const advance = \(signIn = signInForBackup\) => \{\s*if \(pageIndex >= pages\.length - 1\) \{\s*finish\(addWidget, signIn\);/,
      );
    },
  },
];

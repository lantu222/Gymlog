const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

/**
 * The chat gathers a brief and hands it to the composer.
 *
 * From the log (2026-08-26): "Voisitko tehdä minulle uuden saliohjelman?" ran
 * five turns, established five days a week and a chest/glutes/abs focus, and
 * ended in "En pysty rakentamaan tai avaamaan ohjelmaa puolestasi". The
 * conversation had assembled exactly what the composer takes and threw it away.
 */
module.exports = [
  {
    name: 'compose offer: the server accepts a brief and refuses an offer without one',
    run() {
      const endpoint = read('api/ai-coach.ts');

      // The kind has to be in the enum the model can pick from, in the
      // validator, and in the app's own type — a gap in any one of the three
      // is the offer silently never arriving.
      assert.match(endpoint, /'log_measurement', 'compose_programme'\]/);
      assert.match(endpoint, /candidate\.kind !== 'compose_programme'/);
      assert.match(read('src/types/aiCoach.ts'), /\| 'compose_programme'/);

      // An offer with no brief has nothing to hand over and would open an
      // empty field — the retyping this whole path exists to spare.
      assert.match(endpoint, /if \(candidate\.kind === 'compose_programme' && !brief\) \{\s*\n\s*return null;/);
      // And the brief is bounded like every other string that crosses.
      assert.match(endpoint, /candidate\.brief\.trim\(\)\.slice\(0, 400\)/);
    },
  },
  {
    name: 'compose offer: the rules tell the coach to build rather than refuse, and to stay out of pricing',
    run() {
      const rules = read('api/ai-coach.ts');
      assert.match(rules, /attach the `compose_programme` suggestion with a `brief`/);
      // The refusal itself, named so it cannot come back.
      assert.match(rules, /never tell the reader a programme cannot be built/);
      // One question, then the offer. The log's failure was five turns of
      // questions ending in a refusal.
      assert.match(rules, /Two rounds of questions before a button is an interrogation/);
      // Entitlement is the app's to state: the model cannot see a subscription
      // and would be guessing.
      assert.match(rules, /you do not know their subscription/);
    },
  },
  {
    name: 'compose offer: the week is drawn in the thread that asked for it',
    run() {
      const screen = read('src/screens/AICoachChatScreen.tsx');
      const wiring = require('../helpers/appWiringSource.cjs').readAppWiring();

      assert.match(screen, /offer: \{ type: 'compose' as const, brief \}/);
      assert.match(screen, /await onComposeProgramme\(offer\.brief\)/);

      // It used to hand the brief over and navigate to the composer screen,
      // which saved a step and ended the conversation. Drawing the week here is
      // what lets the reader answer it — "tee siitä 5-päiväinen" — and get a
      // revised brief back in the same thread (user 2026-08-26).
      assert.doesNotMatch(wiring, /screen: 'ai_setup', brief/);
      assert.doesNotMatch(wiring, /initialBrief/);
      assert.doesNotMatch(read('src/navigation/routes.ts'), /brief\?: string/);
      assert.doesNotMatch(read('src/screens/AiProgramComposerScreen.tsx'), /initialBrief/);

      // One card, drawn by both surfaces. A second copy in the chat would mean
      // the day list, the unmet-lift notes and the save path exist twice.
      assert.match(screen, /<ProgrammeProposalCard/);
      assert.match(read('src/screens/AiProgramComposerScreen.tsx'), /<ProgrammeProposalCard/);
      // And one compose + save, so the chat cannot store a programme the
      // composer would have refused.
      assert.match(wiring, /compose=\{composeProgramme\}/);
      assert.match(wiring, /onSave=\{saveProgramme\}/);
      assert.match(wiring, /onSaveProgramme=\{saveProgramme\}/);

      // A failure says so instead of leaving the thread on "building…".
      assert.match(screen, /coachChat\.compose\.failed/);
      assert.match(screen, /coachChat\.compose\.building/);
    },
  },
  {
    name: 'compose offer: asking for a second programme is not treated as nagging',
    run() {
      const screen = read('src/screens/AICoachChatScreen.tsx');
      const composeBranch = screen.slice(
        screen.indexOf("if (suggestion.kind === 'compose_programme')"),
        screen.indexOf("if (suggestion.kind === 'log_measurement')"),
      );
      assert.ok(composeBranch.length > 0, 'the compose branch must come before the measurement one');

      // The cooldown ends an offer for good once accepted — right for a card
      // or a reminder, which are switches. A programme request is not: the
      // reader asked, and asking again next month is normal. Silencing it
      // would restore the very refusal this path removes.
      assert.doesNotMatch(composeBranch, /suggestionKind:/);
      assert.doesNotMatch(
        read('src/lib/coachSuggestions.ts'),
        /compose_programme/,
        'the silencing vocabulary must not learn this kind',
      );
    },
  },
];

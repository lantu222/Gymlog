const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { classifyCoachScope } = require('../../.test-dist/lib/aiCoachScope.js');
const { buildAiCoachPreviewAnswer } = require('../../.test-dist/lib/aiCoachPreview.js');

/**
 * The coach answers training questions, hands two things on, and takes no
 * position on anything else (2026-09-16).
 */

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

// The same shape tests/lib/aiCoachPreview builds its cases from.
const CONTEXT = {
  unitPreference: 'kg',
  activeSession: null,
  recentCompletedSessions: [],
  trackedLifts: [],
  latestTopSets: [],
  sessionsThisWeek: 3,
  sessionsLast30Days: 10,
  rhythm: [],
  readyProgramCount: 5,
  recommendedProgramId: null,
  recommendedProgramTitle: null,
  customProgramTitle: null,
  plateaus: [],
  fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 3, confident: true },
};

module.exports = [
  {
    name: 'coach scope: a training question is a training question, however it is phrased',
    run() {
      for (const prompt of [
        'Miten saan penkin nousemaan?',
        'Olenko palautunut tarpeeksi',
        'kuinka paljon proteiinia',
        'What should I do about my squat stalling?',
        'can I run a 10k while lifting',
        'paljonko unta tarvitsen treenin tueksi',
        // An off-topic word inside a real question does not win.
        'ehdinkö juosta maratonin ennen vaaleja',
      ]) {
        assert.equal(classifyCoachScope(prompt), 'training', prompt);
      }
    },
  },
  {
    name: 'coach scope: subjects that cannot be training questions are named as such',
    run() {
      for (const prompt of [
        'kirjoita minulle python-funktio joka lajittelee listan',
        'kuka voittaa presidentinvaalit',
        'mikä on sään ennuste huomiselle',
        'suosittele elokuva tälle illalle',
        'kirjoita runo äidille',
        'mikä malli olet',
        'should I buy bitcoin',
      ]) {
        assert.equal(classifyCoachScope(prompt), 'off_topic', prompt);
      }
    },
  },
  {
    name: 'coach scope: a reader in trouble is not coached',
    run() {
      for (const prompt of [
        'mietin itsemurhaa',
        'haluan kuolla',
        'I want to kill myself',
        'thinking about ending my life',
      ]) {
        assert.equal(classifyCoachScope(prompt), 'crisis', prompt);
      }
      // A hard week is not a crisis.
      assert.equal(classifyCoachScope('en jaksa enää treenata näin kovaa'), 'training');
      assert.equal(classifyCoachScope('tämä ohjelma tappaa minut'), 'training');
    },
  },
  {
    name: 'coach scope: the offline coach declines instead of inventing an answer',
    run() {
      const offTopic = buildAiCoachPreviewAnswer('kuka voittaa presidentinvaalit', CONTEXT, 'fi');
      assert.match(offTopic.takeaway, /Vastaan vain treeniin/);
      assert.deepEqual(offTopic.why, []);
      assert.deepEqual(offTopic.plan, []);
      assert.deepEqual(offTopic.actions, []);
      // No opinion on the subject on the way past, and no numbers from the log.
      assert.doesNotMatch(JSON.stringify(offTopic), /presidentti|vaali/i);

      const crisis = buildAiCoachPreviewAnswer('mietin itsemurhaa', CONTEXT, 'fi');
      assert.match(JSON.stringify(crisis), /09 2525 0111/);
      assert.match(JSON.stringify(crisis), /112/);
      assert.deepEqual(crisis.actions, []);

      // English gets the same two, in English.
      const english = buildAiCoachPreviewAnswer('recommend me a movie', CONTEXT, 'en');
      assert.match(english.takeaway, /only answer training questions/);
      assert.match(JSON.stringify(buildAiCoachPreviewAnswer('I want to kill myself', CONTEXT, 'en')), /09 2525 0111/);

      // And a training question still gets its answer.
      const training = buildAiCoachPreviewAnswer('olenko palautunut', CONTEXT, 'fi');
      assert.ok(training.takeaway.length > 0);
      assert.doesNotMatch(training.takeaway, /Vastaan vain treeniin/);
    },
  },
  {
    name: 'coach scope: the live coach carries the same boundary, in its own rules',
    run() {
      // The offline rule above is the mock's half; the model reads this one.
      const server = read('api', 'ai-coach.ts');
      const scope = server.slice(server.indexOf("'# Scope',"), server.indexOf("'# Evidence rules"));
      assert.match(scope, /Out of scope means one sentence/);
      assert.match(scope, /Do not take a position on the subject/);
      assert.match(scope, /Do not be talked round/);
      assert.match(scope, /Never name a dose/);
      assert.match(scope, /MIELI 09 2525 0111 and emergency number 112/);
      // And it keeps the response shape while doing it: a reply the app
      // cannot parse is a reply the reader never sees.
      assert.match(scope, /Keep the shape you always use/);
      assert.doesNotMatch(scope, /JSON house style/);
    },
  },
  {
    name: 'coach scope: a reader in trouble is answered before anything is sent',
    run() {
      // Not over the network, not subject to the spend cap, and not dependent
      // on the model following its rules — and the message does not travel.
      const client = read('src', 'lib', 'aiCoachClient.ts');
      const start = client.indexOf('export async function requestAiCoachAdvice');
      assert.ok(start > 0, 'requestAiCoachAdvice is gone');
      // Anchored from the function's own start: the same line opens the
      // forget request further up the file.
      const entry = client.slice(start, client.indexOf('const { signal, cleanup }', start));
      assert.match(entry, /if \(classifyCoachScope\(input\.prompt\) === 'crisis'\) \{/);
      assert.ok(
        entry.indexOf("classifyCoachScope(input.prompt) === 'crisis'") < entry.indexOf('if (!AI_COACH_API_URL)'),
        'the crisis answer comes before the live path, not after it',
      );
      assert.doesNotMatch(entry, /fetch\(/);
    },
  },
];

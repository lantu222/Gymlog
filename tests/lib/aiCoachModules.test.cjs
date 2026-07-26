const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildCoachModules } = require('../../.test-dist/lib/aiCoachModules.js');

function session(id, name, performedAt, totalVolumeKg) {
  return {
    id,
    workoutTemplateId: 'tpl',
    workoutNameSnapshot: name,
    performedAt,
    totalVolumeKg,
  };
}

function log(sessionId, name, weight, repsPerSet) {
  return {
    id: `${sessionId}:${name}`,
    sessionId,
    exerciseTemplateId: null,
    exerciseNameSnapshot: name,
    weight,
    repsPerSet,
    tracked: true,
    orderIndex: 0,
  };
}

// Dates near "now" so the analysis module's recency window includes them.
function daysAgo(count) {
  return new Date(Date.now() - count * 86400000).toISOString();
}

module.exports = [
  {
    name: 'an empty account produces no modules and asks for more data',
    run() {
      const modules = buildCoachModules({ sessions: [], logs: [], language: 'en' });

      assert.equal(modules.focus, null);
      assert.equal(modules.analysis, null);
      assert.equal(modules.suggestion, null);
      assert.equal(modules.needsMoreData, true);
    },
  },
  {
    name: 'a single session never claims a comparison it cannot make',
    run() {
      const modules = buildCoachModules({
        sessions: [session('s1', 'Day 1: Full Body', daysAgo(1), 500)],
        logs: [log('s1', 'Barbell Squat', 100, [5, 5, 5])],
        language: 'en',
      });

      // No prior session, so no trend and no plateau.
      assert.equal(modules.focus, null);
      assert.equal(modules.suggestion, null);

      // The analysis states the logged volume rather than inventing a delta.
      assert.ok(modules.analysis);
      const text = modules.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.match(text, /500 kg/);
      assert.doesNotMatch(text, /%/);
    },
  },
  {
    name: 'volume change is computed against the previous session of the same name',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s2', 'Day 1: Full Body', daysAgo(1), 1080),
          session('s1', 'Day 1: Full Body', daysAgo(8), 1000),
        ],
        logs: [
          log('s1', 'Barbell Squat', 100, [5, 5]),
          log('s2', 'Barbell Squat', 105, [5, 5]),
        ],
        language: 'en',
      });

      const volumeBullet = modules.analysis.bullets[0];
      assert.equal(volumeBullet.tone, 'up');
      assert.match(volumeBullet.body.text, /\+8%/);
      assert.ok(volumeBullet.body.highlights.includes('+8%'));
    },
  },
  {
    name: 'a session of a different name is not used as the comparison',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s2', 'Day 2: Lower', daysAgo(1), 2000),
          session('s1', 'Day 1: Upper', daysAgo(8), 1000),
        ],
        logs: [log('s1', 'Bench Press', 60, [5]), log('s2', 'Barbell Squat', 100, [5])],
        language: 'en',
      });

      // Comparing Lower against Upper would produce a meaningless "+100%".
      const text = modules.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.doesNotMatch(text, /%/);
    },
  },
  {
    name: 'the top-set bullet only claims a matched best when a prior best exists',
    run() {
      const first = buildCoachModules({
        sessions: [session('s1', 'Day 1', daysAgo(1), 400)],
        logs: [log('s1', 'Bench Press', 80, [5])],
        language: 'en',
      });
      const firstText = first.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.doesNotMatch(firstText, /matched/);

      const later = buildCoachModules({
        sessions: [session('s2', 'Day 1', daysAgo(1), 400), session('s1', 'Day 1', daysAgo(8), 400)],
        logs: [log('s1', 'Bench Press', 80, [5]), log('s2', 'Bench Press', 80, [5])],
        language: 'en',
      });
      const laterText = later.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.match(laterText, /matched your best/);
    },
  },
  {
    name: 'focus reports a real lift increase with the real gap between the logs',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s3', 'Day 1', daysAgo(1), 900),
          session('s2', 'Day 1', daysAgo(8), 900),
          session('s1', 'Day 1', daysAgo(22), 800),
        ],
        logs: [
          log('s1', 'Barbell Squat', 87.5, [5]),
          log('s2', 'Barbell Squat', 90, [5]),
          log('s3', 'Barbell Squat', 92.5, [5]),
        ],
        language: 'en',
      });

      assert.ok(modules.focus);
      assert.match(modules.focus.body.text, /\+5 kg/);
      assert.match(modules.focus.body.text, /3 weeks/);
      assert.ok(modules.focus.metrics.some((metric) => metric.value === '92.5 kg'));
    },
  },
  {
    name: 'a lift going down does not become a focus',
    run() {
      const modules = buildCoachModules({
        sessions: [session('s2', 'Day 1', daysAgo(1), 900), session('s1', 'Day 1', daysAgo(8), 900)],
        logs: [log('s1', 'Barbell Squat', 100, [5]), log('s2', 'Barbell Squat', 95, [5])],
        language: 'en',
      });

      assert.equal(modules.focus, null);
    },
  },
  {
    name: 'the plateau suggestion needs three flat sessions, not two',
    run() {
      const twoFlat = buildCoachModules({
        sessions: [session('s2', 'Day 1', daysAgo(1), 900), session('s1', 'Day 1', daysAgo(8), 900)],
        logs: [log('s1', 'Bench Press', 80, [5]), log('s2', 'Bench Press', 80, [5])],
        language: 'en',
      });
      assert.equal(twoFlat.suggestion, null);

      const threeFlat = buildCoachModules({
        sessions: [
          session('s3', 'Day 1', daysAgo(1), 900),
          session('s2', 'Day 1', daysAgo(8), 900),
          session('s1', 'Day 1', daysAgo(15), 900),
        ],
        logs: [
          log('s1', 'Bench Press', 80, [5]),
          log('s2', 'Bench Press', 80, [5]),
          log('s3', 'Bench Press', 80, [5]),
        ],
        language: 'en',
      });
      assert.ok(threeFlat.suggestion);
      assert.match(threeFlat.suggestion.body.text, /80 kg/);
    },
  },
  {
    name: 'skipped and zero-weight logs are ignored rather than counted as sets',
    run() {
      const modules = buildCoachModules({
        sessions: [session('s1', 'Day 1', daysAgo(1), 0)],
        logs: [
          { ...log('s1', 'Barbell Squat', 100, [5]), skipped: true },
          log('s1', 'Plank', 0, [30]),
        ],
        language: 'en',
      });

      assert.equal(modules.focus, null);
      assert.equal(modules.analysis, null);
      assert.equal(modules.needsMoreData, true);
    },
  },
  {
    name: 'Finnish output carries the same figures as English',
    run() {
      const input = {
        sessions: [
          session('s2', 'Day 1: Full Body', daysAgo(1), 1080),
          session('s1', 'Day 1: Full Body', daysAgo(8), 1000),
        ],
        logs: [log('s1', 'Barbell Squat', 100, [5, 5]), log('s2', 'Barbell Squat', 105, [5, 5])],
      };

      const en = buildCoachModules({ ...input, language: 'en' });
      const fi = buildCoachModules({ ...input, language: 'fi' });

      assert.match(fi.analysis.bullets[0].body.text, /\+8%/);
      assert.notEqual(fi.analysis.bullets[0].body.text, en.analysis.bullets[0].body.text);
      assert.match(fi.analysis.caption, /Koko keho/);
    },
  },
  {
    name: 'the builder holds no sample figures of its own',
    run() {
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'lib', 'aiCoachModules.ts'),
        'utf8',
      );
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      // The handoff mock ships canned numbers (72.5 kg bench, +8%, 6,240 kg).
      // None of them may leak into the builder as a fallback.
      for (const canned of ['72.5', '6,240', '6240', '92.5', "'+8%'", '"+8%"']) {
        assert.ok(
          !code.includes(canned),
          `builder must not carry the mock figure ${canned}`,
        );
      }
    },
  },
  {
    name: 'a gain over a few days is reported in days, not rounded up to a week',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s2', 'Day 1', daysAgo(1), 900),
          session('s1', 'Day 1', daysAgo(2), 900),
        ],
        logs: [
          log('s1', 'Barbell Squat', 100, [5]),
          log('s2', 'Barbell Squat', 102.5, [5]),
        ],
        language: 'en',
      });

      assert.ok(modules.focus);
      assert.match(modules.focus.body.text, /1 day/);
      assert.doesNotMatch(modules.focus.body.text, /week/);
    },
  },
  {
    name: 'beating the old best reads as a new best, not as matching it',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s2', 'Day 1', daysAgo(1), 900),
          session('s1', 'Day 1', daysAgo(8), 900),
        ],
        logs: [
          log('s1', 'Bench Press', 80, [5]),
          log('s2', 'Bench Press', 82.5, [5]),
        ],
        language: 'en',
      });

      const text = modules.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.match(text, /a new best/);
      assert.doesNotMatch(text, /matched your best/);
    },
  },
  {
    name: 'equalling the old best still reads as matching it',
    run() {
      const modules = buildCoachModules({
        sessions: [
          session('s2', 'Day 1', daysAgo(1), 900),
          session('s1', 'Day 1', daysAgo(8), 900),
        ],
        logs: [
          log('s1', 'Bench Press', 80, [5]),
          log('s2', 'Bench Press', 80, [5]),
        ],
        language: 'en',
      });

      const text = modules.analysis.bullets.map((bullet) => bullet.body.text).join(' ');
      assert.match(text, /matched your best/);
      assert.doesNotMatch(text, /a new best/);
    },
  },
];

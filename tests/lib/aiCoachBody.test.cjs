const assert = require('node:assert/strict');
const { buildAiCoachBodyState, buildAiCoachGoals } = require('../../.test-dist/lib/aiTrainingContext.js');
const { buildAiCoachSystemContext } = require('../../.test-dist/lib/aiCoachSystemContext.js');
const { normalizeAiCoachTrainingContext } = require('../../.test-dist/lib/aiTrainingContext.js');

const NOW = new Date('2026-08-24T12:00:00.000Z');

function weightEntry(daysAgo, weight) {
  return {
    id: `bw-${daysAgo}`,
    recordedAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    weight,
  };
}

module.exports = [
  {
    name: 'aiCoachBody: weight trend needs two weigh-ins inside the window',
    run() {
      const single = buildAiCoachBodyState([weightEntry(2, 82.4)], [], NOW);
      assert.equal(single.weightKg, 82.4);
      assert.equal(single.weightChange30d, null, 'one weigh-in is a fact, not a direction');

      const trending = buildAiCoachBodyState(
        [weightEntry(28, 84.0), weightEntry(14, 83.1), weightEntry(2, 82.4)],
        [],
        NOW,
      );
      assert.equal(trending.weightChange30d.deltaKg, -1.6);
      assert.equal(trending.weightChange30d.spanDays, 26);
      // 90d window sees the same three entries — same span, not a longer story.
      assert.equal(trending.weightChange90d.spanDays, 26);
    },
  },
  {
    name: 'aiCoachBody: measurements carry latest and previous per site; empty record is null',
    run() {
      assert.equal(buildAiCoachBodyState([], [], NOW), null);

      const body = buildAiCoachBodyState(
        [],
        [
          { id: 'm1', kind: 'chest', recordedAt: '2026-07-12T08:00:00.000Z', value: 96.5, unit: 'cm' },
          { id: 'm2', kind: 'chest', recordedAt: '2026-08-20T08:00:00.000Z', value: 98, unit: 'cm' },
          { id: 'm3', kind: 'waist', recordedAt: '2026-08-20T08:00:00.000Z', value: 84, unit: 'cm' },
        ],
        NOW,
      );
      const chest = body.measurements.find((entry) => entry.kind === 'chest');
      assert.equal(chest.latestValue, 98);
      assert.equal(chest.previousValue, 96.5);
      assert.equal(chest.previousAt, '2026-07-12');
      const waist = body.measurements.find((entry) => entry.kind === 'waist');
      assert.equal(waist.previousValue, null);
    },
  },
  {
    name: 'aiCoachGoals: stated goal resolves current value; onboarding weight goal fills in but never doubles',
    run() {
      const body = buildAiCoachBodyState(
        [weightEntry(2, 82.4)],
        [{ id: 'm2', kind: 'chest', recordedAt: '2026-08-20T08:00:00.000Z', value: 98, unit: 'cm' }],
        NOW,
      );
      const stated = {
        id: 'g1',
        text: 'yritän kasvattaa rinnanympärystä',
        kind: 'chest',
        targetValue: 104,
        unit: 'cm',
        startValue: 96.5,
        createdAt: '2026-08-24T06:00:00.000Z',
      };
      const goals = buildAiCoachGoals([stated], 78, body);
      assert.equal(goals.length, 2);
      assert.equal(goals[0].currentValue, 98, 'chest goal reads current chest from the body record');
      assert.equal(goals[1].kind, 'bodyweight');
      assert.equal(goals[1].targetValue, 78);
      assert.equal(goals[1].currentValue, 82.4);

      const statedWeight = { ...stated, id: 'g2', text: 'haluan laskea painoa', kind: 'bodyweight', targetValue: 79, unit: 'kg' };
      const noDouble = buildAiCoachGoals([statedWeight], 78, body);
      assert.equal(noDouble.length, 1, 'the user-stated bodyweight goal wins over the onboarding one');
      assert.equal(noDouble[0].targetValue, 79);
    },
  },
  {
    name: 'aiCoachSystemContext: body and goals render as sections; a normalized bare context omits them',
    run() {
      const body = buildAiCoachBodyState(
        [weightEntry(28, 84.0), weightEntry(2, 82.4)],
        [
          { id: 'm1', kind: 'chest', recordedAt: '2026-07-12T08:00:00.000Z', value: 96.5, unit: 'cm' },
          { id: 'm2', kind: 'chest', recordedAt: '2026-08-20T08:00:00.000Z', value: 98, unit: 'cm' },
        ],
        NOW,
      );
      const context = normalizeAiCoachTrainingContext({
        body,
        goals: buildAiCoachGoals(
          [{ id: 'g1', text: 'yritän kasvattaa rinnanympärystä', kind: 'chest', targetValue: 104, unit: 'cm', startValue: 96.5, createdAt: '2026-08-24T06:00:00.000Z' }],
          null,
          body,
        ),
        profile: { heightCm: 181, age: 29, gender: 'male' },
      });
      const text = buildAiCoachSystemContext(context);
      assert.ok(text.includes('## Body record'), 'body section present');
      assert.ok(text.includes('82.4 kg'), 'latest weight rendered');
      assert.ok(text.includes('-1.6 kg over last 26 days'), 'trend rendered');
      assert.ok(text.includes('chest: 98 cm (2026-08-20) | previous 96.5 cm (2026-07-12)'), 'measurement trend rendered');
      assert.ok(text.includes('## Goals'), 'goals section present');
      assert.ok(text.includes('start 96.5 cm, now 98 cm, target 104 cm'), 'goal progress rendered');
      assert.ok(text.includes('## Profile'), 'profile section present');
      assert.ok(text.includes('181 cm'));

      const bare = buildAiCoachSystemContext(normalizeAiCoachTrainingContext({}));
      assert.ok(!bare.includes('## Body record'), 'no body section without a record');
      assert.ok(!bare.includes('## Goals'), 'no goals section without goals');
    },
  },
];

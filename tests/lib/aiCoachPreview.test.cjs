const assert = require('node:assert/strict');

const { buildAiCoachPreviewAnswer } = require('../../.test-dist/lib/aiCoachPreview.js');

function baseContext(overrides = {}) {
  return {
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
    fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 3 },
    ...overrides,
  };
}

const GENERIC_PROMPT = 'mitä pitäisi tehdä tällä viikolla';

// --- Scenario 1: plateau only ---

module.exports = [
  {
    name: 'preview plateau only: names the stuck lift and suggests concrete fix',
    run() {
      const ctx = baseContext({
        plateaus: [{ exerciseKey: 'bench press', name: 'Bench Press', stagnantSessions: 4, topWeightKg: 100 }],
        fatigue: { acwr: 1.0, recoveryScore: 95, signal: 'optimal', sessionCount7d: 3 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);

      assert.ok(answer.takeaway.includes('Bench Press'), `takeaway should name the lift, got: "${answer.takeaway}"`);
      assert.ok(answer.takeaway.includes('4'), `takeaway should mention stagnant sessions, got: "${answer.takeaway}"`);

      const allText = [answer.takeaway, ...answer.why, ...answer.nextSteps, ...answer.plan].join(' ');
      assert.ok(allText.includes('100 kg'), 'response should reference the actual weight');
      assert.ok(
        allText.toLowerCase().includes('deload') || allText.toLowerCase().includes('variation') || allText.toLowerCase().includes('80%'),
        'response should suggest a concrete action',
      );
    },
  },
  {
    name: 'preview plateau only: second plateau exercise is also mentioned when multiple',
    run() {
      const ctx = baseContext({
        plateaus: [
          { exerciseKey: 'bench press', name: 'Bench Press', stagnantSessions: 4, topWeightKg: 100 },
          { exerciseKey: 'squat', name: 'Squat', stagnantSessions: 3, topWeightKg: 120 },
        ],
        fatigue: { acwr: 1.0, recoveryScore: 95, signal: 'optimal', sessionCount7d: 3 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);
      const allText = [answer.takeaway, ...answer.why].join(' ');
      assert.ok(allText.includes('1 more lift') || allText.includes('2 more'), `should mention extra plateaus, got: "${allText}"`);
    },
  },

  // --- Scenario 2: high fatigue only ---

  {
    name: 'preview high fatigue only: references ACWR and suggests lighter week',
    run() {
      const ctx = baseContext({
        plateaus: [],
        fatigue: { acwr: 1.7, recoveryScore: 35, signal: 'high', sessionCount7d: 6 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);

      const allText = [answer.takeaway, ...answer.why, ...answer.nextSteps, ...answer.plan].join(' ');
      assert.ok(allText.includes('1.7'), `response should reference the actual ACWR, got: "${allText}"`);
      assert.ok(allText.includes('35'), `response should reference the recovery score, got: "${allText}"`);
      assert.ok(
        answer.takeaway.toLowerCase().includes('pull back') || answer.takeaway.toLowerCase().includes('creeping'),
        `takeaway should suggest backing off, got: "${answer.takeaway}"`,
      );
      assert.ok(
        allText.toLowerCase().includes('volume') || allText.toLowerCase().includes('sets'),
        'response should mention volume reduction',
      );
    },
  },
  {
    name: 'preview elevated fatigue (not high): still suggests lighter approach',
    run() {
      const ctx = baseContext({
        plateaus: [],
        fatigue: { acwr: 1.4, recoveryScore: 62, signal: 'elevated', sessionCount7d: 5 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);
      const allText = [answer.takeaway, ...answer.why].join(' ');
      assert.ok(allText.includes('1.4'), `should reference ACWR, got: "${allText}"`);
      assert.ok(allText.includes('elevated'), `should name the signal, got: "${allText}"`);
    },
  },

  // --- Scenario 3: both plateau AND high fatigue → recovery first ---

  {
    name: 'preview both plateau and high fatigue: recovery is prioritised first',
    run() {
      const ctx = baseContext({
        plateaus: [{ exerciseKey: 'deadlift', name: 'Deadlift', stagnantSessions: 5, topWeightKg: 150 }],
        fatigue: { acwr: 1.8, recoveryScore: 28, signal: 'high', sessionCount7d: 7 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);

      assert.ok(
        answer.takeaway.toLowerCase().includes('recover') || answer.takeaway.toLowerCase().includes('wait'),
        `takeaway should prioritise recovery, got: "${answer.takeaway}"`,
      );
      const allText = [answer.takeaway, ...answer.why, ...answer.nextSteps, ...answer.plan].join(' ');
      assert.ok(allText.includes('Deadlift'), 'plateau lift should still be named');
      assert.ok(allText.includes('1.8') || allText.includes('28'), 'fatigue data should be referenced');
      assert.ok(allText.includes('150 kg'), 'plateau weight should be referenced');
    },
  },
  {
    name: 'preview both: deload comes before plateau-fix in the plan',
    run() {
      const ctx = baseContext({
        plateaus: [{ exerciseKey: 'squat', name: 'Squat', stagnantSessions: 3, topWeightKg: 120 }],
        fatigue: { acwr: 1.55, recoveryScore: 42, signal: 'high', sessionCount7d: 5 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);
      const planText = answer.plan.join(' ').toLowerCase();
      const deloadIndex = planText.indexOf('deload');
      const variationIndex = planText.indexOf('variation');
      assert.ok(deloadIndex !== -1, 'plan should mention deload');
      assert.ok(variationIndex !== -1, 'plan should mention variation');
      assert.ok(deloadIndex < variationIndex, 'deload should come before variation in the plan');
    },
  },

  // --- Scenario 4: neither plateau nor high fatigue → normal response ---

  {
    name: 'preview neither condition: returns generic advice without plateau/fatigue framing',
    run() {
      const ctx = baseContext({
        plateaus: [],
        fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 3 },
      });
      const answer = buildAiCoachPreviewAnswer(GENERIC_PROMPT, ctx);
      const allText = [answer.takeaway, ...answer.why].join(' ');
      assert.ok(!allText.toLowerCase().includes('plateau'), `normal response should not mention plateaus, got: "${allText}"`);
      assert.ok(!allText.toLowerCase().includes('acwr'), `normal response should not mention ACWR, got: "${allText}"`);
    },
  },
  {
    name: 'preview neither condition: specific lift question returns lift advice',
    run() {
      const ctx = baseContext({
        plateaus: [],
        fatigue: { acwr: 1.05, recoveryScore: 98, signal: 'optimal', sessionCount7d: 3 },
      });
      const answer = buildAiCoachPreviewAnswer('bench painoo ei nouse', ctx);
      assert.ok(
        answer.takeaway.toLowerCase().includes('twice') || answer.takeaway.toLowerCase().includes('train'),
        `lift question without plateau should get generic lift advice, got: "${answer.takeaway}"`,
      );
    },
  },

  // --- Specific lift + matching plateau ---

  {
    name: 'preview lift keyword + matching plateau: names that specific lift',
    run() {
      const ctx = baseContext({
        plateaus: [{ exerciseKey: 'bench press', name: 'Bench Press', stagnantSessions: 3, topWeightKg: 95 }],
        fatigue: { acwr: 1.0, recoveryScore: 92, signal: 'optimal', sessionCount7d: 3 },
      });
      const answer = buildAiCoachPreviewAnswer('bench jumissa', ctx);
      assert.ok(answer.takeaway.includes('Bench Press'), `should name the specific lift, got: "${answer.takeaway}"`);
    },
  },
  {
    name: 'preview lift keyword + matching plateau + high fatigue: combined response',
    run() {
      const ctx = baseContext({
        plateaus: [{ exerciseKey: 'bench press', name: 'Bench Press', stagnantSessions: 3, topWeightKg: 95 }],
        fatigue: { acwr: 1.6, recoveryScore: 45, signal: 'high', sessionCount7d: 6 },
      });
      const answer = buildAiCoachPreviewAnswer('bench jumissa', ctx);
      const allText = [answer.takeaway, ...answer.why].join(' ');
      assert.ok(
        answer.takeaway.toLowerCase().includes('recover') || answer.takeaway.toLowerCase().includes('wait'),
        `combined response should prioritise recovery, got: "${answer.takeaway}"`,
      );
      assert.ok(allText.includes('Bench Press'), 'should still name the plateau lift');
    },
  },
];

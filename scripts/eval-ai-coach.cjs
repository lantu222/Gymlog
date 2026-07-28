#!/usr/bin/env node
/**
 * Runs the coach evaluation set and prints one score (execution-plan A3).
 *
 *   npx tsc -p tsconfig.test.json
 *   node scripts/eval-ai-coach.cjs              # scores the offline preview
 *   node scripts/eval-ai-coach.cjs --live       # scores the deployed endpoint
 *
 * The number is the point: change a prompt, run this, compare. Preview mode
 * needs no network and no key, so the harness is useful before the endpoint
 * is even deployed — it scores whatever answer generator you point it at.
 *
 * --live posts to $AI_COACH_API_URL and costs real money, one call per case.
 */
const { AI_COACH_EVAL_CASES } = require('../.test-dist/lib/aiCoachEvalCases.js');
const { scoreCase, scoreRun, formatRunReport } = require('../.test-dist/lib/aiCoachEval.js');
const { buildAiCoachPreviewAnswer } = require('../.test-dist/lib/aiCoachPreview.js');

const live = process.argv.includes('--live');
const endpoint = process.env.AI_COACH_API_URL;

async function answerFor(evalCase) {
  if (!live) {
    return buildAiCoachPreviewAnswer(evalCase.prompt, evalCase.context);
  }

  if (!endpoint) {
    throw new Error('--live needs AI_COACH_API_URL');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: evalCase.prompt, context: evalCase.context }),
  });
  const payload = await response.json();

  // A fallback answer is not the live coach; scoring it would quietly report
  // the preview's number as if the endpoint had produced it.
  if (!payload.ok) {
    throw new Error(`${evalCase.id}: endpoint returned ${payload.error?.code ?? 'an error'}`);
  }
  return payload.answer;
}

async function main() {
  const results = [];
  for (const evalCase of AI_COACH_EVAL_CASES) {
    const answer = await answerFor(evalCase);
    results.push(scoreCase(evalCase, answer));
  }

  const run = scoreRun(results);
  console.log(`\nGAINER coach eval — ${live ? 'LIVE endpoint' : 'offline preview'}\n`);
  console.log(formatRunReport(run));
  console.log('');

  // Non-zero exit on any failure so this can gate a prompt change in CI.
  process.exitCode = run.failures.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

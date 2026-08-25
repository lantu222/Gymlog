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

async function answerFor(evalCase, retry = false) {
  if (!live) {
    return buildAiCoachPreviewAnswer(evalCase.prompt, evalCase.context, evalCase.language);
  }

  if (!endpoint) {
    throw new Error('--live needs AI_COACH_API_URL');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: evalCase.prompt,
      context: evalCase.context,
      // A follow-up case is only a follow-up if the exchange goes with it.
      ...(evalCase.history ? { history: evalCase.history } : {}),
      ...(evalCase.language ? { language: evalCase.language } : {}),
    }),
  });
  const payload = await response.json();

  // A fallback answer is not the live coach; scoring it would quietly report
  // the preview's number as if the endpoint had produced it.
  if (!payload.ok) {
    const code = payload.error?.code ?? 'an error';
    // A cold function or a slow model call is not a verdict on the prompt.
    // One blip used to discard the whole run — the cases already answered,
    // and the money they cost — so a transient failure gets one retry.
    // A rate limit is not transient on that timescale: retrying immediately
    // just spends another slot, so it stops the run and says why.
    if (code === 'RATE_LIMIT') {
      throw new Error(
        `${evalCase.id}: rate limited. The endpoint allows 12 requests per 10 minutes per IP, ` +
          'and a phone on the same network shares them. Wait for the window and run again.',
      );
    }
    if (retry) {
      throw new Error(`${evalCase.id}: endpoint returned ${code} twice`);
    }
    console.warn(`  ${evalCase.id}: ${code}, retrying once`);
    return answerFor(evalCase, true);
  }
  return payload.answer;
}

async function main() {
  const results = [];
  const skipped = [];
  for (const evalCase of AI_COACH_EVAL_CASES) {
    // The preview is a keyword mock with no branch for a goal or a body
    // measurement. Scoring those cases offline would move the number for
    // reasons that have nothing to do with the prompt.
    if (!live && evalCase.liveOnly) {
      skipped.push(evalCase.id);
      continue;
    }
    const answer = await answerFor(evalCase);
    results.push(scoreCase(evalCase, answer));
  }

  const run = scoreRun(results);
  console.log(`\nVinha Coach eval — ${live ? 'LIVE endpoint' : 'offline preview'}\n`);
  console.log(formatRunReport(run));
  if (skipped.length > 0) {
    // Said out loud: a set that quietly shrinks reads as full coverage.
    console.log(`\n${skipped.length} case(s) skipped, live only: ${skipped.join(', ')}`);
  }
  console.log('');

  // Non-zero exit on any failure so this can gate a prompt change in CI.
  process.exitCode = run.failures.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// api/ is a serverless entry point outside the src/ test build, so this suite
// guards it at the source level — the same approach the screen-structure tests
// use. The parts that matter here are the ones a silent edit could undo.
const source = fs.readFileSync(path.join(__dirname, '../../api/ai-coach.ts'), 'utf8');

module.exports = [
  {
    name: 'the coach endpoint talks to Claude, with nothing left pointing at OpenAI',
    run() {
      assert.match(source, /https:\/\/api\.anthropic\.com\/v1\/messages/);
      assert.match(source, /'anthropic-version': '2023-06-01'/);
      assert.match(source, /'x-api-key'/);
      assert.match(source, /process\.env\.ANTHROPIC_API_KEY/);

      assert.doesNotMatch(source, /api\.openai\.com/);
      assert.doesNotMatch(source, /OPENAI_API_KEY/);
      assert.doesNotMatch(source, /AI_COACH_OPENAI_/);
    },
  },
  {
    name: 'the answer shape is forced by the API rather than requested in prose',
    run() {
      // Without tool_choice the model may answer in prose, which fails
      // validation and drops every live answer to the preview fallback.
      assert.match(source, /tool_choice: \{ type: 'tool', name: ADVICE_TOOL_NAME \}/);
      assert.match(source, /input_schema: AI_COACH_RESPONSE_SCHEMA/);
      assert.match(source, /required: \['takeaway', 'why', 'nextSteps', 'plan', 'assumptions'\]/);
    },
  },
  {
    name: 'a follow-up question comes back marked, so the free tier is not charged for it',
    run() {
      // The client has always skipped the charge on `unanswered` — but only
      // the offline preview ever set it, so a live "I need to know X first"
      // spent one of three questions a week. All four pieces must hold
      // together: the model may report it, the rules say when, the rules say
      // when not, and the validator carries it through.
      assert.match(source, /unanswered: \{\s*\n\s*type: 'boolean'/);
      assert.match(source, /# When you cannot answer/);
      assert.match(source, /ask exactly one short follow-up question/);
      assert.match(source, /set `unanswered` to true/);
      // The opposite failure — hedging every thin answer into a question —
      // is the more likely one, so both guards are asserted.
      assert.match(source, /Ask only when the missing fact actually blocks the answer/);
      assert.match(source, /Never set `unanswered` on a reply that does answer/);
      assert.match(source, /\.\.\.\(candidate\.unanswered === true \? \{ unanswered: true \} : \{\}\)/);
    },
  },
  {
    name: 'confidence is read off the record, never rated by the model',
    run() {
      // A model asked how sure it is answers "it seems that" in front of
      // every sentence. The count is a fact in the context; the rule only
      // says how to speak given it.
      assert.match(source, /Reading note" section says how much record the answer rests on/);
      assert.match(source, /Never rate your own confidence/);
      // No schema field for it — that would be the self-rating this avoids.
      const schema = source.slice(source.indexOf('AI_COACH_RESPONSE_SCHEMA'), source.indexOf('COACH_SYSTEM_RULES'));
      assert.doesNotMatch(schema, /confidence/);
    },
  },
  {
    name: 'one goal leads, and conflicting goals are named rather than averaged',
    run() {
      // Four goals at the same level produced four vague answers. The rules
      // have to say which one a general question is measured against, and
      // what to do when two of them cannot both be satisfied — a surplus and
      // a deficit have no midpoint worth giving.
      assert.match(source, /Exactly one goal carries `isPrimary`/);
      assert.match(source, /name the conflict in one sentence and ask which comes first/);
      assert.match(source, /Do not split the difference/);
    },
  },
  {
    name: 'a rejected answer says which field was wrong, without logging what it said',
    run() {
      // "stop_reason: tool_use" answers "was it truncated?" and nothing else.
      // A complete tool call that still fails validation used to leave no way
      // to tell an empty takeaway from a malformed list (live eval, 25.8.).
      assert.match(source, /shape: describeAnswerShape\(extractToolInput\(payload\)\)/);
      assert.match(source, /return 'takeaway:empty';/);
      assert.match(source, /return `\$\{field\}:\$\{typeof value\}`;/);

      // Field names and shapes only. The reader's question and the model's
      // answer must never reach a log line.
      const fn = source.slice(source.indexOf('export function describeAnswerShape'), source.indexOf('The offer, or nothing'));
      assert.doesNotMatch(fn, /candidate\.takeaway\.slice|JSON\.stringify\(candidate/);
    },
  },
  {
    name: 'the coach introduces itself as Vinha, not under the old brand',
    run() {
      // GAINER is another company's EU trademark; the app has been Vinha
      // Fitness since the rename. This is the one place the model could say
      // the name out loud.
      assert.match(source, /You are Vinha Coach, the training coach inside Vinha Fitness/);
      assert.doesNotMatch(source, /GAINER/);
    },
  },
  {
    name: 'the cached prefix covers the rules and the training context',
    run() {
      // The context is the bulk of every request. Follow-up questions in one
      // conversation should not pay for it again.
      assert.match(source, /cache_control: \{ type: 'ephemeral' \}/);
      const systemBlock = source.slice(source.indexOf('system: ['), source.indexOf('tools: ['));
      assert.ok(
        systemBlock.indexOf('COACH_SYSTEM_RULES') < systemBlock.indexOf('cache_control'),
        'the rules must sit inside the cached prefix, not after it',
      );
    },
  },
  {
    name: 'the system rules carry the constraints the app depends on',
    run() {
      // The composer's rules sit above the coach's in the file, so the slice
      // must end at the join that closes THIS array, not the first join.
      const rulesStart = source.indexOf('COACH_SYSTEM_RULES = [');
      const rules = source.slice(rulesStart, source.indexOf("].join('\\n')", rulesStart));

      // Anti-fabrication is the whole premise of the coach surfaces.
      assert.match(rules, /Never state a number, session, exercise, or date that does not appear in it/);
      assert.match(rules, /Do not estimate/);
      assert.match(rules, /too little history to read something, do not comment on it/);
      // Medical safety.
      assert.match(rules, /Never diagnose an injury or illness/);
      // Silence is a valid output — ADR-003.
      assert.match(rules, /Silence is a valid output/);
      // The app is kilograms-only and bilingual.
      assert.match(rules, /All weights are kilograms/);
      assert.match(rules, /Answer in the language the user wrote in/);
    },
  },
  {
    name: 'the endpoint bounds what one request can cost (execution-plan A2)',
    run() {
      // The rate limit counts requests; it says nothing about how expensive
      // one is. The budget check must run BEFORE the fetch, and must measure
      // the exact text that gets sent.
      assert.match(source, /const budget = checkBudget\(/);
      const budgetAt = source.indexOf('const budget = checkBudget(');
      const fetchAt = source.indexOf('https://api.anthropic.com/v1/messages');
      assert.ok(budgetAt !== -1 && budgetAt < fetchAt, 'budget must be checked before the upstream call');

      // One build of the context, used for both the measurement and the send.
      assert.match(source, /const contextText = /);
      assert.match(source, /contextChars: contextText\.length \+ COACH_SYSTEM_RULES\.length/);
      assert.match(source, /text: contextText, cache_control/);

      // Spend is booked before the call: a timeout still burned tokens.
      const recordAt = source.indexOf('budgetState = recordSpend(');
      assert.ok(recordAt !== -1 && recordAt < fetchAt, 'spend must be booked before the request goes out');

      // Refusal degrades to preview rather than erroring at the user.
      assert.match(source, /if \(!budget\.allowed\) \{/);
      assert.match(source, /budget_exhausted' \? 'RATE_LIMIT' : 'BAD_REQUEST'/);
    },
  },
  {
    name: 'a failed or slow upstream call still answers with the preview fallback',
    run() {
      assert.match(source, /UPSTREAM_TIMEOUT/);
      assert.match(source, /buildAiCoachPreviewAnswer\(input\.prompt, input\.context, input\.language\)/);
      // An unset key must degrade to preview, never surface as a crash.
      assert.match(source, /MISSING_API_KEY/);
    },
  },
];

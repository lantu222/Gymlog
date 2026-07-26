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
      const rules = source.slice(source.indexOf('COACH_SYSTEM_RULES = ['), source.indexOf("].join('\\n')"));

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
    name: 'a failed or slow upstream call still answers with the preview fallback',
    run() {
      assert.match(source, /UPSTREAM_TIMEOUT/);
      assert.match(source, /buildAiCoachPreviewAnswer\(input\.prompt, input\.context\)/);
      // An unset key must degrade to preview, never surface as a crash.
      assert.match(source, /MISSING_API_KEY/);
    },
  },
];

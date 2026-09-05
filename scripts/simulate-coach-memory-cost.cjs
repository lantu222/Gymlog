/**
 * What the coach's long memory (lib/coachAdviceMemory) costs, per Pro plan.
 *
 * Same rule as scripts/simulate-coach-cost.cjs, which this leans on: the
 * memory block is MEASURED by rendering a full one through the real
 * buildAiCoachSystemContext, not estimated. Prices come from
 * lib/aiCoachCostModel and are a constant, not a fact — re-check them against
 * anthropic.com/pricing before quoting a number from here.
 *
 * Question volumes are bounded by lib/aiCoachQuota: Pro is 25 a month, and
 * free is three answers per install, ever.
 *
 * The prefix is priced as cacheable across a conversation's follow-ups, which
 * is only true because AICoachChatScreen pins the memory for the life of the
 * thread. Let the answer just given into the context and every follow-up
 * rewrites the prefix instead of reading it — roughly a 60 % increase on the
 * typical column, which is what that pin is worth.
 */
const path = require('node:path');
const fs = require('node:fs');

const DIST = path.join(__dirname, '..', '.test-dist', 'lib');
if (!fs.existsSync(DIST)) {
  console.error('Run `npx tsc -p tsconfig.test.json` first — this reads .test-dist.');
  process.exit(1);
}

const { estimateTokens } = require(path.join(DIST, 'aiCoachBudget.js'));
const { buildAiCoachSystemContext } = require(path.join(DIST, 'aiCoachSystemContext.js'));
const { normalizeAiCoachTrainingContext } = require(path.join(DIST, 'aiTrainingContext.js'));
const {
  MAX_COACH_ADVICE_MEMORY_ENTRIES,
  buildCoachAdviceLines,
  rememberCoachAdvice,
} = require(path.join(DIST, 'coachAdviceMemory.js'));
const { PRO_COACH_QUESTIONS_PER_MONTH } = require(path.join(DIST, 'aiCoachQuota.js'));
const {
  SONNET_5_PRICING,
  TOKENIZER_FACTOR_VS_HAIKU_4_5,
  conversationCost,
  monthlyCost,
} = require(path.join(DIST, 'aiCoachCostModel.js'));

/** Sonnet 5 splits the same text into ~1.3x the tokens estimateTokens counts. */
const modelTokens = (tokens) => Math.round(tokens * TOKENIZER_FACTOR_VS_HAIKU_4_5['sonnet-5']);

// Measured in scripts/simulate-coach-cost.cjs against the same builder.
const OVERHEAD_TOKENS = 4908; // coach rules + tool schema
const CONTEXT_TOKENS = 1238; // "full window": 8 weeks, 4x/week, 6 lifts
const PROMPT_TOKENS = modelTokens(estimateTokens('x'.repeat(160)));
const OUTPUT_TOKENS = modelTokens(350);

/**
 * PRICES ARE A CONSTANT, NOT A FACT — same warning as the cost model. These are
 * the app's own listed prices (lib/i18n) and one assumed exchange rate.
 */
const EUR_PER_USD = 0.92;
const PLANS = {
  monthly: { label: 'Pro, kuukausi', eur: 9.9, perMonthEur: 9.9 },
  yearly: { label: 'Pro, vuosi', eur: 59.9, perMonthEur: 59.9 / 12 },
  lifetime: { label: 'Pro, elinikäinen', eur: 119.0, perMonthEur: null },
};

/** A full memory: ten entries, each cut at the cap. */
function fullMemory() {
  let memory = [];
  for (let index = 0; index < MAX_COACH_ADVICE_MEMORY_ENTRIES; index += 1) {
    memory = rememberCoachAdvice(memory, `${index} ${'pidempi neuvo '.repeat(20)}`, '2026-09-05T09:00:00.000Z');
  }
  return memory;
}

function memoryBlockTokens(memory) {
  const lines = buildCoachAdviceLines(memory, '2026-09-05T09:00:00.000Z');
  const withMemory = buildAiCoachSystemContext(normalizeAiCoachTrainingContext({ coachMemory: lines }));
  const without = buildAiCoachSystemContext(normalizeAiCoachTrainingContext({}));
  const chars = withMemory.length - without.length;
  return { chars, tokens: modelTokens(estimateTokens('x'.repeat(Math.max(0, chars)))) };
}

function profile(prefixTokens, conversationsPerMonth, questionsPerConversation) {
  return {
    label: 'x',
    prefixTokens,
    promptTokens: PROMPT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    questionsPerConversation,
    conversationsPerMonth,
  };
}

const eur = (usd) => `${(usd * EUR_PER_USD).toFixed(3).replace('.', ',')} €`;

const full = memoryBlockTokens(fullMemory());
// A free reader gets three answers per install, ever, so the memory can never
// hold more than two lines when the third is asked.
const twoLines = memoryBlockTokens(fullMemory().slice(-2));

console.log('AI Coach — pitkän muistin kustannus');
console.log('='.repeat(78));
console.log(`Malli: claude-sonnet-5   sisään $2/Mtok   ulos $10/Mtok   (kurssi 1 $ = ${EUR_PER_USD} €)`);
console.log(`Kiinteä ylimeno: säännöt + työkaluskeema  ~${OVERHEAD_TOKENS} tok`);
console.log(`Treenikonteksti (8 vk, 4x/vk, 6 liikettä) ~${CONTEXT_TOKENS} tok`);
console.log('');
console.log('MUISTIBLOKIN MITATTU KOKO');
console.log('-'.repeat(78));
console.log(`täysi (${MAX_COACH_ADVICE_MEMORY_ENTRIES} riviä, jokainen katkaisurajassa)   ${String(full.chars).padStart(5)} merkkiä  ~${String(full.tokens).padStart(4)} tok`);
console.log(`kaksi riviä (mitä ilmaiskäyttäjällä voi olla) ${String(twoLines.chars).padStart(5)} merkkiä  ~${String(twoLines.tokens).padStart(4)} tok`);
console.log('');

const base = OVERHEAD_TOKENS + CONTEXT_TOKENS;

console.log('ILMAINEN — kolme vastausta per asennus, ikuisesti (lib/aiCoachQuota)');
console.log('-'.repeat(78));
{
  const withoutUsd = conversationCost(profile(base, 1, 1), SONNET_5_PRICING).cachedUsd * 3;
  const withUsd =
    conversationCost(profile(base, 1, 1), SONNET_5_PRICING).cachedUsd +
    conversationCost(profile(base + memoryBlockTokens(fullMemory().slice(-1)).tokens, 1, 1), SONNET_5_PRICING).cachedUsd +
    conversationCost(profile(base + twoLines.tokens, 1, 1), SONNET_5_PRICING).cachedUsd;
  console.log(`  koko elinkaari, ilman muistia   ${eur(withoutUsd)}`);
  console.log(`  koko elinkaari, muistin kanssa  ${eur(withUsd)}   (+${eur(withUsd - withoutUsd)})`);
  console.log('  Muisti ei ehdi kertyä: ensimmäinen vastaus näkee tyhjän, kolmas kaksi riviä.');
}
console.log('');

/**
 * Volume is not the only thing that sets the bill: the prefix is cached for
 * five minutes, so the SHAPE of a month matters as much as its size. Twelve
 * two-question conversations pay the prefix twelve times; five five-question
 * ones pay it five times for more questions. Both are listed, at the same
 * question count, so the comparison is visible rather than surprising.
 */
const ENGAGEMENT = [
  { label: 'kevyt        4 keskustelua x 1 kysymys', conversations: 4, questions: 1 },
  { label: 'tyypillinen 12 keskustelua x 2 kysymystä', conversations: 12, questions: 2 },
  { label: 'katossa     12 keskustelua x 2 + 1', conversations: 13, questions: 2 },
  { label: 'katossa      5 keskustelua x 5 kysymystä', conversations: 5, questions: 5 },
];

console.log('PRO — kuukausikustannus mallista, per käyttäjä');
console.log('-'.repeat(78));
console.log(`${''.padEnd(40)}${'ilman'.padStart(10)}${'muistin kanssa'.padStart(17)}${'lisäys'.padStart(12)}`);
const proMonthly = {};
for (const item of ENGAGEMENT) {
  const without = monthlyCost(profile(base, item.conversations, item.questions), SONNET_5_PRICING, true).perUserUsd;
  const withMem = monthlyCost(
    profile(base + full.tokens, item.conversations, item.questions),
    SONNET_5_PRICING,
    true,
  ).perUserUsd;
  proMonthly[item.label] = { without, withMem };
  console.log(
    `${item.label.padEnd(40)}${eur(without).padStart(10)}${eur(withMem).padStart(17)}${('+' + eur(withMem - without)).padStart(12)}`,
  );
}
console.log('');

console.log('KATE — mallikustannus osuutena tuotosta, muisti mukana');
console.log('-'.repeat(78));
const capped = proMonthly[ENGAGEMENT[2].label].withMem * EUR_PER_USD;
const typical = proMonthly[ENGAGEMENT[1].label].withMem * EUR_PER_USD;
for (const key of ['monthly', 'yearly']) {
  const plan = PLANS[key];
  const share = (cost) => `${((cost / plan.perMonthEur) * 100).toFixed(1)} %`;
  console.log(
    `${plan.label.padEnd(20)}${(plan.perMonthEur.toFixed(2) + ' €/kk').padStart(10)}   tyypillinen ${share(typical).padStart(6)}   katossa ${share(capped).padStart(6)}`,
  );
}
{
  const plan = PLANS.lifetime;
  const monthsTypical = plan.eur / typical;
  const monthsCapped = plan.eur / capped;
  console.log(
    `${plan.label.padEnd(20)}${(plan.eur.toFixed(2) + ' € kerran').padStart(10)}   ` +
      `kestää ${monthsTypical.toFixed(0)} kk tyypillisellä, ${monthsCapped.toFixed(0)} kk katossa`,
  );
  // The same horizon without the memory, so its share of the shortening is visible.
  const monthsCappedNoMemory = plan.eur / (proMonthly[ENGAGEMENT[2].label].without * EUR_PER_USD);
  console.log(
    `${''.padEnd(20)}${''.padStart(10)}   ilman muistia katossa ${monthsCappedNoMemory.toFixed(0)} kk ` +
      `(muisti lyhentää ${(monthsCappedNoMemory - monthsCapped).toFixed(1)} kk)`,
  );
}
console.log('');
console.log('FLOTILLA — 1000 Pro-käyttäjää, tyypillinen käyttö');
console.log('-'.repeat(78));
{
  const without = proMonthly[ENGAGEMENT[1].label].without * 1000;
  const withMem = proMonthly[ENGAGEMENT[1].label].withMem * 1000;
  console.log(`  ilman muistia   ${eur(without)} / kk`);
  console.log(`  muistin kanssa  ${eur(withMem)} / kk   (+${eur(withMem - without)})`);
}

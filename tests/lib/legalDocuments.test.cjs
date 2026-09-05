const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  LEGAL_ENTITY,
  LEGAL_LAST_UPDATED,
  buildLegalDocument,
  renderLegalDocumentMarkdown,
} = require('../../.test-dist/lib/legalDocuments.js');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const IDS = ['privacy', 'terms'];
const LANGUAGES = ['en', 'fi'];

module.exports = [
  {
    name: 'both documents build in both languages with no empty sections',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const doc = buildLegalDocument(id, language);
          assert.equal(doc.id, id);
          assert.ok(doc.title.length > 3, `${id}/${language} needs a title`);
          assert.ok(doc.summary.length > 20, `${id}/${language} needs a summary`);
          assert.ok(doc.updatedLabel.includes(LEGAL_LAST_UPDATED.slice(0, 4)));
          assert.ok(doc.sections.length >= 8, `${id}/${language} is too thin`);
          for (const section of doc.sections) {
            assert.ok(section.heading.length > 2, `${id}/${language} empty heading`);
            const lines = [...(section.body ?? []), ...(section.bullets ?? [])];
            assert.ok(lines.length > 0, `${id}/${language} "${section.heading}" has no content`);
            for (const line of lines) {
              assert.ok(line.trim().length > 0, `${id}/${language} blank line`);
            }
          }
        }
      }
    },
  },
  {
    name: 'the two languages stay structurally parallel',
    run() {
      for (const id of IDS) {
        const en = buildLegalDocument(id, 'en');
        const fi = buildLegalDocument(id, 'fi');
        assert.equal(
          en.sections.length,
          fi.sections.length,
          `${id}: a section exists in one language only — a translated policy that omits a clause is not the same policy`,
        );
        en.sections.forEach((section, index) => {
          const other = fi.sections[index];
          assert.equal(
            (section.body ?? []).length,
            (other.body ?? []).length,
            `${id} section ${index} ("${section.heading}") has a different paragraph count in Finnish`,
          );
          assert.equal(
            (section.bullets ?? []).length,
            (other.bullets ?? []).length,
            `${id} section ${index} ("${section.heading}") has a different bullet count in Finnish`,
          );
        });
      }
    },
  },
  {
    name: 'every document carries the contact address and the publisher',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const text = renderLegalDocumentMarkdown(buildLegalDocument(id, language));
          assert.ok(text.includes(LEGAL_ENTITY.email), `${id}/${language} has no contact address`);
          assert.ok(text.includes(LEGAL_ENTITY.name), `${id}/${language} does not name the publisher`);
        }
      }
    },
  },
  {
    name: 'the terms carry the health warning in both languages',
    run() {
      const en = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'en')).toLowerCase();
      const fi = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'fi')).toLowerCase();
      // A fitness app that ships terms without these is a liability, not a document.
      for (const needle of ['not medical advice', 'doctor', 'own risk']) {
        assert.ok(en.includes(needle), `English terms are missing "${needle}"`);
      }
      for (const needle of ['ei ole lääketieteellistä', 'lääkär', 'omalla vastuullasi']) {
        assert.ok(fi.includes(needle), `Finnish terms are missing "${needle}"`);
      }
    },
  },
  {
    name: 'the privacy claims still match what the code does',
    run() {
      // Each of these is a factual claim in the policy. If the app grows a new
      // network call, an analytics SDK or a third storage key, this fails
      // before the policy becomes a lie.
      const srcFiles = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.tsx?$/.test(entry.name)) srcFiles.push(full);
        }
      };
      walk(path.join(root, 'src'));

      // Comments and copy are not call sites. A prose mention of the word
      // was enough to fail this with "update the policy or remove the call",
      // which is a confusing way to be told a sentence was worded badly.
      const isCallSite = (source) =>
        source
          .split(String.fromCharCode(10))
          .filter((line) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
          })
          .some((line) => /\bfetch\s*\(/.test(line));
      const fetchSites = srcFiles.filter((file) => isCallSite(fs.readFileSync(file, 'utf8')));
      assert.deepEqual(
        fetchSites.map((file) => path.basename(file)).sort(),
        ['aiCoachClient.ts', 'analyticsClient.ts', 'backupApi.ts'],
        'The policy names exactly three outbound request sites: the AI coach, the '
          + 'anonymous usage events, and the optional cloud backup. Update the '
          + 'policy or remove the call.',
      );

      const allSource = srcFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
      for (const banned of ['firebase', 'amplitude', 'mixpanel', 'segment.com', 'Sentry', 'AppsFlyer']) {
        assert.ok(
          !allSource.includes(banned),
          `The policy says there is no analytics or crash reporting, but ${banned} appears in src/`,
        );
      }

      // The live keys are @vinha/*. Two @gymlog/* constants also remain — the
      // pre-rename fallback that loadDatabase/loadWorkoutBundle read once — and
      // they are the same two stores, so they are not a third thing to declare.
      // Three live stores now: the training log, the workout in progress, and
      // the small preferences key a theme or language change writes on its own
      // rather than paying for the whole database. Plus the quarantine slot an
      // unreadable database is
      // moved to rather than deleted. The policy declares that one too, in
      // "Where it is stored" — it holds the reader's own data.
      const keys = new Set(allSource.match(/@vinha\/[a-z0-9/]+/g) ?? []);
      assert.deepEqual(
        [...keys].sort(),
        [
          '@vinha/account/v1',
          '@vinha/analytics/v1',
          '@vinha/coach/memory/v1',
          '@vinha/database/corrupt',
          '@vinha/database/v1',
          '@vinha/preferences/v1',
          '@vinha/workout/v1',
        ],
        'The policy declares these storage keys. A new one needs a line in "Where it is stored".',
      );
      const legacy = new Set(allSource.match(/@gymlog\/[a-z0-9/]+/g) ?? []);
      assert.deepEqual(
        [...legacy].sort(),
        ['@gymlog/database/v1', '@gymlog/workout/v1'],
        'The only pre-rename keys left should be the two migration fallbacks.',
      );
    },
  },
  {
    name: 'the usage-statistics switch is a real gate, and the policy says it exists',
    run() {
      // The old analytics row was a useState(true) that sent nothing, and it
      // was removed with the other explainer rows (user, 2026-07-29). Usage
      // events became real on 2026-08-25, and the switch came back on
      // 2026-09-04 as a real gate: Settings writes the preference, App.tsx
      // hands it to the client, and the client sends nothing until told and
      // drops its queue when told no. Each link is pinned here, because a
      // switch that writes a preference nobody reads is the old bug again.
      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(!settings.includes('settings.analytics'), 'the old inert analytics row must stay dead');
      assert.match(settings, /usageStatisticsEnabled: next/, 'the usage-statistics switch must write the preference');
      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      assert.match(
        app,
        /setUsageStatisticsEnabled\(preferences\.usageStatisticsEnabled\)/,
        'App.tsx must hand the preference to the analytics client',
      );
      const client = read('src/features/analytics/analyticsClient.ts');
      assert.match(client, /export function setUsageStatisticsEnabled/);
      // Sending is gated on an explicit yes, so nothing leaves before the
      // stored preference has been read.
      assert.match(client, /enabled !== true/, 'flush must refuse until the switch has been read');
      assert.match(client, /enabled === false/, 'trackEvent must queue nothing once the switch is off');
      // And the policy carries the fact and the switch, in both languages.
      const legal = read('src/lib/legalDocuments.ts');
      assert.match(legal, /No third-party analytics and no crash-reporting/);
      assert.match(legal, /Usage statistics/);
      assert.match(legal, /analytiikkaa/i);
      assert.match(legal, /Settings → Usage statistics/);
      assert.match(legal, /Asetukset → Käyttötilastot/);
    },
  },
  {
    name: 'no surface claims push notifications the app cannot send',
    run() {
      // The policy says notifications are scheduled locally and no device token
      // exists. Settings used to say "Push and reminders", which contradicted it.
      const i18n = read('src/lib/i18n.ts');
      // The Settings row and the master switch on the Notifications screen both
      // name the feature, so both have to stay honest about what it is.
      for (const key of ['settings.notifications.sub', 'notif.push']) {
        const line = i18n.split('\n').filter((row) => row.includes(`'${key}'`));
        assert.equal(line.length, 2, `expected an English and a Finnish value for ${key}`);
        for (const row of line) {
          // Only the value: the key itself is allowed to be called notif.push.
          const value = row.slice(row.indexOf(':') + 1);
          assert.ok(
            !/push/i.test(value),
            `"${row.trim()}" promises push notifications; the app schedules them locally`,
          );
        }
      }
    },
  },
  {
    name: 'every account surface is backed by the real sign-in, never a decorative one',
    run() {
      // Settings once carried "Sign out" and "Delete account" rows with
      // chevrons and no handler. Since 2026-08-22 the app HAS an account —
      // the optional Google sign-in that keys the cloud backup — so the guard
      // flips: account rows are allowed, but only wired through the real
      // feature and hidden in builds that cannot sign anyone in.
      const settings = read('src/screens/SettingsScreen.tsx');
      const referencesAccount = /account\.(signIn|signOut|backupNow|deleteRemote)/.test(settings);
      if (referencesAccount) {
        assert.ok(
          fs.existsSync(path.join(root, 'src', 'features', 'account', 'googleAuth.ts')),
          'Settings shows account rows but src/features/account/googleAuth.ts is gone — '
            + 'that is the decorative-buttons bug coming back.',
        );
        // The rows must be gated on the account prop, so a build without a
        // configured OAuth client shows nothing rather than a dead button.
        assert.match(
          settings,
          /\{account && /,
          'Account rows must render behind the account prop gate.',
        );
      }

      // The old fake keys stay dead either way; the real feature has its own.
      const i18n = read('src/lib/i18n.ts');
      for (const key of ['settings.signOut', 'settings.deleteAccount']) {
        assert.ok(
          !i18n.includes(`'${key}'`),
          `${key} is back. The account rows live under account.* and are gated on the real feature.`,
        );
      }
    },
  },
  {
    name: 'the CSV rows in settings reach a real importer and exporter',
    run() {
      // These two sat inert for months. Wired now: import opens the same paste
      // sheet the Programs tab uses, export shares the plan as CSV text.
      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(settings.includes('onPress={onImportPlan}'), 'Import plan (CSV) does nothing again');
      assert.ok(settings.includes('onPress={onExportPlan}'), 'Export plan (CSV) does nothing again');

      // The row promised a download for months; there is no file to download.
      const i18n = read('src/lib/i18n.ts');
      const subs = i18n.split('\n').filter((row) => row.includes("'settings.exportCsv.sub'"));
      assert.equal(subs.length, 2, 'expected an English and a Finnish export subtitle');
      for (const row of subs) {
        assert.ok(
          !/download|lataa/i.test(row.slice(row.indexOf(':') + 1)),
          `"${row.trim()}" promises a download; the plan is shared as text.`,
        );
      }
    },
  },
  {
    name: 'both documents are reachable from settings and from the Pro page',
    run() {
      const settings = read('src/screens/SettingsScreen.tsx');
      assert.ok(settings.includes("onOpenLegal('privacy')"), 'Settings privacy row does not open anything');
      assert.ok(settings.includes("onOpenLegal('terms')"), 'Settings terms row does not open anything');

      const premium = read('src/screens/PremiumScreen.tsx');
      assert.ok(premium.includes("onOpenLegal('privacy')"), 'Pro page privacy link is inert text');
      assert.ok(premium.includes("onOpenLegal('terms')"), 'Pro page terms link is inert text');

      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      assert.ok(app.includes('<LegalDocumentScreen'), 'The legal screen is never rendered');
      assert.ok(
        (app.match(/screen: 'legal', document/g) ?? []).length >= 2,
        'Both entry points must navigate to the legal route',
      );
    },
  },
  {
    name: 'the exported Markdown matches the in-app documents',
    run() {
      for (const id of IDS) {
        for (const language of LANGUAGES) {
          const file = path.join(root, 'docs', 'legal', `${id}.${language}.md`);
          assert.ok(fs.existsSync(file), `Missing export: run node scripts/export-legal.cjs`);
          // Line endings are git's business, not the document's: checked out on
          // Windows these files are CRLF and the renderer emits LF, so a
          // byte-for-byte comparison failed on every machine that has one —
          // which is a guard nobody can read, not a guard.
          assert.equal(
            fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'),
            renderLegalDocumentMarkdown(buildLegalDocument(id, language)),
            `docs/legal/${id}.${language}.md is stale — re-run node scripts/export-legal.cjs`,
          );
        }
      }
    },
  },
  {
    name: 'the online-coach notice and the policy disclose everything the context carries',
    run() {
      // The AI context grew the body record (weight, measurements) and the
      // profile (height, age, gender) on 2026-08-23, and for twelve days the
      // in-app notice and the policy went on saying "body measurements are
      // not sent". This pins the disclosure to the call site: whatever
      // App.tsx hands buildAiTrainingContext, the reader is told about, in
      // the notice they read before the first question and in the policy.
      //
      // The call site is the source of truth, not two hand-picked regexes:
      // every top-level key of the object App.tsx passes must be listed in
      // DISCLOSED below, and every listed key that carries something personal
      // must be named in both notices and both policies. A new input to the
      // coach therefore fails here until someone has decided what the reader
      // is told about it.
      const app = require('../helpers/appWiringSource.cjs').readAppWiring();
      const callStart = app.indexOf('buildAiTrainingContext({');
      assert.ok(callStart >= 0, 'App.tsx no longer builds the AI context — move this guard to wherever it went');
      // The literal closes on the first line that dedents back to `})`.
      const callEnd = app.indexOf('\n      })', callStart);
      assert.ok(callEnd > callStart, 'could not find the end of the buildAiTrainingContext call');
      const call = app.slice(callStart, callEnd);
      // Top-level keys sit at exactly eight spaces; nested keys and comments do not.
      const keys = [...call.matchAll(/^ {8}([a-zA-Z]+)[,:]/gm)].map((match) => match[1]);
      assert.ok(keys.length >= 10, `expected the call site's keys, got: ${keys.join(', ')}`);

      // What each input is, in the reader's words. null = nothing personal
      // (a unit, a count, a title, the state of the Home screen).
      const DISCLOSED = {
        unitPreference: null,
        activeWorkoutSummary: 'workouts',
        homeSummary: 'workouts',
        workoutSessions: 'workouts',
        exerciseLogs: 'workouts',
        trackedProgress: 'workouts',
        readyProgramCount: null,
        recommendedProgramId: null,
        recommendedProgramTitle: 'programme',
        customProgramTitle: 'programme',
        programme: 'programme',
        trainingDays: 'programme',
        schedule: 'programme',
        bodyweightEntries: 'weight',
        measurementEntries: 'measurements',
        coachGoals: 'goals',
        primaryGoalId: 'goals',
        bodyweightGoalKg: 'goals',
        profile: 'profile',
        homeState: null,
        plannerSetup: 'setup',
        coachMemory: 'pastAdvice',
      };
      const PHRASES = {
        workouts: { en: /recent workouts/, fi: /viimeaikaiset treenisi/ },
        programme: { en: /programme/, fi: /ohjelmasi/ },
        weight: { en: /latest weight/, fi: /viimeisin painosi/ },
        measurements: { en: /measurements/, fi: /mittasi/ },
        goals: { en: /goals/, fi: /tavoitteesi/ },
        profile: { en: /height, age and gender/, fi: /pituutesi, ikäsi ja sukupuolesi/ },
        setup: { en: /setup answers/, fi: /käyttöönoton vastauksesi/ },
        pastAdvice: {
          en: /answers from the last three weeks/,
          fi: /vastaukset viimeisiltä kolmelta viikolta/,
        },
      };
      const unknown = keys.filter((key) => !(key in DISCLOSED));
      assert.deepEqual(
        unknown,
        [],
        `new input(s) reach the coach: ${unknown.join(', ')} — add each to DISCLOSED here, and to `
          + 'coachChat.online.body and the privacy policy in both languages if it is personal',
      );

      // The notice value starts on the line after its key and ends where the
      // next key begins: two spaces of indent and a quote.
      const i18n = read('src/lib/i18n.ts');
      const notices = i18n
        .split("'coachChat.online.body':")
        .slice(1)
        .map((rest) => rest.split(/\n {2}'/)[0]);
      assert.equal(notices.length, 2, 'expected an English and a Finnish online-coach notice');
      const [noticeEn, noticeFi] = notices;
      const policyEn = renderLegalDocumentMarkdown(buildLegalDocument('privacy', 'en'));
      const policyFi = renderLegalDocumentMarkdown(buildLegalDocument('privacy', 'fi'));

      const required = new Set(keys.map((key) => DISCLOSED[key]).filter(Boolean));
      for (const item of required) {
        const { en, fi } = PHRASES[item];
        assert.match(noticeEn, en, `the English online notice must disclose ${item}`);
        assert.match(noticeFi, fi, `the Finnish online notice must disclose ${item}`);
        assert.match(policyEn, en, `the English privacy policy must disclose ${item}`);
        assert.match(policyFi, fi, `the Finnish privacy policy must disclose ${item}`);
      }
      // And the sentence that was untrue for twelve days stays gone.
      assert.doesNotMatch(noticeEn, /body measurements are not sent/, 'the old English notice is back');
      assert.doesNotMatch(noticeFi, /kehonmittojasi ei lähetetä/, 'the old Finnish notice is back');
    },
  },
  {
    name: 'the policy names its processors in both languages',
    run() {
      // Three companies touch data on our behalf. A policy that loses one of
      // them by accident is the kind of omission a regulator reads as hiding.
      // Checked on the rendered document per language, not the source: the
      // file's header comment names the same companies and must not count.
      for (const language of LANGUAGES) {
        const text = renderLegalDocumentMarkdown(buildLegalDocument('privacy', language));
        for (const processor of ['Anthropic', 'Vercel', 'Google']) {
          assert.ok(text.includes(processor), `${processor} is missing from the ${language} privacy policy`);
        }
      }
    },
  },
  {
    name: 'the terms quote the free limits the code enforces',
    run() {
      // The terms say what Free is in numbers, so a reader knows what they
      // are buying out of. Each number is a constant in src/lib; change the
      // constant and this points at the two sentences to change with it.
      const { FREE_CUSTOM_PROGRAM_LIMIT } = require('../../.test-dist/lib/programSlots.js');
      const { FREE_ACTIVE_PROGRAM_CAP } = require('../../.test-dist/lib/activeProgramSet.js');
      const { FREE_TREND_MONTHS } = require('../../.test-dist/lib/historyWindow.js');
      assert.equal(FREE_CUSTOM_PROGRAM_LIMIT, 3, 'the terms say "three programmes of your own" — update the Pro section in both languages');
      assert.equal(FREE_ACTIVE_PROGRAM_CAP, 2, 'the terms say "two in use at a time" — update the Pro section in both languages');
      assert.equal(FREE_TREND_MONTHS, 3, 'the terms say "the most recent three months" — update the Pro section in both languages');
      const en = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'en'));
      const fi = renderLegalDocumentMarkdown(buildLegalDocument('terms', 'fi'));
      assert.match(en, /three programmes of your own, two in use at a time/);
      assert.match(en, /most recent three months/);
      assert.match(fi, /kolme omaa ohjelmaa, kaksi käytössä kerrallaan/);
      assert.match(fi, /viimeisimmän kolmen kuukauden/);
    },
  },
];

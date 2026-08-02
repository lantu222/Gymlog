const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

const appSource = read('App.tsx');
const settingsSource = read('src', 'screens', 'SettingsScreen.tsx');
const planSettingsSource = read('src', 'screens', 'PlanSettingsScreen.tsx');
const premiumSource = read('src', 'screens', 'PremiumScreen.tsx');
const homeSource = read('src', 'screens', 'HomeScreen.tsx');
const proOfferSource = read('src', 'screens', 'ProOfferScreen.tsx');
const i18nSource = read('src', 'lib', 'i18n.ts');
const unlockSource = read('src', 'screens', 'PremiumUnlockScreen.tsx');
const guidedSource = read('src', 'screens', 'GuidedPlayerScreen.tsx');

/**
 * The Pro/Free audit (2026-07-28) found three ways the paid tier lied: a promo
 * code that never expired, screens that read the preview switch instead of the
 * entitlement, and a dark-theme toggle sold as a Pro perk that repainted
 * nothing. These guard the fixes, because every one of them is invisible until
 * someone pays.
 */

module.exports = [
  {
    name: 'the guided player can do everything the list logger can do to a session',
    run() {
      // The list logger was the only place you could swap an exercise, skip
      // one, or add a set — so the only way to do any of them mid-workout was
      // to leave the guided flow entirely. All three happen in a real gym
      // (rack taken, shoulder complaining, one more set in you).
      //
      // This is the precondition for ever retiring the list view: while the
      // guided player is missing any of these, the list is not redundant, it
      // is the only editor.
      for (const action of ['swapExercise', 'skipExercise', 'addSet', 'completeSet']) {
        assert.match(
          guidedSource,
          new RegExp(`workout\\.${action}\\(`),
          `the guided player cannot ${action} — the list logger still has to exist for it`,
        );
      }

      // Skipping drops that exercise's steps, so whatever followed slides into
      // the index its block started at — that index is the landing. Asking
      // resolveGuidedResumeIndex instead is the bug this replaced: it answers 0
      // when no set is complete, so skipping the first exercise before logging
      // anything threw the user back to the warm-up.
      assert.match(guidedSource, /resyncTargetRef/);
      assert.doesNotMatch(guidedSource, /resolveGuidedResumeIndex\(steps, null/);

      // The clock must not run while a sheet is open over the set.
      assert.match(guidedSource, /const frozen = paused \|\|[^;]*swapOpen/);
    },
  },
  {
    name: 'every screen that pins its own CTA hides the floating tab bar',
    run() {
      // Three screens shipped with a pinned footer under the floating bar: the
      // Pro page (a bar of dead space reserved under the CTA), the membership
      // screen (second button covered) and the post-onboarding offer (primary
      // button covered outright, on the one screen shown once). The bar is a
      // sibling of the content, not a layout the screens can see, so nothing
      // catches this except looking at the phone.
      //
      // If you add a screen with a bottom-pinned action, add it here too.
      const gate = appSource.slice(
        appSource.indexOf('const showTabBar ='),
        appSource.indexOf('const setupOnboardingActive'),
      );
      assert.match(gate, /screen === 'premium'/);
      assert.match(gate, /screen === 'membership_end'/);
      assert.match(gate, /screen === 'pro_offer'/);
    },
  },
  {
    name: 'redeeming a promo stores only the expiry, so Pro ends when the code does',
    run() {
      const redeem = appSource.match(/onRedeemed=\{[^}]*\}/);
      assert.ok(redeem, 'PromoCodeScreen should still be wired with onRedeemed');
      assert.match(redeem[0], /promoProUntil: proUntilIso/);
      assert.doesNotMatch(
        redeem[0],
        /adaptiveCoachPremiumUnlocked/,
        'flipping the preview switch on redemption would make a 30-day code permanent Pro',
      );
    },
  },
  {
    name: 'the logger and the premium screen ask the entitlement, not the preview switch',
    run() {
      // hasAdaptiveCoachPremium was the list logger's prop and went with it.
      assert.doesNotMatch(appSource, /hasAdaptiveCoachPremium/);
      assert.match(appSource, /proUnlocked=\{coachProUnlocked\}/);
    },
  },
  {
    name: 'Settings and Plan settings resolve Pro through the entitlement',
    run() {
      assert.match(
        planSettingsSource,
        /import \{ isProUnlocked \} from '\.\.\/lib\/proEntitlement';/,
      );
      assert.match(planSettingsSource, /const proUnlocked = isProUnlocked\(preferences\);/);
      assert.doesNotMatch(
        planSettingsSource,
        /preferences\.adaptiveCoachPremiumUnlocked/,
        'PlanSettingsScreen must not read the raw preview flag — a promo user is Pro too',
      );

      // Settings resolves the same way, but through resolveProEntitlement
      // because its demo row has to say WHICH source is granting Pro.
      assert.match(
        settingsSource,
        /import \{ resolveProEntitlement \} from '\.\.\/lib\/proEntitlement';/,
      );
      assert.match(settingsSource, /const proUnlocked = entitlement\.unlocked;/);

      // The raw preview flag may be read in exactly one place: the demo switch,
      // which IS that flag. Everywhere else it would hide promo users from a
      // Pro surface, which is the bug this whole suite exists for.
      const demoStart = settingsSource.indexOf('{demoBuild ? (');
      assert.ok(demoStart > 0, 'the demo block is gone — move this guard, do not delete it');
      const demoEnd = settingsSource.indexOf(') : null}', demoStart);
      const outsideDemo =
        settingsSource.slice(0, demoStart) + settingsSource.slice(demoEnd);
      assert.doesNotMatch(
        outsideDemo,
        /preferences\.adaptiveCoachPremiumUnlocked/,
        'SettingsScreen reads the raw preview flag outside the demo switch',
      );
    },
  },
  {
    name: 'the dark-theme row is a live switch for Pro and a paywall for everyone else',
    run() {
      // The engine landed 2026-08-01, so the row stopped saying Soon. What it
      // must not become is a switch a free user can flip: the state comes from
      // resolveThemeRowState, which folds in the entitlement.
      assert.match(settingsSource, /resolveThemeRowState\(preferences\)/);
      assert.match(
        settingsSource,
        /title=\{t\(language, 'settings\.darkTheme'\)\}[\s\S]{0,600}?themeRow\.locked \? \(/,
      );
      assert.match(settingsSource, /onPress=\{themeRow\.locked \? onOpenSubscription : undefined\}/);
      assert.match(settingsSource, /value=\{themeRow\.value\}/);
      assert.match(settingsSource, /onPreferencesChange\(\{ darkThemeEnabled: next \}\)/);
      // The subtitle no longer promises something unbuilt.
      assert.doesNotMatch(i18nSource, /'settings\.darkTheme\.sub': '[^']*still in build/);
    },
  },
  {
    name: 'the Pro page table draws the line where the code draws it',
    run() {
      const table = premiumSource.match(/const ROWS[\s\S]*?\n\];/);
      assert.ok(table, 'the free/premium comparison rows should be declared');

      // Free in BOTH columns. Each of these was checked against the code on
      // 2026-08-01: none of them has an isProUnlocked gate anywhere.
      for (const key of ['logging', 'ready', 'own', 'records', 'guided', 'widget', 'csv']) {
        assert.match(
          table[0],
          new RegExp(`'pro\\.v2\\.row\\.${key}', free: 'pro\\.v2\\.val\\.[a-zA-Z]+'`),
          `${key} is free and the table has to say so`,
        );
      }

      // History is never capped, in either tier — the page's trust row. An
      // eight-week free limit was in the v2 mock and does not exist in code.
      assert.match(table[0], /'pro\.v2\.row\.history', free: 'pro\.v2\.val\.allTime', pro: 'pro\.v2\.val\.allTime'/);
      assert.doesNotMatch(premiumSource, /8 weeks|8 viikkoa/);

      // The paywall-moments rule: the detection is free, the conclusion is Pro.
      assert.match(table[0], /'pro\.v2\.row\.plateau', free: 'pro\.v2\.val\.yes'/);
      for (const key of ['why', 'recovery', 'analysis']) {
        assert.match(table[0], new RegExp(`'pro\\.v2\\.row\\.${key}', free: null`), `${key} is the Pro conclusion`);
      }

      // Genuinely gated in the app: resolveProgressionOptions and openAiMode.
      for (const key of ['progression', 'builder', 'theme']) {
        assert.match(table[0], new RegExp(`'pro\\.v2\\.row\\.${key}', free: null`), `${key} is Pro-gated in code`);
      }
      // The free coach quota the table promises is implemented (aiCoachQuota).
      assert.match(table[0], /'pro\.v2\.row\.coachQ', free: 'pro\.v2\.val\.threeWeek'/);

      // Unbuilt things wear 'Soon' rather than being sold as present.
      assert.match(table[0], /'pro\.v2\.row\.backup', free: null, pro: 'pro\.v2\.val\.soon'/);
      assert.match(table[0], /'pro\.v2\.row\.adaptSession', free: null, pro: 'pro\.v2\.val\.soon'/);

      // Claims from the v2 mock that describe things this app does not do.
      // Checked against the copy itself, not the screen — the screen's comments
      // name the cut features on purpose.
      const copy = i18nSource.match(/'pro\.v2\.[\s\S]*?'pro\.v2\.footer': '[^']*'/g)?.join('\n') ?? '';
      assert.ok(copy.length > 0, 'the pro.v2 copy block should be findable');
      assert.doesNotMatch(copy, /watch|wrist|kello|ranteest/i, 'there is no watch app');
      assert.doesNotMatch(copy, /several active|useita aktiivisia/i, 'only one plan can be active');
    },
  },
  {
    name: 'the Pro page table promises are wired, not just printed',
    run() {
      // "AI Coach — 3 / wk": App resolves the quota and the chat gates on it.
      assert.match(appSource, /freeQuestionsRemaining=\{resolveCoachQuota\(preferences\.aiCoachFreeQuota\)\.remaining\}/);
      assert.match(appSource, /recordCoachQuestion\(preferences\.aiCoachFreeQuota\)/);
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
      assert.match(chat, /const canAsk = proUnlocked \|\| freeQuestionsRemaining > 0;/);
      // Out of quota the door stays open: the question still sends and the
      // answer comes back blurred, rather than the chat refusing to talk.
      assert.match(chat, /if \(!canAsk\) \{/);
      // What is blurred is the REAL withheld answer — the offline coach is
      // free and deterministic, so blurring a placeholder would be a bluff.
      assert.match(chat, /buildAiCoachPreviewAnswer\(trimmed, trainingContext, language\)/);
      assert.match(chat, /lockedLines: \[withheld\.takeaway/);

      // "AI program builder — Pro": the generator and both entries gate on Pro.
      assert.match(appSource, /if \(!isProUnlocked\(nextPreferences\)\) \{/);
      assert.equal(
        (appSource.match(/onAiAssisted=\{\(\) => navigate\(coachProUnlocked \? \{ tab: 'home', screen: 'ai_setup' \} : \{ tab: 'profile', screen: 'premium' \}\)\}/g) ?? []).length,
        2,
      );
    },
  },
  {
    name: 'the written session analysis stays behind Pro, quota or not',
    run() {
      // The free weekly quota buys coach questions; the Pro page's table says
      // the written analysis is Pro. Without this gate a free user reached the
      // analysis screen through the unlocked chat and the table was a lie.
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');
      assert.match(chat, /proUnlocked \? onOpenAnalysis\(lastSession\.id\) : onOpenPremium\(\)/);
      assert.match(chat, /coach\.analysisLocked/);
    },
  },
  {
    name: 'one yearly price across every surface that quotes one',
    run() {
      const i18n = read('src', 'lib', 'i18n.ts');
      // Three different yearly prices shipped at once (59,99 / 69,99 / 71,99)
      // across the coach lock, the subscription screen and the Pro page.
      assert.doesNotMatch(i18n, /59[.,]99/);
      assert.doesNotMatch(i18n, /69[.,]99/);
      for (const key of ['pro.page.billedYearly', 'coach.lock.fine', 'subs.yearlyPrice']) {
        const line = i18n.split('\n').find((row) => row.includes(`'${key}':`));
        assert.ok(line, `${key} should exist`);
        assert.match(line, /71[.,]99/, `${key} must quote the one planned yearly price`);
      }
    },
  },
  {
    name: 'the Progress trend chart is rendered, not just computed',
    run() {
      const progress = read('src', 'screens', 'ProgressScreen.tsx');
      // overviewChart was assigned to a const nobody read, and the metric and
      // range setters were never called: three metrics and four ranges existed
      // in code that no user could reach.
      assert.match(progress, /points=\{overviewChart\.points\}/);
      assert.match(progress, /onChange=\{setOverviewMetric\}/);
      assert.match(progress, /onChange=\{setOverviewRange\}/);

      // Volume was the one metric with no tick values, so the chart made its
      // own and printed "1730.8 kg" under a headline reading "2,2 t".
      assert.match(progress, /yTickValues: volumeTicks/);
      assert.match(progress, /formatOverviewVolumeTick\(value, volumeTicks\)/);
      assert.doesNotMatch(progress, /yTickValues: undefined/);
    },
  },
  {
    name: 'the adaptive set coach is gone from the code AND from every price list',
    run() {
      // The effort question, the coach's rest override and the adaptive set
      // coach lived only in WorkoutLoggingScreen. Removing the list logger
      // removed them (user decision 2026-08-02), so the guard flips: they must
      // not be sold anywhere. A feature the app no longer has is the worst
      // kind of paywall claim, because nobody can find it to complain.
      assert.ok(
        !fs.existsSync(path.join(__dirname, '..', '..', 'src', 'lib', 'adaptiveCoach.ts')),
        'adaptiveCoach.ts is back — if the feature returns, restore its Pro claims too',
      );
      assert.doesNotMatch(premiumSource, /pro\.v2\.coach\.adaptive|pro\.v2\.coach\.rest/);
      assert.doesNotMatch(premiumSource, /pro\.v2\.row\.adaptive'/);
      assert.doesNotMatch(proOfferSource, /proOffer\.pro\.adaptive/);

      const benefits = read('src', 'lib', 'proBenefits.ts');
      assert.doesNotMatch(benefits, /coach\.adaptive|coach\.rest/);

      // Onboarding's progression step sold the effort feedback too.
      const onboarding = read('src', 'screens', 'OnboardingScreen.tsx');
      const bullets = onboarding.slice(
        onboarding.indexOf('const PROGRESSION_BULLET_KEYS'),
        onboarding.indexOf('const CAUTION_REFINEMENT_OPTIONS'),
      );
      assert.doesNotMatch(bullets, /'onb\.progression\.b2'/);
    },
  },
  {
    name: 'the paywall moments blur the real conclusion, never a feature list',
    run() {
      const locked = read('src', 'components', 'ProLockedCard.tsx');
      // The blur is transparent ink + shadow over caller-provided REAL lines.
      assert.match(locked, /color: 'transparent'/);
      assert.match(locked, /textShadowRadius/);

      // Home: the detection card carries the plateau conclusion from
      // proInsights — the same lines Pro reads unblurred in place.
      assert.match(appSource, /locked: proPlateau\.conclusion/);
      assert.match(homeSource, /plateau\.locked\.lines/);
      assert.match(homeSource, /proUnlocked \?/);

      // Progress: statuses always free, and the footer says so.
      const progress = read('src', 'screens', 'ProgressScreen.tsx');
      assert.match(progress, /pro\.read\.footer/);

      // Moment 4 (the logger's post-effort coach chip) went with the list
      // logger and the effort question it hung off.

      // The old Home pro sheet is gone: one full page, moments elsewhere.
      assert.doesNotMatch(homeSource, /PRO_STATS|PRO_COMPARISON|proSheetVisible/);
      assert.match(homeSource, /onPress=\{\(\) => onOpenPremium\?\.\(\)\}/);
    },
  },
  {
    name: 'automated progression is sold as Pro, so every start path gates it on Pro',
    run() {
      // App.tsx: all three start call sites go through the one helper that
      // combines the toggle with the entitlement.
      assert.doesNotMatch(
        appSource,
        /automatedProgressionEnabled: (preferences|nextPreferences)\.automatedProgressionEnabled/,
        'a start call passing the raw toggle would hand a free user the paid prefill',
      );
      assert.equal(
        (appSource.match(/resolveProgressionOptions\((preferences|nextPreferences)\)/g) ?? []).length,
        3,
        'the ready, custom, and AI start paths must all resolve through the entitlement',
      );

      // There used to be a fourth path — the list logger's own bootstrap —
      // and it went with the screen. The three above are now all of them.
    },
  },
  {
    name: 'the post-onboarding offer states only counts the code can prove',
    run() {
      // The two figures are read from the catalog and the library, never typed.
      assert.match(proOfferSource, /WORKOUT_TEMPLATES_V1\.length/);
      assert.match(proOfferSource, /GENERATED_EXERCISE_LIBRARY\.length/);
      assert.doesNotMatch(proOfferSource, /'\d+ (ready programs|exercises)/);

      // No trial promise, and continuing free is the primary action.
      assert.doesNotMatch(proOfferSource, /trial|kokeilu/i);
      assert.match(proOfferSource, /proOffer\.continueFree/);

      // Shown once, on the plan-ready path.
      assert.match(appSource, /resetToRoute\(\{ tab: 'home', screen: 'pro_offer' \}\)/);
    },
  },
  {
    name: 'the unlock moment names what actually switched on',
    run() {
      // The mock's third card said '14 months of logs are back', which would
      // mean history had been taken away. It never was, in either tier, and the
      // Pro page one screen earlier says so.
      const block = i18nSource.match(/'unlock\.[\s\S]*?'unlock\.noBadge': '[^']*'/g);
      const copy = block ? block.join('\n') : '';
      assert.ok(copy.length > 0, 'the unlock copy block should be findable');
      assert.doesNotMatch(copy, /logs are back|lokit ovat takaisin|months of logs/i);
      assert.doesNotMatch(copy, /8 weeks|8 viikkoa/);

      // Each card points somewhere real and is a genuinely gated feature.
      for (const key of ['c1', 'c2', 'c3', 'c4']) {
        assert.match(unlockSource, new RegExp(`'unlock\\.${key}\\.t'`), `${key} should be listed`);
      }

      // A celebration you cannot dismiss is a modal, and the animation must
      // never be the thing hiding the content underneath it.
      assert.match(unlockSource, /setShowMoment\(false\)/);
      assert.match(unlockSource, /isReduceMotionEnabled/);

      // The %-sized Svg trap: a gradient with no viewBox does not stretch to a
      // flex parent on Android, it leaves a hard edge where it stopped
      // measuring. The field is measured and drawn at pixel size instead.
      // (A percentage Svg WITH a viewBox scales fine — the sparkline uses one.)
      assert.match(unlockSource, /onLayout=\{\(event\) => \{/);
      assert.match(unlockSource, /<Svg style=\{StyleSheet\.absoluteFill\} width=\{field\.width\} height=\{field\.height\}>/);
    },
  },
  {
    name: 'the coach chat says each fact once',
    run() {
      const chat = read('src', 'screens', 'AICoachChatScreen.tsx');

      // What the coach has read and what today is were three surfaces saying
      // one thing: a subtitle, a strip of context chips, and an evidence
      // footnote under every answer. They are one line now.
      assert.match(chat, /const contextLine = useMemo/);
      assert.doesNotMatch(chat, /styles.chipStrip/);
      assert.doesNotMatch(chat, /'coachChat.evidence'/);

      // The PRO pill is gone; the free quota still has its own row, so nothing
      // honest was lost with it.
      assert.doesNotMatch(chat, /styles.badge/);
      assert.match(chat, /styles.quotaRow/);

      // The coach gets no bubble — it is the voice of the screen. Only the
      // user's own words are enclosed.
      assert.match(chat, /coachBubble: \{\s*maxWidth: '96%',\s*\},/);
      assert.match(chat, /meBubble: \{[\s\S]*?backgroundColor: theme\.purple/);

      // Bottom-anchored: a half-empty thread must not leave a dead middle.
      assert.match(chat, /thread: \{[\s\S]*?justifyContent: 'flex-end'/);
    },
  },
];

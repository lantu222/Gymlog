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
const loggerSource = read('src', 'screens', 'WorkoutLoggingScreen.tsx');
const proOfferSource = read('src', 'screens', 'ProOfferScreen.tsx');

/**
 * The Pro/Free audit (2026-07-28) found three ways the paid tier lied: a promo
 * code that never expired, screens that read the preview switch instead of the
 * entitlement, and a dark-theme toggle sold as a Pro perk that repainted
 * nothing. These guard the fixes, because every one of them is invisible until
 * someone pays.
 */
module.exports = [
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
      assert.match(appSource, /hasAdaptiveCoachPremium=\{coachProUnlocked\}/);
      assert.match(appSource, /proUnlocked=\{coachProUnlocked\}/);
    },
  },
  {
    name: 'Settings and Plan settings resolve Pro through isProUnlocked',
    run() {
      for (const [name, source] of [
        ['SettingsScreen', settingsSource],
        ['PlanSettingsScreen', planSettingsSource],
      ]) {
        assert.match(source, /import \{ isProUnlocked \} from '\.\.\/lib\/proEntitlement';/, name);
        assert.match(source, /const proUnlocked = isProUnlocked\(preferences\);/, name);
        assert.doesNotMatch(
          source,
          /preferences\.adaptiveCoachPremiumUnlocked/,
          `${name} must not read the raw preview flag — a promo user is Pro too`,
        );
      }
    },
  },
  {
    name: 'the dark-theme row offers no switch while the theme engine does not exist',
    run() {
      assert.doesNotMatch(
        settingsSource,
        /darkTheme, setDarkTheme/,
        'a toggle that repaints nothing reads as a delivered Pro perk',
      );
      assert.match(settingsSource, /title=\{t\(language, 'settings\.darkTheme'\)\}[\s\S]{0,240}?soonPill/);
    },
  },
  {
    name: 'the Pro page table draws the line where the code draws it',
    run() {
      const table = premiumSource.match(/const TABLE[\s\S]*?\n\];/);
      assert.ok(table, 'the grouped Track/Understand/Decide table should be declared');

      // TRACK: everything free stays marked free in both columns.
      for (const key of ['logging', 'ready', 'own', 'history', 'records', 'rest']) {
        assert.match(table[0], new RegExp(`\['pro\.page\.row\.${key}', 1, 1\]`), `${key} is free`);
      }

      // The paywall-moments rule: the detection is free, the conclusion is Pro.
      assert.match(table[0], /\['pro\.page\.row\.plateau', 1, 1\]/);
      assert.match(table[0], /\['pro\.page\.row\.why', 0, 1\]/);
      assert.match(table[0], /\['pro\.page\.row\.recovery', 0, 1\]/);
      assert.match(table[0], /\['pro\.page\.row\.analysis', 0, 1\]/);

      // DECIDE: all four are genuinely gated in the app.
      assert.match(table[0], /\['pro\.page\.row\.adaptive', 0, 1\]/);
      assert.match(table[0], /\['pro\.page\.row\.progression', 0, 1\]/);
      assert.match(table[0], /\['pro\.page\.row\.builder', 0, 1\]/);
      // The free coach quota the table promises is implemented (aiCoachQuota).
      assert.match(table[0], /\['pro\.page\.row\.coach', 'quota', 1\]/);

      // No trial promise anywhere on the page while billing is off.
      assert.doesNotMatch(premiumSource, /trial|kokeilujakso/i);
      assert.match(premiumSource, /pro\.page\.plannedNote/);
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
      assert.match(chat, /lockedLines:/);

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
    },
  },
  {
    name: 'the effort question is rendered, because every adaptive feature starts there',
    run() {
      // EFFORT_OPTIONS and handleRecordEffort existed as dead code: declared,
      // never rendered. No set could be rated, so the adaptive set coach, the
      // coach's rest override and paywall moment 4 were all unreachable while
      // the Pro page sold two of them. The prompt must stay on screen.
      assert.match(loggerSource, /EFFORT_OPTIONS\.map\(/, 'the effort options must render');
      assert.match(loggerSource, /onPress=\{\(\) => handleRecordEffort\(option\.value\)\}/);
      assert.match(loggerSource, /activeEffortPrompt && activeEffortPrompt\.slotId === exercise\.slotId/);
      // Skippable and inline — it must never block the next set.
      assert.match(loggerSource, /onPress=\{handleSkipEffortPrompt\}/);
      assert.doesNotMatch(loggerSource, /<Modal[^>]*effort/i);

      // A recorded effort reads back on the row it belongs to.
      const setRow = read('src', 'components', 'WorkoutSetRow.tsx');
      assert.match(setRow, /completed && effort \?/);
      assert.match(setRow, /styles\.effortPill/);
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

      // Logger: moment 4 is a passive chip, never a spontaneous modal — it
      // renders inline in the exercise list and only speaks when tapped.
      assert.match(loggerSource, /postEffortTransition\.adaptiveCoachLocked \?/);
      assert.match(loggerSource, /styles\.coachChip/);

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

      // The logger's own bootstrap is the fourth path.
      assert.match(
        loggerSource,
        /automatedProgressionEnabled: automatedProgressionEnabled && hasAdaptiveCoachPremium/,
      );

      // The raw toggle still drives the adaptive-coach offer, so a free user
      // with it on sees the locked upsell and one with it off is left alone.
      assert.match(loggerSource, /resolveAdaptiveCoachOffer\(\{\s*automatedProgressionEnabled,/);
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
];

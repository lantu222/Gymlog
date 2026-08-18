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

      // Calling the action is not the same as the action landing. The swap
      // above satisfied this suite while being completely dead on screen: the
      // step list is memoised, every set step bakes in the exercise name, and
      // the memo key listed only slots, set counts and skips. The name moved in
      // state and the player went on rendering the steps it already had. The
      // key now comes from the module that builds the steps, so the thing the
      // steps depend on and the thing that invalidates them cannot drift apart.
      assert.match(guidedSource, /getGuidedStepPlanKey\(guidedExercises\)/);
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
      // Interest in Pro goes to the Pro page, never to the management screen
      // (seen on the phone: the PRO chip landed on "Manage subscription").
      assert.match(settingsSource, /onPress=\{themeRow\.locked \? onOpenPremium : undefined\}/);
      assert.match(settingsSource, /onPress=\{proUnlocked \? onOpenSubscription : onOpenPremium\}/);
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
      // adaptSession stopped wearing it: the progression gate's fatigue holds
      // are wired to the ACWR model now, so the row is live. The claim was
      // narrowed with it — "Session & weekly adaptation" promised a weekly
      // half that still does not exist, so the row names only the half that
      // ships. A row cannot be half live.
      assert.match(table[0], /'pro\.v2\.row\.adaptSession', free: null, pro: 'pro\.v2\.val\.yes'/);
      assert.doesNotMatch(i18nSource, /'pro\.v2\.(row\.adaptSession|coach\.session\.t)': '[^']*weekly/);

      // Claims from the v2 mock that describe things this app does not do.
      // Checked against the copy itself, not the screen — the screen's comments
      // name the cut features on purpose.
      const copy = i18nSource.match(/'pro\.v2\.[\s\S]*?'pro\.v2\.footer': '[^']*'/g)?.join('\n') ?? '';
      assert.ok(copy.length > 0, 'the pro.v2 copy block should be findable');
      assert.ok(
        copy.length < 20000,
        'the pro.v2 span ran past its own block — a pro.v2.* key was added after pro.v2.footer',
      );
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
      assert.match(chat, /lockedBody: \[withheld\.takeaway/);

      // "AI program builder — Pro": the composer route and both entries gate on
      // Pro. The route gate is an effect, because the entries are not the only
      // way onto a route (history, a lapsed entitlement mid-screen).
      assert.match(appSource, /route\.screen === 'ai_setup' && !coachProUnlocked\) \{\s*navigate\(\{ tab: 'profile', screen: 'premium' \}\);/);
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
    name: 'one price set, and no price outside the dictionary',
    run() {
      const i18n = read('src', 'lib', 'i18n.ts');

      // This guard existed and still let two coherent price sets ship in one
      // build. It failed twice over: it forbade 59,99 and 69,99 where the
      // onboarding paywall actually said 59,90, and it pinned three keys while
      // the paywall's own keys were not among them.
      //
      // The set is arithmetic, not a list of forbidden numbers: 59,90 / 12 =
      // 4,99, / 52 = 1,15, and against 9,90 x 12 = 118,80 that is 50% off.
      for (const shape of [/71[.,]99/, /69[.,]99/, /5[.,]99/, /9[.,]99/]) {
        assert.doesNotMatch(i18n, shape, `${shape} belongs to the retired price set`);
      }
      const priced = {
        'pro.page.billedYearly': /59,90/,
        'coach.lock.fine': /59,90/,
        'subs.yearlyPrice': /59,90/,
        'unlock.trialBody': /59,90/,
        'pro.v2.ctaSubYearly': /59,90/,
        'paywall.plan.yearly.price': /59,90/,
        'paywall.cta.footYear': /59,90/,
        'pro.page.perYearly': /4,99/,
        'paywall.plan.yearly.note': /4,99/,
        'paywall.plan.yearly.week': /1,15/,
        'pro.page.perMonthly': /9,90/,
        'paywall.plan.monthly.price': /9,90/,
        'subs.monthlyPrice': /9,90/,
        'pro.page.perLifetime': /119,00/,
        'pro.v2.ctaSubLifetime': /119,00/,
      };
      const lines = i18n.split(String.fromCharCode(10));
      for (const [key, shape] of Object.entries(priced)) {
        const matches = lines.filter((row) => row.includes(`'${key}':`));
        assert.ok(matches.length >= 2, `${key} should exist in both languages`);
        for (const line of matches) {
          assert.match(line, shape, `${key} must quote the one price set`);
        }
      }

      // The root cause: PremiumScreen carried '5,99 €' and '9,99 €' as string
      // literals in its plan array, so the numbers this guard exists for were
      // not in the file this guard reads.
      for (const file of ['PremiumScreen.tsx', 'ProPaywallScreen.tsx']) {
        // Comments are exempt: the one in PremiumScreen quotes both retired
        // prices to explain how they came to ship together, and losing that
        // to a guard about rendered strings would be the wrong trade.
        const code = read('src', 'screens', file)
          .split(String.fromCharCode(10))
          .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
          .join(String.fromCharCode(10));
        assert.doesNotMatch(code, /[0-9]+[.,][0-9][0-9]\s*€/, `${file} must take prices from i18n`);
      }
    },
  },
  {
    name: 'the Pro page knows whether the reader already pays, and renders its one real asset',
    run() {
      // Two failures of the same kind: a value computed and never read.
      //
      // proUnlocked reached this screen and nothing looked at it, so an
      // existing subscriber saw "start your free trial" — and the button ran
      // onTogglePreview, which flips the switch OFF. The page's only button
      // was a cancel button wearing a trial label.
      assert.match(premiumSource, /\{proUnlocked \? \(/);
      assert.match(premiumSource, /t\(language, 'promo\.proOn'\)/);
      // A redeemed code cannot be turned off by the preview switch, so that
      // case must route to subscription management instead of toggling.
      assert.match(premiumSource, /promoOnly \? onManageSubscription : onTogglePreview/);
      assert.match(appSource, /onManageSubscription=\{\(\) => navigate\(\{ tab: 'profile', screen: 'subscription' \}\)\}/);

      // coachSpecimen is proInsights' real read of this reader's own log. It
      // was passed in and dropped: the hero charted their numbers and nothing
      // said what they meant, which is the only thing the page is selling.
      assert.match(premiumSource, /\{coachSpecimen \? \(/);
      assert.match(premiumSource, /styles\.specimenText/);
      // Blurred before you buy, plain after — never the other way round.
      assert.match(premiumSource, /proUnlocked \? \([\s\S]{0,200}styles\.specimenText/);
      assert.match(premiumSource, /styles\.specimenScrim/);
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
      // proInsights — the same sentence Pro reads unblurred in place. It is
      // one string, not a pre-wrapped pair: a line break authored for English
      // width split a Finnish genitive from its head noun.
      assert.match(appSource, /locked: proPlateau\.conclusion/);
      assert.match(homeSource, /plateau\.locked\.body/);
      assert.match(homeSource, /proUnlocked \?/);

      // Progress: statuses always free, and the footer says so.
      const progress = read('src', 'screens', 'ProgressScreen.tsx');
      assert.match(progress, /pro\.read\.footer/);

      // Moment 4 (the logger's post-effort coach chip) went with the list
      // logger and the effort question it hung off.

      // The old Home pro sheet is gone: one full page, moments elsewhere.
      assert.doesNotMatch(homeSource, /PRO_STATS|PRO_COMPARISON|proSheetVisible/);
      // The PRO pill is gone from the header, so this is now the only place
      // Home reaches the Pro page: the plateau moment's sheet. The prop and
      // the route stay — twelve other surfaces use them.
      assert.match(homeSource, /onSeePro=\{\(\) => \{[\s\S]{0,120}onOpenPremium\?\.\(\);/);
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
      // Two start paths now: ready and custom. The AI branch no longer starts
      // a workout of its own — it composes a programme that is saved as a
      // custom one and starts through the custom path like any other.
      assert.equal(
        (appSource.match(/resolveProgressionOptions\((preferences|nextPreferences)\)/g) ?? []).length,
        2,
        'the ready and custom start paths must both resolve through the entitlement',
      );

      // There used to be a fourth path — the list logger's own bootstrap —
      // and it went with the screen. The three above are now all of them.
    },
  },
  {
    name: 'the post-onboarding offer states only counts the code can prove',
    run() {
      // The two figures are read from the catalog and the library, never typed.
      // The onboarding paywall's programs line follows the same rule — it is
      // the only number on that screen anyone can check, so it must not become
      // a string the day someone adds a program.
      const paywallSource = read('src', 'screens', 'ProPaywallScreen.tsx');
      assert.match(paywallSource, /count: WORKOUT_TEMPLATES_V1\.length/);
      assert.doesNotMatch(paywallSource, /'\d+ (programs|ohjelmaa)/);
      assert.match(proOfferSource, /WORKOUT_TEMPLATES_V1\.length/);
      assert.match(proOfferSource, /GENERATED_EXERCISE_LIBRARY\.length/);
      assert.doesNotMatch(proOfferSource, /'\d+ (ready programs|exercises)/);

      // No trial promise, and continuing free is the primary action.
      assert.doesNotMatch(proOfferSource, /trial|kokeilu/i);
      assert.match(proOfferSource, /proOffer\.continueFree/);

      // No longer reached: the Pro sale moved INSIDE onboarding as its last
      // step (the "GAINER Paywall Sell" design), and keeping this hop would
      // have put two paywalls back to back. The screen and its route are still
      // here — unrouted, not deleted — so this asserts the duplication is gone
      // rather than that the screen is.
      assert.doesNotMatch(appSource, /resetToRoute\(\{ tab: 'home', screen: 'pro_offer' \}\)/);
    },
  },
  {
    name: 'the unlock moment announces exactly what PRO_LIVE_BENEFITS sells',
    run() {
      // The unlock screen used to carry its own parallel card list, which is
      // how it sold the adaptive set coach for a day after the feature was
      // deleted. The cards now live in proBenefits.ts next to the source list
      // and the union invariant is tested at runtime in proBenefits.test.cjs;
      // here we pin the screen to that source and to the honest behaviours.
      assert.match(unlockSource, /PRO_UNLOCK_CARDS\.map/);
      assert.doesNotMatch(unlockSource, /adaptive|sarjavalmentaja|nextSet|\+2,5/i);

      // No splash phase: the reveal IS the staggered checklist, and it must
      // settle instantly under reduced motion — the animation is never the
      // thing hiding the content.
      assert.doesNotMatch(unlockSource, /MOMENT_MS|setShowMoment/);
      assert.match(unlockSource, /Animated\.stagger\(ROW_STAGGER_MS/);
      assert.match(unlockSource, /isReduceMotionEnabled/);

      // One CTA, not two labels for the same navigation.
      assert.match(unlockSource, /onPress=\{onDone\}/);
      assert.doesNotMatch(unlockSource, /onOpenLogger/);

      // The specimen card renders only with real data — no invented read.
      assert.match(unlockSource, /coachSpecimen \? \(/);

      // Old lies stay dead: no history-restoration claims in the copy.
      const block = i18nSource.match(/'unlock\.[\s\S]*?'unlock\.noBadge': '[^']*'/g);
      const copy = block ? block.join('\n') : '';
      assert.ok(copy.length > 0, 'the unlock copy block should be findable');
      assert.doesNotMatch(copy, /logs are back|lokit ovat takaisin|months of logs/i);
      assert.doesNotMatch(copy, /8 weeks|8 viikkoa/);
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

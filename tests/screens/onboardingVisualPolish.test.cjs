const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const appShellSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'AppShell.tsx'), 'utf8');
const onboardingSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);

module.exports = [
  {
    name: 'onboarding plan-ready screen keeps safe-area background consistent and hero copy readable',
    run() {
      assert.match(appShellSource, /shellBackgroundColor\?: string/);
      assert.match(appSource, /const onboardingScreenActive = onboardingActive \|\| setupOnboardingActive/);
      assert.match(appSource, /shellBackgroundColor=\{onboardingScreenActive \? '#1D1C35' : undefined\}/);
      assert.match(appSource, /statusBarStyleOverride=\{welcomeActive \|\| onboardingScreenActive \? 'light' : undefined\}/);
      assert.match(onboardingSource, /const planReadyActiveWorkoutImageSource = planReadyActiveWorkout/);
      assert.match(onboardingSource, /const \[planReadyProgramOverviewVisible, setPlanReadyProgramOverviewVisible\] = useState\(false\)/);
      assert.match(onboardingSource, /const \[expandedPlanReadyProgramWeek, setExpandedPlanReadyProgramWeek\] = useState\(2\)/);
      assert.match(onboardingSource, /<Image[\s\S]*source=\{planReadyActiveWorkoutImageSource\}[\s\S]*style=\{styles\.planReadyNextSessionHeroImage\}/);
      assert.match(onboardingSource, /planReadyNextSessionHeroImage:\s*\{[\s\S]*width: '172%'/);
      assert.match(onboardingSource, /planReadyNextSessionHeroShade:\s*\{[\s\S]*backgroundColor: 'rgba\(4,4,14,0\.32\)'/);
      assert.match(onboardingSource, /planReadyNextSessionHeroSideShade:\s*\{[\s\S]*display: 'flex'/);
      assert.match(onboardingSource, /planReadyNextSessionTitle:\s*\{[\s\S]*textShadowColor: 'rgba\(0,0,0,0\.82\)'/);
      assert.match(onboardingSource, /planReadyNextSessionBody:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.9\)'/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyNextExerciseChevron/);
      assert.doesNotMatch(onboardingSource, /planReadyNextExerciseChevron:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyNextExerciseChevronText:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramTitle/);
      assert.doesNotMatch(onboardingSource, /\{planReadyProgramTitle\}/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyProgramWeekBadgeText\}>Week 1 of 4<\/Text>/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyProgramDayTitle\}>\{`Day \$\{planReadyWorkoutPageStart \+ 1\} of \$\{planReadyWorkoutCount\}`\}<\/Text>/);
      assert.match(onboardingSource, /planReadyNextSessionHeroCopy:\s*\{[\s\S]*justifyContent: 'flex-start'/);
      assert.match(onboardingSource, /planReadyHeroMainCopy:\s*\{[\s\S]*minHeight: 150/);
      assert.match(onboardingSource, /if \(planReadyProgramOverviewVisible\) \{/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyProgramOverviewKicker\}>4-WEEK<\/Text>/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyProgramOverviewTitleProgress\}>PROGRESS<\/Text>/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyProgramOverviewTitlePlan\}>PLAN<\/Text>/);
      assert.match(onboardingSource, /BUILD\. <Text style=\{styles\.planReadyProgramOverviewTaglineAccent\}>FOCUS\.<\/Text> PROGRESS\./);
      assert.match(onboardingSource, /planReadyProgramOverviewHero:\s*\{[\s\S]*height: 288/);
      assert.match(onboardingSource, /planReadyProgramOverviewHeroCopy:\s*\{[\s\S]*left: 54[\s\S]*bottom: 18/);
      assert.match(onboardingSource, /planReadyProgramOverviewKicker:\s*\{[\s\S]*fontSize: 19[\s\S]*letterSpacing: 0\.7[\s\S]*skewX: '-11deg'[\s\S]*scaleY: 1\.08/);
      assert.match(onboardingSource, /planReadyProgramOverviewTitleProgress:\s*\{[\s\S]*fontStyle: 'italic'/);
      assert.match(onboardingSource, /planReadyProgramOverviewTitleProgress:\s*\{[\s\S]*fontSize: 44[\s\S]*scaleX: 0\.9[\s\S]*scaleY: 1\.24/);
      assert.match(onboardingSource, /planReadyProgramOverviewTitlePlan:\s*\{[\s\S]*color: '#A15BFF'/);
      assert.match(onboardingSource, /planReadyProgramOverviewTitlePlan:\s*\{[\s\S]*fontSize: 50[\s\S]*scaleX: 0\.9[\s\S]*scaleY: 1\.24/);
      assert.match(onboardingSource, /planReadyProgramOverviewTaglineAccent:\s*\{[\s\S]*color: '#A98BFF'/);
      assert.match(onboardingSource, /style=\{styles\.planReadyProgramCarbonBackdrop\}/);
      assert.match(onboardingSource, /Array\.from\(\{ length: 20 \}\)/);
      assert.match(onboardingSource, /fill="rgba\(169,139,255,0\.030\)"/);
      assert.doesNotMatch(onboardingSource, /Build week by week with the same Upper, Lower and Full Body structure\./);
      assert.match(onboardingSource, /PLAN_READY_PROGRAM_OVERVIEW_HERO_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/progress-plan-purple-hero\.png'\)/);
      assert.match(onboardingSource, /stage === 'review' && planReadyProgramOverviewVisible \? \(/);
      assert.match(onboardingSource, /source=\{PLAN_READY_PROGRAM_OVERVIEW_HERO_SOURCE\}[\s\S]*style=\{styles\.planReadyProgramOverviewRootImage\}/);
      assert.match(onboardingSource, /styles\.planReadyProgramOverviewStage/);
      assert.match(onboardingSource, /styles\.planReadyProgramOverviewScrollView/);
      assert.match(onboardingSource, /planReadyProgramOverviewStage:\s*\{[^}]*backgroundColor: 'transparent'/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramOverviewHeroImage/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramOverviewScreenImage/);
      assert.match(onboardingSource, /planReadyProgramOverviewRootImage:\s*\{[\s\S]*left: -52[\s\S]*width: '124%'[\s\S]*translateX: 42/);
      assert.match(onboardingSource, /planReadyProgramOverviewRootShade:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.match(onboardingSource, /planReadyProgramOverviewFooter:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramOverviewBackText/);
      assert.match(onboardingSource, /planReadyProgramWeeks = planReadyPayload\.fourWeekProgression\.map/);
      assert.match(onboardingSource, /title: phase\.label\.replace/);
      assert.match(onboardingSource, /summary: phase\.body/);
      assert.match(onboardingSource, /planReadyProgramWeekList:\s*\{[\s\S]*marginTop: 150[\s\S]*marginHorizontal: 10[\s\S]*backgroundColor: 'transparent'[\s\S]*overflow: 'visible'[\s\S]*gap: 10/);
      assert.match(onboardingSource, /weekIndex === 0 && styles\.planReadyProgramWeekCardFirst/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramOverviewIntro/);
      assert.doesNotMatch(onboardingSource, /<Text style=\{styles\.planReadyProgramWeekSummary\}>/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekToggle/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramWeekMeta/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekDay/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekLetterBadge/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekLetter/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekRhythm/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekRhythmItem/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyProgramWeekFocus/);
      assert.match(onboardingSource, /planReadyProgramOverviewContent:\s*\{[\s\S]*position: 'relative'/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramWeekListScrim/);
      assert.match(onboardingSource, /<Rect x="0" y="0" width="390" height="760" fill="transparent" \/>/);
      assert.match(onboardingSource, /planReadyProgramCarbonBackdrop:\s*\{[\s\S]*opacity: 0/);
      assert.match(onboardingSource, /planReadyProgramOverviewShell:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.match(onboardingSource, /planReadyProgramWeekList:\s*\{[\s\S]*backgroundColor: 'rgba\(18,17,39,0\.46\)'[\s\S]*gap: 10/);
      assert.match(onboardingSource, /planReadyProgramWeekCard:\s*\{[\s\S]*borderRadius: 12[\s\S]*borderWidth: 1[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /planReadyProgramWeekCardExpanded:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /planReadyProgramWeekWorkoutCard:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /planReadyProgramWeekWorkoutList:\s*\{[\s\S]*padding: 18[\s\S]*gap: 16/);
      assert.match(onboardingSource, /planReadyProgramWeekWorkoutHeader:\s*\{[\s\S]*paddingVertical: 14/);
      assert.match(onboardingSource, /planReadyProgramExerciseRow:\s*\{[\s\S]*minHeight: 54[\s\S]*paddingVertical: 11/);
      assert.match(onboardingSource, /planReadyProgramExerciseTargets:\s*\{[\s\S]*width: 76/);
      assert.match(onboardingSource, /planReadyProgramExerciseTarget:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.9\)'[\s\S]*fontSize: 12[\s\S]*lineHeight: 15/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramWeekList:\s*\{[\s\S]*backgroundColor: 'rgba\(5,5,13,0\.96\)'/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramWeekCardExpanded:\s*\{[\s\S]*backgroundColor: 'rgba\(36,18,70,0\.72\)'/);
      assert.match(onboardingSource, /expandedPlanReadyProgramWeek === programWeek\.week/);
      assert.match(onboardingSource, /workout\.exercises\.map\(\(exercise, exerciseIndex\) =>/);
      assert.match(onboardingSource, /setPlanReadyProgramOverviewVisible\(true\)/);
      assert.match(onboardingSource, /setPlanReadyProgramOverviewVisible\(false\)/);
      assert.match(onboardingSource, /import \{ PrimaryCTAButton \} from '\.\.\/components\/PrimaryCTAButton'/);
      assert.match(onboardingSource, /stage === 'review' && busy[\s\S]*\? 'SAVING PLAN\.\.\.'/);
      assert.match(onboardingSource, /stage === 'review'[\s\S]*\? 'SAVE PLAN & START'/);
      assert.match(onboardingSource, /stage === 'about'[\s\S]*\? 'BUILD MY PLAN'/);
      assert.match(onboardingSource, /: 'CONTINUE'/);
      assert.match(onboardingSource, /<PrimaryCTAButton[\s\S]*title=\{footerPrimaryLabel\}[\s\S]*disabled=\{!canContinue \|\| busy\}[\s\S]*style=\{styles\.onboardingPrimaryCTA\}/);
      assert.match(onboardingSource, /footer:\s*\{[\s\S]*paddingTop: 32[\s\S]*gap: 16/);
      assert.match(onboardingSource, /footerBackText:\s*\{[\s\S]*opacity: 0\.6[\s\S]*fontSize: 15/);
      assert.match(onboardingSource, /dot:\s*\{[\s\S]*height: 7/);
      assert.match(onboardingSource, /dotActive:\s*\{[\s\S]*shadowColor: '#8B5CF6'[\s\S]*shadowOpacity: 0\.32[\s\S]*shadowRadius: 10/);
      assert.doesNotMatch(onboardingSource, /This helps us build the right program for you\./);
      assert.doesNotMatch(onboardingSource, /<Text style=\{styles\.locationSubtitle\}>/);
      assert.match(onboardingSource, /const scrollLockedStage =[\s\S]*stage === 'location'[\s\S]*stage === 'about'/);
      assert.match(onboardingSource, /locationEquipmentTopPane:\s*\{[\s\S]*height: 206[\s\S]*paddingTop: 36/);
      assert.match(onboardingSource, /locationEquipmentTopCopy:\s*\{[\s\S]*paddingTop: 58/);
      assert.match(onboardingSource, /style=\{styles\.locationProgressBarWrap\}[\s\S]*<StepDots index=\{stageIndex\} \/>/);
      assert.match(onboardingSource, /locationProgressBarWrap:\s*\{[\s\S]*position: 'absolute'[\s\S]*top: 54[\s\S]*minHeight: 12/);
      assert.match(onboardingSource, /locationStepOneOptionsShift:\s*\{[\s\S]*translateY: -36/);
      assert.match(onboardingSource, /trainingProfileTopCopy:\s*\{[\s\S]*paddingTop: 58/);
      assert.match(onboardingSource, /focusAreaTopPane:\s*\{[\s\S]*height: 206[\s\S]*paddingTop: 24/);
      assert.match(onboardingSource, /focusAreaTopCopy:\s*\{[\s\S]*paddingTop: 58/);
      assert.match(onboardingSource, /bodyweightTopPane:\s*\{[\s\S]*height: 214[\s\S]*paddingTop: 24/);
      assert.match(onboardingSource, /bodyweightTopCopy:\s*\{[\s\S]*paddingTop: 58/);
      assert.match(onboardingSource, /type BodyweightSetupStep = 'goal' \| 'current' \| 'target' \| 'outcome'/);
      assert.match(onboardingSource, /BODYWEIGHT_SETUP_STEPS: BodyweightSetupStep\[\] = \['goal', 'current', 'target', 'outcome'\]/);
      assert.match(onboardingSource, /const \[bodyweightSetupStep, setBodyweightSetupStep\] = useState<BodyweightSetupStep>\('goal'\)/);
      assert.match(onboardingSource, /const \[bodyweightGoalSelected, setBodyweightGoalSelected\]/);
      assert.match(onboardingSource, /bodyweightSetupStep === 'goal'[\s\S]*\? \["WHAT'S YOUR", 'GOAL\?'\]/);
      assert.match(onboardingSource, /bodyweightSetupStep === 'current'[\s\S]*\? \["WHAT'S YOUR", 'CURRENT WEIGHT\?'\]/);
      assert.match(onboardingSource, /bodyweightSetupStep === 'target'[\s\S]*\? \['SET A GOAL', 'WEIGHT'\]/);
      assert.match(onboardingSource, /: \['EXPECTED', 'OUTCOME'\]/);
      assert.match(onboardingSource, /bodyweightSetupStep === 'goal'[\s\S]*styles\.bodyweightGoalStepList/);
      assert.match(onboardingSource, /wide[\s\S]*onPress=\{\(\) => \{[\s\S]*setBodyweightGoalSelected\(true\)/);
      assert.match(onboardingSource, /AnimatedPressable = Animated\.createAnimatedComponent\(Pressable\)/);
      assert.match(onboardingSource, /toValue: active \? 1\.04 : 1/);
      assert.match(onboardingSource, /bodyweightGoalStepList:\s*\{[\s\S]*gap: 18/);
      assert.match(onboardingSource, /bodyweightGoalCardWide:\s*\{[\s\S]*minHeight: 97[\s\S]*borderRadius: 14/);
      assert.match(onboardingSource, /bodyweightGoalCardWideActive:\s*\{[\s\S]*backgroundColor: '#5F4EE8'[\s\S]*shadowColor: '#8B5CF6'[\s\S]*shadowOpacity: 0\.46[\s\S]*shadowRadius: 26/);
      assert.match(onboardingSource, /bodyweightGoalCardActiveBloom:\s*\{[\s\S]*backgroundColor: '#8B5CF6'[\s\S]*opacity: 0\.34/);
      assert.match(onboardingSource, /bodyweightGoalCheck:\s*\{[\s\S]*width: 38[\s\S]*height: 38[\s\S]*shadowColor: '#FFFFFF'/);
      assert.match(onboardingSource, /bodyweightGoalIconBubbleWide:\s*\{[\s\S]*backgroundColor: '#7C6AF2'/);
      assert.match(onboardingSource, /bodyweightTargetCard:\s*\{[\s\S]*minHeight: 96[\s\S]*borderRadius: 18/);
      assert.match(onboardingSource, /bodyweightTargetValueInput:\s*\{[\s\S]*fontSize: 40[\s\S]*textAlign: 'center'/);
      assert.match(onboardingSource, /bodyweightTargetStepButton:\s*\{[\s\S]*width: 38[\s\S]*height: 38[\s\S]*borderColor: 'rgba\(169,139,255,0\.36\)'/);
      assert.match(onboardingSource, /function BodyweightStepButton\(/);
      assert.match(onboardingSource, /void haptics\.select\(\);[\s\S]*onPress\(\);/);
      assert.match(onboardingSource, /outputRange: \[1, 1\.05\]/);
      assert.doesNotMatch(onboardingSource, /bodyweightTargetStepGlow/);
      assert.match(onboardingSource, /<BodyweightStepButton[\s\S]*label="-"/);
      assert.match(onboardingSource, /<BodyweightStepButton[\s\S]*label="\+"/);
      assert.match(onboardingSource, /bodyweightUnitPill:\s*\{[\s\S]*minWidth: 40[\s\S]*minHeight: 24/);
      assert.doesNotMatch(onboardingSource, /label="Current weight"[\s\S]*onUnitChange=\{setUnitPreference\}/);
      assert.match(onboardingSource, /label=\{`Current Weight \(\$\{unitPreference\.toUpperCase\(\)\}\)`\}/);
      assert.match(onboardingSource, /const targetWeightBlock = \([\s\S]*<BodyweightStepper[\s\S]*label=\{`Goal Weight \(\$\{unitPreference\.toUpperCase\(\)\}\)`\}[\s\S]*onChange=\{\(nextValue\) =>/);
      assert.doesNotMatch(onboardingSource, /const targetWeightBlock = \([\s\S]*<BodyweightTargetSlider/);
      assert.match(onboardingSource, /<Text style=\{styles\.bodyweightSummaryValue\}>Goal: \{selectedGoalOption\.title\}<\/Text>/);
      assert.doesNotMatch(onboardingSource, /bodyweightGoalSummaryPill/);
      assert.match(onboardingSource, /bodyweightSetupStep === 'outcome'[\s\S]*\? 'BUILD MY PLAN'/);
      assert.match(onboardingSource, /currentBodyweightStepIndex < BODYWEIGHT_SETUP_STEPS\.length - 1[\s\S]*setBodyweightSetupStep\(BODYWEIGHT_SETUP_STEPS\[currentBodyweightStepIndex \+ 1\]\)/);
      assert.match(onboardingSource, /Object\.entries\(FOCUS_AREA_CARD_ASSETS\)\.map/);
      assert.match(onboardingSource, /style=\{styles\.focusAreaPreloadTray\}/);
      assert.match(onboardingSource, /focus-chest-anatomy-card\.webp/);
      assert.match(onboardingSource, /function FocusAreaImageCard\(/);
      assert.match(onboardingSource, /const \[imageLoaded, setImageLoaded\] = useState\(false\)/);
      assert.doesNotMatch(onboardingSource, /focusAreaSkeletonShimmer/);
      assert.match(onboardingSource, /onLoadEnd=\{\(\) => setImageLoaded\(true\)\}/);
      assert.match(onboardingSource, /Animated\.timing\(imageOpacity[\s\S]*duration: 240/);
      assert.match(onboardingSource, /style=\{\[styles\.focusAreaImage, \{ opacity: imageOpacity \}\]\}/);
      assert.match(onboardingSource, /styles\.focusAreaSkeleton/);
      assert.match(onboardingSource, /focusAreaLabelsPreloadTrigger/);
      assert.match(onboardingSource, /Image\.prefetch\(asset\.uri\)/);
      assert.doesNotMatch(onboardingSource, /FOCUS_AREA_IMAGE_FRAMES/);
      // Focus-area cards sit on a dark backdrop behind the (currently dark)
      // anatomy illustrations, softened from pure black to dark slate (#1A1726).
      // These images are slated to be swapped for light-theme assets; once that
      // lands the backdrop changes again, so assert "a 6-digit hex backdrop that
      // is not pure black" rather than hard-coding the interim slate value.
      // TODO(focus-image-swap): assert the final light-asset treatment here.
      assert.match(onboardingSource, /focusAreaImageSlot:\s*\{[^}]*backgroundColor: '#[0-9A-Fa-f]{6}'/);
      assert.doesNotMatch(onboardingSource, /focusAreaImageSlot:\s*\{[^}]*backgroundColor: '#000000'/);
      assert.match(onboardingSource, /focusAreaSkeleton:\s*\{[^}]*backgroundColor: '#[0-9A-Fa-f]{6}'/);
      assert.doesNotMatch(onboardingSource, /focusAreaSkeleton:\s*\{[^}]*backgroundColor: '#000000'/);
      assert.match(onboardingSource, /planReadyWorkoutTabs\.map\(\(tab\) =>/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyCurrentWorkoutTitle\}>CURRENT WORKOUT<\/Text>/);
      assert.match(onboardingSource, /<Text style=\{styles\.planReadyAllWorkoutsTitle\}>ALL WORKOUTS<\/Text>/);
      assert.match(onboardingSource, /Day \{index \+ 1\} of \{planReadyWorkoutCount\}/);
      assert.match(onboardingSource, /PLAN_READY_UPPER_WORKOUT_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/upper-focus-background\.png'\)/);
      assert.match(onboardingSource, /PLAN_READY_LOWER_WORKOUT_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/lower-focus-background\.png'\)/);
      assert.match(onboardingSource, /PLAN_READY_FULL_BODY_WORKOUT_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/full-body-focus-background\.png'\)/);
      assert.match(onboardingSource, /PLAN_READY_WORKOUT_ROW_SOURCES: Record<string, ImageSourcePropType>/);
      assert.match(onboardingSource, /Upper: PLAN_READY_UPPER_WORKOUT_SOURCE/);
      assert.match(onboardingSource, /Lower: PLAN_READY_LOWER_WORKOUT_SOURCE/);
      assert.match(onboardingSource, /'Full Body': PLAN_READY_FULL_BODY_WORKOUT_SOURCE/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyAllWorkoutPreview/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyAllWorkoutImage/);
      assert.doesNotMatch(onboardingSource, /styles\.planReadyAllWorkoutPreviewOverlay/);
      assert.match(onboardingSource, /planReadyAllWorkoutRow:\s*\{[\s\S]*minHeight: 72/);
      assert.doesNotMatch(onboardingSource, /planReadyAllWorkoutImageShade:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyAllWorkoutImageFade:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyAllWorkoutPreview:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyAllWorkoutImage:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyAllWorkoutPreviewOverlay:\s*\{/);
      assert.doesNotMatch(onboardingSource, /<Text style=\{styles\.planReadyCurrentWorkoutMetaText\}>\{planReadyActiveWorkout\.duration\}<\/Text>/);
      assert.doesNotMatch(onboardingSource, /\{workout\.duration \?\? 'Guided workout'\} - \{workout\.exercises\.length \+ workout\.hiddenExerciseCount\} exercises/);
      assert.match(onboardingSource, /VIEW FULL PROGRAM/);
    },
  },
  {
    name: 'plan-building loading screen shows a calm progress list with no orb or mascot',
    run() {
      // Phase 2 redesign: the building-your-plan loader is a calm step list with
      // a slim progress bar - no orb/mascot/hype (handoff README, Phase 2
      // "Building-your-plan loader" + designs onb-screens3 "Building your plan").
      const loaderStart = onboardingSource.indexOf('function renderBuildingPlan()');
      assert.notEqual(loaderStart, -1, 'renderBuildingPlan should exist');
      const loaderEnd = onboardingSource.indexOf('return renderBuildingPlan();', loaderStart);
      const loaderBody = onboardingSource.slice(loaderStart, loaderEnd === -1 ? undefined : loaderEnd);

      // Four calm phase labels with rotating active subtitles.
      assert.match(onboardingSource, /const buildingPlanPhases = useMemo\([\s\S]*'Analyzing your inputs'[\s\S]*'Building your split'[\s\S]*'Matching exercises'[\s\S]*'Finalizing your plan'/);
      assert.match(onboardingSource, /const buildingPlanStepSubtitles = useMemo/);
      assert.match(onboardingSource, /Creating training structure\.\.\./);

      // Heading flips to the done copy; animated ellipsis while in progress.
      assert.match(loaderBody, /buildingPlanComplete \? 'Your plan is ready' : `Building your plan\$\{buildingPlanAnimatedEllipsis\}`/);
      assert.match(onboardingSource, /buildingPlanEllipsisStep/);
      assert.match(onboardingSource, /'\.'\.repeat\(buildingPlanEllipsisStep \+ 1\)/);
      assert.match(onboardingSource, /setBuildingPlanComplete\(true\)/);

      // Slim determinate progress bar + percent readout (calm, not a hype ring).
      assert.match(loaderBody, /styles\.buildingPlanProgressTrack/);
      assert.match(loaderBody, /styles\.buildingPlanProgressFill, \{ width: `\$\{buildingPlanPercent\}%` \}/);
      assert.match(loaderBody, /<Text style=\{styles\.buildingPlanPercentText\}>\{`\$\{buildingPlanPercent\}%`\}<\/Text>/);

      // Vertical step list with an active-row highlight and a done check.
      assert.match(loaderBody, /styles\.buildingPlanStepList/);
      assert.match(loaderBody, /buildingPlanPhases\.map\(\(label, index\) =>/);
      assert.match(loaderBody, /active && styles\.buildingPlanStepRowActive/);
      assert.match(loaderBody, /completed && styles\.buildingPlanStepIconDone/);
      assert.match(loaderBody, /styles\.buildingPlanStepActiveDot/);

      // No orb, mascot, progress ring, or "did you know" hype in the loader.
      assert.doesNotMatch(loaderBody, /GainerCoachOrb/);
      assert.doesNotMatch(onboardingSource, /buildingPlanOrbGlow/);
      assert.doesNotMatch(onboardingSource, /buildingPlanOrbFloat/);
      assert.doesNotMatch(onboardingSource, /buildingPlanPercentBadge/);
      assert.doesNotMatch(onboardingSource, /const ringSize = 282/);
      assert.doesNotMatch(onboardingSource, /const progressRadius = 118/);
      assert.doesNotMatch(onboardingSource, /DID YOU KNOW\?/);
      assert.doesNotMatch(onboardingSource, /Plans that adapt to you get better results/);
    },
  },
];

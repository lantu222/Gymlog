import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  ImageStyle,
  ImageSourcePropType,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { HG } from '../lightTheme';
import { useThemeName } from '../theming';
import { HG_DARK } from '../darkTheme';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { BadgePill, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { VinhaIcon, VinhaIconName } from '../components/VinhaIcon';
import { VinhaWordmark } from '../components/VinhaWordmark';
import { ProgramPickScreen } from './ProgramPickScreen';
import { LEVEL_STREAKS } from '../lib/levelStreaks';
import { OnboardingOptionIcon, OnboardingOptionIconName } from '../components/OnboardingOptionIcon';
import { PrimaryCTAButton } from '../components/PrimaryCTAButton';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { convertWeightToKg, formatWeight, formatWeightInputValue, parseNumberInput } from '../lib/format';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { equipmentItemLabel, I18nKey, t } from '../lib/i18n';
import {
  buildScheduleFitNote,
  buildFirstRunCustomProgramName,
  buildFirstRunHelperPrompt,
  buildFirstRunPromptSuggestions,
  buildFirstRunAiCoachContext,
  DEFAULT_FIRST_RUN_SELECTION,
  DEFAULT_RHYTHM_BY_DAYS,
  formatFocusAreaList,
  FirstRunSetupSelection,
  FirstRunStep,
  getFocusAreaDescription,
  getFocusAreaTitle,
  getGuidanceModeLabel,
  getRecommendedProgramName,
  getScheduleModeLabel,
  getSecondaryOutcomeTitle,
  getWeeklyMinuteOptions,
  getWeekdayShortLabel,
  resolveFirstRunRecommendationWithTailoring,
  resolveProjectedTrainingDays,
  getEffectiveWeeklyMinutes,
  getSetupEquipmentTitle,
  getSetupGoalTitle,
} from '../lib/firstRunSetup';
import { buildRecommendationTradeoffLabel } from '../lib/recommendationExplanation';
import { buildRecommendationOptionIds } from '../lib/recommendationPresentation';
import { buildRecommendationPlanReadyPayload } from '../lib/recommendationProgramme';
import { READY_PROGRAM_MIN_BLOCK_WEEKS } from '../lib/readyProgramDuration';
import { buildSessionGuidance } from '../lib/sessionGuidance';
import { getFocusAreaLabel, getOnboardingFocusAreaPresentationOptions } from '../lib/focusAreaPresentation';
import {
  buildProgramFocusSplit,
  getProgramFocusQualityLabel,
  PROGRAM_FOCUS_COLORS,
  ProgramFocusSegment,
} from '../lib/programFocusSplit';
import { composeProgramWeekForSelection } from '../lib/programDayComposer';
import { buildCautionSummaryLabel, CAUTION_TO_FOCUS_AREAS } from '../lib/cautionExerciseFilter';
import { buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { getReadyTemplatePresentation } from '../lib/templatePresentation';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { patternFromOnOff } from '../lib/trainingSchedule';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { colors, radii, spacing } from '../theme';
import { haptics } from '../utils/haptics';
import {
  AppLanguage,
  SetupDaysPerWeek,
  SetupAgeRange,
  SetupEquipment,
  SetupGender,
  SetupGoal,
  SetupGuidanceMode,
  SetupFocusArea,
  SetupLevel,
  SetupScheduleMode,
  SetupCautionArea,
  SetupCautionFlag,
  SetupCautionLevel,
  SetupSecondaryOutcome,
  SetupTrainingEnvironment,
  SetupWeekday,
  UnitPreference,
} from '../types/models';
import { AICoachAdvice } from '../types/aiCoach';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryReduceMotion } from '../utils/reduceMotion';

interface OnboardingScreenProps {
  initialUnitPreference: UnitPreference;
  language?: AppLanguage;
  readyProgramCount: number;
  dismissedTipIds: string[];
  onDismissTip: (tipId: string) => void | Promise<void>;
  mode?: 'first_run' | 'edit';
  initialSelection?: FirstRunSetupSelection | null;
  /**
   * Seeds the first-run questionnaire with the basics collected on the
   * About-you screen (name/gender/age/height/weight) WITHOUT marking the
   * questionnaire steps as already answered the way initialSelection does.
   */
  basicsSeed?: Partial<FirstRunSetupSelection> | null;
  initialStage?: SetupStage;
  tailoringPreferences?: TailoringPreferencesInput | null;
  onBackToEntry?: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onCompleteToTraining: (selection: FirstRunSetupSelection, recommendedProgramId: string) => void | Promise<void>;
  /**
   * Fires when a full-bleed review screen takes over — the program picker's
   * diagonal runs to the top edge. The shell
   * reserves the status-bar strip for onboarding and paints it light, which
   * would cut a band across either of them.
   */
  onFullBleedReviewChange?: (tone: 'light' | 'dark' | null) => void;
  onCompleteToProgramDetail: (selection: FirstRunSetupSelection, recommendedProgramId: string) => void | Promise<void>;
  onCompleteToCustom: (
    selection: FirstRunSetupSelection,
    recommendedProgramId: string | null,
    prefillName: string,
  ) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

type SetupStage =
  | 'location'
  | 'goal'
  | 'level'
  | 'days'
  | 'avoid'
  | 'review'
  | 'planning'
  | 'recommendation';
type HelperState = 'idle' | 'loading' | 'ready' | 'error';
type RecommendationRefinementPanel = 'schedule' | 'focus' | 'custom' | 'ai' | null;
type PlanReadyHeroKey = 'mass' | 'strength' | 'athletic';
type LocationSelectionOptionId = SetupTrainingEnvironment;
type LocationBenefit = { icon: VinhaIconName; label: string; body?: string };
type FocusBadgeTone = 'neutral' | 'green' | 'blue' | 'purple';
type FocusBadgeInput = string | { label: string; tone?: FocusBadgeTone };

const STAGES: SetupStage[] = ['location', 'goal', 'level', 'days', 'avoid', 'planning', 'review'];
const ONBOARDING_PROGRESS_STAGES: SetupStage[] = ['location', 'goal', 'level', 'days', 'avoid', 'planning'];

// STEP n OF m labels follow the progress stages so inserting/removing a stage
// (e.g. the avoid step in a later phase) renumbers every screen automatically.
function getQuestionnaireStepLabel(stage: SetupStage, language: AppLanguage) {
  const index = ONBOARDING_PROGRESS_STAGES.indexOf(stage);
  return t(language, 'onb.stepLabel', { index: index + 1, count: ONBOARDING_PROGRESS_STAGES.length });
}

/**
 * Onboarding's own palette, in two.
 *
 * The questionnaire was built light and signed off light, so the light values
 * below are the originals to the digit — deliberately NOT remapped onto the
 * app's `Theme` tokens, which are close but not identical (`#7C3AED` against
 * `theme.purple`'s `#6D28D9`, and so on). Remapping would have quietly
 * restyled a flow nobody asked to restyle.
 *
 * Dark exists because the theme is chosen one tap after "Let's begin"
 * (2026-08-23), and a reader who picks dark and is then walked through eight
 * white screens has been told one thing and shown another. It is tuned to sit
 * beside the app's dark theme rather than to invert the light one: same
 * near-black ground, same lifted surfaces, the purple brightened so it still
 * reads as the accent against a dark card.
 */
interface OnbPalette {
  panel: string;
  card: string;
  cardActive: string;
  primary: string;
  primarySoft: string;
  text: string;
  textSoft: string;
  textMuted: string;
  border: string;
  borderActive: string;
  /** Unfilled progress dots and bar tracks. */
  trackIdle: string;
  /** The level slider's groove, a shade warmer than trackIdle. */
  sliderTrack: string;
  /** A grey (not lilac) tile — the avoid step's body-part squares. */
  neutralTile: string;
  /**
   * The near-black "chosen" fill on the about-you checks, and what is legible
   * on it. In dark a near-black fill on a dark card is no fill at all, so the
   * pair inverts to the light ink with dark type on it.
   */
  inkStrong: string;
  onInkStrong: string;
  /** The chosen row on the personalization list, and its title. */
  optionActive: string;
  onOptionActive: string;
  /** Focus-tag tints, which carry coloured type and cannot go white-on-white. */
  badgeNeutral: string;
  badgeBlue: string;
  badgePurple: string;
  /** The week-preview glyph's bars. */
  previewBar: string;
  /** The chosen about-you row's background. */
  rowActive: string;
}

const ONB_LIGHT: OnbPalette = {
  panel: HG.bg,
  card: '#FFFFFF',
  cardActive: '#EFE7FF',
  primary: '#7C3AED',
  primarySoft: 'rgba(124,58,237,0.14)',
  text: '#101828',
  // Emphasis treatment (user-approved on Welcome/StartPath/Health): secondary
  // copy runs darker than the old #667085 so it stays legible on dim displays.
  textSoft: '#475467',
  textMuted: '#9A93AC',
  border: '#E4D8FF',
  borderActive: '#7C3AED',
  trackIdle: '#E6DEF6',
  sliderTrack: '#EDE6FB',
  neutralTile: '#F1F0F4',
  inkStrong: '#06080B',
  onInkStrong: '#FFFFFF',
  optionActive: '#F4FAFF',
  onOptionActive: '#0B0F14',
  badgeNeutral: '#F2ECFF',
  badgeBlue: '#E1ECFB',
  badgePurple: '#EFE7FF',
  previewBar: '#F3F7FF',
  rowActive: '#F7F8FA',
};

const ONB_DARK: OnbPalette = {
  panel: HG_DARK.bg,
  card: HG_DARK.surface,
  cardActive: HG_DARK.purpleLight,
  primary: HG_DARK.purple,
  primarySoft: 'rgba(155,109,255,0.18)',
  text: HG_DARK.ink,
  textSoft: HG_DARK.muted,
  textMuted: HG_DARK.faint,
  border: HG_DARK.border,
  borderActive: HG_DARK.purple,
  trackIdle: HG_DARK.border,
  sliderTrack: HG_DARK.surfaceSoft,
  neutralTile: HG_DARK.surfaceSoft,
  // Inverted deliberately: the light palette fills the chosen check near-black
  // with white type, and the dark one fills it near-white with dark type. A
  // near-black fill on a near-black card is an invisible "chosen" state.
  inkStrong: HG_DARK.ink,
  onInkStrong: HG_DARK.bg,
  optionActive: HG_DARK.purpleLight,
  onOptionActive: HG_DARK.ink,
  badgeNeutral: HG_DARK.surfaceSoft,
  badgeBlue: 'rgba(10,132,255,0.20)',
  badgePurple: HG_DARK.purpleLight,
  previewBar: HG_DARK.surfaceSoft,
  rowActive: HG_DARK.surfaceSoft,
};

/** Forward reference: the sheet factory is defined with the styles, at the foot. */
type OnbStyles = ReturnType<typeof makeOnboardingStyles>;

/**
 * The palette and the matching sheet, for any component in this file.
 *
 * Onboarding paints from its own constants rather than the app `Theme`, so it
 * cannot use `useThemedStyles` — but it still has to follow the theme the
 * reader picked one screen ago, which is what this reads.
 */
function useOnboardingPalette(): { C: OnbPalette; styles: OnbStyles } {
  const dark = useThemeName() === 'dark';
  return dark
    ? { C: ONB_DARK, styles: ONBOARDING_STYLES.dark }
    : { C: ONB_LIGHT, styles: ONBOARDING_STYLES.light };
}
function formatPlanReadyExercisePrescription(exercise: {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSecondsMin: number;
  restSecondsMax: number;
}) {
  const repsLabel = exercise.repsMin === exercise.repsMax
    ? `${exercise.repsMin} reps`
    : `${exercise.repsMin}-${exercise.repsMax} reps`;
  const restLabel = exercise.restSecondsMin === exercise.restSecondsMax
    ? `${exercise.restSecondsMin} sec`
    : `${exercise.restSecondsMin}-${exercise.restSecondsMax} sec`;

  return `${exercise.sets} sets x ${repsLabel} - ${restLabel} rest`;
}

function formatPlanReadyExerciseRepTarget(exercise: {
  sets: number;
  repsMin: number;
  repsMax: number;
}) {
  const repsLabel = exercise.repsMin === exercise.repsMax
    ? `${exercise.repsMin}`
    : `${exercise.repsMin}-${exercise.repsMax}`;

  return `${exercise.sets} x ${repsLabel}`;
}

function formatPlanReadyExerciseSetLabel(exercise: { sets: number }) {
  return `${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'}`;
}

function formatPlanReadyExerciseRepLabel(exercise: {
  repsMin: number;
  repsMax: number;
}) {
  const repsLabel = exercise.repsMin === exercise.repsMax
    ? `${exercise.repsMin}`
    : `${exercise.repsMin}-${exercise.repsMax}`;

  return `${repsLabel} reps`;
}

function getStageIndex(stage?: SetupStage) {
  const index = stage ? STAGES.indexOf(stage) : -1;
  return index >= 0 ? index : 0;
}

function getDefaultLocationOptionId(
  equipment: SetupEquipment,
  trainingEnvironment?: SetupTrainingEnvironment | null,
): LocationSelectionOptionId {
  // The setup step offers three cards; legacy environments map to the closest
  // card (minimal home setups fall under Home equipment, running under gym).
  if (trainingEnvironment) {
    switch (trainingEnvironment) {
      case 'minimal_equipment':
        return 'home_gym';
      case 'running_hybrid':
        return 'full_gym';
      default:
        return trainingEnvironment;
    }
  }

  switch (equipment) {
    case 'home':
    case 'minimal':
      return 'home_gym';
    case 'gym':
    default:
      return 'full_gym';
  }
}

// Catalogs carry i18n keys rather than copy: the option identity (goal, level,
// area…) is the stored value, the words around it are resolved at render.
const GOAL_OPTIONS: Array<{
  goal: SetupGoal;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  tags: Array<{ labelKey: I18nKey; tone: FocusBadgeTone }>;
  icon: OnboardingOptionIconName;
}> = [
  {
    goal: 'strength',
    titleKey: 'onb.goal.strength.title',
    bodyKey: 'onb.goal.strength.body',
    tags: [
      { labelKey: 'onb.goal.strength.tag1', tone: 'neutral' },
      { labelKey: 'onb.goal.strength.tag2', tone: 'blue' },
      { labelKey: 'onb.goal.strength.tag3', tone: 'green' },
    ],
    icon: 'barbell',
  },
  {
    goal: 'muscle',
    titleKey: 'onb.goal.muscle.title',
    bodyKey: 'onb.goal.muscle.body',
    tags: [
      { labelKey: 'onb.goal.muscle.tag1', tone: 'green' },
      { labelKey: 'onb.goal.muscle.tag2', tone: 'neutral' },
      { labelKey: 'onb.goal.muscle.tag3', tone: 'purple' },
    ],
    icon: 'trend_up',
  },
  {
    goal: 'lean_athletic',
    titleKey: 'onb.goal.lean_athletic.title',
    bodyKey: 'onb.goal.lean_athletic.body',
    tags: [
      { labelKey: 'onb.goal.lean_athletic.tag1', tone: 'purple' },
      { labelKey: 'onb.goal.lean_athletic.tag2', tone: 'green' },
      { labelKey: 'onb.goal.lean_athletic.tag3', tone: 'blue' },
    ],
    icon: 'run',
  },
  {
    goal: 'general_fitness',
    titleKey: 'onb.goal.general_fitness.title',
    bodyKey: 'onb.goal.general_fitness.body',
    tags: [
      { labelKey: 'onb.goal.general_fitness.tag1', tone: 'blue' },
      { labelKey: 'onb.goal.general_fitness.tag2', tone: 'green' },
      { labelKey: 'onb.goal.general_fitness.tag3', tone: 'neutral' },
    ],
    icon: 'heart',
  },
];

// Training-level slider (step 04): Beginner / Advanced / Pro.
const LEVEL_SLIDER_OPTIONS: Array<{
  level: SetupLevel;
  labelKey: I18nKey;
  yearsKey: I18nKey;
  lineKeys: [I18nKey, I18nKey];
}> = [
  {
    level: 'beginner',
    labelKey: 'onb.level.beginner.label',
    yearsKey: 'onb.level.beginner.years',
    lineKeys: ['onb.level.beginner.line1', 'onb.level.beginner.line2'],
  },
  {
    level: 'advanced',
    labelKey: 'onb.level.advanced.label',
    yearsKey: 'onb.level.advanced.years',
    lineKeys: ['onb.level.advanced.line1', 'onb.level.advanced.line2'],
  },
  {
    level: 'pro',
    labelKey: 'onb.level.pro.label',
    yearsKey: 'onb.level.pro.years',
    lineKeys: ['onb.level.pro.line1', 'onb.level.pro.line2'],
  },
];

// Flame positions inside the 280x140 logo wrap - count and size grow with the
// level (few small sparks -> whole-logo blaze).

// Training-days step (04b): number chips on top, a tappable week row below.
const TRAINING_DAY_COUNT_OPTIONS: SetupDaysPerWeek[] = [2, 3, 4, 5, 6];

/**
 * Repeating on/off rhythms the days step offers under the weekday picker
 * (user 2026-08-23): a cycle is for the reader whose training week has no
 * fixed days — every other day, two on one off. Choosing one persists as
 * preferences.trainingCycle, which overrides the weekday list everywhere a
 * calendar day is marked training or rest.
 */
const CYCLE_PRESET_OPTIONS = [
  { id: 'on1off1', on: 1, off: 1, labelKey: 'onb.days.cycle.on1off1' },
  { id: 'on2off1', on: 2, off: 1, labelKey: 'onb.days.cycle.on2off1' },
  { id: 'on3off1', on: 3, off: 1, labelKey: 'onb.days.cycle.on3off1' },
  { id: 'on1off2', on: 1, off: 2, labelKey: 'onb.days.cycle.on1off2' },
] as const;
type CyclePresetId = (typeof CYCLE_PRESET_OPTIONS)[number]['id'];

/**
 * What a cycle means in the questionnaire's own unit. The recommender picks a
 * programme by sessions per week, and the honest number for a cycle is the
 * average count of training days a seven-day window holds, clamped to the
 * 2–6 the answer supports.
 */
function cycleDaysPerWeek(on: number, off: number): SetupDaysPerWeek {
  return Math.min(6, Math.max(2, Math.round((7 * on) / (on + off)))) as SetupDaysPerWeek;
}

/**
 * The build screen's phase rows, as a fixed-length list to allocate animated
 * nodes against. The labels themselves are translated per render; this only
 * has to agree with how many there are, and the render clamps to it.
 */
const BUILDING_PLAN_PHASE_COUNT = [0, 1, 2, 3] as const;

function getRecommendedDaysForLevel(level: SetupLevel): SetupDaysPerWeek {
  return level === 'beginner' ? 3 : level === 'pro' ? 5 : 4;
}

// Letters only in the week cells (no icons), Monday first.
const WEEKDAY_LETTER_KEYS: Record<SetupWeekday, I18nKey> = {
  mon: 'onb.weekday.mon',
  tue: 'onb.weekday.tue',
  wed: 'onb.weekday.wed',
  thu: 'onb.weekday.thu',
  fri: 'onb.weekday.fri',
  sat: 'onb.weekday.sat',
  sun: 'onb.weekday.sun',
};

// Avoid step: flaggable body parts, colour-coded caution levels and optional
// refinement chips. The flags persist to setupCautionFlags and colour the
// focus-area list on the next step.
const AVOID_AREA_OPTIONS: Array<{ area: SetupCautionArea; labelKey: I18nKey }> = [
  { area: 'shoulders', labelKey: 'onb.area.shoulders' },
  { area: 'lower_back', labelKey: 'onb.area.lower_back' },
  { area: 'knees', labelKey: 'onb.area.knees' },
  { area: 'elbows', labelKey: 'onb.area.elbows' },
];

const AVOID_EXTRA_AREA_OPTIONS: Array<{ area: SetupCautionArea; labelKey: I18nKey }> = [
  { area: 'wrists', labelKey: 'onb.area.wrists' },
  { area: 'hips', labelKey: 'onb.area.hips' },
  { area: 'neck', labelKey: 'onb.area.neck' },
  { area: 'ankles', labelKey: 'onb.area.ankles' },
];

const CAUTION_AREA_LABEL_KEYS = Object.fromEntries(
  [...AVOID_AREA_OPTIONS, ...AVOID_EXTRA_AREA_OPTIONS].map((option) => [option.area, option.labelKey]),
) as Record<SetupCautionArea, I18nKey>;

const CAUTION_LEVEL_OPTIONS: Array<{ level: SetupCautionLevel; labelKey: I18nKey; bodyKey: I18nKey }> = [
  { level: 'info', labelKey: 'onb.caution.info.label', bodyKey: 'onb.caution.info.body' },
  { level: 'careful', labelKey: 'onb.caution.careful.label', bodyKey: 'onb.caution.careful.body' },
  { level: 'avoid', labelKey: 'onb.caution.avoid.label', bodyKey: 'onb.caution.avoid.body' },
];

const CAUTION_LEVEL_COLORS: Record<SetupCautionLevel, { ink: string; soft: string }> = {
  info: { ink: '#667085', soft: '#F1F0F4' },
  careful: { ink: '#D97706', soft: '#FEF3C7' },
  avoid: { ink: '#DC2626', soft: '#FEE2E2' },
};

// Plan-review progression card. Copy honesty (truth plan P7): every bullet
// describes something the app actually does today — no promised deloads or
// auto-progressing weights the engine doesn't ship yet.
const PROGRESSION_BULLET_KEYS: I18nKey[] = [
  'onb.progression.b1',
  // b2 sold the effort feedback that tuned rest and the next set. That went
  // with the list logger it lived in (2026-08-02).
  'onb.progression.b3',
];


function CautionGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5L21.5 20h-19L12 3.5z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 10v4.4M12 17.2v.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function getGoalBackgroundSource(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return require('../../assets/fitness/selected/strength-goal-card.png');
    case 'muscle':
      return require('../../assets/fitness/selected/build-muscle-goal-card.png');
    case 'general':
    case 'lean_athletic':
    case 'general_fitness':
      return require('../../assets/fitness/selected/lose-weight-goal-card.png');
    case 'run_mobility':
      return require('../../assets/fitness/selected/endurance-cardio-goal-card.png');
    default:
      return undefined;
  }
}

function getPlanReadyHeroKey({
  title,
  goal,
}: {
  title?: string | null;
  goal?: string | null;
}): PlanReadyHeroKey {
  const haystack = `${title ?? ''} ${goal ?? ''}`.toLowerCase();

  if (
    haystack.includes('athletic') ||
    haystack.includes('cardio') ||
    haystack.includes('conditioning') ||
    haystack.includes('run') ||
    haystack.includes('mobility') ||
    haystack.includes('hiit')
  ) {
    return 'athletic';
  }

  if (
    haystack.includes('strength') ||
    haystack.includes('power') ||
    haystack.includes('barbell') ||
    haystack.includes('low reps')
  ) {
    return 'strength';
  }

  return 'mass';
}

const GUIDANCE_MODE_OPTIONS: Array<{
  mode: SetupGuidanceMode;
  titleKey: I18nKey;
  bodyKey: I18nKey;
}> = [
  {
    mode: 'done_for_me',
    titleKey: 'onb.guidance.done_for_me.title',
    bodyKey: 'onb.guidance.done_for_me.body',
  },
  {
    mode: 'guided_editable',
    titleKey: 'onb.guidance.guided_editable.title',
    bodyKey: 'onb.guidance.guided_editable.body',
  },
  {
    mode: 'self_directed',
    titleKey: 'onb.guidance.self_directed.title',
    bodyKey: 'onb.guidance.self_directed.body',
  },
];

const SCHEDULE_MODE_OPTIONS: Array<{
  mode: SetupScheduleMode;
  titleKey: I18nKey;
  bodyKey: I18nKey;
}> = [
  {
    mode: 'app_managed',
    titleKey: 'onb.schedule.app_managed.title',
    bodyKey: 'onb.schedule.app_managed.body',
  },
  {
    mode: 'self_managed',
    titleKey: 'onb.schedule.self_managed.title',
    bodyKey: 'onb.schedule.self_managed.body',
  },
];

const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions();
const REFINEMENT_FOCUS_AREA_OPTIONS: SetupFocusArea[] = FOCUS_AREA_OPTIONS.map((option) => option.area);

// Focus rows read the avoid-step flags: a flagged part tints its row amber
// (Be careful) or red (Avoid entirely) with a warning triangle; info-level
// flags stay neutral. Avoid wins when multiple flags touch the same area.
// The caution-area → focus-area mapping lives in cautionExerciseFilter so the
// UI colouring and the actual exercise filtering can never disagree.

function getFocusAreaCautionLevel(
  area: SetupFocusArea,
  flags: SetupCautionFlag[],
): 'careful' | 'avoid' | null {
  let result: 'careful' | null = null;
  for (const flag of flags) {
    if (flag.level === 'info' || !(CAUTION_TO_FOCUS_AREAS[flag.area] ?? []).includes(area)) {
      continue;
    }
    if (flag.level === 'avoid') {
      return 'avoid';
    }
    result = 'careful';
  }
  return result;
}

const WEEKDAY_OPTIONS: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const LOCATION_SELECTION_OPTIONS: Array<{
  id: LocationSelectionOptionId;
  equipment: SetupEquipment;
  trainingEnvironment: SetupTrainingEnvironment;
  labelKey: I18nKey;
  subtitleKey: I18nKey;
  icon: OnboardingOptionIconName;
  focusLabelKey?: I18nKey;
  focusTone?: FocusBadgeTone;
}> = [
  {
    id: 'full_gym',
    equipment: 'gym',
    trainingEnvironment: 'full_gym',
    labelKey: 'onb.location.full_gym.label',
    subtitleKey: 'onb.location.full_gym.subtitle',
    icon: 'barbell',
    focusLabelKey: 'onb.location.full_gym.badge',
    focusTone: 'neutral',
  },
  {
    id: 'home_gym',
    equipment: 'home',
    trainingEnvironment: 'home_gym',
    labelKey: 'onb.location.home_gym.label',
    subtitleKey: 'onb.location.home_gym.subtitle',
    icon: 'home',
  },
  {
    id: 'bodyweight_only',
    equipment: 'minimal',
    trainingEnvironment: 'bodyweight_only',
    labelKey: 'onb.location.bodyweight_only.label',
    subtitleKey: 'onb.location.bodyweight_only.subtitle',
    icon: 'bodyweight',
    focusLabelKey: 'onb.location.bodyweight_only.badge',
    focusTone: 'blue',
  },
];

// Equipment chips per setup. The selected card expands into these toggles and
// the chosen labels persist to setupEquipmentItems for later exercise filtering.
const EQUIPMENT_CHIP_CATALOG: Partial<Record<LocationSelectionOptionId, string[]>> = {
  full_gym: ['Barbells', 'Dumbbells', 'Machines', 'Cables', 'Squat rack', 'Bench', 'Kettlebells', 'Cardio machines'],
  home_gym: ['Dumbbells', 'Barbell & plates', 'Squat rack', 'Bench', 'Resistance bands', 'Kettlebells', 'Pull-up bar'],
  bodyweight_only: ['Pull-up bar', 'Resistance bands', 'Yoga mat'],
};

const EQUIPMENT_DEFAULT_ITEMS: Partial<Record<LocationSelectionOptionId, string[]>> = {
  full_gym: ['Barbells', 'Dumbbells', 'Machines', 'Cables', 'Squat rack', 'Bench', 'Kettlebells', 'Cardio machines'],
  home_gym: ['Dumbbells', 'Bench', 'Resistance bands'],
  bodyweight_only: [],
};

// Heavy home gear upgrades the derived environment from minimal_equipment to home_gym.
const HOME_HEAVY_EQUIPMENT_ITEMS = ['Barbell & plates', 'Squat rack'];

const GOAL_SELECTION_OPTIONS: Array<{
  id: SetupGoal;
  labelKey: I18nKey;
  subtitleKey: I18nKey;
  icon: OnboardingOptionIconName;
  tags: Array<{ labelKey: I18nKey; tone: FocusBadgeTone }>;
}> = GOAL_OPTIONS.map((option) => ({
  id: option.goal,
  labelKey: option.titleKey,
  subtitleKey: option.bodyKey,
  icon: option.icon,
  tags: option.tags,
}));

function getLocationFocusBadgeStyle(styles: OnbStyles, tone: FocusBadgeTone) {
  switch (tone) {
    case 'green':
      return styles.locationFocusBadgeGreen;
    case 'blue':
      return styles.locationFocusBadgeBlue;
    case 'purple':
      return styles.locationFocusBadgePurple;
    case 'neutral':
    default:
      return styles.locationFocusBadgeNeutral;
  }
}

function getLocationFocusBadgeTextStyle(styles: OnbStyles, tone: FocusBadgeTone) {
  switch (tone) {
    case 'green':
      return styles.locationFocusBadgeTextGreen;
    case 'blue':
      return styles.locationFocusBadgeTextBlue;
    case 'purple':
      return styles.locationFocusBadgeTextPurple;
    case 'neutral':
    default:
      return styles.locationFocusBadgeTextNeutral;
  }
}

function normalizeFocusBadge(input: unknown, fallbackTone: FocusBadgeTone): { label: string; tone: FocusBadgeTone } | null {
  if (typeof input === 'string') {
    const label = input.trim();
    return label ? { label, tone: fallbackTone } : null;
  }

  if (input && typeof input === 'object' && 'label' in input) {
    const candidate = input as { label?: unknown; tone?: unknown };
    if (typeof candidate.label !== 'string' || !candidate.label.trim()) {
      return null;
    }

    const tone =
      candidate.tone === 'green' ||
      candidate.tone === 'blue' ||
      candidate.tone === 'purple' ||
      candidate.tone === 'neutral'
        ? candidate.tone
        : fallbackTone;

    return { label: candidate.label.trim(), tone };
  }

  return null;
}

function ChoiceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { styles } = useOnboardingPalette();
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LocationChoiceCard({
  label,
  subtitle,
  icon,
  focusLabel,
  focusTone = 'neutral',
  tags,
  benefits,
  active,
  subdued = false,
  onPress,
  compact = false,
  roomy = false,
  hideIcon = false,
  leadingRadio = false,
  tall = false,
}: {
  label: string;
  subtitle?: string;
  icon: OnboardingOptionIconName;
  focusLabel?: FocusBadgeInput;
  focusTone?: FocusBadgeTone;
  tags?: FocusBadgeInput[];
  benefits?: LocationBenefit[];
  active: boolean;
  subdued?: boolean;
  onPress: () => void;
  compact?: boolean;
  roomy?: boolean;
  hideIcon?: boolean;
  leadingRadio?: boolean;
  tall?: boolean;
}) {
  const { C, styles } = useOnboardingPalette();
  const focusBadge = normalizeFocusBadge(focusLabel, focusTone);
  const normalizedTags = (tags ?? [])
    .map((tag) => normalizeFocusBadge(tag, 'neutral'))
    .filter((tag): tag is { label: string; tone: FocusBadgeTone } => Boolean(tag));
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  // Interpolated once — per-render interpolations leak native animated nodes
  // (disconnectAnimatedNodes crash under Fabric).
  const animatedStyle = useRef({
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }],
  }).current;
  const radio = (
    <View
      style={[
        styles.locationChoiceRadio,
        leadingRadio && styles.locationChoiceRadioLeading,
        active && styles.locationChoiceRadioActive,
      ]}
    >
      {active ? (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l5 5L19 7" stroke={C.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );

  return (
    <Pressable onPress={onPress} style={styles.locationChoicePressable}>
      <Animated.View
        style={[
          styles.locationChoiceCard,
          compact && styles.locationChoiceCardCompact,
          roomy && styles.locationChoiceCardRoomy,
          tall && styles.locationChoiceCardTall,
          active && styles.locationChoiceCardActive,
          animatedStyle,
        ]}
      >
        {active ? <Animated.View pointerEvents="none" style={[styles.locationChoiceActiveOutline, { opacity: progress }]} /> : null}
        <View style={styles.locationChoiceRow}>
          {leadingRadio ? radio : null}
          {hideIcon ? null : <OnboardingOptionIcon name={icon} active={active} subdued={subdued} />}
          <View style={[styles.locationChoiceCopy, hideIcon && styles.locationChoiceCopyNoIcon]}>
            <View style={styles.locationChoiceTitleRow}>
              <Text numberOfLines={1} style={[styles.locationChoiceLabel, active && styles.locationChoiceLabelActive]}>
                {label}
              </Text>
              {focusBadge ? (
                <View style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(styles, focusBadge.tone), active && styles.locationFocusBadgeOnActive]}>
                  <Text
                    numberOfLines={1}
                    style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(styles, focusBadge.tone), active && styles.locationFocusBadgeTextOnActive]}
                  >
                    {focusBadge.label}
                  </Text>
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Text style={[styles.locationChoiceSubtitle, active && styles.locationChoiceSubtitleActive]}>{subtitle}</Text>
            ) : null}
            {normalizedTags.length > 0 ? (
              <View style={styles.locationChoiceTagRow}>
                {normalizedTags.map((tag, index) => (
                  <View
                    key={`${tag.label}:${tag.tone}:${index}`}
                    style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(styles, tag.tone), active && styles.locationFocusBadgeChipOnActive]}
                  >
                    <Text
                      style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(styles, tag.tone), active && styles.locationFocusBadgeChipTextOnActive]}
                    >
                      {tag.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {leadingRadio ? null : radio}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Screen 08b "Pick your program" card. Both options render through this same
// template so the alternative reads as a real choice, not a footnote.
function SetupOptionCard({
  title,
  body,
  active,
  backgroundSource,
  focusImageSource,
  imageMode = 'background',
  compact = false,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  body: string;
  active: boolean;
  backgroundSource?: number;
  focusImageSource?: ImageSourcePropType;
  imageMode?: 'background' | 'icon';
  compact?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { styles } = useOnboardingPalette();
  const hasBackground = Boolean(backgroundSource);
  const hasFocusImage = Boolean(focusImageSource);
  const iconImage = hasBackground && imageMode === 'icon';
  const visualCard = iconImage || hasFocusImage;
  const activeAnimation = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnimation, {
      toValue: active ? 1 : 0,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [active, activeAnimation]);

  // Interpolated once per mount — per-render interpolations leak native
  // animated nodes (disconnectAnimatedNodes crash under Fabric).
  const animatedStyles = useRef({
    card: {
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
    },
    thumb: {
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
    },
    copy: {
      transform: [{ translateY: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
    },
    figureImage: {
      opacity: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
    },
    selectionBadge: {
      opacity: activeAnimation,
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
    },
    iconImageFade: {
      opacity: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
    },
    iconGlow: {
      opacity: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }),
    },
    iconPaint: {
      opacity: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
    },
    iconRing: {
      opacity: activeAnimation,
      transform: [{ scale: activeAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
    },
  }).current;
  const cardAnimatedStyle = visualCard ? animatedStyles.card : undefined;
  const thumbAnimatedStyle = iconImage ? animatedStyles.thumb : undefined;
  const copyAnimatedStyle = visualCard ? animatedStyles.copy : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected: active }}
      style={[
        styles.setupOptionCard,
        compact && styles.setupOptionCardCompact,
        hasBackground && !iconImage && styles.setupOptionCardImage,
        visualCard && styles.setupOptionCardIcon,
        active && styles.setupOptionCardActive,
        hasBackground && !iconImage && active && styles.setupOptionCardImageActive,
        visualCard && active && styles.setupOptionCardIconActive,
      ]}
    >
      {hasFocusImage && focusImageSource ? (
        <Animated.View style={[styles.setupOptionCardFigureContent, cardAnimatedStyle]}>
          <View style={[styles.setupOptionCardFigureThumb, active && styles.setupOptionCardIconThumbActive]}>
            <Animated.Image
              source={focusImageSource}
              resizeMode="cover"
              style={[styles.setupOptionCardFigureImage, animatedStyles.figureImage]}
            />
            <View style={styles.setupOptionCardFigureVignette} />
            <Animated.View
              pointerEvents="none"
              style={[styles.setupOptionCardSelectionBadge, animatedStyles.selectionBadge]}
            >
              <View style={styles.setupOptionCardSelectionCheck}>
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkShort]} />
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkLong]} />
              </View>
            </Animated.View>
          </View>
          <Animated.View style={[styles.setupOptionCardFigureCopy, copyAnimatedStyle]}>
            <Text style={styles.setupOptionCardFigureTitle} numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : iconImage ? (
        <Animated.View style={[styles.setupOptionCardIconContent, cardAnimatedStyle]}>
          <Animated.View style={[styles.setupOptionCardIconCopy, copyAnimatedStyle]}>
            <Text style={[styles.setupOptionCardTitle, styles.setupOptionCardTitleOnImage]}>{title}</Text>
            <Text style={[styles.setupOptionCardBody, styles.setupOptionCardBodyOnImage]}>{body}</Text>
          </Animated.View>
          <View style={[styles.setupOptionCardIconThumb, active && styles.setupOptionCardIconThumbActive]}>
            <Animated.Image
              source={backgroundSource}
              resizeMode="cover"
              style={[styles.setupOptionCardIconImage, thumbAnimatedStyle, animatedStyles.iconImageFade]}
            />
            <View style={styles.setupOptionCardIconShade} />
            <Animated.View
              pointerEvents="none"
              style={[styles.setupOptionCardIconGlow, animatedStyles.iconGlow]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.setupOptionCardIconPaint, animatedStyles.iconPaint]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.setupOptionCardIconRing, animatedStyles.iconRing]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.setupOptionCardSelectionBadge, animatedStyles.selectionBadge]}
            >
              <View style={styles.setupOptionCardSelectionCheck}>
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkShort]} />
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkLong]} />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      ) : hasBackground ? (
        <View style={[styles.setupOptionCardImageSurface, compact && styles.setupOptionCardImageSurfaceCompact]}>
          <Image
            source={backgroundSource}
            resizeMode="cover"
            style={styles.setupOptionCardImageAsset}
          />
          <View style={styles.setupOptionCardImageShade} />
          <View style={[styles.setupOptionCardContent, compact && styles.setupOptionCardContentCompact]}>
            <Text
              style={[
                styles.setupOptionCardTitle,
                compact && styles.setupOptionCardTitleCompact,
                styles.setupOptionCardTitleOnImage,
                active && styles.setupOptionCardTitleActive,
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.setupOptionCardBody,
                compact && styles.setupOptionCardBodyCompact,
                styles.setupOptionCardBodyOnImage,
                active && styles.setupOptionCardBodyActive,
              ]}
              numberOfLines={2}
            >
              {body}
            </Text>
          </View>
          {compact && active ? (
            <View style={styles.setupOptionCardSelectionBadge}>
              <View style={styles.setupOptionCardSelectionCheck}>
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkShort]} />
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkLong]} />
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={[styles.setupOptionCardTitle, active && styles.setupOptionCardTitleActive]}>{title}</Text>
          <Text style={[styles.setupOptionCardBody, active && styles.setupOptionCardBodyActive]}>{body}</Text>
        </>
      )}
    </Pressable>
  );
}

function ProfileCheckRow({
  title,
  body,
  badge,
  dotCount,
  compactMeta = false,
  active,
  onPress,
}: {
  title: string;
  body?: string;
  badge?: string;
  dotCount?: number;
  compactMeta?: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const { styles } = useOnboardingPalette();
  return (
    <Pressable onPress={onPress} style={[styles.profileCheckRow, active && styles.profileCheckRowActive]}>
      <View style={[styles.profileCheckBox, active && styles.profileCheckBoxActive]}>
        {active ? (
          <>
            <View style={[styles.profileCheckMark, styles.profileCheckMarkShort]} />
            <View style={[styles.profileCheckMark, styles.profileCheckMarkLong]} />
          </>
        ) : null}
      </View>
      <View style={styles.profileCheckCopy}>
        <View style={styles.profileCheckTitleRow}>
          <Text style={[styles.profileCheckTitle, active && styles.profileCheckTitleActive]}>{title}</Text>
          {dotCount && !compactMeta ? (
            <View style={styles.profileCheckDotRow}>
              {Array.from({ length: dotCount }).map((_, index) => (
                <View
                  key={`${title}-dot-${index}`}
                  style={[styles.profileCheckDot, active && styles.profileCheckDotActive]}
                />
              ))}
            </View>
          ) : null}
          {badge && !compactMeta ? (
            <View style={[styles.profileCheckBadge, active && styles.profileCheckBadgeActive]}>
              <Text style={[styles.profileCheckBadgeText, active && styles.profileCheckBadgeTextActive]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {compactMeta && (dotCount || badge) ? (
          <View style={styles.profileCheckMetaRow}>
            {dotCount ? (
              <View style={styles.profileCheckDotRow}>
                {Array.from({ length: dotCount }).map((_, index) => (
                  <View
                    key={`${title}-meta-dot-${index}`}
                    style={[styles.profileCheckDot, active && styles.profileCheckDotActive]}
                  />
                ))}
              </View>
            ) : null}
            {badge ? (
              <View style={[styles.profileCheckBadge, active && styles.profileCheckBadgeActive]}>
                <Text style={[styles.profileCheckBadgeText, active && styles.profileCheckBadgeTextActive]}>{badge}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {body ? <Text style={[styles.profileCheckBody, active && styles.profileCheckBodyActive]}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

function clampSetupAge(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAgeFromRange(ageRange?: SetupAgeRange | null) {
  switch (ageRange) {
    case '18':
      return 18;
    case '26_30':
      return 28;
    case '31_40':
      return 35;
    case '41_plus':
      return 45;
    case '19_25':
    case 'unspecified':
    default:
      return 25;
  }
}

function getAgeRangeFromAge(age: number): SetupAgeRange {
  if (age <= 18) {
    return '18';
  }
  if (age <= 25) {
    return '19_25';
  }
  if (age <= 30) {
    return '26_30';
  }
  if (age <= 40) {
    return '31_40';
  }
  return '41_plus';
}

function PreviewGlyph({ dayCount }: { dayCount: number }) {
  const { styles } = useOnboardingPalette();
  const bars = dayCount >= 4 ? [20, 30, 24, 30] : dayCount === 2 ? [18, 28, 0, 22] : [18, 28, 18, 26];
  return (
    <View style={styles.previewGlyph}>
      {bars.map((height, index) =>
        height ? <View key={`bar-${index}`} style={[styles.previewGlyphBar, { height }]} /> : <View key={`gap-${index}`} style={styles.previewGlyphGap} />,
      )}
    </View>
  );
}

function getPlanReadyWeekIconName({
  training,
  title,
  body,
}: {
  training: boolean;
  title: string;
  body: string;
}): VinhaIconName {
  const haystack = `${title} ${body}`.toLowerCase();

  if (!training) {
    return 'restDay';
  }

  if (haystack.includes('tempo')) {
    return 'tempo';
  }

  if (haystack.includes('run') || haystack.includes('stride') || haystack.includes('cardio')) {
    return 'endurance';
  }

  if (haystack.includes('mobility') || haystack.includes('reset') || haystack.includes('recovery')) {
    return 'mobility';
  }

  if (haystack.includes('bench') || haystack.includes('press')) {
    return 'benchPress';
  }

  if (haystack.includes('squat') || haystack.includes('leg')) {
    return 'squat';
  }

  if (haystack.includes('deadlift') || haystack.includes('hinge')) {
    return 'deadlift';
  }

  return 'strength';
}

function formatProfileName(value: string) {
  const trimmedStart = value.replace(/^\s+/, '');
  return trimmedStart.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

/** The level step's motion box — the wordmark's own frame. */
const LEVEL_FIELD_WIDTH = 280;

/**
 * The level step's motion field: the launch sequence's own bars, sweeping
 * across the wordmark's box.
 *
 * This replaced a ring of flame emoji, which said "intensity" in a vocabulary
 * the app does not otherwise speak. The bars are the brand's, and unlike a
 * flame they can carry a degree — `LEVEL_STREAKS` gets denser and quicker per
 * tier, so the level reads twice: in how many there are, and in how fast they
 * cross.
 *
 * Bounded to its parent (`overflow: hidden` on the wrap) so bars appear from
 * the left edge of the box rather than the screen. Reduced motion drops the
 * layer, like `AmbientDrift`: a row of parked bars is stranger than none.
 */
function LevelStreaks({ levelIndex }: { levelIndex: number }) {
  const { C, styles } = useOnboardingPalette();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const bars = LEVEL_STREAKS[levelIndex] ?? LEVEL_STREAKS[0];
  // One value per bar in the WIDEST tier, so switching level never changes the
  // hook count — the same reason the animated values live in a ref.
  const values = useRef(LEVEL_STREAKS.map((tier) => tier.map(() => new Animated.Value(0)))).current;
  const tierValues = values[levelIndex] ?? values[0];

  const sweeps = useMemo(
    () =>
      tierValues.map((value) =>
        value.interpolate({ inputRange: [0, 1], outputRange: [-140, LEVEL_FIELD_WIDTH + 40] }),
      ),
    [tierValues],
  );
  const fades = useMemo(
    () =>
      tierValues.map((value, index) =>
        value.interpolate({
          inputRange: [0, 0.14, 0.8, 1],
          outputRange: [0, bars[index]?.opacity ?? 0.2, bars[index]?.opacity ?? 0.2, 0],
        }),
      ),
    [tierValues, bars],
  );

  useEffect(() => {
    let cancelled = false;
    queryReduceMotion().then((enabled) => {
      if (!cancelled) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion !== false) {
      return;
    }
    const loops: Animated.CompositeAnimation[] = [];
    bars.forEach((bar, index) => {
      const value = tierValues[index];
      if (!value) {
        return;
      }
      // A negative delay is a head start: seed the value part-way through the
      // cycle so the field is already in flight on the first frame.
      const headStart = Math.min(0.999, Math.abs(bar.delay) / bar.ms);
      value.setValue(headStart);
      const loop = Animated.loop(
        Animated.timing(value, { toValue: 1, duration: bar.ms, easing: Easing.linear, useNativeDriver: true }),
      );
      Animated.timing(value, {
        toValue: 1,
        duration: bar.ms * (1 - headStart),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          value.setValue(0);
          loop.start();
        }
      });
      loops.push(loop);
    });

    return () => {
      loops.forEach((loop) => loop.stop());
      tierValues.forEach((value) => value.stopAnimation());
    };
  }, [bars, reduceMotion, tierValues]);

  if (reduceMotion !== false) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bars.map((bar, index) => (
        <Animated.View
          key={`${levelIndex}-${bar.y}`}
          style={[
            styles.levelStreak,
            {
              top: bar.y,
              width: bar.width,
              height: bar.height,
              opacity: fades[index],
              backgroundColor: bar.accent ? C.primary : C.text,
              transform: [{ translateX: sweeps[index] }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function StepDots({ index, light = false }: { index: number; light?: boolean }) {
  const { styles } = useOnboardingPalette();
  return (
    <View style={styles.pagination}>
      {ONBOARDING_PROGRESS_STAGES.map((stage, stageIndex) => (
        <View
          key={stage}
          style={[
            styles.dot,
            light && styles.dotLight,
            stageIndex <= index && styles.dotActive,
            light && stageIndex <= index && styles.dotActiveLight,
          ]}
        />
      ))}
    </View>
  );
}

// These three used to be hardcoded English, which is how "4 viikon ohjelma ·
// Get stronger · Full gym" reached the plan-ready screen — Finnish sentence,
// English fragments. The translations already existed; nothing was reading
// them. They take `language` now so there is no English path left.
function getLocationLabel(
  trainingEnvironment: SetupTrainingEnvironment,
  equipment: SetupEquipment,
  language: AppLanguage,
) {
  switch (trainingEnvironment) {
    case 'full_gym':
      return t(language, 'setup.env.fullGym');
    case 'home_gym':
      return t(language, 'setup.env.homeGym');
    case 'minimal_equipment':
      return t(language, 'setup.env.minimal');
    case 'bodyweight_only':
      return t(language, 'setup.env.bodyweight');
    case 'running_hybrid':
      return t(language, 'setup.env.running');
    default:
      return getSetupEquipmentTitle(equipment, language);
  }
}

function formatGoalList(goals: SetupGoal[], language: AppLanguage) {
  if (goals.length === 0) {
    return t(language, 'setup.goal.none');
  }

  return goals.map((goal) => getSetupGoalTitle(goal, language)).join(', ');
}

function getAgeRangeLabel(ageRange: SetupAgeRange) {
  switch (ageRange) {
    case '18':
      return '18';
    case '19_25':
      return '19-25';
    case '26_30':
      return '26-30';
    case '31_40':
      return '31-40';
    case '41_plus':
      return '41+';
    case 'unspecified':
      return 'Prefer not to say';
    default:
      return 'Not set';
  }
}

function getLevelLabel(level: SetupLevel, language: AppLanguage) {
  if (level === 'beginner') {
    return t(language, 'setup.level.beginner');
  }

  return t(language, level === 'pro' ? 'setup.level.pro' : 'setup.level.advanced');
}

function getTrainingProfileSetupSummary(level: SetupLevel, daysPerWeek: SetupDaysPerWeek) {
  const duration =
    level === 'pro'
      ? '60-75 min sessions'
      : level === 'advanced'
        ? '50-70 min sessions'
        : '45-60 min sessions';
  const structure =
    daysPerWeek <= 3
      ? 'Full body structure'
      : daysPerWeek === 4
        ? 'Upper/lower structure'
        : daysPerWeek === 5
          ? 'Split structure'
          : 'High-frequency split';
  const recovery =
    level === 'pro'
      ? 'Workload managed'
      : level === 'advanced'
        ? 'Progressive balance'
        : 'Recovery focused';

  return {
    workouts: `${daysPerWeek === 6 ? '6+' : daysPerWeek} workouts / week`,
    duration,
    structure,
    recovery,
  };
}

function TrainingSetupMetric({ icon, label }: { icon: VinhaIconName; label: string }) {
  const { C, styles } = useOnboardingPalette();
  return (
    <View style={styles.trainingSetupMetric}>
      <VinhaIcon name={icon} size={18} color={C.primary} />
      <Text style={styles.trainingSetupMetricText}>{label}</Text>
    </View>
  );
}

export function OnboardingScreen({
  initialUnitPreference,
  language = 'en',
  readyProgramCount,
  mode = 'first_run',
  initialSelection,
  basicsSeed,
  initialStage,
  tailoringPreferences = null,
  onBackToEntry,
  onSkip,
  onCompleteToTraining,
  onFullBleedReviewChange,
  onCompleteToProgramDetail,
  onCompleteToCustom,
  onCancel,
}: OnboardingScreenProps) {
  const { C, styles } = useOnboardingPalette();
  const insets = useSafeAreaInsets();
  // Catalog keys resolved once per language for the helpers that want plain
  // labels (caution summaries, focus rows).
  const cautionAreaLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(CAUTION_AREA_LABEL_KEYS).map(([area, key]) => [area, t(language, key)]),
      ) as Record<SetupCautionArea, string>,
    [language],
  );
  const setupSeed =
    initialSelection ?? (basicsSeed ? { ...DEFAULT_FIRST_RUN_SELECTION, ...basicsSeed } : DEFAULT_FIRST_RUN_SELECTION);
  const editMode = mode === 'edit';
  const BUILDING_PLAN_TOTAL_MS = 10000;
  const previousUnitPreferenceRef = useRef(initialUnitPreference);
  const onboardingScrollRef = useRef<ScrollView | null>(null);
  const [stageIndex, setStageIndex] = useState(() =>
    getStageIndex(initialStage ?? (editMode ? 'review' : 'location')),
  );
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);
  const [showBuildingPlanThinking, setShowBuildingPlanThinking] = useState(false);
  const [buildingPlanPhaseIndex, setBuildingPlanPhaseIndex] = useState(0);
  const [buildingPlanPercent, setBuildingPlanPercent] = useState(0);
  const [buildingPlanComplete, setBuildingPlanComplete] = useState(false);
  const [buildingPlanEllipsisStep, setBuildingPlanEllipsisStep] = useState(0);
  const buildingPlanScreenOpacity = useRef(new Animated.Value(1)).current;
  const buildingPlanEntryOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanTopTranslate = useRef(new Animated.Value(-36)).current;
  const buildingPlanBottomTranslate = useRef(new Animated.Value(36)).current;
  const buildingPlanLogoOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanLogoScale = useRef(new Animated.Value(0.95)).current;
  const buildingPlanThinkingOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanCaptionOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanPulse = useRef(new Animated.Value(0)).current;
  /**
   * One interpolation PER ROW, not one shared between them.
   *
   * Interpolating once was already the rule here (the disconnectAnimatedNodes
   * rule: renderBuildingPlan re-runs on every percent tick). What that rule
   * did not say is that a single interpolation is also a single native node,
   * and `PropsAnimatedNode` holds exactly one `connectedViewTag`. The pulse
   * rode whichever step row was active, so every phase change asked one node
   * to leave one view and join another in the same Fabric mount batch — and
   * when the connect landed before the disconnect it threw
   * "Animated node N is already attached to a view", killing the app about
   * 85 % through the build (reported 2026-08-24).
   *
   * A node each means a phase change is now "row 2's node detaches, row 3's
   * node attaches" — two nodes, two views, no collision possible. They all
   * read the same driver, so the rows still pulse in step.
   */
  const buildingPlanPulseScales = useRef(
    BUILDING_PLAN_PHASE_COUNT.map(() =>
      buildingPlanPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }),
    ),
  ).current;
  const buildingPlanPulseOpacities = useRef(
    BUILDING_PLAN_PHASE_COUNT.map(() =>
      buildingPlanPulse.interpolate({ inputRange: [0, 1], outputRange: [0.64, 1] }),
    ),
  ).current;
  const buildingPlanRingSpin = useRef(new Animated.Value(0)).current;
  const planReadyCardTranslateX = useRef(new Animated.Value(0)).current;
  const planReadyCardOpacity = useRef(new Animated.Value(1)).current;
  const [profileName] = useState(setupSeed.profileName ?? '');
  const [gender, setGender] = useState<SetupGender>(setupSeed.gender);
  const [age, setAge] = useState(() =>
    typeof setupSeed.age === 'number' && Number.isFinite(setupSeed.age)
      ? clampSetupAge(setupSeed.age)
      : getAgeFromRange(setupSeed.ageRange),
  );
  const ageRange = useMemo(() => getAgeRangeFromAge(age), [age]);
  const [goal, setGoal] = useState<SetupGoal>(setupSeed.goal);
  const [goals, setGoals] = useState<SetupGoal[]>(setupSeed.goals?.length ? setupSeed.goals : [setupSeed.goal]);
  const [level, setLevel] = useState<SetupLevel>(setupSeed.level);
  const [daysPerWeek, setDaysPerWeek] = useState<SetupDaysPerWeek>(setupSeed.daysPerWeek);
  const [profileLevelSelected, setProfileLevelSelected] = useState(() => Boolean(initialSelection || editMode));
  const [profileFrequencySelected, setProfileFrequencySelected] = useState(() => Boolean(initialSelection || editMode));
  const [equipment, setEquipment] = useState<SetupEquipment>(setupSeed.equipment);
  const [trainingEnvironment, setTrainingEnvironment] = useState<SetupTrainingEnvironment>(
    setupSeed.trainingEnvironment,
  );
  const [selectedLocationOptionId, setSelectedLocationOptionId] = useState<LocationSelectionOptionId | null>(() =>
    initialSelection || editMode
      ? getDefaultLocationOptionId(setupSeed.equipment, setupSeed.trainingEnvironment)
      : null,
  );
  // Whether the selected equipment card shows its chips. Tapping the header
  // toggles it without un-selecting (user, 2026-08-19). Since 2026-08-23 a
  // full gym keeps its chips closed — "everything" is a complete answer — and
  // only the setups where the chips are the real question open on select.
  const [equipmentCardOpen, setEquipmentCardOpen] = useState(
    selectedLocationOptionId !== null && selectedLocationOptionId !== 'full_gym',
  );
  const [equipmentItems, setEquipmentItems] = useState<string[]>(setupSeed.equipmentItems ?? []);
  const [levelTrackWidth, setLevelTrackWidth] = useState(0);
  const levelThumbAnim = useRef(
    new Animated.Value(Math.max(0, LEVEL_SLIDER_OPTIONS.findIndex((option) => option.level === setupSeed.level))),
  ).current;
  // Interpolation depends on the measured track width, so it is memoized on
  // that instead of rebuilt per render (disconnectAnimatedNodes rule).
  const levelThumbSegmentWidth = levelTrackWidth > 0 ? (levelTrackWidth - 8) / LEVEL_SLIDER_OPTIONS.length : 0;
  const levelThumbTranslate = useMemo(
    () =>
      levelThumbAnim.interpolate({
        inputRange: [0, LEVEL_SLIDER_OPTIONS.length - 1],
        outputRange: [0, levelThumbSegmentWidth * (LEVEL_SLIDER_OPTIONS.length - 1)],
      }),
    [levelThumbAnim, levelThumbSegmentWidth],
  );
  const levelFlamePop = useRef(new Animated.Value(1)).current;
  const [secondaryOutcomes, setSecondaryOutcomes] = useState<SetupSecondaryOutcome[]>(
    setupSeed.secondaryOutcomes,
  );
  const [focusAreas, setFocusAreas] = useState<SetupFocusArea[]>(setupSeed.focusAreas);
  const [cautionFlags, setCautionFlags] = useState<SetupCautionFlag[]>(setupSeed.cautionFlags ?? []);
  const [avoidExtraVisible, setAvoidExtraVisible] = useState(() =>
    (setupSeed.cautionFlags ?? []).some((flag) =>
      AVOID_EXTRA_AREA_OPTIONS.some((option) => option.area === flag.area),
    ),
  );
  const [guidanceMode, setGuidanceMode] = useState<SetupGuidanceMode>(setupSeed.guidanceMode);
  const [scheduleMode, setScheduleMode] = useState<SetupScheduleMode>(setupSeed.scheduleMode);
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(setupSeed.weeklyMinutes ?? null);
  const [availableDays, setAvailableDays] = useState<SetupWeekday[]>(setupSeed.availableDays);
  // The repeating rhythm, kept as the raw pattern rather than a preset id so
  // a cycle set elsewhere (the plan screen's steppers can build ones these
  // chips do not offer) survives a re-run of the questionnaire untouched.
  // Availability (the weekday list) stays as its own answer either way.
  const [cyclePattern, setCyclePattern] = useState<boolean[] | null>(setupSeed.trainingCyclePattern ?? null);
  const cyclePresetId: CyclePresetId | null =
    CYCLE_PRESET_OPTIONS.find(
      (option) => cyclePattern !== null && patternFromOnOff(option.on, option.off).join(',') === cyclePattern.join(','),
    )?.id ?? null;
  const [unitPreference, setUnitPreference] = useState<UnitPreference>(initialUnitPreference);
  const [currentWeightDraft, setCurrentWeightDraft] = useState(
    formatWeightInputValue(setupSeed.currentWeightKg, initialUnitPreference),
  );
  const [targetWeightDraft, setTargetWeightDraft] = useState(
    formatWeightInputValue(setupSeed.targetWeightKg, initialUnitPreference),
  );
  const [busy, setBusy] = useState(false);
  const [activeRecommendationRefinement, setActiveRecommendationRefinement] =
    useState<RecommendationRefinementPanel>(null);
  const [selectedRecommendationProgramId, setSelectedRecommendationProgramId] = useState<string | null>(null);
  const [planReadyWorkoutPage, setPlanReadyWorkoutPage] = useState(0);
  /**
   * The plan-ready screen has two views, not three.
   *
   * A 'pro' one used to close onboarding with the paywall — user decision
   * 2026-08-24 to take it out: the reader has just been handed a programme
   * and the next thing the app did was ask for money. The paywall itself is
   * unchanged and still reachable from Profile.
   */
  const [planReadyView, setPlanReadyView] = useState<'overview' | 'day'>('overview');
  /**
   * The recommendation is the answer until the user gives another one.
   *
   * The days step drew the recommendation as if selected but kept the seed in
   * state, so continuing without tapping would have built a different week
   * from the one on screen. Committing it here keeps the two the same, and a
   * tap on any count or any weekday overrides it as before.
   */
  useEffect(() => {
    if (STAGES[stageIndex] !== 'days' || profileFrequencySelected) {
      return;
    }
    const recommended = getRecommendedDaysForLevel(level);
    setDaysPerWeek(recommended);
    setAvailableDays(DEFAULT_RHYTHM_BY_DAYS[recommended]);
  }, [level, profileFrequencySelected, stageIndex]);

  // Told from an effect, never during render: the parent turns it into shell
  // state, and setting parent state while rendering a child is a loop.
  useEffect(() => {
    if (STAGES[stageIndex] !== 'review') {
      onFullBleedReviewChange?.(null);
      return;
    }
    if (planReadyView !== 'overview') {
      onFullBleedReviewChange?.(null);
    }
    // The picker reports its own tone: its top half flips white when the
    // second program is chosen, and white icons would vanish into it.
  }, [onFullBleedReviewChange, planReadyView, stageIndex]);
  const [automatedProgressionEnabled, setAutomatedProgressionEnabled] = useState(
    setupSeed.automatedProgression ?? true,
  );
  const [helperVisible, setHelperVisible] = useState(false);
  const [helperDraft, setHelperDraft] = useState('');
  const [helperState, setHelperState] = useState<HelperState>('idle');
  const [helperAnswer, setHelperAnswer] = useState<AICoachAdvice | null>(null);
  const [helperNote, setHelperNote] = useState('');
  const [helperSource, setHelperSource] = useState<'live' | 'preview'>('preview');
  const [helperError, setHelperError] = useState('');

  const stage = STAGES[stageIndex];
  const buildingPlanPhases = useMemo(
    () => [
      t(language, 'onb.building.phase1'),
      t(language, 'onb.building.phase2'),
      t(language, 'onb.building.phase3'),
      t(language, 'onb.building.phase4'),
    ],
    [language],
  );
  const buildingPlanStepSubtitles = useMemo(
    () => [
      t(language, 'onb.building.sub1'),
      t(language, 'onb.building.sub2'),
      t(language, 'onb.building.sub3'),
      t(language, 'onb.building.sub4'),
    ],
    [language],
  );
  const currentWeightValue = useMemo(() => parseNumberInput(currentWeightDraft), [currentWeightDraft]);
  const targetWeightValue = useMemo(() => parseNumberInput(targetWeightDraft), [targetWeightDraft]);
  const selection = useMemo<FirstRunSetupSelection>(
    () => ({
      profileName: formatProfileName(profileName).trim() ? formatProfileName(profileName).trim().slice(0, 32) : null,
      gender,
      age,
      ageRange,
      heightCm: setupSeed.heightCm ?? null,
      goal,
      goals,
      level,
      daysPerWeek,
      equipment,
      trainingEnvironment,
      equipmentItems,
      secondaryOutcomes,
      focusAreas,
      cautionFlags,
      guidanceMode,
      scheduleMode,
      automatedProgression: automatedProgressionEnabled,
      weeklyMinutes,
      availableDays,
      trainingCyclePattern: cyclePattern,
      currentWeightKg: currentWeightValue === null ? null : convertWeightToKg(currentWeightValue, unitPreference),
      targetWeightKg: targetWeightValue === null ? null : convertWeightToKg(targetWeightValue, unitPreference),
      unitPreference,
    }),
    [
      automatedProgressionEnabled,
      availableDays,
      cyclePattern,
      age,
      ageRange,
      cautionFlags,
      currentWeightValue,
      daysPerWeek,
      equipment,
      equipmentItems,
      focusAreas,
      gender,
      goal,
      goals,
      guidanceMode,
      level,
      profileName,
      scheduleMode,
      secondaryOutcomes,
      setupSeed.heightCm,
      targetWeightValue,
      trainingEnvironment,
      unitPreference,
      weeklyMinutes,
    ],
  );
  const recommendationTailoringPreferences = useMemo<TailoringPreferencesInput>(
    () => ({
      setupEquipment: selection.equipment,
      setupFreeWeightsPreference: tailoringPreferences?.setupFreeWeightsPreference ?? 'neutral',
      setupBodyweightPreference: tailoringPreferences?.setupBodyweightPreference ?? 'neutral',
      setupMachinesPreference: tailoringPreferences?.setupMachinesPreference ?? 'neutral',
      setupShoulderFriendlySwaps: tailoringPreferences?.setupShoulderFriendlySwaps ?? 'neutral',
      setupElbowFriendlySwaps: tailoringPreferences?.setupElbowFriendlySwaps ?? 'neutral',
      setupKneeFriendlySwaps: tailoringPreferences?.setupKneeFriendlySwaps ?? 'neutral',
    }),
    [selection.equipment, tailoringPreferences],
  );
  const recommendation = useMemo(
    () => resolveFirstRunRecommendationWithTailoring(selection, recommendationTailoringPreferences),
    [recommendationTailoringPreferences, selection],
  );
  const recommendationOptionIds = useMemo(
    () => buildRecommendationOptionIds(recommendation),
    [recommendation.alternativeProgramIds, recommendation.featuredProgramId, recommendation.secondaryProgramId],
  );
  const activeRecommendedProgramId = useMemo(() => {
    if (selectedRecommendationProgramId && recommendationOptionIds.includes(selectedRecommendationProgramId)) {
      return selectedRecommendationProgramId;
    }

    return recommendation.featuredProgramId;
  }, [recommendation.featuredProgramId, recommendationOptionIds, selectedRecommendationProgramId]);
  const recommendedProgram = useMemo(
    () => getWorkoutTemplateById(activeRecommendedProgramId),
    [activeRecommendedProgramId],
  );
  const activeRecommendationCandidate = useMemo(
    () => recommendation.scoredCandidates.find((candidate) => candidate.programId === activeRecommendedProgramId) ?? null,
    [activeRecommendedProgramId, recommendation.scoredCandidates],
  );
  const alternativeRecommendationPrograms = useMemo(
    () =>
      recommendationOptionIds
        .filter((programId) => programId !== activeRecommendedProgramId)
        .map((programId) => {
          const template = getWorkoutTemplateById(programId);
          const candidate = recommendation.scoredCandidates.find((entry) => entry.programId === programId) ?? null;
          if (!template) {
            return null;
          }

          return {
            id: programId,
            template,
            presentation: getReadyTemplatePresentation(template, language),
            tradeoffNote:
              activeRecommendationCandidate && candidate
                ? buildRecommendationTradeoffLabel(activeRecommendationCandidate, candidate)
                : null,
          };
        })
        .filter(
          (
            option,
          ): option is {
            id: string;
            template: NonNullable<ReturnType<typeof getWorkoutTemplateById>>;
            presentation: ReturnType<typeof getReadyTemplatePresentation>;
            tradeoffNote: string | null;
          } => option !== null,
        )
        .slice(0, 2),
    [activeRecommendationCandidate, activeRecommendedProgramId, recommendation.scoredCandidates, recommendationOptionIds],
  );
  const activeRecommendationMismatchNote =
    activeRecommendedProgramId === recommendation.featuredProgramId ? recommendation.mismatchNote : null;
  const planReadyPayload = useMemo(
    () =>
      buildRecommendationPlanReadyPayload(selection, activeRecommendedProgramId, {
        fallbackReason: activeRecommendationMismatchNote ?? recommendation.fallbackReason,
      }),
    [activeRecommendationMismatchNote, activeRecommendedProgramId, recommendation.fallbackReason, selection],
  );
  // Program picker (08b): the recommended program always renders first and the
  // card list stays stable while the selection moves between the two options.
  // Stats and the focus split come from the COMPOSED week (the exact thing
  // that gets saved), never the raw catalog template — days-per-week truth.
  const programPickOptions = useMemo(() => {
    const ids = [
      recommendation.featuredProgramId,
      ...recommendationOptionIds.filter((programId) => programId !== recommendation.featuredProgramId),
    ].slice(0, 2);

    return ids
      .map((programId, index) => {
        const template = getWorkoutTemplateById(programId);
        const week = composeProgramWeekForSelection(selection, programId);
        if (!template || !week) {
          return null;
        }

        return {
          id: programId,
          presentation: getReadyTemplatePresentation(template, language),
          recommended: index === 0,
          days: week.days,
          mins: week.sessionMinutes,
          weeks: week.weeks,
          totalWorkouts: week.totalWorkouts,
          focus: buildProgramFocusSplit(week.sessions),
        };
      })
      .filter((option): option is NonNullable<typeof option> => option !== null);
  }, [recommendation.featuredProgramId, recommendationOptionIds, selection]);
  const helperSuggestions = useMemo(
    () => buildFirstRunPromptSuggestions(selection, getRecommendedProgramName(activeRecommendedProgramId)),
    [activeRecommendedProgramId, selection],
  );
  const helperPrompt = useMemo(
    () => buildFirstRunHelperPrompt(stage as FirstRunStep, selection, recommendedProgram?.name ?? null),
    [recommendedProgram?.name, selection, stage],
  );
  // The composed week for the currently selected program — the single truth
  // for day counts and the week preview (matches what gets saved).
  const composedActiveWeek = useMemo(
    () => composeProgramWeekForSelection(selection, activeRecommendedProgramId),
    [activeRecommendedProgramId, selection],
  );
  const locationLabel = useMemo(
    () => getLocationLabel(trainingEnvironment, equipment, language),
    [equipment, language, trainingEnvironment],
  );
  const goalLabel = useMemo(() => formatGoalList(goals, language), [goals, language]);
  const levelLabel = useMemo(() => getLevelLabel(level, language), [language, level]);
  const secondaryOutcomeLabels = useMemo(
    () => secondaryOutcomes.map((outcome) => getSecondaryOutcomeTitle(outcome)),
    [secondaryOutcomes],
  );
  const focusAreaLabels = useMemo(
    () => focusAreas.map((area) => getFocusAreaTitle(area, language)),
    [focusAreas, language],
  );
  const focusAreaSummary = useMemo(() => formatFocusAreaList(focusAreas), [focusAreas]);
  const guidanceModeLabel = useMemo(() => getGuidanceModeLabel(guidanceMode), [guidanceMode]);
  const scheduleModeLabel = useMemo(() => getScheduleModeLabel(scheduleMode), [scheduleMode]);
  const projectedDaysPerWeek = composedActiveWeek?.days ?? recommendedProgram?.daysPerWeek ?? daysPerWeek;
  // Built after the composed week so the day tag carries the week the user
  // actually runs, not the catalog template's own count.
  const recommendedProgramPresentation = useMemo(
    () =>
      recommendedProgram
        ? getReadyTemplatePresentation(recommendedProgram, language, projectedDaysPerWeek)
        : null,
    [recommendedProgram, language, projectedDaysPerWeek],
  );
  const recommendedProgramTags = useMemo(
    () => recommendedProgramPresentation?.tags.slice(0, 3) ?? [],
    [recommendedProgramPresentation],
  );
  const projectedRhythm = useMemo(() => {
    return resolveProjectedTrainingDays(selection, projectedDaysPerWeek).map((day) => getWeekdayShortLabel(day, language));
  }, [language, projectedDaysPerWeek, selection]);
  const weeklyMinuteOptions = useMemo(
    () => getWeeklyMinuteOptions(projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration],
  );
  const effectiveWeeklyMinutes = useMemo(
    () => getEffectiveWeeklyMinutes(selection, projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration, selection],
  );
  const scheduleFitNote = useMemo(
    () => buildScheduleFitNote(selection, projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration, selection],
  );

  function toggleGoal(nextGoal: SetupGoal) {
    setGoal(nextGoal);
    setGoals([nextGoal]);
  }
  const availableDayLabels = useMemo(
    () => availableDays.map((day) => getWeekdayShortLabel(day, language)),
    [availableDays, language],
  );
  const projectedSessions = useMemo(
    () =>
      recommendedProgram && composedActiveWeek
        ? composedActiveWeek.sessions
            .map((session) => ({
              id: session.id,
              name: session.name,
              weekdayLabel: session.weekdayLabel,
              guidance: buildSessionGuidance(recommendedProgram, session),
              hiddenExerciseCount: Math.max(0, session.exercises.length - 5),
              exercises: session.exercises.slice(0, 5).map((exercise) => ({
                id: exercise.id,
                name: exercise.exerciseName,
                prescription: formatPlanReadyExercisePrescription(exercise),
                compactPrescription: formatPlanReadyExerciseRepTarget(exercise),
                setsLabel: formatPlanReadyExerciseSetLabel(exercise),
                repsLabel: formatPlanReadyExerciseRepLabel(exercise),
              })),
              detailExercises: session.exercises.map((exercise) => ({
                id: exercise.id,
                name: exercise.exerciseName,
                prescription: formatPlanReadyExercisePrescription(exercise),
              })),
              body:
                session.exercises
                  .slice(0, 3)
                  .map((exercise) => exercise.exerciseName)
                  .join(', ') || `${session.exercises.length} exercises`,
            }))
        : [],
    [recommendedProgram],
  );
  const tailoringBadgeLabels = useMemo(
    () => buildTailoringBadgeLabels(recommendationTailoringPreferences).slice(0, 3),
    [recommendationTailoringPreferences],
  );

  useEffect(() => {
    setUnitPreference(initialUnitPreference);
  }, [initialUnitPreference]);

  useEffect(() => {
    if (stage !== 'recommendation' && activeRecommendationRefinement !== null) {
      setActiveRecommendationRefinement(null);
    }
  }, [activeRecommendationRefinement, stage]);

  useEffect(() => {
    if (selectedRecommendationProgramId && !recommendationOptionIds.includes(selectedRecommendationProgramId)) {
      setSelectedRecommendationProgramId(null);
    }
  }, [recommendationOptionIds, selectedRecommendationProgramId]);

  useEffect(() => {
    setPlanReadyWorkoutPage(0);
  }, [activeRecommendedProgramId]);

  useEffect(() => {
    const previousUnit = previousUnitPreferenceRef.current;
    if (previousUnit === unitPreference) {
      return;
    }

    setCurrentWeightDraft((current) => {
      const parsed = parseNumberInput(current);
      if (parsed === null) {
        return '';
      }

      return formatWeightInputValue(convertWeightToKg(parsed, previousUnit), unitPreference);
    });
    setTargetWeightDraft((current) => {
      const parsed = parseNumberInput(current);
      if (parsed === null) {
        return '';
      }

      return formatWeightInputValue(convertWeightToKg(parsed, previousUnit), unitPreference);
    });
    previousUnitPreferenceRef.current = unitPreference;
  }, [unitPreference]);

  useEffect(() => {
    requestAnimationFrame(() => {
      onboardingScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [stageIndex]);

  useEffect(() => {
    if (!isBuildingPlan) {
      buildingPlanScreenOpacity.setValue(1);
      buildingPlanEntryOpacity.setValue(0);
      buildingPlanTopTranslate.setValue(-36);
      buildingPlanBottomTranslate.setValue(36);
      buildingPlanLogoOpacity.setValue(0);
      buildingPlanLogoScale.setValue(0.95);
      buildingPlanThinkingOpacity.setValue(0);
      buildingPlanCaptionOpacity.setValue(0);
      setShowBuildingPlanThinking(false);
      setBuildingPlanPercent(0);
      setBuildingPlanComplete(false);
      setBuildingPlanEllipsisStep(0);
      buildingPlanPulse.stopAnimation();
      buildingPlanPulse.setValue(0);
      buildingPlanRingSpin.stopAnimation();
      buildingPlanRingSpin.setValue(0);
      return;
    }

    setBuildingPlanPhaseIndex(0);
    setShowBuildingPlanThinking(true);
    setBuildingPlanPercent(0);
    setBuildingPlanComplete(false);
    setBuildingPlanEllipsisStep(0);
    buildingPlanScreenOpacity.setValue(1);
    buildingPlanEntryOpacity.setValue(0);
    buildingPlanTopTranslate.setValue(-36);
    buildingPlanBottomTranslate.setValue(36);
    buildingPlanLogoOpacity.setValue(0);
    buildingPlanLogoScale.setValue(0.95);
    buildingPlanThinkingOpacity.setValue(0);
    buildingPlanCaptionOpacity.setValue(0);
    buildingPlanPulse.setValue(0);
    buildingPlanRingSpin.setValue(0);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const startedAt = Date.now();
    const percentIntervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(100, Math.round((elapsed / BUILDING_PLAN_TOTAL_MS) * 100));
      setBuildingPlanPercent(percent);
    }, 80);
    const ellipsisIntervalId = setInterval(() => {
      setBuildingPlanEllipsisStep((current) => (current + 1) % 3);
    }, 460);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildingPlanPulse, {
          toValue: 1,
          duration: 1550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buildingPlanPulse, {
          toValue: 0,
          duration: 1550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const ringSpinLoop = Animated.loop(
      Animated.timing(buildingPlanRingSpin, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    Animated.timing(buildingPlanThinkingOpacity, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    pulseLoop.start();
    ringSpinLoop.start();

    const fadeCaption = (index: number) => {
      setBuildingPlanPhaseIndex(index);
      buildingPlanCaptionOpacity.setValue(0);
      Animated.timing(buildingPlanCaptionOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    timeouts.push(setTimeout(() => fadeCaption(0), 200));
    timeouts.push(setTimeout(() => fadeCaption(1), 2800));
    timeouts.push(setTimeout(() => fadeCaption(2), 5400));
    timeouts.push(setTimeout(() => fadeCaption(3), 8000));

    timeouts.push(
      setTimeout(() => {
        clearInterval(percentIntervalId);
        clearInterval(ellipsisIntervalId);
        setBuildingPlanPhaseIndex(buildingPlanPhases.length - 1);
        setBuildingPlanPercent(100);
        setBuildingPlanComplete(true);
      }, BUILDING_PLAN_TOTAL_MS - 1500),
    );

    timeouts.push(
      setTimeout(() => {
        pulseLoop.stop();
        ringSpinLoop.stop();
        Animated.timing(buildingPlanScreenOpacity, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            return;
          }
          void haptics.success();
          setIsBuildingPlan(false);
          setShowBuildingPlanThinking(false);
          // The built plan lands on its OVERVIEW, not the picker. Landing on
          // two comparable cards asked the user to redo the choice the whole
          // questionnaire had just made for them, under a heading that already
          // said the program was ready — and then said it again one screen
          // later. The alternative is still there, behind "Vaihda", as an
          // escape hatch rather than an equal option.
          setPlanReadyView('overview');
          setStageIndex(getStageIndex('review'));
        });
      }, BUILDING_PLAN_TOTAL_MS - 420),
    );

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      clearInterval(percentIntervalId);
      clearInterval(ellipsisIntervalId);
      pulseLoop.stop();
      ringSpinLoop.stop();
      buildingPlanScreenOpacity.stopAnimation();
      buildingPlanEntryOpacity.stopAnimation();
      buildingPlanTopTranslate.stopAnimation();
      buildingPlanBottomTranslate.stopAnimation();
      buildingPlanLogoOpacity.stopAnimation();
      buildingPlanLogoScale.stopAnimation();
      buildingPlanThinkingOpacity.stopAnimation();
      buildingPlanCaptionOpacity.stopAnimation();
      buildingPlanPulse.stopAnimation();
      buildingPlanRingSpin.stopAnimation();
      buildingPlanScreenOpacity.setValue(1);
      buildingPlanEntryOpacity.setValue(0);
      buildingPlanTopTranslate.setValue(-36);
      buildingPlanBottomTranslate.setValue(36);
      buildingPlanLogoOpacity.setValue(0);
      buildingPlanLogoScale.setValue(0.95);
      buildingPlanThinkingOpacity.setValue(0);
      buildingPlanCaptionOpacity.setValue(0);
      setShowBuildingPlanThinking(false);
      setBuildingPlanPercent(0);
      setBuildingPlanComplete(false);
      setBuildingPlanEllipsisStep(0);
      buildingPlanPulse.setValue(0);
      buildingPlanRingSpin.setValue(0);
    };
  }, [
    BUILDING_PLAN_TOTAL_MS,
    buildingPlanPhases.length,
    buildingPlanBottomTranslate,
    buildingPlanCaptionOpacity,
    buildingPlanEntryOpacity,
    buildingPlanLogoOpacity,
    buildingPlanLogoScale,
    buildingPlanPulse,
    buildingPlanRingSpin,
    buildingPlanScreenOpacity,
    buildingPlanThinkingOpacity,
    buildingPlanTopTranslate,
    isBuildingPlan,
  ]);

  useEffect(() => {
    if (stage !== 'review') {
      return;
    }

    planReadyCardTranslateX.setValue(18);
    planReadyCardOpacity.setValue(0.78);
    Animated.parallel([
      Animated.timing(planReadyCardTranslateX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(planReadyCardOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeRecommendedProgramId, planReadyCardOpacity, planReadyCardTranslateX, stage]);

  function openHelper(prefill?: string) {
    setHelperDraft(prefill ?? helperPrompt);
    setHelperVisible(true);
    setHelperState('idle');
    setHelperAnswer(null);
    setHelperNote('');
    setHelperError('');
  }

  async function runAction(action: () => Promise<void> | void) {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      await action();
    } finally {
      setBusy(false);
    }
  }

  function toggleSecondaryOutcome(outcome: SetupSecondaryOutcome) {
    setSecondaryOutcomes((current) =>
      current.includes(outcome) ? current.filter((item) => item !== outcome) : [...current, outcome],
    );
  }

  function toggleFocusArea(area: SetupFocusArea) {
    setFocusAreas((current) => {
      if (current.includes(area)) {
        return current.filter((item) => item !== area);
      }

      // Was 2, raised on request (user 2026-08-23: "enemmän kuin 1-2"). Not
      // unlimited: every focus area adds its own accessory lifts to the week
      // (buildFocusEmphasisAdditions), so at some count "focus" stops meaning
      // anything and the sessions just swell. Past the cap the oldest choice
      // rolls off, same as before.
      if (current.length >= 4) {
        return [...current.slice(1), area];
      }

      return [...current, area];
    });
  }

  function toggleAvailableDay(day: SetupWeekday) {
    setAvailableDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function toggleRecommendationRefinement(panel: Exclude<RecommendationRefinementPanel, null>) {
    setActiveRecommendationRefinement((current) => (current === panel ? null : panel));
  }

  async function askAiCoach() {
    const prompt = helperDraft.trim();
    if (!prompt) {
      return;
    }

    setHelperState('loading');
    setHelperAnswer(null);
    setHelperNote('');
    setHelperError('');

    try {
      const result = await requestAiCoachAdvice({
        prompt,
        context: buildFirstRunAiCoachContext(selection, readyProgramCount),
        language,
      });

      setHelperAnswer(result.answer);
      setHelperNote(result.note ?? '');
      setHelperSource(result.source);
      setHelperState('ready');
    } catch {
      setHelperState('error');
      setHelperError(t(language, 'coachPreview.default.takeaway'));
    }
  }

  function renderProjectedPreview() {
    const previewTitle = formatWorkoutDisplayLabel(
      projectedSessions[0]?.name ?? recommendedProgram?.sessions?.[0]?.name ?? recommendedProgram?.name ?? 'Start here',
      'Workout',
    );
    const previewDuration = recommendedProgram?.estimatedSessionDuration
      ? `${recommendedProgram.estimatedSessionDuration} min`
      : null;
    const topBadges = [locationLabel, goalLabel, levelLabel, `${projectedDaysPerWeek} days`];
    const extraBadges = [...secondaryOutcomeLabels, ...focusAreaLabels].slice(0, 3);

    return (
      <SurfaceCard accent="neutral" emphasis="standard" style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderCopy}>
            <Text style={styles.previewKicker}>{t(language, 'onb.preview.startWith')}</Text>
            <Text style={styles.previewTitle}>{previewTitle}</Text>
            {previewDuration ? <Text style={styles.previewBody}>Time {previewDuration}</Text> : null}
          </View>
          <View style={styles.previewHeaderAside}>
            <PreviewGlyph dayCount={projectedDaysPerWeek} />
            {recommendedProgram ? (
              <BadgePill label={formatWorkoutDisplayLabel(recommendedProgram.name, 'Program')} accent="neutral" />
            ) : null}
          </View>
        </View>

        <View style={styles.previewBadgeRow}>
          {topBadges.map((label) => (
            <BadgePill key={label} label={label} accent="neutral" />
          ))}
        </View>

        {extraBadges.length ? (
          <View style={styles.previewSectionBlock}>
            <View style={styles.previewBadgeRow}>
              {extraBadges.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.previewSectionBlock}>
          <View style={styles.previewBadgeRow}>
            <BadgePill label={guidanceModeLabel} accent="neutral" />
            <BadgePill label={scheduleModeLabel} accent="neutral" />
            <BadgePill label={`~${effectiveWeeklyMinutes} min`} accent="neutral" />
          </View>
        </View>

        {stage === 'recommendation' ||
        selection.scheduleMode !== DEFAULT_FIRST_RUN_SELECTION.scheduleMode ||
        typeof selection.weeklyMinutes === 'number' ||
        selection.availableDays.length ? (
          <View style={styles.previewSectionBlock}>
            {selection.scheduleMode === 'self_managed' && availableDayLabels.length ? (
              <View style={styles.previewBadgeRow}>
                {availableDayLabels.map((label) => (
                  <BadgePill key={label} label={label} accent="neutral" />
                ))}
              </View>
            ) : null}
            <Text style={styles.previewSupportText}>{scheduleFitNote}</Text>
          </View>
        ) : null}

        {selection.currentWeightKg || selection.targetWeightKg ? (
          <View style={styles.previewSectionBlock}>
            <View style={styles.previewBadgeRow}>
              {selection.currentWeightKg ? (
                <BadgePill
                  label={`Current ${formatWeight(selection.currentWeightKg, unitPreference)}`}
                  accent="neutral"
                />
              ) : null}
              {selection.targetWeightKg ? (
                <BadgePill
                  label={`Target ${formatWeight(selection.targetWeightKg, unitPreference)}`}
                  accent="neutral"
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.previewSectionBlock}>
          <Text style={styles.previewSectionLabel}>{t(language, 'onb.preview.thisWeek')}</Text>
          <View style={styles.previewRhythmRow}>
            {projectedRhythm.map((day) => (
              <View key={day} style={styles.previewDayPill}>
                <Text style={styles.previewDayText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {projectedSessions.length ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>{t(language, 'onb.preview.comingUp')}</Text>
            <View style={styles.previewSessionList}>
              {projectedSessions.map((session) => (
                <View key={session.id} style={styles.previewSessionRow}>
                  <Text style={styles.previewSessionName}>{session.name}</Text>
                  <Text style={styles.previewSessionBody}>{session.body}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {activeRecommendationMismatchNote ? <Text style={styles.previewNote}>{activeRecommendationMismatchNote}</Text> : null}
      </SurfaceCard>
    );
  }

  function applyEquipmentEnvironment(option: (typeof LOCATION_SELECTION_OPTIONS)[number], items: string[]) {
    if (option.id === 'home_gym') {
      const hasHeavy = items.some((item) => HOME_HEAVY_EQUIPMENT_ITEMS.includes(item));
      setEquipment(hasHeavy ? 'home' : 'minimal');
      setTrainingEnvironment(hasHeavy ? 'home_gym' : 'minimal_equipment');
      return;
    }
    setEquipment(option.equipment);
    setTrainingEnvironment(option.trainingEnvironment);
  }

  function selectEquipmentSetup(option: (typeof LOCATION_SELECTION_OPTIONS)[number]) {
    void haptics.select();
    const defaults = EQUIPMENT_DEFAULT_ITEMS[option.id] ?? [];
    setSelectedLocationOptionId(option.id);
    // Full gym stays closed on select (user 2026-08-23): its default is
    // everything, so the chips are a correction, not a question. Home and
    // bodyweight open, because "what do you actually have" is the question.
    setEquipmentCardOpen(option.id !== 'full_gym');
    setEquipmentItems(defaults);
    applyEquipmentEnvironment(option, defaults);
  }

  function toggleEquipmentItem(option: (typeof LOCATION_SELECTION_OPTIONS)[number], item: string) {
    void haptics.select();
    setEquipmentItems((current) => {
      const next = current.includes(item) ? current.filter((value) => value !== item) : [...current, item];
      applyEquipmentEnvironment(option, next);
      return next;
    });
  }

  function renderLocation() {
    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('location', language),
      titleLines: [t(language, 'onb.stage.location.title1'), t(language, 'onb.stage.location.title2')],
      topPaneStyle: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyle: styles.locationEquipmentHeadline,
      children: (
        <View style={styles.locationCardList}>
          {/* The cards keep their order. Selecting used to lift the chosen one
              to the top as an expanded card and list the rest under "or
              choose" — so the card you tapped jumped away from under your
              thumb, and the only way to close it was to pick another. Now
              each card expands where it is, and its header toggles it. */}
          {LOCATION_SELECTION_OPTIONS.map((option) => {
            const isSelected = option.id === selectedLocationOptionId;
            if (!isSelected) {
              return (
                <LocationChoiceCard
                  key={option.id}
                  label={t(language, option.labelKey)}
                  subtitle={t(language, option.subtitleKey)}
                  icon={option.icon}
                  focusLabel={option.focusLabelKey ? t(language, option.focusLabelKey) : undefined}
                  focusTone={option.focusTone}
                  active={false}
                  onPress={() => selectEquipmentSetup(option)}
                />
              );
            }
            const chips = EQUIPMENT_CHIP_CATALOG[option.id] ?? [];
            return (
              <View key={option.id} style={styles.equipmentExpandedCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: true, expanded: equipmentCardOpen }}
                  onPress={() => {
                    void haptics.select();
                    setEquipmentCardOpen((open) => !open);
                  }}
                  style={styles.equipmentExpandedHeader}
                >
                  <OnboardingOptionIcon name={option.icon} />
                  <View style={styles.equipmentExpandedCopy}>
                    <Text style={styles.equipmentExpandedTitle}>{t(language, option.labelKey)}</Text>
                    <Text style={styles.equipmentExpandedCount}>
                      {chips.length > 0
                        ? t(language, 'onb.equip.selectedCount', { count: equipmentItems.length })
                        : t(language, option.subtitleKey)}
                    </Text>
                  </View>
                  <View style={styles.equipmentExpandedCheck}>
                    <VinhaIcon name="check" size={13} color="#FFFFFF" />
                  </View>
                </Pressable>
                {equipmentCardOpen && chips.length > 0 ? (
                  <>
                    <Text style={styles.equipmentChipsPrompt}>{t(language, 'onb.equip.prompt')}</Text>
                    <View style={styles.equipmentChipsWrap}>
                      {chips.map((item) => {
                        const active = equipmentItems.includes(item);
                        // The English item is the stored id; only its label moves.
                        const label = equipmentItemLabel(language, item);
                        return (
                          <Pressable
                            key={item}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={label}
                            onPress={() => toggleEquipmentItem(option, item)}
                            style={[styles.equipmentChip, active && styles.equipmentChipActive]}
                          >
                            {/* Colour alone marked the chosen chips; a check
                                says it outright (user 2026-08-23). */}
                            {active ? <VinhaIcon name="check" size={12} color={C.primary} /> : null}
                            <Text style={[styles.equipmentChipText, active && styles.equipmentChipTextActive]}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ),
    });
  }

  function renderSplitSelectionStage({
    stepLabel,
    titleLines,
    subtitle,
    options,
    beforeOptions,
    afterOptions,
    grid = false,
    compactCards = false,
    hideIcons = false,
    leadingRadio = false,
    tightBottom = false,
    largeTitle = false,
    solidStepLabel = false,
    compactTop = false,
    roomyCards = false,
    tallCards = false,
    optionsContainerStyle,
    topPaneStyleOverride,
    topCopyStyle,
    titleStyleOverride,
  }: {
    stepLabel: string;
    titleLines: string[];
    subtitle?: string;
    beforeOptions?: React.ReactNode;
    afterOptions?: React.ReactNode;
    grid?: boolean;
    compactCards?: boolean;
    hideIcons?: boolean;
    leadingRadio?: boolean;
    tightBottom?: boolean;
    largeTitle?: boolean;
    solidStepLabel?: boolean;
    compactTop?: boolean;
    roomyCards?: boolean;
    tallCards?: boolean;
    optionsContainerStyle?: ViewStyle;
    topPaneStyleOverride?: ViewStyle;
    topCopyStyle?: ViewStyle;
    titleStyleOverride?: TextStyle;
    options: Array<{
      id: string;
      label: string;
      subtitle?: string;
      icon: OnboardingOptionIconName;
      focusLabel?: string;
      focusTone?: FocusBadgeTone;
      tags?: FocusBadgeInput[];
      benefits?: LocationBenefit[];
      active: boolean;
      subdued?: boolean;
      onPress: () => void;
    }>;
  }) {
    return renderOnboardingShell({
      stepLabel,
      titleLines,
      subtitle,
      topPaneStyle: [
        compactTop && styles.locationTopPaneCompact,
        topPaneStyleOverride,
      ],
      topCopyStyle: [
        compactTop && styles.locationTopCopyCompact,
        topCopyStyle,
      ],
      titleStyle: titleStyleOverride ?? (largeTitle ? styles.locationHeadlineLarge : undefined),
      stepLabelStyle: solidStepLabel ? styles.locationStepLabelSolid : undefined,
      bottomStyle: tightBottom ? styles.locationBottomPaneTight : undefined,
      children: (
        <>
          {beforeOptions}
          {grid ? (
            <View style={[styles.locationCardGrid, optionsContainerStyle]}>
              {options.map((option) => (
                <View key={option.id} style={styles.locationCardGridItem}>
                  <LocationChoiceCard
                    label={option.label}
                    subtitle={option.subtitle}
                    icon={option.icon}
                    focusLabel={option.focusLabel}
                    focusTone={option.focusTone}
                    tags={option.tags}
                    benefits={option.benefits}
                    active={option.active}
                    subdued={option.subdued}
                    onPress={option.onPress}
                    compact={compactCards}
                    roomy={roomyCards}
                    hideIcon={hideIcons}
                    leadingRadio={leadingRadio}
                    tall={tallCards}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.locationCardList, compactCards && styles.locationCardListCompact, optionsContainerStyle]}>
              {options.map((option) => (
                <LocationChoiceCard
                  key={option.id}
                  label={option.label}
                  subtitle={option.subtitle}
                  icon={option.icon}
                  focusLabel={option.focusLabel}
                  focusTone={option.focusTone}
                  tags={option.tags}
                  benefits={option.benefits}
                  active={option.active}
                  subdued={option.subdued}
                  onPress={option.onPress}
                  compact={compactCards}
                  roomy={roomyCards}
                  hideIcon={hideIcons}
                  leadingRadio={leadingRadio}
                  tall={tallCards}
                />
              ))}
            </View>
          )}
          {afterOptions}
        </>
      ),
    });
  }

  function renderOnboardingShell({
    stepLabel,
    titleLines,
    subtitle,
    children,
    shellStyle,
    topPaneStyle,
    topCopyStyle,
    titleStyle,
    stepLabelStyle,
    bottomStyle,
  }: {
    stepLabel: string;
    titleLines: string[];
    subtitle?: string;
    children: React.ReactNode;
    shellStyle?: ViewStyle | ViewStyle[];
    topPaneStyle?: ViewStyle | Array<ViewStyle | false | undefined>;
    topCopyStyle?: ViewStyle | Array<ViewStyle | false | undefined>;
    titleStyle?: TextStyle;
    stepLabelStyle?: TextStyle;
    bottomStyle?: ViewStyle | ViewStyle[];
  }) {
    const locationStageHeight = Math.max(640, Dimensions.get('window').height - insets.top - insets.bottom - 150);
    const fixedTopPaneHeight = Math.min(380, Math.round(locationStageHeight * 0.34) + 34);

    return (
      <View style={[styles.locationStageShell, { minHeight: locationStageHeight }, shellStyle]}>
        {/* The bar rides the back chevron's row (user 2026-08-23): on a short
            phone the old bar-below-button layout pushed the last option card
            off screen, and a row that only holds a 40px circle has the width
            for it. */}
        <View pointerEvents="none" style={styles.locationProgressBarWrap}>
          <StepDots index={stageIndex} />
        </View>
        <View style={[styles.locationTopPane, { height: fixedTopPaneHeight }, topPaneStyle]}>
          <View style={styles.locationTopSlope} />
          <View style={[styles.locationTopCopy, topCopyStyle]}>
            <Text style={[styles.locationStepLabel, stepLabelStyle]}>{stepLabel}</Text>
            {titleLines.map((line) => (
              <Text key={line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84} style={[styles.locationHeadline, titleStyle]}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.locationBottomPane, bottomStyle]}>{children}</View>
      </View>
    );
  }

  function renderGoal() {
    return renderSplitSelectionStage({
      stepLabel: getQuestionnaireStepLabel('goal', language),
      titleLines: [t(language, 'onb.stage.goal.title1'), t(language, 'onb.stage.goal.title2')],
      subtitle: t(language, 'onb.stage.goal.sub'),
      options: GOAL_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: t(language, option.labelKey),
        subtitle: t(language, option.subtitleKey),
        icon: option.icon,
        active: goal === option.id,
        onPress: () => {
          void haptics.select();
          toggleGoal(option.id);
        },
      })),
      roomyCards: true,
      optionsContainerStyle: styles.locationStepTwoOptionsShift,
      topPaneStyleOverride: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyleOverride: styles.locationEquipmentHeadline,
    });
  }

  function renderLevel() {
    const selectedLevelIndex = Math.max(
      0,
      LEVEL_SLIDER_OPTIONS.findIndex((option) => option.level === level),
    );
    const selectedLevelOption = LEVEL_SLIDER_OPTIONS[selectedLevelIndex];
    const segmentWidth = levelTrackWidth > 0 ? (levelTrackWidth - 8) / LEVEL_SLIDER_OPTIONS.length : 0;

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('level', language),
      titleLines: [t(language, 'onb.stage.level.title1')],
      subtitle: t(language, 'onb.stage.level.sub'),
      topPaneStyle: styles.trainingProfileTopPane,
      topCopyStyle: styles.trainingProfileTopCopy,
      titleStyle: styles.trainingProfileHeadline,
      bottomStyle: styles.trainingProfileBottomPane,
      children: (
        <View style={styles.levelStageContent}>
          <View style={styles.levelLogoWrap}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ scale: levelFlamePop }] }]}>
              <LevelStreaks levelIndex={selectedLevelIndex} />
            </Animated.View>
            {/* This was the GAINER wordmark, spelled out as G + AI + NER —
                three Text nodes, so the string "GAINER" never appeared in the
                source and every search for it during the rename came back
                clean. It survived on step 3 of 6 of first-run onboarding. */}
            <View style={styles.levelLogoRow}>
              {/* Onboarding is light-only and paints from its own constants,
                  so the mark takes them rather than the theme's near-matches. */}
              <VinhaWordmark size={44} fitness color={C.text} accentColor={C.primary} />
            </View>
          </View>

          {/* The thumb is deliberately not drawn before a choice, so the
              description must not be either: naming "Aloittelija" in bold over
              an empty selector claims a level the user never picked. Before the
              choice the block asks for one; after it, it explains. */}
          <View style={styles.levelCopyBlock}>
            <Text style={styles.levelTitle}>
              {t(language, profileLevelSelected ? selectedLevelOption.labelKey : 'onb.level.pickTitle')}
            </Text>
            {profileLevelSelected
              ? selectedLevelOption.lineKeys.map((lineKey) => (
                  <Text key={lineKey} style={styles.levelLine}>
                    {t(language, lineKey)}
                  </Text>
                ))
              : null}
          </View>

          <View
            style={styles.levelSliderTrack}
            onLayout={(event) => setLevelTrackWidth(event.nativeEvent.layout.width)}
          >
            {/* The filled pill is the selection. Drawing it before the user has
                chosen shows a level that was never picked while Continue stays
                disabled — the state that made the button look broken. */}
            {segmentWidth > 0 && profileLevelSelected ? (
              <Animated.View
                style={[
                  styles.levelSliderThumb,
                  { width: segmentWidth, transform: [{ translateX: levelThumbTranslate }] },
                ]}
              />
            ) : null}
            {LEVEL_SLIDER_OPTIONS.map((option, index) => {
              const active = profileLevelSelected && index === selectedLevelIndex;

              return (
                <Pressable
                  key={option.level}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'onb.level.a11y', { label: t(language, option.labelKey) })}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.select();
                    setLevel(option.level);
                    setProfileLevelSelected(true);
                    Animated.timing(levelThumbAnim, {
                      toValue: index,
                      duration: 240,
                      easing: Easing.out(Easing.cubic),
                      useNativeDriver: true,
                    }).start();
                    levelFlamePop.setValue(0.4);
                    Animated.spring(levelFlamePop, {
                      toValue: 1,
                      friction: 4,
                      tension: 90,
                      useNativeDriver: true,
                    }).start();
                  }}
                  style={[styles.levelSliderSegment, !profileLevelSelected && styles.levelSliderSegmentIdle]}
                >
                  <Text style={[styles.levelSliderLabel, active && styles.levelSliderLabelActive]}>
                    {t(language, option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.levelYearsRow}>
            {LEVEL_SLIDER_OPTIONS.map((option, index) => {
              const active = profileLevelSelected && index === selectedLevelIndex;
              return (
                <Text key={option.level} style={[styles.levelYearsText, active && styles.levelYearsTextActive]}>
                  {t(language, option.yearsKey)}
                </Text>
              );
            })}
          </View>
          <Text style={styles.levelSliderHint}>
            {t(language, profileLevelSelected ? 'onb.level.hintChosen' : 'onb.level.hintPick')}
          </Text>
        </View>
      ),
    });
  }

  function selectTrainingDaysCount(option: SetupDaysPerWeek) {
    void haptics.select();
    setDaysPerWeek(option);
    setAvailableDays(DEFAULT_RHYTHM_BY_DAYS[option]);
    // Chips hand the weekly rhythm back to the app; hand-picked days below
    // switch to self-managed scheduling instead. Either way it is a weekly
    // answer, so a chosen cycle gives way to it.
    setCyclePattern(null);
    setScheduleMode('app_managed');
    setProfileFrequencySelected(true);
  }

  function toggleTrainingDay(day: SetupWeekday) {
    const base = availableDays.length > 0 ? availableDays : DEFAULT_RHYTHM_BY_DAYS[daysPerWeek];
    const next = (base.includes(day) ? base.filter((item) => item !== day) : [...base, day]).sort(
      (left, right) => WEEKDAY_OPTIONS.indexOf(left) - WEEKDAY_OPTIONS.indexOf(right),
    );

    // daysPerWeek only supports 2-6 training days; ignore taps outside that.
    if (next.length < 2 || next.length > 6) {
      void haptics.error();
      return;
    }

    void haptics.select();
    setAvailableDays(next);
    setDaysPerWeek(next.length as SetupDaysPerWeek);
    setCyclePattern(null);
    setScheduleMode('self_managed');
    setProfileFrequencySelected(true);
  }

  function selectCyclePreset(option: (typeof CYCLE_PRESET_OPTIONS)[number]) {
    void haptics.select();
    // Tapping the active preset steps back to plain weekdays.
    if (cyclePresetId === option.id) {
      setCyclePattern(null);
      return;
    }
    setCyclePattern(patternFromOnOff(option.on, option.off));
    setDaysPerWeek(cycleDaysPerWeek(option.on, option.off));
    setScheduleMode('app_managed');
    setProfileFrequencySelected(true);
  }

  function renderDays() {
    const recommendedDays = getRecommendedDaysForLevel(level);
    const cycleActive = cyclePattern !== null;
    // Until a count is chosen the week shown IS the recommendation, so the
    // chips have to draw the recommendation's rhythm. Falling back to
    // daysPerWeek's default put three days on screen looking chosen, under a
    // tile marked "4 — recommended", above a disabled button that said
    // nothing about why.
    const selectedDays =
      availableDays.length > 0
        ? availableDays
        : DEFAULT_RHYTHM_BY_DAYS[profileFrequencySelected ? daysPerWeek : recommendedDays];
    const restCount = 7 - selectedDays.length;

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('days', language),
      titleLines: [t(language, 'onb.stage.days.title1')],
      subtitle: t(language, 'onb.stage.days.sub'),
      topPaneStyle: styles.trainingProfileTopPane,
      topCopyStyle: styles.trainingProfileTopCopy,
      titleStyle: styles.trainingProfileHeadline,
      bottomStyle: styles.trainingProfileBottomPane,
      children: (
        <View style={styles.trainingProfileContent}>
          <View style={styles.daysChipRow}>
            {TRAINING_DAY_COUNT_OPTIONS.map((option) => {
              // Before a choice, the recommendation is what the rest of the
              // screen is showing, so it is what reads as selected. With a
              // cycle chosen the count is derived, and a lit chip next to a
              // lit preset would be two answers claiming the same question.
              const active =
                !cycleActive &&
                (profileFrequencySelected ? daysPerWeek === option : option === recommendedDays);
              const recommended = option === recommendedDays;

              return (
                <View key={option} style={styles.daysChipColumn}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t(language, 'setup.a11y.daysPerWeek', { count: option })}${
                      recommended ? t(language, 'setup.a11y.daysRecommended') : ''
                    }`}
                    accessibilityState={{ selected: active }}
                    onPress={() => selectTrainingDaysCount(option)}
                    style={[
                      styles.daysChip,
                      recommended && !active && styles.daysChipRecommended,
                      active && styles.daysChipActive,
                    ]}
                  >
                    <Text style={[styles.daysChipText, active && styles.daysChipTextActive]}>{option}</Text>
                  </Pressable>
                  {recommended ? (
                    <Text numberOfLines={1} style={styles.daysChipCaption}>
                      {t(language, 'onb.days.recommended')}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* A chosen cycle overrides the weekdays everywhere else in the
              app, so the week row is hidden rather than greyed while one is
              active — two rhythms on one screen, one of them inert, is how a
              screen disagrees with itself (same rule as the plan screen). */}
          {!cycleActive ? (
            <>
              {/* Until a count is chosen, this step LOOKS answered — the
                  weekday cells are drawn from the recommendation and the
                  summary reads as a result — while Continue stays disabled on
                  profileFrequencySelected. "Tap days to adjust" told the user
                  the opposite of what the screen required, with nothing
                  saying why. The level stage solves this by asking. */}
              <Text style={styles.daysWeekLabel}>
                {t(language, profileFrequencySelected ? 'onb.days.tapToAdjust' : 'onb.days.pickCount')}
              </Text>
              <View style={styles.daysWeekRow}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const dayActive = selectedDays.includes(day);

                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={`${getWeekdayShortLabel(day, language)}${
                        dayActive ? t(language, 'setup.a11y.trainingDay') : t(language, 'setup.a11y.restDay')
                      }`}
                      accessibilityState={{ selected: dayActive }}
                      onPress={() => toggleTrainingDay(day)}
                      style={[styles.daysWeekCell, dayActive && styles.daysWeekCellActive]}
                    >
                      <Text style={[styles.daysWeekCellText, dayActive && styles.daysWeekCellTextActive]}>
                        {t(language, WEEKDAY_LETTER_KEYS[day])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.daysSummaryLine}>
                {t(language, 'onb.days.summary', { days: selectedDays.length, rest: restCount })}
              </Text>
              {profileFrequencySelected && daysPerWeek !== recommendedDays ? (
                <Text style={styles.daysRecommendHint}>
                  {t(language, 'onb.days.recommendHint', { days: recommendedDays })}
                </Text>
              ) : null}
            </>
          ) : null}

          {/* Cycle splits (user 2026-08-23): the rhythms that do not fit
              inside a week. */}
          <Text style={styles.daysCycleLabel}>{t(language, 'onb.days.cycleLabel')}</Text>
          <View style={styles.daysCycleRow}>
            {CYCLE_PRESET_OPTIONS.map((option) => {
              const active = cyclePresetId === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => selectCyclePreset(option)}
                  style={[styles.daysCycleChip, active && styles.daysCycleChipActive]}
                >
                  {active ? <VinhaIcon name="check" size={12} color={C.primary} /> : null}
                  <Text style={[styles.daysCycleChipText, active && styles.daysCycleChipTextActive]}>
                    {t(language, option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {cyclePattern ? (
            <>
              {/* Which weekdays the rhythm actually lands on (user
                  2026-08-24). A cycle is defined without weekdays, which is
                  the point of it — but "2 on, 1 off" is abstract until you
                  see that it means training Mon, Tue, Thu, Fri, Sun this
                  week. Read-only on purpose: tapping a day here would be the
                  weekday picker again, and the two cannot both be the answer.
                  Anchored on today, because that is when the cycle starts. */}
              <Text style={styles.daysCycleLabel}>{t(language, 'onb.days.cycleWeek')}</Text>
              <View style={styles.daysWeekRow}>
                {Array.from({ length: 7 }).map((_, offset) => {
                  const date = new Date();
                  date.setDate(date.getDate() + offset);
                  const trains = cyclePattern[offset % cyclePattern.length];
                  const weekday = WEEKDAY_OPTIONS[(date.getDay() + 6) % 7];
                  return (
                    <View
                      key={offset}
                      accessible
                      accessibilityLabel={`${getWeekdayShortLabel(weekday, language)}${t(
                        language,
                        trains ? 'setup.a11y.trainingDay' : 'setup.a11y.restDay',
                      )}`}
                      style={[styles.daysWeekCell, trains && styles.daysWeekCellActive]}
                    >
                      <Text style={[styles.daysWeekCellText, trains && styles.daysWeekCellTextActive]}>
                        {t(language, WEEKDAY_LETTER_KEYS[weekday])}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.daysSummaryLine}>
                {t(language, 'onb.days.cycleSummary', { len: cyclePattern.length })}
              </Text>
            </>
          ) : null}
        </View>
      ),
    });
  }

  function flagCautionArea(area: SetupCautionArea) {
    void haptics.select();
    setCautionFlags((current) =>
      current.some((flag) => flag.area === area)
        ? current
        : [...current, { area, level: 'careful', refinements: [] }],
    );
  }

  function removeCautionFlag(area: SetupCautionArea) {
    void haptics.select();
    setCautionFlags((current) => current.filter((flag) => flag.area !== area));
  }

  function setCautionLevel(area: SetupCautionArea, level: SetupCautionLevel) {
    void haptics.select();
    setCautionFlags((current) => current.map((flag) => (flag.area === area ? { ...flag, level } : flag)));
  }


  function renderCautionRow(option: { area: SetupCautionArea; labelKey: I18nKey }) {
    const areaLabel = t(language, option.labelKey);
    const flag = cautionFlags.find((item) => item.area === option.area) ?? null;
    // A flagged area shows its levels; tapping the header again un-flags it.
    // There used to be a separate expand/collapse, a REFINE chip row and a
    // "Remove" link under the levels — three controls where the card itself
    // was enough (user, 2026-08-19): on/off is the card, the level is inside.
    const expanded = flag !== null;
    const colors = flag ? CAUTION_LEVEL_COLORS[flag.level] : null;
    const levelLabelKey = flag
      ? CAUTION_LEVEL_OPTIONS.find((item) => item.level === flag.level)?.labelKey ?? null
      : null;
    const levelLabel = levelLabelKey ? t(language, levelLabelKey) : null;

    return (
      <View
        key={option.area}
        style={[styles.avoidRow, colors ? { borderColor: colors.ink } : null]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            flag ? t(language, 'onb.avoid.a11y.flagged', { area: areaLabel, level: levelLabel ?? '' }) : areaLabel
          }
          accessibilityState={{ selected: flag !== null, expanded }}
          onPress={() => {
            if (!flag) {
              flagCautionArea(option.area);
              return;
            }
            removeCautionFlag(option.area);
          }}
          style={styles.avoidRowHeader}
        >
          <View style={[styles.avoidRowTile, colors ? { backgroundColor: colors.soft } : null]}>
            <CautionGlyph color={colors ? colors.ink : C.textMuted} />
          </View>
          <View style={styles.avoidRowCopy}>
            <Text style={[styles.avoidRowTitle, colors ? { color: colors.ink } : null]}>{areaLabel}</Text>
            {flag ? <Text style={[styles.avoidRowLevel, { color: colors!.ink }]}>{levelLabel}</Text> : null}
          </View>
          {flag ? (
            <View style={[styles.avoidRowRadio, { borderColor: colors!.ink, backgroundColor: colors!.ink }]}>
              <VinhaIcon name="check" size={12} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.avoidRowRadio} />
          )}
        </Pressable>

        {expanded && flag ? (
          <View style={styles.avoidRowDetail}>
            <View style={styles.avoidLevelList}>
              {CAUTION_LEVEL_OPTIONS.map((levelOption) => {
                const levelColors = CAUTION_LEVEL_COLORS[levelOption.level];
                const active = flag.level === levelOption.level;

                return (
                  <Pressable
                    key={levelOption.level}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(language, levelOption.labelKey)}: ${t(language, levelOption.bodyKey)}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setCautionLevel(option.area, levelOption.level)}
                    style={[
                      styles.avoidLevelRow,
                      active && { borderColor: levelColors.ink, backgroundColor: levelColors.soft },
                    ]}
                  >
                    <View
                      style={[
                        styles.avoidLevelRadio,
                        active && { borderColor: levelColors.ink, backgroundColor: levelColors.ink },
                      ]}
                    >
                      {active ? <VinhaIcon name="check" size={11} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.avoidLevelCopy}>
                      <Text style={[styles.avoidLevelTitle, active && { color: levelColors.ink }]}>
                        {t(language, levelOption.labelKey)}
                      </Text>
                      <Text style={styles.avoidLevelBody}>{t(language, levelOption.bodyKey)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

          </View>
        ) : null}
      </View>
    );
  }

  function renderAvoid() {
    const seriousFlagCount = cautionFlags.filter((flag) => flag.level !== 'info').length;
    const avoidFlagCount = cautionFlags.filter((flag) => flag.level === 'avoid').length;
    const showProfessionalAdvisory = seriousFlagCount >= 3 || avoidFlagCount >= 2;

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('avoid', language),
      titleLines: [t(language, 'onb.stage.avoid.title1'), t(language, 'onb.stage.avoid.title2')],
      subtitle: t(language, 'onb.stage.avoid.sub'),
      topPaneStyle: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyle: styles.locationEquipmentHeadline,
      children: (
        <View style={styles.avoidList}>
          {AVOID_AREA_OPTIONS.map((option) => renderCautionRow(option))}
          {avoidExtraVisible ? AVOID_EXTRA_AREA_OPTIONS.map((option) => renderCautionRow(option)) : null}

          {showProfessionalAdvisory ? (
            <View style={styles.avoidAdvisoryBox}>
              <CautionGlyph color="#D97706" size={18} />
              <Text style={styles.avoidAdvisoryText}>{t(language, 'onb.avoid.advisory')}</Text>
            </View>
          ) : null}

          {!avoidExtraVisible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'onb.addSomethingElse')}
              onPress={() => {
                void haptics.select();
                setAvoidExtraVisible(true);
              }}
              style={styles.avoidGhostRow}
            >
              <Text style={styles.avoidGhostText}>{t(language, 'onb.avoid.addOther')}</Text>
            </Pressable>
          ) : null}

          {/* "Ei huomautettavaa" was here. It cleared an already-empty list
              and stayed on the step, so on a fresh run it did nothing at all —
              and the primary button below already says "Ohita" when nothing is
              selected. Two controls, one job, and the quieter one was broken. */}
        </View>
      ),
    });
  }

  /**
   * The plan-ready screen, from design 08b variant D: two programs owning the
   * whole screen either side of one diagonal seam.
   *
   * This replaced BOTH of the screens that used to be here. The overview
   * announced one program with the alternative tucked behind a "Vaihda"
   * button, and that button opened a second screen — titled the same thing —
   * that asked the question again on two stacked cards. The choice now happens
   * where the programs are, once, and the CTA never moves.
   */
  function renderReview() {
    if (planReadyView === 'day') {
      return renderPlanReadyDay();
    }

    const planReadyWeeks = planReadyPayload.blockLengthWeeks > 0 ? planReadyPayload.blockLengthWeeks : READY_PROGRAM_MIN_BLOCK_WEEKS;
    // Composed-week day count wins; the raw template's own count is only a
    // fallback (days-per-week truth).
    const planReadyPerWeek =
      projectedDaysPerWeek
      || planReadyPayload.programDaysPerWeek
      || planReadyPayload.requestedDaysPerWeek
      || 3;
    const planReadyTotalWorkouts = planReadyWeeks * planReadyPerWeek;
    // Why THIS program for THIS user. The design's card carries a blurb; the
    // waterfall's reason is the better sentence for the same slot, so it wins
    // when there is one. Dropping it would have been the recommendation
    // quietly stopping explaining itself.
    const planReadyWaterfall = recommendation.waterfall;
    const whyKey = (key: I18nKey | null) => (key ? t(language, key) : null);
    const whyFor = (programId: string): string | null => {
      if (!planReadyWaterfall) {
        return null;
      }
      if (programId === planReadyWaterfall.primaryProgramId) {
        return whyKey(planReadyWaterfall.whyPrimary);
      }
      if (programId === planReadyWaterfall.alternativeProgramId) {
        return whyKey(planReadyWaterfall.whyAlternative);
      }
      return null;
    };
    const planReadyMeta = [
      t(language, 'onb.planReady.weekPlan', { count: planReadyWeeks }),
      goalLabel,
      locationLabel,
    ]
      .filter((part) => Boolean(part && part.trim()))
      .join('  ·  ');

    return (
      <ProgramPickScreen
        language={language}
        title={t(language, 'onb.planReady.title')}
        meta={planReadyMeta}
        options={programPickOptions.map((option) => ({
          id: option.id,
          title: option.presentation.title,
          subtitle: whyFor(option.id) ?? option.presentation.subtitle,
          days: option.days,
          mins: option.mins,
          weeks: option.weeks,
          totalWorkouts: option.totalWorkouts,
          recommended: option.recommended,
          focus: option.focus,
        }))}
        selectedId={activeRecommendedProgramId}
        onSelect={(id) => {
          void haptics.select();
          setSelectedRecommendationProgramId(id);
        }}
        ctaLabel={t(language, 'onb.cta.startTraining')}
        // Straight into the app. This used to open the paywall — the reader
        // had just been handed a programme and the next thing the app did was
        // ask for money (user decision 2026-08-24). The paywall is unchanged
        // and still reachable from Profile.
        onContinue={() => {
          void haptics.success();
          void runAction(() => onCompleteToTraining(selection, activeRecommendedProgramId));
        }}
        onOpenWeek={() => {
          setPlanReadyWorkoutPage(0);
          setPlanReadyView('day');
        }}
        weekLinkLabel={t(language, 'onb.planReady.viewWeek')}
        onTopToneChange={onFullBleedReviewChange}
        busy={busy}
      />
    );
  }

  function renderPlanReadyDay() {
    const days = projectedSessions;
    const dayCount = Math.max(days.length, 1);
    const selectedIndex = Math.min(Math.max(planReadyWorkoutPage, 0), dayCount - 1);
    const selectedSession = days[selectedIndex] ?? null;
    const planReadyWeeks = planReadyPayload.blockLengthWeeks > 0 ? planReadyPayload.blockLengthWeeks : READY_PROGRAM_MIN_BLOCK_WEEKS;
    const focusOf = (name: string, index: number) => {
      const normalized = (name ?? '').toLowerCase();
      if (normalized.includes('full')) return 'Full Body';
      if (normalized.includes('lower')) return 'Lower';
      if (normalized.includes('upper')) return 'Upper';
      return index % 3 === 2 ? 'Full Body' : index % 3 === 1 ? 'Lower' : 'Upper';
    };
    const groupOf = (name: string) => {
      const normalized = (name ?? '').toLowerCase();
      if (normalized.includes('squat') || normalized.includes('lunge') || normalized.includes('leg')) return 'LEGS';
      if (normalized.includes('curl') || normalized.includes('tricep')) return 'ARMS';
      if (normalized.includes('row') || normalized.includes('pull')) return 'BACK';
      if (normalized.includes('push') || normalized.includes('press') || normalized.includes('chest')) {
        return normalized.includes('shoulder') || normalized.includes('overhead') ? 'SHOULDERS' : 'CHEST';
      }
      if (normalized.includes('plank') || normalized.includes('core') || normalized.includes('abs')) return 'CORE';
      return focusOf(selectedSession?.name ?? '', selectedIndex).toUpperCase();
    };
    const dayTitle = selectedSession
      ? localizeSessionName(selectedSession.name, language)
      : `Day ${selectedIndex + 1}`;
    const dayDuration = selectedSession?.guidance?.estimatedDuration ?? null;
    const dayExercises = selectedSession?.exercises ?? [];

    return (
      <Animated.View
        style={[
          styles.planReadyDayStage,
          {
            paddingTop: insets.top + spacing.lg,
            opacity: planReadyCardOpacity,
            transform: [{ translateX: planReadyCardTranslateX }],
          },
        ]}
      >
        <View style={styles.planReadyDayHeader}>
          <View style={styles.planReadyDayHeaderCopy}>
            {/* The weekday the reader picked, alongside "Day 2 of 3" — the
                split showed which session it was but never which day it
                lands on (user 2026-08-24). A weekday, not a date: the plan
                has no start date yet here, and a date would be invented. */}
            <Text style={styles.planReadyDayKicker}>
              {[
                t(language, 'onb.day.kicker', { index: selectedIndex + 1, count: dayCount }),
                selectedSession?.weekdayLabel,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
            <Text style={styles.planReadyDayTitle}>{dayTitle}</Text>
          </View>
          <View style={styles.planReadyDayWeekBadge}>
            <Text style={styles.planReadyDayWeekBadgeText}>
              {t(language, 'onb.day.week', { weeks: planReadyWeeks })}
            </Text>
          </View>
        </View>

        <View style={styles.planReadyDayMetaRow}>
          {dayDuration ? (
            <View style={styles.planReadyDayMetaItem}>
              <VinhaIcon name="tempo" color={C.textSoft} size={15} />
              <Text style={styles.planReadyDayMetaText}>{dayDuration}</Text>
            </View>
          ) : null}
          <View style={styles.planReadyDayMetaItem}>
            <VinhaIcon name="progress" color={C.textSoft} size={15} />
            <Text style={styles.planReadyDayMetaText}>{levelLabel}</Text>
          </View>
        </View>

        <Text style={styles.planReadyDayExercisesLabel}>
          {t(language, dayExercises.length === 1 ? 'onb.day.exerciseOne' : 'onb.day.exerciseMany', {
            count: dayExercises.length,
          })}
        </Text>
        <View style={styles.planReadyDayExerciseList}>
          {dayExercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.planReadyDayExerciseRow}>
              <Text style={styles.planReadyDayExerciseNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.planReadyDayExerciseCopy}>
                <Text style={styles.planReadyDayExerciseName} numberOfLines={1}>{exerciseNameLabel(language, exercise.name)}</Text>
                <Text style={styles.planReadyDayExerciseGroup}>{groupOf(exercise.name)}</Text>
              </View>
              <View style={styles.planReadyDayExerciseRight}>
                <Text style={styles.planReadyDayExerciseSets}>{exercise.setsLabel}</Text>
                <Text style={styles.planReadyDayExerciseReps}>{exercise.repsLabel}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  /**
   * The last step of onboarding is the Pro paywall (design: "GAINER Paywall
   * Sell"), in place of the automated-progression toggle that used to sit here.
   *
   * The toggle asked a free user to configure a feature they do not have:
   * `resolveProgressionOptions` gates it behind Pro, and the row even said
   * "(Pro)" with nothing on the screen to explain what Pro was. Selling it is
   * the honest version of the same moment. The preference itself still defaults
   * on and stays editable in plan settings for anyone who has Pro.
   */
  function renderPlanning() {
    const visibleFocusOptions = FOCUS_AREA_OPTIONS.filter((option) => option.area !== 'mobility');
    const flaggedFocusSelected = visibleFocusOptions.some(
      (option) => focusAreas.includes(option.area) && getFocusAreaCautionLevel(option.area, cautionFlags) !== null,
    );

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('planning', language),
      titleLines: [t(language, 'onb.stage.focus.title1'), t(language, 'onb.stage.focus.title2')],
      topPaneStyle: styles.focusAreaTopPane,
      topCopyStyle: styles.focusAreaTopCopy,
      titleStyle: styles.focusAreaHeadline,
      bottomStyle: styles.focusAreaBottomPane,
      children: (
        <View style={styles.focusAreaContent}>
          <View style={styles.focusListStack}>
            {visibleFocusOptions.map((option) => {
              const active = focusAreas.includes(option.area);
              const caution = getFocusAreaCautionLevel(option.area, cautionFlags);
              const cautionColors = caution ? CAUTION_LEVEL_COLORS[caution] : null;

              return (
                <Pressable
                  key={option.area}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${getFocusAreaLabel(option.area, language)}${
                    caution === 'avoid'
                      ? t(language, 'setup.a11y.flaggedAvoid')
                      : caution === 'careful'
                        ? t(language, 'setup.a11y.flaggedCareful')
                        : ''
                  }`}
                  onPress={() => {
                    void haptics.select();
                    toggleFocusArea(option.area);
                  }}
                  style={[
                    styles.focusListRow,
                    cautionColors && !active
                      ? { borderColor: cautionColors.ink, backgroundColor: cautionColors.soft }
                      : null,
                    active && styles.focusListRowActive,
                    // Flagged areas keep their caution colour when selected —
                    // purple would hide the warning the previous step set up.
                    active && cautionColors
                      ? {
                          backgroundColor: cautionColors.ink,
                          borderColor: cautionColors.ink,
                          shadowColor: cautionColors.ink,
                        }
                      : null,
                  ]}
                >
                  {cautionColors ? (
                    <CautionGlyph color={active ? '#FFFFFF' : cautionColors.ink} size={16} />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.focusListLabel,
                      cautionColors && !active ? { color: cautionColors.ink } : null,
                      active && styles.focusListLabelActive,
                    ]}
                  >
                    {getFocusAreaLabel(option.area, language)}
                  </Text>
                  <View style={[styles.focusListRadio, active && styles.focusListRadioActive]}>
                    {active ? (
                      <VinhaIcon name="check" size={12} color={cautionColors ? cautionColors.ink : C.primary} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {flaggedFocusSelected ? (
            <View style={styles.focusCautionNote}>
              <CautionGlyph color="#D97706" size={16} />
              <Text style={styles.focusCautionNoteText}>{t(language, 'onb.focusCaution')}</Text>
            </View>
          ) : (
            <Text style={styles.focusPickHint}>{t(language, 'onb.pickAreas')}</Text>
          )}
        </View>
      ),
    });
  }

  function renderRecommendation() {
    const recommendationPrimaryLabel = 'Open week';
    const recommendationSecondaryLabel = 'Open plan';
    const recommendationHeroTitle = formatWorkoutDisplayLabel(
      projectedSessions[0]?.name ?? recommendedProgram?.sessions?.[0]?.name ?? recommendedProgram?.name ?? 'Start here',
      'Workout',
    );
    const recommendationPlanLabel = recommendedProgram
      ? formatWorkoutDisplayLabel(recommendedProgram.name, 'Program')
      : '';
    const recommendationDurationLabel = recommendedProgram ? `${recommendedProgram.estimatedSessionDuration} min` : '';
    const recommendationPhoto = getFitnessPhotoVariant({
      title: recommendationHeroTitle,
      goal: selection.goal,
    });
    const visibleFitBadges = [
      ...tailoringBadgeLabels.slice(0, 2),
      ...secondaryOutcomeLabels.slice(0, 1),
      ...focusAreaLabels.slice(0, 1),
    ].slice(0, 3);
    const flowSessions = projectedSessions.slice(0, 3);
    const recommendationFlowItems = flowSessions.map((session, index) => ({
      id: session.id,
      day: projectedRhythm[index] ?? t(language, 'onb.flow.dayFallback', { index: index + 1 }),
      title: formatWorkoutDisplayLabel(session.name, 'Workout'),
      label:
        index === 0
          ? t(language, 'onb.flow.startHere')
          : index === flowSessions.length - 1
            ? t(language, 'onb.flow.finish')
            : t(language, 'onb.flow.then'),
    }));

    function renderRecommendationRefinementPanel() {
      if (activeRecommendationRefinement === 'schedule') {
        return (
          <View style={styles.refinementPanel}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleHeaderCopy}>
                <Text style={styles.scheduleTitle}>{t(language, 'onb.schedule.title')}</Text>
                <Text style={styles.scheduleBody}>{t(language, 'onb.schedule.body')}</Text>
              </View>
              <PreviewGlyph dayCount={projectedDaysPerWeek} />
            </View>

            <View style={styles.scheduleMiniRow}>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>{t(language, 'onb.schedule.currentRhythm')}</Text>
                <View style={styles.recommendationRhythmRow}>
                  {projectedRhythm.map((day) => (
                    <View key={day} style={styles.recommendationDayPill}>
                      <Text style={styles.recommendationDayText}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>{t(language, 'onb.schedule.time')}</Text>
                <Text style={styles.scheduleMiniValue}>~{effectiveWeeklyMinutes} min</Text>
                <Text style={styles.scheduleMiniMeta}>{scheduleModeLabel}</Text>
              </View>
            </View>

            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>{t(language, 'onb.schedule.style')}</Text>
              <View style={styles.choiceRow}>
                {SCHEDULE_MODE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.mode}
                    label={t(language, option.titleKey)}
                    active={scheduleMode === option.mode}
                    onPress={() => {
                      setScheduleMode(option.mode);
                      if (option.mode === 'app_managed') {
                        setAvailableDays([]);
                      }
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>{t(language, 'onb.schedule.weeklyTime')}</Text>
              <View style={styles.choiceRow}>
                {weeklyMinuteOptions.map((minutes) => (
                  <ChoiceChip
                    key={minutes}
                    label={`${minutes} min`}
                    active={effectiveWeeklyMinutes === minutes}
                    onPress={() => setWeeklyMinutes(minutes)}
                  />
                ))}
              </View>
            </View>

            {scheduleMode === 'self_managed' ? (
              <View style={styles.optionBlock}>
                <Text style={styles.optionLabel}>{t(language, 'onb.schedule.whichDays')}</Text>
                <View style={styles.choiceRow}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <ChoiceChip
                      key={day}
                      label={getWeekdayShortLabel(day, language)}
                      active={availableDays.includes(day)}
                      onPress={() => toggleAvailableDay(day)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={styles.personalizationHint}>{scheduleFitNote}</Text>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'focus') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>{t(language, 'onb.extra.title')}</Text>
            <Text style={styles.personalizationBody}>{t(language, 'onb.extra.body')}</Text>
            <View style={styles.personalizationGrid}>
              {REFINEMENT_FOCUS_AREA_OPTIONS.map((area) => {
                const active = focusAreas.includes(area);
                return (
                  <Pressable
                    key={area}
                    onPress={() => {
                      void haptics.select();
                      toggleFocusArea(area);
                    }}
                    style={[
                      styles.personalizationOption,
                      active && styles.personalizationOptionActive,
                    ]}
                  >
                    <Text style={[styles.personalizationOptionTitle, active && styles.personalizationOptionTitleActive]}>
                      {getFocusAreaTitle(area, language)}
                    </Text>
                    <Text style={styles.personalizationOptionBody}>{getFocusAreaDescription(area)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.personalizationHint}>
              {focusAreaSummary
                ? `Now: ${focusAreaSummary}`
                : 'Leave empty for default.'}
            </Text>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'custom') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.buildOwnKicker}>{t(language, 'onb.custom.kicker')}</Text>
            {/* These four shipped hardcoded in English on the last onboarding
                step of a Finnish app. */}
            <Text style={styles.buildOwnTitle}>
              {t(language, guidanceMode === 'self_directed' ? 'onb.custom.baseTitle' : 'onb.custom.ownTitle')}
            </Text>
            <Text style={styles.buildOwnBody}>
              {t(language, guidanceMode === 'self_directed' ? 'onb.custom.baseBody' : 'onb.custom.ownBody')}
            </Text>
            <Pressable
              onPress={() =>
                runAction(() =>
                  onCompleteToCustom(
                    selection,
                    activeRecommendedProgramId,
                    buildFirstRunCustomProgramName(selection, language),
                  ),
                )
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t(language, 'onb.custom.cta')}</Text>
            </Pressable>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'ai') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>{t(language, 'onb.ai.ask')}</Text>
            <Text style={styles.personalizationBody}>{t(language, 'onb.ai.askBody')}</Text>
            <Pressable
              onPress={() => openHelper(helperSuggestions[1] ?? helperSuggestions[0] ?? helperPrompt)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t(language, 'onb.ai.open')}</Text>
            </Pressable>
          </View>
        );
      }

      return null;
    }

    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>{editMode ? 'Setup' : 'Ready'}</Text>
          <Text style={styles.title}>{t(language, 'onb.startWeek.title')}</Text>
          <Text style={styles.body}>{t(language, 'onb.startWeek.body')}</Text>
        </View>

        {recommendedProgram ? (
          <View style={styles.recommendationCard}>
            <FitnessPhotoSurface variant={recommendationPhoto} style={styles.recommendationHeroSurface}>
              <View style={styles.recommendationHeroContent}>
                <View style={styles.recommendationBadgeCluster}>
                  <BadgePill label={levelLabel} accent="neutral" />
                  <BadgePill label={`${recommendedProgram.daysPerWeek} days`} accent="neutral" />
                </View>

                <View style={styles.recommendationHeroCopy}>
                  {recommendationPlanLabel ? <Text style={styles.recommendationHeroEyebrow}>{recommendationPlanLabel}</Text> : null}
                  <Text style={styles.recommendationHeroTitle}>{recommendationHeroTitle}</Text>
                  {recommendationDurationLabel ? <Text style={styles.recommendationHeroMeta}>Time {recommendationDurationLabel}</Text> : null}
                </View>
              </View>
            </FitnessPhotoSurface>

            <View style={styles.recommendationActions}>
              <Pressable
                onPress={() => runAction(() => onCompleteToTraining(selection, activeRecommendedProgramId))}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{recommendationPrimaryLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction(() => onCompleteToProgramDetail(selection, activeRecommendedProgramId))}
                style={styles.recommendationSecondaryButton}
              >
                <Text style={styles.recommendationSecondaryButtonText}>{recommendationSecondaryLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.recommendationTokenRow}>
              {visibleFitBadges.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
              <BadgePill label={`${effectiveWeeklyMinutes} min`} accent="neutral" />
            </View>

            {recommendationFlowItems.length ? (
              <View style={styles.recommendationFlowBlock}>
                <Text style={styles.recommendationSectionLabel}>{t(language, 'onb.preview.comingUp')}</Text>
                <View style={styles.recommendationSessionGrid}>
                  {recommendationFlowItems.map((session, index) => (
                    <React.Fragment key={session.id}>
                      <View style={styles.recommendationSessionCard}>
                        <View style={styles.recommendationSessionTopRow}>
                          <View style={styles.recommendationSessionDayPill}>
                            <Text style={styles.recommendationSessionDayText}>{session.day}</Text>
                          </View>
                          <Text style={styles.recommendationSessionLabel}>{session.label}</Text>
                        </View>
                        <Text style={styles.recommendationSessionTitle}>{session.title}</Text>
                      </View>
                      {index < recommendationFlowItems.length - 1 ? <Text style={styles.recommendationFlowConnector}>v</Text> : null}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.personalizationCard}>
          <Text style={styles.personalizationKicker}>{t(language, 'onb.tune.kicker')}</Text>
          <Text style={styles.personalizationTitle}>{t(language, 'onb.tune.title')}</Text>
          <Text style={styles.personalizationBody}>{t(language, 'onb.tune.body')}</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip
              label={t(language, 'planSet.week')}
              active={activeRecommendationRefinement === 'schedule'}
              onPress={() => toggleRecommendationRefinement('schedule')}
            />
            <ChoiceChip
              label={t(language, 'onb.focusLabel')}
              active={activeRecommendationRefinement === 'focus'}
              onPress={() => toggleRecommendationRefinement('focus')}
            />
            <ChoiceChip
              label={t(language, 'setup.guidance.own')}
              active={activeRecommendationRefinement === 'custom'}
              onPress={() => toggleRecommendationRefinement('custom')}
            />
            <ChoiceChip
              label={t(language, 'brand.coach')}
              active={activeRecommendationRefinement === 'ai'}
              onPress={() => toggleRecommendationRefinement('ai')}
            />
          </View>
          {activeRecommendationRefinement ? renderRecommendationRefinementPanel() : null}
        </SurfaceCard>

        <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))} style={styles.recommendationBackButton}>
          <Text style={styles.secondaryText}>{t(language, 'onb.backToSetup')}</Text>
        </Pressable>
      </View>
    );
  }

  function renderBuildingPlan() {
    const activePhaseIndex = Math.min(buildingPlanPhaseIndex, buildingPlanPhases.length - 1);

    return (
      <Animated.View style={[styles.buildingPlanScreen, { opacity: buildingPlanScreenOpacity }]}>
        {showBuildingPlanThinking ? (
          <Animated.View style={[styles.buildingPlanThinkingScene, { opacity: buildingPlanThinkingOpacity }]}>
            <View style={styles.buildingPlanThinkingCenter}>
              {/* The fade rides a View, not the Text.

                  It was on the Text, whose children then had to change every
                  ellipsis tick — animated props on a subtree that relays four
                  times a second, in the same mount batch as the phase change
                  that was already racing. The wrapper never reflows, so the
                  caption's node has nothing to collide with. */}
              <Animated.View style={{ opacity: buildingPlanCaptionOpacity }}>
                <Text style={styles.buildingPlanThinkingText}>
                  {buildingPlanComplete ? (
                    t(language, 'onb.building.ready')
                  ) : (
                    <>
                      {t(language, 'onb.building.title')}
                      {/* All three dots hold their width from the first frame;
                          the unlit ones are painted transparent. Appending
                          1–3 real dots changed the line's width every tick,
                          and on a narrow phone the title bounced between one
                          and two lines (user 2026-08-23). */}
                      <Text>.</Text>
                      <Text style={buildingPlanEllipsisStep >= 1 ? null : styles.buildingPlanDotHidden}>.</Text>
                      <Text style={buildingPlanEllipsisStep >= 2 ? null : styles.buildingPlanDotHidden}>.</Text>
                    </>
                  )}
                </Text>
              </Animated.View>

              <View style={styles.buildingPlanProgressBlock}>
                <View style={styles.buildingPlanProgressTrack}>
                  <View style={[styles.buildingPlanProgressFill, { width: `${buildingPlanPercent}%` }]} />
                </View>
                <Text style={styles.buildingPlanPercentText}>{`${buildingPlanPercent}%`}</Text>
              </View>

              <View style={styles.buildingPlanStepList}>
                {buildingPlanPhases.map((label, index) => {
                  const completed = index < activePhaseIndex;
                  const active = index === activePhaseIndex;
                  const activeSubtitle = buildingPlanStepSubtitles[index];

                  return (
                    <Animated.View
                      key={label}
                      style={[
                        styles.buildingPlanStepRow,
                        active && styles.buildingPlanStepRowActive,
                        // This row's own node — never the one next door's.
                        active && { opacity: buildingPlanPulseOpacities[index] },
                      ]}
                    >
                      <View
                        style={[
                          styles.buildingPlanStepIcon,
                          completed && styles.buildingPlanStepIconDone,
                          active && styles.buildingPlanStepIconActive,
                        ]}
                      >
                        {completed ? (
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 12.4 9.2 17.6 20 6.8" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        ) : active ? (
                          <Animated.View
                            style={[
                              styles.buildingPlanStepActiveDot,
                              { transform: [{ scale: buildingPlanPulseScales[index] }] },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={styles.buildingPlanStepCopy}>
                        <Text style={[styles.buildingPlanStepText, !completed && !active && styles.buildingPlanStepTextPending]}>
                          {label}
                        </Text>
                        {active && activeSubtitle ? (
                          <Text style={styles.buildingPlanStepSubtitle}>{activeSubtitle}</Text>
                        ) : null}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  }

  const canContinue =
    stage === 'location'
      ? selectedLocationOptionId !== null
      : stage === 'goal'
      ? goals.length > 0
      : stage === 'level'
      ? profileLevelSelected
      : stage === 'days'
      ? // The recommendation counts as an answer: the screen shows it as the
        // selection, so requiring a tap to confirm what is already on screen
        // is a disabled button with no stated reason.
        true
      : stage === 'planning'
      ? focusAreas.length > 0
      : true;
  const locationStageActive =
    stage === 'location' ||
    stage === 'goal' ||
    stage === 'level' ||
    stage === 'days' ||
    stage === 'avoid' ||
    stage === 'planning';
  const standaloneProgressHidden = locationStageActive || stage === 'review';
  const footerPrimaryLabel =
    stage === 'review' && busy
      ? t(language, 'onb.cta.saving')
      : stage === 'review'
      ? planReadyView === 'day'
        ? // "Seuraava" walks the days forward; the chevron walks them back
          // (user 2026-08-23). Only the last day's button returns to the plan.
          planReadyWorkoutPage < projectedSessions.length - 1
          ? t(language, 'common.next')
          : t(language, 'onb.cta.backToPlan')
        : // The overview's button is the last one in onboarding now that the
          // paywall no longer follows it, so it says what it does.
          t(language, 'onb.cta.startTraining')
      : stage === 'planning'
      ? t(language, 'onb.cta.buildPlan')
      : stage === 'avoid'
      ? cautionFlags.length > 0
        ? t(language, 'common.continue')
        : t(language, 'onb.cta.skip')
      : t(language, 'common.continue');
  // The programme picker is full-bleed and carries its own pinned CTA, so the
  // shared footer would stack a second pair of buttons under it. The day view
  // does use the shared footer, which is what walks through the days.
  const footerVisible = !(stage === 'review' && planReadyView === 'overview');
  const scrollLockedStage = stage === 'level' || stage === 'days';
  // Steps 1-2 (location/goal) scroll so an expanded benefits panel or a
  // wrapped chip row stays reachable above the footer, but they should not
  // rubber-band when the cards already fit the viewport.
  const allowScrollBounce = !scrollLockedStage && stage !== 'location' && stage !== 'goal';
  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      {
        paddingTop: stage === 'review' || locationStageActive ? 0 : spacing.xxl,
        paddingBottom: (footerVisible ? spacing.xxl : spacing.xl) + insets.bottom,
      },
    ],
    [footerVisible, insets.bottom, locationStageActive, stage],
  );

  if (isBuildingPlan) {
    return renderBuildingPlan();
  }

  // The picker is a full-screen surface with its own scroll and its own
  // pinned CTA, so it cannot live inside the onboarding's ScrollView: a flex:1
  // child of a scroll container collapses to content height, and the footer
  // anchored to it ends up somewhere down the page instead of on the screen.
  const fullBleedReview = stage === 'review' && planReadyView === 'overview';
  if (fullBleedReview) {
    return renderReview();
  }

  // One back control, top-left, like every other screen — the footer link it
  // replaces is below. Where it goes is the same decision the link made.
  const goBack = () => {
    if (stage === 'review') {
      if (planReadyView === 'day') {
        // Backward through the days, then out to the plan. This used to fall
        // through to the questionnaire: one tap on the chevron from a day
        // view landed on the focus step and the review had to be rebuilt
        // (user 2026-08-23, "iso virhe").
        if (planReadyWorkoutPage > 0) {
          setPlanReadyWorkoutPage((current) => current - 1);
          return;
        }
        setPlanReadyView('overview');
        return;
      }
      setStageIndex(getStageIndex('planning'));
      return;
    }
    if (stage === 'location') {
      if (editMode) {
        void runAction(() => onCancel?.());
      } else {
        void runAction(onBackToEntry ?? onSkip);
      }
      return;
    }
    setStageIndex((current) => Math.max(0, current - 1));
  };

  return (
    <View style={[styles.root, styles.rootLight]}>
      {locationStageActive ? <View pointerEvents="none" style={[styles.locationTopSafeArea, { height: insets.top }]} /> : null}
      <OnboardingBackButton language={language} onPress={goBack} disabled={busy} />
      <ScrollView
        key={stage}
        ref={onboardingScrollRef}
        style={[
          styles.scrollView,
          styles.scrollViewLight,
        ]}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!scrollLockedStage}
        bounces={allowScrollBounce}
        alwaysBounceVertical={allowScrollBounce}
        overScrollMode={allowScrollBounce ? 'auto' : 'never'}
        keyboardShouldPersistTaps="handled"
      >
        {standaloneProgressHidden ? null : <StepDots index={stageIndex} light />}

        {stage === 'location' ? renderLocation() : null}
        {stage === 'goal' ? renderGoal() : null}
        {stage === 'level' ? renderLevel() : null}
        {stage === 'days' ? renderDays() : null}
        {stage === 'avoid' ? renderAvoid() : null}
        {stage === 'planning' ? renderPlanning() : null}
        {stage === 'review' ? renderReview() : null}
      </ScrollView>

      {footerVisible ? (
        <View
          style={[
            styles.footer,
            styles.footerLight,
            locationStageActive && styles.locationFooter,
            stage === 'review' && styles.planReadyFixedFooter,
            {
              // Every questionnaire step carries a "Takaisin" link under the
              // CTA, and at spacing.xs it sat a few pixels above the system
              // navigation bar — reachable, but a thumb aiming for it hits the
              // bar instead. The review stage has no link under its button and
              // keeps the tight value.
              //
              // locationStageActive is ALL SIX questionnaire steps, not just
              // the location one: it is the shell they share. Raising the
              // OTHER branch, as the first attempt did, changed nothing at all
              // because no stage reaches it.
              paddingBottom: stage === 'review'
                ? insets.bottom + spacing.xs
                : insets.bottom + spacing.lg,
            },
          ]}
        >
          <>
            <PrimaryCTAButton
              title={footerPrimaryLabel}
              onPress={() => {
                if (!canContinue || busy) {
                  return;
                }

                if (stage === 'location') {
                  void haptics.success();
                  setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
                  return;
                }

                if (stage === 'goal') {
                  void haptics.success();
                  setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
                  return;
                }

                if (stage === 'planning') {
                  void haptics.impactMedium();
                  setIsBuildingPlan(true);
                  return;
                }

                if (stage === 'review') {
                  void haptics.success();
                  if (planReadyView === 'day') {
                    if (planReadyWorkoutPage < projectedSessions.length - 1) {
                      setPlanReadyWorkoutPage((current) => current + 1);
                      return;
                    }
                    setPlanReadyView('overview');
                    return;
                  }
                  // The overview IS the end of onboarding now: the paywall
                  // that used to sit between it and the app is gone (user
                  // 2026-08-24).
                  void runAction(() => onCompleteToTraining(selection, activeRecommendedProgramId));
                  return;
                }

                setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
              }}
              disabled={!canContinue || busy}
              style={styles.onboardingPrimaryCTA}
            />

            {/* The "Takaisin" link that sat here moved to the top-left chevron. */}
          </>
          {busy ? <ActivityIndicator color={C.text} size="small" /> : null}
        </View>
      ) : null}

      <Modal visible={helperVisible} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setHelperVisible(false)} />
          </View>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetKicker}>{t(language, 'onb.ai.brand')}</Text>
        <Text style={styles.sheetTitle}>{t(language, 'onb.ai.ask')}</Text>
              </View>
              <Pressable onPress={() => setHelperVisible(false)}>
                <Text style={styles.sheetClose}>{t(language, 'onb.ai.close')}</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetBody}>{t(language, 'onb.ai.prompt')}</Text>

            <TextInput
              value={helperDraft}
              onChangeText={setHelperDraft}
              placeholder={t(language, 'onb.ai.placeholder')}
              placeholderTextColor={colors.textMuted}
              selectionColor="#F3F7FF"
              multiline
              textAlignVertical="top"
              style={styles.sheetInput}
            />

            <View style={styles.sheetSuggestionRow}>
              {helperSuggestions.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setHelperDraft(suggestion)} style={styles.sheetSuggestionChip}>
                  <Text style={styles.sheetSuggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={askAiCoach} style={[styles.primaryButton, !helperDraft.trim() && styles.buttonDisabled]}>
          <Text style={styles.primaryButtonText}>{t(language, 'onb.ai.send')}</Text>
            </Pressable>

            {helperState === 'loading' ? (
              <View style={styles.helperStatusBlock}>
                <ActivityIndicator color="#F3F7FF" size="small" />
                <Text style={styles.helperStatusText}>{t(language, 'onb.ai.answering')}</Text>
              </View>
            ) : null}

            {helperState === 'error' ? <Text style={styles.helperErrorText}>{helperError}</Text> : null}

            {helperState === 'ready' && helperAnswer ? (
              <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent} showsVerticalScrollIndicator={false}>
                <View style={styles.answerHeaderRow}>
                  <Text style={styles.answerSection}>{t(language, 'onb.ai.answer')}</Text>
                  <BadgePill label={t(language, helperSource === 'live' ? 'onb.ai.live' : 'onb.ai.preview')} accent="neutral" />
                </View>
                {helperNote ? <Text style={styles.answerNote}>{helperNote}</Text> : null}

                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>{t(language, 'onb.ai.answer')}</Text>
                  <Text style={styles.answerText}>{helperAnswer.takeaway}</Text>
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>{t(language, 'onb.ai.why')}</Text>
                  {helperAnswer.why.map((item) => (
                    <Text key={item} style={styles.answerBullet}>- {item}</Text>
                  ))}
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>{t(language, 'onb.ai.doNext')}</Text>
                  {helperAnswer.nextSteps.map((item) => (
                    <Text key={item} style={styles.answerBullet}>- {item}</Text>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Built once per palette at module load, not per render.
 *
 * Two StyleSheets rather than a `useThemedStyles` factory because this sheet
 * is ~2200 entries: registering it on every theme read would be the most
 * expensive thing on the screen, and there are exactly two possible answers.
 */
const makeOnboardingStyles = (C: OnbPalette) => StyleSheet.create({
  root: {
    flex: 1,
  },
  rootLight: {
    backgroundColor: C.panel,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewLight: {
    backgroundColor: C.panel,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
  },
  // Level with the back chevron: the shell starts at the safe-area edge, the
  // chevron circle is 40 tall at top 10, and the bar centers on that height
  // to the chevron's right.
  locationProgressBarWrap: {
    position: 'absolute',
    top: 10,
    left: 70,
    right: spacing.lg,
    height: 40,
    zIndex: 3,
    justifyContent: 'center',
  },
  dot: {
    flex: 1,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: C.trackIdle,
  },
  dotLight: {
    backgroundColor: C.trackIdle,
  },
  dotActive: {
    backgroundColor: C.primary,
  },
  dotActiveLight: {
    backgroundColor: C.primary,
  },
  stageBody: {
    gap: spacing.lg,
  },
  locationStageShell: {
    backgroundColor: C.panel,
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
  },
  locationTopSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.panel,
    zIndex: 10,
  },
  locationTopPane: {
    backgroundColor: C.panel,
    // The back chevron sits in the corner above this pane (40 tall + its gap).
    // Every stage's bar and title used to start level with it once the footer
    // "Takaisin" link moved up there; the whole pane steps down instead, so no
    // stage needs its own offset.
    marginTop: 48,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg * 2,
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: 30,
    overflow: 'visible',
    position: 'relative',
  },
  locationTopPaneCompact: {
    paddingBottom: 28,
  },
  locationEquipmentTopPane: {
    justifyContent: 'flex-start',
    // 206 with the copy pushed 58 down, when the progress bar lived inside
    // this pane. The bar moved up to the chevron row; the freed band goes to
    // the option list below, which is the part that clipped on short phones.
    height: 168,
    paddingTop: 36,
    paddingBottom: 12,
  },
  locationTopSlope: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: -36,
    height: 72,
    backgroundColor: C.panel,
    transform: [{ rotate: '-4deg' }],
  },
  locationTopCopy: {
    gap: 3,
    zIndex: 1,
    paddingBottom: 8,
  },
  locationTopCopyCompact: {
    paddingBottom: 12,
  },
  locationEquipmentTopCopy: {
    paddingTop: 12,
    paddingBottom: 0,
    gap: 2,
  },
  locationStepLabel: {
    color: C.primary,
    fontSize: 12.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.75,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  locationStepLabelSolid: {
    color: '#FFFFFF',
  },
  locationHeadline: {
    color: C.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.56,
  },
  locationHeadlineLarge: {
    fontSize: 28,
    lineHeight: 32,
    maxWidth: 220,
  },
  locationEquipmentHeadline: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
  },
  locationBottomPane: {
    backgroundColor: C.panel,
    paddingHorizontal: spacing.lg * 2 - 14,
    paddingTop: 0,
  },
  locationBottomPaneTight: {
    paddingTop: 6,
  },
  locationCardList: {
    gap: 7,
  },
  locationCardListCompact: {
    gap: 8,
  },
  equipmentExpandedCard: {
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: C.borderActive,
    borderRadius: 18,
    padding: 16,
  },
  equipmentExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  equipmentExpandedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  equipmentExpandedTitle: {
    color: C.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  equipmentExpandedCount: {
    color: C.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  equipmentExpandedCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.primary,
    borderWidth: 1.5,
    borderColor: '#5B21B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentChipsPrompt: {
    color: C.textSoft,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  equipmentChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  equipmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  equipmentChipActive: {
    borderColor: C.borderActive,
    backgroundColor: C.cardActive,
  },
  equipmentChipText: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  equipmentChipTextActive: {
    color: '#5B21B6',
    fontWeight: '800',
  },
  equipmentOrChooseLabel: {
    color: C.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  levelStageContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  levelLogoWrap: {
    width: LEVEL_FIELD_WIDTH,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    // The bars sweep in from outside the box; without this they cross the
    // whole screen instead of the mark.
    overflow: 'hidden',
  },
  levelLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  levelStreak: {
    position: 'absolute',
    left: 0,
    borderRadius: 999,
  },
  levelCopyBlock: {
    alignItems: 'center',
    gap: 3,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  levelTitle: {
    color: C.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  levelLine: {
    color: C.textSoft,
    fontSize: 13.5,
    lineHeight: 18.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  levelSliderTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: C.sliderTrack,
    borderRadius: 999,
    padding: 4,
    marginTop: 22,
    position: 'relative',
  },
  levelSliderThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  levelSliderSegment: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  /**
   * Until a level is picked there is no filled thumb, and three flat grey
   * labels on a pale track read as a disabled control — the screen looked like
   * nothing on it could be tapped. Unpicked segments now carry their own pill
   * so the choice looks like three buttons, which is what it is.
   */
  levelSliderSegmentIdle: {
    backgroundColor: C.card,
    marginHorizontal: 2,
  },
  levelSliderLabel: {
    color: C.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  levelSliderLabelActive: {
    color: '#FFFFFF',
  },
  levelSliderHint: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  levelYearsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    marginTop: 7,
  },
  levelYearsText: {
    flex: 1,
    color: C.textMuted,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  levelYearsTextActive: {
    color: C.primary,
    fontWeight: '800',
  },
  daysChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  daysChipColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  daysChip: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysChipActive: {
    borderColor: C.primary,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  daysChipText: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
  },
  daysChipTextActive: {
    color: '#FFFFFF',
  },
  daysChipRecommended: {
    borderColor: '#C9B6FF',
    backgroundColor: C.primarySoft,
  },
  daysChipCaption: {
    color: C.primary,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  daysWeekLabel: {
    color: C.text,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  daysWeekRow: {
    flexDirection: 'row',
    gap: 6,
  },
  daysWeekCell: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysWeekCellActive: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  daysWeekCellText: {
    color: C.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  daysWeekCellTextActive: {
    color: '#FFFFFF',
  },
  daysSummaryLine: {
    color: C.textSoft,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  daysCycleLabel: {
    color: C.text,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  daysCycleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  daysCycleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  daysCycleChipActive: {
    borderColor: C.borderActive,
    backgroundColor: C.cardActive,
  },
  daysCycleChipText: {
    color: C.textSoft,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  // Was a hardcoded #5B21B6 — dark violet on cardActive, and in the dark
  // theme cardActive IS dark violet (#2C2350), so the chosen preset read as
  // a blank pill (user 2026-08-31: "on vaikea nähdä mitään tausta liian
  // tumma"). The token knows which theme it is in; the literal did not.
  daysCycleChipTextActive: {
    color: C.primary,
    fontWeight: '800',
  },
  daysRecommendHint: {
    color: C.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  avoidList: {
    gap: 8,
  },
  avoidAdvisoryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avoidAdvisoryText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  avoidRow: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  avoidRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  avoidRowTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.neutralTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  avoidRowTitle: {
    color: C.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  avoidRowLevel: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
  },
  avoidRowRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidRowDetail: {
    paddingHorizontal: 13,
    paddingBottom: 13,
    gap: 10,
  },
  avoidLevelList: {
    gap: 7,
  },
  avoidLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  avoidLevelRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidLevelCopy: {
    flex: 1,
    minWidth: 0,
  },
  avoidLevelTitle: {
    color: C.text,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  avoidLevelBody: {
    color: C.textSoft,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  avoidGhostRow: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  avoidGhostText: {
    color: C.textSoft,
    fontSize: 13.5,
    fontWeight: '700',
  },
  focusListStack: {
    gap: 6,
  },
  focusListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  focusListRowActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  focusListLabel: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  focusListLabelActive: {
    color: '#FFFFFF',
  },
  focusListRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9B6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusListRadioActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  locationStepTwoOptionsShift: {
    marginBottom: 18,
    transform: [{ translateY: -2 }],
  },
  locationCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  locationCardGridItem: {
    width: '47.6%',
  },
  trainingProfileTopPane: {
    height: 112,
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingBottom: 8,
  },
  trainingProfileTopCopy: {
    paddingTop: 12,
    paddingBottom: 0,
    gap: 3,
  },
  trainingProfileHeadline: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
  },
  trainingProfileBottomPane: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  trainingProfileContent: {
    gap: 14,
  },
  trainingSetupMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  trainingSetupMetricText: {
    flex: 1,
    color: C.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  locationChoicePressable: {
    width: '100%',
    padding: 2,
    position: 'relative',
  },
  locationChoiceCard: {
    minHeight: 74,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  locationChoiceCardCompact: {
    minHeight: 54,
    paddingVertical: 7,
  },
  locationChoiceCardRoomy: {
    minHeight: 100,
    paddingVertical: 14,
  },
  locationChoiceCardTall: {
    minHeight: 142,
    paddingVertical: 22,
  },
  locationChoiceCardActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  locationChoiceActiveOutline: {
    // The design's selected card needs no extra outline overlay.
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  locationChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  locationChoiceCopy: {
    flex: 1,
    gap: 2,
    marginLeft: 10,
  },
  locationChoiceCopyNoIcon: {
    marginLeft: 12,
  },
  locationChoiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  locationChoiceLabel: {
    color: C.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  locationChoiceLabelActive: {
    color: '#FFFFFF',
  },
  locationFocusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  locationFocusBadgeNeutral: {
    backgroundColor: C.badgeNeutral,
  },
  locationFocusBadgeGreen: {
    backgroundColor: '#E8F7EE',
  },
  locationFocusBadgeBlue: {
    backgroundColor: C.badgeBlue,
  },
  locationFocusBadgePurple: {
    backgroundColor: C.badgePurple,
  },
  locationFocusBadgeText: {
    fontSize: 10.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.42,
    textTransform: 'uppercase',
  },
  locationFocusBadgeTextNeutral: {
    color: C.textSoft,
  },
  locationFocusBadgeTextGreen: {
    color: '#16A34A',
  },
  locationFocusBadgeTextBlue: {
    color: '#0A84FF',
  },
  locationFocusBadgeTextPurple: {
    color: C.primary,
  },
  locationFocusBadgeOnActive: {
    backgroundColor: '#FFFFFF',
  },
  locationFocusBadgeTextOnActive: {
    color: '#5B21B6',
  },
  locationFocusBadgeChipOnActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  locationFocusBadgeChipTextOnActive: {
    color: '#FFFFFF',
  },
  locationChoiceSubtitle: {
    color: C.textSoft,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  locationChoiceSubtitleActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  locationChoiceTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  locationChoiceRadio: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#C9B6FF',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  locationChoiceRadioLeading: {
    marginLeft: 0,
    marginRight: 0,
    borderColor: '#C9B6FF',
  },
  locationChoiceRadioActive: {
    borderColor: '#5B21B6',
    backgroundColor: '#FFFFFF',
  },
  heroBlock: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  profileCheckRow: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: C.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileCheckRowActive: {
    borderColor: C.inkStrong,
    backgroundColor: C.rowActive,
  },
  profileCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.24)',
    backgroundColor: C.card,
  },
  profileCheckBoxActive: {
    borderColor: C.inkStrong,
    backgroundColor: C.inkStrong,
  },
  profileCheckMark: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: C.onInkStrong,
  },
  profileCheckMarkShort: {
    width: 7,
    left: 5,
    top: 12,
    transform: [{ rotate: '45deg' }],
  },
  profileCheckMarkLong: {
    width: 12,
    left: 10,
    top: 10,
    transform: [{ rotate: '-45deg' }],
  },
  profileCheckCopy: {
    flex: 1,
    gap: 4,
  },
  profileCheckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  profileCheckTitle: {
    flexShrink: 1,
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  profileCheckTitleActive: {
    color: C.text,
  },
  profileCheckDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  profileCheckMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileCheckDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(6,8,11,0.22)',
  },
  profileCheckDotActive: {
    backgroundColor: C.inkStrong,
  },
  profileCheckBadge: {
    minHeight: 20,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: C.card,
    justifyContent: 'center',
  },
  profileCheckBadgeActive: {
    borderColor: C.inkStrong,
    backgroundColor: C.inkStrong,
  },
  profileCheckBadgeText: {
    color: 'rgba(6,8,11,0.62)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileCheckBadgeTextActive: {
    color: C.onInkStrong,
  },
  profileCheckBody: {
    color: 'rgba(6,8,11,0.56)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  profileCheckBodyActive: {
    color: 'rgba(6,8,11,0.66)',
  },
  // Matched to the equipment step, which is the same shell with room in it.
  // The 58px copy offset died with the in-pane progress bar (it existed so
  // "VAIHE 6/6" would not sit on the bar's last segment).
  focusAreaTopPane: {
    height: 178,
    justifyContent: 'flex-start',
    paddingTop: 36,
    paddingBottom: 8,
  },
  focusAreaTopCopy: {
    paddingTop: 12,
    paddingBottom: 0,
    gap: 3,
  },
  focusAreaHeadline: {
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  focusAreaBottomPane: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  focusAreaContent: {
    gap: 6,
  },
  focusPickHint: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  focusCautionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 2,
  },
  focusCautionNoteText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  buildingPlanScreen: {
    flex: 1,
    backgroundColor: C.panel,
  },
  buildingPlanThinkingScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.panel,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 96,
  },
  buildingPlanThinkingCenter: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  buildingPlanProgressBlock: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  buildingPlanProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: C.trackIdle,
    overflow: 'hidden',
  },
  buildingPlanProgressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: C.primary,
  },
  buildingPlanPercentText: {
    color: C.primary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  buildingPlanThinkingText: {
    color: C.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.56,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 22,
    minHeight: 34,
  },
  buildingPlanDotHidden: {
    color: 'transparent',
  },
  buildingPlanStepList: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 10,
  },
  buildingPlanStepRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buildingPlanStepRowActive: {
    backgroundColor: C.primarySoft,
  },
  buildingPlanStepIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingPlanStepIconDone: {
    borderWidth: 0,
    backgroundColor: C.primary,
  },
  buildingPlanStepIconActive: {
    borderColor: C.primary,
    backgroundColor: C.primarySoft,
  },
  buildingPlanStepActiveDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.primary,
  },
  buildingPlanStepCopy: {
    flex: 1,
    gap: 3,
  },
  buildingPlanStepText: {
    color: C.text,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  buildingPlanStepSubtitle: {
    color: C.textSoft,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  buildingPlanStepTextPending: {
    color: C.textSoft,
    fontWeight: '600',
  },
  optionBlock: {
    gap: spacing.sm,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setupOptionCard: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  setupOptionCardCompact: {
    minHeight: 164,
  },
  setupOptionCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  setupOptionCardContentCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 4,
    justifyContent: 'flex-end',
  },
  setupOptionCardActive: {
    backgroundColor: C.cardActive,
    borderColor: C.borderActive,
  },
  setupOptionCardImage: {
    overflow: 'hidden',
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIcon: {
    minHeight: 188,
    overflow: 'hidden',
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIconActive: {
    borderColor: C.borderActive,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  setupOptionCardIconContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  setupOptionCardFigureContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  setupOptionCardFigureThumb: {
    position: 'relative',
    width: '100%',
    height: 132,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  setupOptionCardFigureImage: {
    width: '100%',
    height: '100%',
  },
  setupOptionCardFigureVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  setupOptionCardFigureCopy: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  setupOptionCardFigureTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  setupOptionCardIconCopy: {
    gap: spacing.xs,
  },
  setupOptionCardIconThumb: {
    position: 'relative',
    marginTop: spacing.xs,
    width: '100%',
    height: 110,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupOptionCardIconThumbActive: {
    borderColor: 'rgba(243,247,255,0.92)',
    backgroundColor: '#050505',
  },
  setupOptionCardIconImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  setupOptionCardIconShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  setupOptionCardIconGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243,247,255,0.16)',
  },
  setupOptionCardIconPaint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243,247,255,0.12)',
  },
  setupOptionCardIconRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(243,247,255,0.78)',
  },
  setupOptionCardSelectionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: C.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  setupOptionCardSelectionCheck: {
    width: 12,
    height: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupOptionCardSelectionCheckMark: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: C.text,
  },
  setupOptionCardSelectionCheckMarkShort: {
    width: 5,
    left: 1,
    top: 7,
    transform: [{ rotate: '45deg' }],
  },
  setupOptionCardSelectionCheckMarkLong: {
    width: 9,
    left: 3,
    top: 5,
    transform: [{ rotate: '-45deg' }],
  },
  setupOptionCardImageActive: {
    borderColor: C.borderActive,
  },
  setupOptionCardImageSurface: {
    overflow: 'hidden',
    position: 'relative',
    minHeight: 112,
    justifyContent: 'flex-end',
  },
  setupOptionCardImageAsset: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  setupOptionCardImageSurfaceCompact: {
    minHeight: 164,
  },
  setupOptionCardImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,11,0.34)',
  },
  setupOptionCardTitle: {
    color: C.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  setupOptionCardTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  setupOptionCardTitleActive: {
    color: '#FFFFFF',
  },
  setupOptionCardTitleOnImage: {
    color: '#FFFFFF',
  },
  setupOptionCardBody: {
    color: C.textSoft,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  setupOptionCardBodyCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  setupOptionCardBodyActive: {
    color: '#FFFFFF',
  },
  setupOptionCardBodyOnImage: {
    color: '#FFFFFF',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  choiceChipActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  choiceChipTextActive: {
    color: colors.textPrimary,
  },
  previewCard: {
    gap: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  previewHeaderAside: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  previewHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  previewBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  previewGlyph: {
    width: 78,
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  previewGlyphBar: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: C.previewBar,
  },
  previewGlyphGap: {
    flex: 1,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewSectionBlock: {
    gap: spacing.sm,
  },
  previewSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewRhythmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewDayPill: {
    minWidth: 54,
    minHeight: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewDayText: {
    color: '#F4FAFF',
    fontSize: 12,
    fontWeight: '900',
  },
  previewSessionList: {
    gap: spacing.sm,
  },
  previewSessionRow: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  previewSessionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  previewSessionBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  previewNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  previewSupportText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  recommendationCard: {
    gap: spacing.sm,
  },
  recommendationBadgeCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationTokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationHeroSurface: {
    minHeight: 284,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recommendationHeroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  recommendationHeroCopy: {
    gap: spacing.sm,
  },
  recommendationHeroEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationHeroTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.3,
    maxWidth: '82%',
  },
  recommendationHeroMeta: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    opacity: 0.92,
  },
  recommendationSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationFlowBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  recommendationRhythmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationDayPill: {
    minWidth: 44,
    minHeight: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recommendationDayText: {
    color: '#F4FAFF',
    fontSize: 11,
    fontWeight: '900',
  },
  recommendationSessionGrid: {
    gap: spacing.sm,
  },
  recommendationSessionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15, 18, 23, 0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  recommendationSessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recommendationSessionDayPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  recommendationSessionDayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  recommendationSessionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationSessionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  recommendationFlowConnector: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  recommendationActions: {
    gap: spacing.sm,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scheduleHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  scheduleTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scheduleBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  scheduleMiniRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scheduleMiniCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  scheduleMiniLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  scheduleMiniValue: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scheduleMiniMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  personalizationCard: {
    gap: spacing.sm,
  },
  refinementPanel: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  personalizationKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  personalizationTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  personalizationBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  personalizationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  personalizationOption: {
    width: '48%',
    minHeight: 94,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 19, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  personalizationOptionActive: {
    borderColor: C.optionActive,
    backgroundColor: C.optionActive,
  },
  personalizationOptionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  personalizationOptionTitleActive: {
    color: C.onOptionActive,
  },
  personalizationOptionBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  personalizationHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  buildOwnKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buildOwnTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  buildOwnBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: 32,
    gap: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerLight: {
    backgroundColor: C.panel,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  locationFooter: {
    paddingTop: 32,
    transform: [{ translateY: 0 }],
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  planReadyDayStage: {
    paddingBottom: spacing.lg,
  },
  planReadyDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planReadyDayHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  planReadyDayKicker: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: C.primary,
  },
  planReadyDayTitle: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.25,
    color: C.text,
  },
  planReadyDayWeekBadge: {
    backgroundColor: C.cardActive,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  planReadyDayWeekBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    // Same pair as equipmentChipTextActive: a literal on C.cardActive.
    color: C.primary,
  },
  planReadyDayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  planReadyDayMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planReadyDayMetaText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSoft,
  },
  planReadyDayExercisesLabel: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: C.textSoft,
  },
  planReadyDayExerciseList: {
    gap: 8,
  },
  planReadyDayExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  planReadyDayExerciseNumber: {
    width: 20,
    fontSize: 13,
    fontWeight: '800',
    color: C.primary,
  },
  planReadyDayExerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  planReadyDayExerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  planReadyDayExerciseGroup: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.66,
    color: C.textSoft,
    textTransform: 'uppercase',
  },
  planReadyDayExerciseRight: {
    alignItems: 'flex-end',
  },
  planReadyDayExerciseSets: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  planReadyDayExerciseReps: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    color: C.textSoft,
  },
  planReadyFixedFooter: {
    backgroundColor: C.panel,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 32,
    alignItems: 'center',
    gap: 16,
  },
  onboardingPrimaryCTA: {
    width: '100%',
    maxWidth: 360,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonText: {
    color: C.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  recommendationSecondaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    paddingHorizontal: spacing.md,
  },
  recommendationSecondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryTextDark: {
    color: C.textSoft,
  },
  footerBackText: {
    opacity: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  recommendationBackButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    margin: spacing.lg,
    maxHeight: '82%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12, 16, 21, 0.97)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sheetKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  sheetClose: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  sheetInput: {
    minHeight: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  sheetSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sheetSuggestionChip: {
    minHeight: 30,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sheetSuggestionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  helperStatusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  helperStatusText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  helperErrorText: {
    color: '#FFD9C8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  answerScroll: {
    maxHeight: 320,
  },
  answerContent: {
    gap: spacing.sm,
  },
  answerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  answerSection: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  answerNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  answerBlock: {
    gap: 4,
  },
  answerTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  answerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  answerBullet: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});

const ONBOARDING_STYLES = {
  light: makeOnboardingStyles(ONB_LIGHT),
  dark: makeOnboardingStyles(ONB_DARK),
} as const;

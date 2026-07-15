import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { BadgePill, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { GymlogIcon, GymlogIconName } from '../components/GymlogIcon';
import { OnboardingOptionIcon, OnboardingOptionIconName } from '../components/OnboardingOptionIcon';
import { PrimaryCTAButton } from '../components/PrimaryCTAButton';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { convertWeightToKg, formatWeight, formatWeightInputValue, parseNumberInput } from '../lib/format';
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
} from '../lib/firstRunSetup';
import { buildRecommendationTradeoffLabel } from '../lib/recommendationExplanation';
import { buildRecommendationOptionIds } from '../lib/recommendationPresentation';
import { buildRecommendationPlanReadyPayload } from '../lib/recommendationProgramme';
import { buildSessionGuidance } from '../lib/sessionGuidance';
import { getOnboardingFocusAreaPresentationOptions } from '../lib/focusAreaPresentation';
import { buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { getReadyTemplatePresentation } from '../lib/templatePresentation';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { colors, radii, spacing } from '../theme';
import { haptics } from '../utils/haptics';
import {
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

interface OnboardingScreenProps {
  initialUnitPreference: UnitPreference;
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
type BodyweightGoalMode = 'hidden' | 'optional' | 'required';
type BodyweightGoalIconName = 'up' | 'flat' | 'down';
type BodyweightSetupStep = 'goal' | 'current' | 'target' | 'outcome';
type LocationSelectionOptionId = SetupTrainingEnvironment;
type LocationBenefit = { icon: GymlogIconName; label: string; body?: string };
type FocusBadgeTone = 'neutral' | 'green' | 'blue' | 'purple';
type FocusBadgeInput = string | { label: string; tone?: FocusBadgeTone };

const STAGES: SetupStage[] = ['location', 'goal', 'level', 'days', 'avoid', 'planning', 'review'];
const ONBOARDING_PROGRESS_STAGES: SetupStage[] = ['location', 'goal', 'level', 'days', 'avoid', 'planning'];

// STEP n OF m labels follow the progress stages so inserting/removing a stage
// (e.g. the avoid step in a later phase) renumbers every screen automatically.
function getQuestionnaireStepLabel(stage: SetupStage) {
  const index = ONBOARDING_PROGRESS_STAGES.indexOf(stage);
  return `STEP ${index + 1} OF ${ONBOARDING_PROGRESS_STAGES.length}`;
}
const BODYWEIGHT_SETUP_STEPS: BodyweightSetupStep[] = ['goal', 'current', 'target', 'outcome'];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DEFAULT_BODYWEIGHT_KG = 70;
const DEFAULT_BODYWEIGHT_LB = 154;
// Light redesign palette (HG tokens from the design handoff).
const ONBOARDING_PANEL = '#F7F3FF';
const ONBOARDING_BG = ONBOARDING_PANEL;
const ONBOARDING_TOP = ONBOARDING_PANEL;
const ONBOARDING_CARD = '#FFFFFF';
const ONBOARDING_CARD_ACTIVE = '#EFE7FF';
const ONBOARDING_PRIMARY = '#7C3AED';
const ONBOARDING_PRIMARY_SOFT = 'rgba(124,58,237,0.14)';
const ONBOARDING_TEXT = '#101828';
const ONBOARDING_TEXT_SOFT = '#667085';
const ONBOARDING_TEXT_MUTED = '#9A93AC';
const ONBOARDING_BORDER = '#E4D8FF';
const ONBOARDING_BORDER_ACTIVE = '#7C3AED';
const BODYWEIGHT_INTEGER_LIMITS: Record<UnitPreference, { min: number; max: number }> = {
  kg: { min: 35, max: 220 },
  lb: { min: 77, max: 485 },
};

function clampBodyweightInteger(value: number, unit: UnitPreference) {
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  const step = getBodyweightStep(unit);
  const roundedValue = Math.round(value / step) * step;
  return Math.min(Math.max(Math.round(roundedValue * 10) / 10, limits.min), limits.max);
}

function getDefaultBodyweightForUnit(unit: UnitPreference) {
  return unit === 'kg' ? DEFAULT_BODYWEIGHT_KG : DEFAULT_BODYWEIGHT_LB;
}

function getBodyweightGoalMode(goals: SetupGoal[]): BodyweightGoalMode {
  if (goals.includes('lean_athletic')) {
    return 'required';
  }

  if (
    goals.includes('muscle') ||
    goals.includes('general') ||
    goals.includes('general_fitness') ||
    goals.includes('strength') ||
    goals.includes('run_mobility')
  ) {
    return 'optional';
  }

  return 'optional';
}

function getDefaultBodyweightGoal(goal: SetupGoal): SetupGoal {
  if (goal === 'muscle' || goal === 'lean_athletic' || goal === 'general_fitness' || goal === 'general') {
    return goal === 'general' ? 'general_fitness' : goal;
  }

  return 'general_fitness';
}

function getDefaultTargetBodyweight(value: number, unit: UnitPreference, goal: SetupGoal | BodyweightGoalMode) {
  const current = Number.isFinite(value) ? value : getDefaultBodyweightForUnit(unit);
  const offset =
    goal === 'muscle'
      ? unit === 'kg'
        ? 8
        : 18
      : goal === 'lean_athletic' || goal === 'required'
      ? unit === 'kg'
        ? -5
        : -10
      : 0;
  return clampBodyweightInteger(current + offset, unit);
}

function getBodyweightTargetLimits(current: number, unit: UnitPreference, goal: SetupGoal) {
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  const safeCurrent = clampBodyweightInteger(Number.isFinite(current) ? current : getDefaultBodyweightForUnit(unit), unit);

  if (goal === 'lean_athletic') {
    return { min: limits.min, max: safeCurrent };
  }

  if (goal === 'muscle') {
    return { min: safeCurrent, max: limits.max };
  }

  const maintainRange = unit === 'kg' ? 5 : 10;
  return {
    min: Math.max(limits.min, safeCurrent - maintainRange),
    max: Math.min(limits.max, safeCurrent + maintainRange),
  };
}

function clampTargetBodyweightForGoal(value: number, current: number, unit: UnitPreference, goal: SetupGoal) {
  const limits = getBodyweightTargetLimits(current, unit, goal);
  const safeValue = clampBodyweightInteger(Number.isFinite(value) ? value : getDefaultTargetBodyweight(current, unit, goal), unit);
  return Math.min(Math.max(safeValue, limits.min), limits.max);
}

function getBodyweightStep(unit: UnitPreference) {
  return unit === 'kg' ? 0.5 : 1;
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

const GENDER_OPTIONS: Array<{
  gender: SetupGender;
  title: string;
  body: string;
}> = [
  {
    gender: 'male',
    title: 'Male',
    body: 'Male-focused programs',
  },
  {
    gender: 'female',
    title: 'Female',
    body: 'Female-focused programs',
  },
  {
    gender: 'unspecified',
    title: 'No preference',
    body: 'Neutral matching',
  },
];

const GOAL_OPTIONS: Array<{
  goal: SetupGoal;
  title: string;
  body: string;
  tags: Array<{ label: string; tone: FocusBadgeTone }>;
  icon: OnboardingOptionIconName;
}> = [
  {
    goal: 'strength',
    title: 'Get stronger',
    body: 'Focus on heavy lifts and progressive strength.',
    tags: [
      { label: 'Lower reps', tone: 'neutral' },
      { label: 'Longer rest', tone: 'blue' },
      { label: 'Strength focus', tone: 'green' },
    ],
    icon: 'barbell',
  },
  {
    goal: 'muscle',
    title: 'Build muscle',
    body: 'Higher volume training to build size and definition.',
    tags: [
      { label: 'Hypertrophy', tone: 'green' },
      { label: 'Moderate reps', tone: 'neutral' },
      { label: 'More volume', tone: 'purple' },
    ],
    icon: 'trend_up',
  },
  {
    goal: 'lean_athletic',
    title: 'Lean & athletic',
    body: 'Stay lean while building strength and performance.',
    tags: [
      { label: 'Hybrid training', tone: 'purple' },
      { label: 'Conditioning', tone: 'green' },
      { label: 'Lower fatigue', tone: 'blue' },
    ],
    icon: 'run',
  },
  {
    goal: 'general_fitness',
    title: 'General fitness',
    body: 'Balanced training for overall health and consistency.',
    tags: [
      { label: 'Beginner friendly', tone: 'blue' },
      { label: 'Sustainable', tone: 'green' },
      { label: 'Flexible', tone: 'neutral' },
    ],
    icon: 'heart',
  },
];

// Training-level slider (step 04): Beginner / Advanced / Pro.
const LEVEL_SLIDER_OPTIONS: Array<{
  level: SetupLevel;
  label: string;
  lines: [string, string];
}> = [
  {
    level: 'beginner',
    label: 'Beginner',
    lines: ['New to lifting or returning after a break.', 'We keep form simple and progress steady.'],
  },
  {
    level: 'advanced',
    label: 'Advanced',
    lines: ['Trained consistently for a year or more.', 'You know the main lifts and want structure.'],
  },
  {
    level: 'pro',
    label: 'Pro',
    lines: ['Years of serious training behind you.', 'Higher volume and intensity - we push the pace.'],
  },
];

// Flame positions inside the 280x140 logo wrap - count and size grow with the
// level (few small sparks -> whole-logo blaze).
const LEVEL_FLAME_LAYOUTS: Array<Array<{ x: number; y: number; size: number; opacity?: number }>> = [
  [
    { x: 82, y: 98, size: 16, opacity: 0.9 },
    { x: 184, y: 100, size: 14, opacity: 0.75 },
  ],
  [
    { x: 44, y: 92, size: 18, opacity: 0.8 },
    { x: 104, y: 102, size: 24, opacity: 0.95 },
    { x: 166, y: 100, size: 20, opacity: 0.85 },
    { x: 222, y: 90, size: 16, opacity: 0.7 },
  ],
  [
    { x: 18, y: 58, size: 22, opacity: 0.75 },
    { x: 56, y: 92, size: 30, opacity: 0.9 },
    { x: 106, y: 102, size: 34 },
    { x: 158, y: 98, size: 30, opacity: 0.95 },
    { x: 206, y: 88, size: 26, opacity: 0.85 },
    { x: 244, y: 54, size: 20, opacity: 0.7 },
    { x: 128, y: 14, size: 18, opacity: 0.65 },
  ],
];

// Training-days step (04b): number chips on top, a tappable week row below.
const TRAINING_DAY_COUNT_OPTIONS: SetupDaysPerWeek[] = [2, 3, 4, 5, 6];

function getRecommendedDaysForLevel(level: SetupLevel): SetupDaysPerWeek {
  return level === 'beginner' ? 3 : level === 'pro' ? 5 : 4;
}

// Letters only in the week cells (no icons), Monday first.
const WEEKDAY_LETTERS: Record<SetupWeekday, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

// Avoid step: flaggable body parts, colour-coded caution levels and optional
// refinement chips. The flags persist to setupCautionFlags and colour the
// focus-area list on the next step.
const AVOID_AREA_OPTIONS: Array<{ area: SetupCautionArea; label: string }> = [
  { area: 'shoulders', label: 'Shoulders' },
  { area: 'lower_back', label: 'Lower back' },
  { area: 'knees', label: 'Knees' },
  { area: 'elbows', label: 'Elbows' },
];

const AVOID_EXTRA_AREA_OPTIONS: Array<{ area: SetupCautionArea; label: string }> = [
  { area: 'wrists', label: 'Wrists' },
  { area: 'hips', label: 'Hips' },
  { area: 'neck', label: 'Neck' },
  { area: 'ankles', label: 'Ankles' },
];

const CAUTION_LEVEL_OPTIONS: Array<{ level: SetupCautionLevel; label: string; body: string }> = [
  { level: 'info', label: 'For info only', body: "We'll keep it in mind." },
  { level: 'careful', label: 'Be careful', body: 'Lighter loads and joint-friendly swaps.' },
  { level: 'avoid', label: 'Avoid entirely', body: 'We leave this area out of your plan.' },
];

const CAUTION_LEVEL_COLORS: Record<SetupCautionLevel, { ink: string; soft: string }> = {
  info: { ink: '#667085', soft: '#F1F0F4' },
  careful: { ink: '#D97706', soft: '#FEF3C7' },
  avoid: { ink: '#DC2626', soft: '#FEE2E2' },
};

const CAUTION_REFINEMENT_FALLBACK = ['Old injury', 'Chronic pain', 'Recent surgery'];

// Plan-review progression card: what GAINER automates when the toggle is on.
const PROGRESSION_BULLETS = [
  'Weights progress week to week',
  'Sets and reps adapt to your logs',
  'Deloads arrive when recovery dips',
];

const CAUTION_REFINEMENT_OPTIONS: Partial<Record<SetupCautionArea, string[]>> = {
  shoulders: ['Old injury', 'Impingement', 'Limited mobility'],
  lower_back: ['Old injury', 'Lower-back pain', 'Disc issues'],
  knees: ['Old injury', 'Knee pain', 'Post-surgery'],
  elbows: ['Old injury', 'Tennis elbow', 'Tendon pain'],
  wrists: ['Old injury', 'Wrist pain', 'Limited mobility'],
  hips: ['Old injury', 'Hip pain', 'Limited mobility'],
  neck: ['Old injury', 'Neck pain', 'Limited mobility'],
  ankles: ['Old injury', 'Ankle pain', 'Instability'],
};

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
  title: string;
  body: string;
}> = [
  {
    mode: 'done_for_me',
    title: 'Keep it simple for me',
    body: 'One ready plan.',
  },
  {
    mode: 'guided_editable',
    title: 'Recommend, then edit',
    body: 'Start, then tweak.',
  },
  {
    mode: 'self_directed',
    title: 'I want to build it myself',
    body: 'Start from a base.',
  },
];

const SCHEDULE_MODE_OPTIONS: Array<{
  mode: SetupScheduleMode;
  title: string;
  body: string;
}> = [
  {
    mode: 'app_managed',
    title: 'Plan it for me',
    body: 'GAINER places the week.',
  },
  {
    mode: 'self_managed',
    title: "I'll manage the days",
    body: 'You pick the days.',
  },
];

const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions();
const REFINEMENT_FOCUS_AREA_OPTIONS: SetupFocusArea[] = FOCUS_AREA_OPTIONS.map((option) => option.area);

// Focus rows read the avoid-step flags: a flagged part tints its row amber
// (Be careful) or red (Avoid entirely) with a warning triangle; info-level
// flags stay neutral. Avoid wins when multiple flags touch the same area.
const CAUTION_TO_FOCUS_AREAS: Record<SetupCautionArea, SetupFocusArea[]> = {
  neck: ['shoulders'],
  shoulders: ['shoulders'],
  elbows: ['arms'],
  wrists: ['arms'],
  lower_back: ['back', 'core'],
  hips: ['glutes'],
  knees: ['legs', 'quads', 'hamstrings'],
  ankles: ['calves'],
};

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
  label: string;
  subtitle: string;
  icon: OnboardingOptionIconName;
  focusLabel?: string;
  focusTone?: FocusBadgeTone;
}> = [
  {
    id: 'full_gym',
    equipment: 'gym',
    trainingEnvironment: 'full_gym',
    label: 'Full Gym',
    subtitle: 'Commercial gym access with machines, barbells and dumbbells.',
    icon: 'barbell',
    focusLabel: 'MOST FLEXIBLE',
    focusTone: 'neutral',
  },
  {
    id: 'home_gym',
    equipment: 'home',
    trainingEnvironment: 'home_gym',
    label: 'Home equipment',
    subtitle: 'Train at home with the gear you have.',
    icon: 'home',
  },
  {
    id: 'bodyweight_only',
    equipment: 'minimal',
    trainingEnvironment: 'bodyweight_only',
    label: 'Bodyweight only',
    subtitle: 'No equipment needed. Train anywhere.',
    icon: 'bodyweight',
    focusLabel: 'BEGINNER FRIENDLY',
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

const LOCATION_SELECTION_BENEFITS: Record<LocationSelectionOptionId, LocationBenefit[]> = {
  full_gym: [
    { icon: 'progress', label: 'Adaptive plan', body: 'Built around gym access.' },
    { icon: 'strength', label: 'Exercise variety', body: 'More swaps available.' },
    { icon: 'tempo', label: 'Weekly rhythm', body: 'Structured for progress.' },
    { icon: 'recovery', label: 'Recovery aware', body: 'Load stays manageable.' },
  ],
  home_gym: [
    { icon: 'strength', label: 'Adaptive plan', body: 'Built around your setup.' },
    { icon: 'tempo', label: 'Weekly rhythm', body: 'Easy to repeat.' },
    { icon: 'progress', label: 'Progress tracking', body: 'Clear progression.' },
    { icon: 'recovery', label: 'Recovery aware', body: 'Load adjusts to you.' },
  ],
  minimal_equipment: [
    { icon: 'lightning', label: 'Adaptive plan', body: 'Efficient sessions.' },
    { icon: 'strength', label: 'Smart swaps', body: 'Bands and dumbbells.' },
    { icon: 'progress', label: 'Progress tracking', body: 'Simple progression.' },
    { icon: 'tempo', label: 'Weekly rhythm', body: 'Fits your lifestyle.' },
  ],
  bodyweight_only: [
    { icon: 'strength', label: 'Adaptive plan', body: 'Train anywhere.' },
    { icon: 'progress', label: 'Progress tracking', body: 'Bodyweight progress.' },
    { icon: 'tempo', label: 'Weekly rhythm', body: 'No equipment friction.' },
    { icon: 'recovery', label: 'Recovery aware', body: 'Load adjusts to you.' },
  ],
  running_hybrid: [
    { icon: 'cardio', label: 'Adaptive plan', body: 'Run + strength balance.' },
    { icon: 'recovery', label: 'Recovery aware', body: 'Weekly load adjusts.' },
    { icon: 'progress', label: 'Progress tracking', body: 'Cardio and muscle.' },
    { icon: 'tempo', label: 'Weekly rhythm', body: 'Fits your lifestyle.' },
  ],
};

const GOAL_SELECTION_OPTIONS: Array<{
  id: SetupGoal;
  label: string;
  subtitle: string;
  icon: OnboardingOptionIconName;
  tags: Array<{ label: string; tone: FocusBadgeTone }>;
}> = GOAL_OPTIONS.map((option) => ({
  id: option.goal,
  label: option.title,
  subtitle: option.body,
  icon: option.icon,
  tags: option.tags,
}));

const BODYWEIGHT_GOAL_OPTIONS: Array<{
  id: SetupGoal;
  title: string;
  body: string;
  icon: BodyweightGoalIconName;
  accentColor: string;
}> = [
  {
    id: 'muscle',
    title: 'Gain muscle',
    body: 'Build size and get stronger',
    icon: 'up',
    accentColor: '#8BDEAE',
  },
  {
    id: 'general_fitness',
    title: 'Maintain',
    body: 'Stay at your current weight',
    icon: 'flat',
    accentColor: '#8FCAFF',
  },
  {
    id: 'lean_athletic',
    title: 'Lean down',
    body: 'Lose fat and get leaner',
    icon: 'down',
    accentColor: '#D9A9FF',
  },
];

function getLocationFocusBadgeStyle(tone: FocusBadgeTone) {
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

function getLocationFocusBadgeTextStyle(tone: FocusBadgeTone) {
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

  const animatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        }),
      },
    ],
  };
  const radio = (
    <View
      style={[
        styles.locationChoiceRadio,
        leadingRadio && styles.locationChoiceRadioLeading,
        active && styles.locationChoiceRadioActive,
      ]}
    >
      {active ? (
        <View style={styles.locationChoiceRadioCheck}>
          <View style={styles.locationChoiceRadioCheckShort} />
          <View style={styles.locationChoiceRadioCheckLong} />
        </View>
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
                <View style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(focusBadge.tone), active && styles.locationFocusBadgeOnActive]}>
                  <Text
                    numberOfLines={1}
                    style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(focusBadge.tone), active && styles.locationFocusBadgeTextOnActive]}
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
                    style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(tag.tone), active && styles.locationFocusBadgeChipOnActive]}
                  >
                    <Text
                      style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(tag.tone), active && styles.locationFocusBadgeChipTextOnActive]}
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

function PhotoSelectionCard({
  title,
  body,
  meta,
  active,
  variantLabel,
  tagLabel,
  plain = false,
  backgroundSource,
  onPress,
  photo,
}: {
  title: string;
  body: string;
  meta: string;
  active: boolean;
  variantLabel?: string;
  tagLabel?: string;
  plain?: boolean;
  backgroundSource?: number;
  onPress: () => void;
  photo: 'strength' | 'recovery' | 'running';
}) {
  const scale = useRef(new Animated.Value(active ? 1.02 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.02 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: active ? 8 : 4,
    }).start();
  }, [active, scale]);

  function handlePress() {
    scale.stopAnimation();
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.986,
        duration: 85,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.03,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
    ]).start();
    onPress();
  }

  const content = (
    <View style={[styles.photoSelectionContent, plain && styles.photoSelectionContentPlain]}>
      {!plain ? (
        <View style={styles.photoSelectionTopRow}>
          <BadgePill accent="neutral" label={tagLabel ?? title} />
          {active ? <BadgePill accent="neutral" label="Selected" /> : null}
        </View>
      ) : null}
      <View style={styles.photoSelectionCopy}>
        <Text
          style={[
            styles.photoSelectionTitle,
            plain && styles.photoSelectionTitlePlain,
            plain && backgroundSource ? styles.photoSelectionTitleOnImage : undefined,
          ]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            style={[
              styles.photoSelectionBody,
              plain && styles.photoSelectionBodyPlain,
              plain && backgroundSource ? styles.photoSelectionBodyOnImage : undefined,
            ]}
          >
            {body}
          </Text>
        ) : null}
        {meta ? (
          <Text
            style={[
              styles.photoSelectionMeta,
              plain && styles.photoSelectionMetaPlain,
              plain && backgroundSource ? styles.photoSelectionMetaOnImage : undefined,
            ]}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const splitContent = (
    <View style={[styles.splitSelectionCard, active && styles.splitSelectionCardActive]}>
      <View style={[styles.splitSelectionFrame, active && styles.splitSelectionFrameActive]} />
      <View style={styles.splitSelectionDarkPane} />
      <View style={[styles.splitSelectionBottomLeftPane, active && styles.splitSelectionBottomLeftPaneActive]} />
      <View style={[styles.splitSelectionLightPane, active && styles.splitSelectionLightPaneActive]} />
      <View style={[styles.splitSelectionDiagonal, active && styles.splitSelectionDiagonalActive]} />
      <View style={[styles.splitSelectionDiagonalOffset, active && styles.splitSelectionDiagonalOffsetActive]} />
      <View style={[styles.splitSelectionCornerAccent, styles.splitSelectionCornerAccentTopRight, active && styles.splitSelectionCornerAccentActive]} />
      <View style={[styles.splitSelectionCornerAccent, styles.splitSelectionCornerAccentBottomLeft, active && styles.splitSelectionCornerAccentActive]} />

      <View style={styles.splitSelectionContent}>
        {variantLabel ? (
          <View style={styles.splitSelectionVariantBadge}>
            <Text style={styles.splitSelectionVariantBadgeText}>{variantLabel}</Text>
          </View>
        ) : null}
        <View style={styles.splitSelectionPrimary}>
        </View>

        <View style={styles.splitSelectionSecondary}>
          {body ? <Text style={styles.splitSelectionBody}>{body}</Text> : null}
          {meta ? <Text style={styles.splitSelectionMeta}>{meta}</Text> : null}
        </View>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.photoSelectionCard,
        active && styles.photoSelectionCardActive,
        plain && styles.photoSelectionCardPlain,
        plain && active && styles.photoSelectionCardPlainActive,
      ]}
    >
      <Animated.View
        style={[
          styles.photoSelectionAnimatedWrap,
          active && styles.photoSelectionAnimatedWrapPlainActive,
          { transform: [{ scale }] },
        ]}
      >
        {plain ? (
          splitContent
        ) : plain && backgroundSource ? (
          <View style={styles.photoSelectionSurfacePlainImage}>
            <Image source={backgroundSource} resizeMode="cover" style={styles.photoSelectionSurfacePlainAsset} />
            <View style={styles.photoSelectionPlainShade} />
            {content}
          </View>
        ) : (
          <FitnessPhotoSurface variant={photo} compact style={styles.photoSelectionSurface}>
            {content}
          </FitnessPhotoSurface>
        )}
      </Animated.View>
    </Pressable>
  );
}

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

  const cardAnimatedStyle = visualCard
    ? {
        transform: [
          {
            scale: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.02],
            }),
          },
        ],
      }
    : undefined;
  const thumbAnimatedStyle = iconImage
    ? {
        transform: [
          {
            scale: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.04],
            }),
          },
        ],
      }
    : undefined;
  const copyAnimatedStyle = visualCard
    ? {
        transform: [
          {
            translateY: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -2],
            }),
          },
        ],
      }
    : undefined;

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
              style={[
                styles.setupOptionCardFigureImage,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.035],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.setupOptionCardFigureVignette} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardSelectionBadge,
                {
                  opacity: activeAnimation,
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                },
              ]}
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
              style={[
                styles.setupOptionCardIconImage,
                thumbAnimatedStyle,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.84, 1],
                  }),
                },
              ]}
            />
            <View style={styles.setupOptionCardIconShade} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconGlow,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.28],
                  }),
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconPaint,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.2],
                  }),
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconRing,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardSelectionBadge,
                {
                  opacity: activeAnimation,
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                },
              ]}
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

function AgeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const trackWidthRef = useRef(1);
  const ageMarks = [0, 25, 50, 75, 100];
  const progress = clampSetupAge(value);

  function updateFromTrackPosition(locationX: number) {
    const trackWidth = Math.max(1, trackWidthRef.current);
    onChange(clampSetupAge((locationX / trackWidth) * 100));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => updateFromTrackPosition(event.nativeEvent.locationX),
      onPanResponderMove: (event) => updateFromTrackPosition(event.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View style={styles.ageSliderCard}>
      <View style={styles.ageSliderHeader}>
        <Text style={styles.ageSliderEyebrow}>Selected age</Text>
        <Text style={styles.ageSliderValue}>{value}</Text>
      </View>

      <View
        style={styles.ageSliderTrackArea}
        onLayout={(event) => {
          trackWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.ageSliderTrack} />
        <View style={[styles.ageSliderTrackFill, { width: `${progress}%` }]} />
        <View style={[styles.ageSliderThumb, { left: `${progress}%` }]} />
      </View>

      <View style={styles.ageSliderLabelRow}>
        {ageMarks.map((ageMark) => {
          const active = value === ageMark;
          return (
            <Pressable key={ageMark} onPress={() => onChange(ageMark)} style={styles.ageSliderLabelPress}>
              <Text style={[styles.ageSliderLabel, active && styles.ageSliderLabelActive]}>{ageMark}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PreviewGlyph({ dayCount }: { dayCount: number }) {
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
}): GymlogIconName {
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

function BodyweightStepper({
  label,
  hint,
  value,
  unit,
  onChange,
  onUnitChange,
}: {
  label: string;
  hint?: string;
  value: number;
  unit: UnitPreference;
  onChange: (value: number) => void;
  onUnitChange?: (unit: UnitPreference) => void;
}) {
  const step = getBodyweightStep(unit);
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  const clampedValue = Math.min(
    Math.max(Number.isFinite(value) ? value : getDefaultBodyweightForUnit(unit), limits.min),
    limits.max,
  );

  function updateValue(nextValue: number) {
    onChange(Math.min(Math.max(nextValue, limits.min), limits.max));
  }

  const [draftValue, setDraftValue] = useState(clampedValue.toFixed(1));
  const [editingValue, setEditingValue] = useState(false);

  useEffect(() => {
    if (!editingValue) {
      setDraftValue(clampedValue.toFixed(1));
    }
  }, [clampedValue, editingValue, unit]);

  function handleValueDraftChange(nextDraft: string) {
    setDraftValue(nextDraft);
    const parsed = parseNumberInput(nextDraft);
    if (parsed !== null) {
      updateValue(parsed);
    }
  }

  return (
    <View style={styles.bodyweightStepperBlock}>
      <View style={styles.bodyweightTargetHeader}>
        <Text style={styles.bodyweightPickerLabel}>{label}</Text>
        {hint ? <Text style={styles.bodyweightTargetHint}>{hint}</Text> : null}
      </View>

      <View style={styles.bodyweightTargetCard}>
        <BodyweightStepButton
          label="-"
          onPress={() => updateValue(clampedValue - step)}
          textStyle={styles.bodyweightTargetMinusText}
        />
        <View style={styles.bodyweightTargetValueWrap}>
          <TextInput
            value={editingValue ? draftValue : clampedValue.toFixed(1)}
            onFocus={() => {
              setEditingValue(true);
              setDraftValue(clampedValue.toFixed(1));
            }}
            onChangeText={handleValueDraftChange}
            onBlur={() => {
              setEditingValue(false);
              setDraftValue(clampedValue.toFixed(1));
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={styles.bodyweightTargetValueInput}
          />
        </View>
        <BodyweightStepButton
          label="+"
          onPress={() => updateValue(clampedValue + step)}
        />
      </View>

    </View>
  );
}

function BodyweightGoalTrendIcon({ name, color }: { name: BodyweightGoalIconName; color: string }) {
  if (name === 'flat') {
    return (
      <Svg width={24} height={18} viewBox="0 0 24 18" fill="none" style={styles.bodyweightGoalTrendIcon}>
        <Path d="M6 9 H18" stroke={color} strokeWidth={2.75} strokeLinecap="round" />
      </Svg>
    );
  }

  const path = name === 'down' ? 'M12 3 V14' : 'M12 15 V4';
  const arrow = name === 'down' ? 'M7.5 9.5 L12 14 L16.5 9.5' : 'M7.5 8.5 L12 4 L16.5 8.5';

  return (
    <Svg width={24} height={18} viewBox="0 0 24 18" fill="none" style={styles.bodyweightGoalTrendIcon}>
      <Path d={path} stroke={color} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={arrow} stroke={color} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BodyweightStepButton({
  label,
  textStyle,
  onPress,
}: {
  label: '+' | '-';
  textStyle?: TextStyle;
  onPress: () => void;
}) {
  const pressProgress = useRef(new Animated.Value(0)).current;
  const scale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  function animate(toValue: number) {
    Animated.timing(pressProgress, {
      toValue,
      duration: 95,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase weight' : 'Decrease weight'}
      onPress={() => {
        void haptics.select();
        onPress();
      }}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      style={[
        styles.bodyweightTargetStepButton,
        {
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={[styles.bodyweightTargetStepText, textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
}

function BodyweightGoalOptionCard({
  title,
  body,
  icon,
  accentColor,
  active,
  wide = false,
  onPress,
}: {
  title: string;
  body: string;
  icon: BodyweightGoalIconName;
  accentColor: string;
  active: boolean;
  wide?: boolean;
  onPress: () => void;
}) {
  const iconColor = wide ? (active ? '#FFFFFF' : '#5B21B6') : accentColor;
  const scale = useRef(new Animated.Value(active ? 1.04 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.04 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: active ? 9 : 4,
    }).start();
  }, [active, scale]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.bodyweightGoalCard,
        wide && styles.bodyweightGoalCardWide,
        { borderColor: active ? accentColor : `${accentColor}66` },
        active && styles.bodyweightGoalCardActive,
        wide && active && styles.bodyweightGoalCardWideActive,
        active && { borderColor: accentColor },
        wide && { transform: [{ scale }] },
      ]}
    >
      {wide && active ? <View pointerEvents="none" style={styles.bodyweightGoalCardActiveBloom} /> : null}
      <View style={[styles.bodyweightGoalIconBubble, wide && styles.bodyweightGoalIconBubbleWide, active && styles.bodyweightGoalIconBubbleActive]}>
        <BodyweightGoalTrendIcon name={icon} color={iconColor} />
      </View>
      <View style={styles.bodyweightGoalCardCopy}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bodyweightGoalCardTitle, active && styles.bodyweightGoalCardTitleActive]}>
          {title}
        </Text>
        <Text style={[styles.bodyweightGoalCardBody, active && styles.bodyweightGoalCardBodyActive]}>{body}</Text>
      </View>
      {wide && active ? (
        <View style={styles.bodyweightGoalCheck}>
          <GymlogIcon name="check" color={ONBOARDING_PRIMARY} size={16} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

function BodyweightTargetSlider({
  value,
  unit,
  min,
  max,
  onChange,
  onClear,
}: {
  value: number;
  unit: UnitPreference;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onClear: () => void;
}) {
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  const sliderMin = Math.min(Math.max(clampBodyweightInteger(min, unit), limits.min), limits.max);
  const sliderMax = Math.min(Math.max(clampBodyweightInteger(max, unit), sliderMin), limits.max);
  const clampedValue = Math.min(
    Math.max(Number.isFinite(value) ? clampBodyweightInteger(value, unit) : getDefaultBodyweightForUnit(unit), sliderMin),
    sliderMax,
  );
  const percent = sliderMax === sliderMin ? 0 : (clampedValue - sliderMin) / (sliderMax - sliderMin);
  const [trackWidth, setTrackWidth] = useState(0);

  function updateFromTrackPosition(locationX: number) {
    if (trackWidth <= 0 || sliderMax === sliderMin) {
      return;
    }

    const nextPercent = Math.min(Math.max(locationX / trackWidth, 0), 1);
    onChange(clampBodyweightInteger(sliderMin + nextPercent * (sliderMax - sliderMin), unit));
  }

  return (
    <View style={styles.bodyweightSliderCard}>
      <View style={styles.bodyweightSliderRow}>
        <Text style={styles.bodyweightSliderValue}>{clampedValue.toFixed(1)} {unit}</Text>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={`Target weight ${clampedValue.toFixed(1)} ${unit}`}
          onPress={(event) => updateFromTrackPosition(event.nativeEvent.locationX)}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          style={styles.bodyweightSliderTrackWrap}
        >
          <View style={styles.bodyweightSliderTrack} />
          <View style={[styles.bodyweightSliderTrackActive, { width: `${percent * 100}%` }]} />
          <View style={[styles.bodyweightSliderThumb, { left: `${percent * 100}%` }]} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear target weight" onPress={onClear}>
          <Text style={styles.bodyweightSliderClearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatBodyweightDisplay(value: number, unit: UnitPreference) {
  const roundedValue = Math.round(value * 10) / 10;
  const valueText = Number.isInteger(roundedValue) ? `${roundedValue}` : roundedValue.toFixed(1);
  return `${valueText} ${unit}`;
}

function formatBodyweightSummaryDisplay(value: number, unit: UnitPreference) {
  const roundedValue = Math.round(value * 10) / 10;
  const valueText = Number.isInteger(roundedValue) ? `${roundedValue}` : roundedValue.toFixed(1);
  return `${valueText}${unit.toUpperCase()}`;
}

function formatProfileName(value: string) {
  const trimmedStart = value.replace(/^\s+/, '');
  return trimmedStart.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function BodyweightSummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.bodyweightSummaryRow}>
      <View style={styles.bodyweightSummaryCheck}>
        <GymlogIcon name="check" color="#FFFFFF" size={13} />
      </View>
      <View style={styles.bodyweightSummaryCopy}>
        <Text style={styles.bodyweightSummaryValue}>{label}: {value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={onEdit} style={styles.bodyweightSummaryEdit}>
        <Text style={styles.bodyweightSummaryEditText}>Edit</Text>
      </Pressable>
    </View>
  );
}

function BodyweightTimelineCard({
  current,
  target,
  unit,
}: {
  current: number;
  target: number;
  unit: UnitPreference;
}) {
  const difference = target - current;
  const absoluteDifference = Math.abs(difference);
  const startY = difference > 0 ? 78 : difference < 0 ? 24 : 51;
  const endY = difference > 0 ? 24 : difference < 0 ? 78 : 51;
  const curve = `M18 ${startY} C100 ${startY}, 196 ${endY}, 302 ${endY}`;
  const weeksMin = Math.max(4, Math.round(absoluteDifference * 4));
  const weeksMax = Math.max(8, Math.round(absoluteDifference * 6));
  const timelineLabel = absoluteDifference < 0.25 ? '~4-8 weeks' : `~${weeksMin}-${weeksMax} weeks`;

  return (
    <View style={styles.bodyweightTimelineCard}>
      <View style={styles.bodyweightTimelineHeader}>
        <Text style={styles.bodyweightTimelineTitle}>Expected timeline</Text>
      </View>

      <View style={styles.bodyweightTimelineChart}>
        <Svg width="100%" height={114} viewBox="0 0 320 114" fill="none">
          <Path d="M18 34H302" stroke="rgba(16,24,40,0.06)" strokeWidth={1} strokeLinecap="round" strokeDasharray="5 10" />
          <Path d="M18 60H302" stroke="rgba(124,58,237,0.10)" strokeWidth={1} strokeLinecap="round" strokeDasharray="5 10" />
          <Path d="M18 92H302" stroke="rgba(16,24,40,0.12)" strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M18 16V92" stroke="rgba(16,24,40,0.10)" strokeWidth={1.2} strokeLinecap="round" />
          <Path d={curve} stroke="rgba(124,58,237,0.20)" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Path d={curve} stroke={ONBOARDING_PRIMARY} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Circle cx={18} cy={startY} r={6} fill={ONBOARDING_PRIMARY} stroke="#FFFFFF" strokeWidth={1.5} />
          <Circle cx={302} cy={endY} r={7} fill={ONBOARDING_PRIMARY} stroke="#FFFFFF" strokeWidth={1.5} />
        </Svg>
        <Text style={[styles.bodyweightTimelinePointLabel, styles.bodyweightTimelineStartLabel]}>
          Today{"\n"}{formatBodyweightDisplay(current, unit)}
        </Text>
        <Text style={[styles.bodyweightTimelinePointLabel, styles.bodyweightTimelineTargetLabel]}>
          Target{"\n"}{formatBodyweightDisplay(target, unit)}
        </Text>
        <Text style={styles.bodyweightTimelineDuration}>{timelineLabel}</Text>
      </View>

      <Text style={styles.bodyweightTimelineNote}>
        Based on a sustainable weekly rate. You can adjust this later.
      </Text>
    </View>
  );
}

function FlameGlyph({ size, opacity = 1 }: { size: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity }}>
      <Path
        d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
        fill={ONBOARDING_PRIMARY}
      />
    </Svg>
  );
}

function StepDots({ index, light = false }: { index: number; light?: boolean }) {
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

function getLocationLabel(trainingEnvironment: SetupTrainingEnvironment, equipment: SetupEquipment) {
  switch (trainingEnvironment) {
    case 'full_gym':
      return 'Full gym';
    case 'home_gym':
      return 'Home gym';
    case 'minimal_equipment':
      return 'Minimal equipment';
    case 'bodyweight_only':
      return 'Bodyweight only';
    case 'running_hybrid':
      return 'Running / hybrid';
    default:
      switch (equipment) {
        case 'gym':
          return 'Full gym';
        case 'home':
          return 'Home setup';
        case 'minimal':
          return 'Minimal equipment';
        default:
          return 'Your setup';
      }
  }
}

function getGoalLabel(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return 'Get stronger';
    case 'muscle':
      return 'Build muscle';
    case 'lean_athletic':
      return 'Lean & athletic';
    case 'general_fitness':
      return 'General fitness';
    case 'general':
      return 'Lose weight';
    case 'run_mobility':
      return 'Endurance / cardio';
    default:
      return 'Training';
  }
}

function formatGoalList(goals: SetupGoal[]) {
  if (goals.length === 0) {
    return 'Not set';
  }

  return goals.map((goal) => getGoalLabel(goal)).join(', ');
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

function getLevelLabel(level: SetupLevel) {
  if (level === 'beginner') {
    return 'Beginner';
  }

  return level === 'pro' ? 'Pro' : 'Advanced';
}

function getGenderProfileLabel(gender: SetupGender) {
  if (gender === 'male') {
    return 'Male';
  }

  if (gender === 'female') {
    return 'Female';
  }

  return 'No preference';
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

function getTrainingProfileWeekPreview(daysPerWeek: SetupDaysPerWeek) {
  const labelsByCadence: Record<SetupDaysPerWeek, Array<string | null>> = {
    2: ['Upper', null, 'Lower', null, null, null, null],
    3: ['Upper', null, 'Lower', null, 'Full', null, null],
    4: ['Upper A', null, 'Lower A', null, 'Upper B', null, 'Lower B'],
    5: ['Upper A', 'Lower A', null, 'Full Body', 'Upper B', null, 'Lower B'],
    6: ['Push', 'Pull', 'Legs', null, 'Upper', 'Lower', 'Full'],
  };
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const labels = labelsByCadence[daysPerWeek];

  return weekDays.map((day, index) => ({
    day,
    label: labels[index],
    training: labels[index] !== null,
  }));
}

function TrainingSetupMetric({ icon, label }: { icon: GymlogIconName; label: string }) {
  return (
    <View style={styles.trainingSetupMetric}>
      <GymlogIcon name={icon} size={18} color={ONBOARDING_PRIMARY} />
      <Text style={styles.trainingSetupMetricText}>{label}</Text>
    </View>
  );
}

export function OnboardingScreen({
  initialUnitPreference,
  readyProgramCount,
  mode = 'first_run',
  initialSelection,
  basicsSeed,
  initialStage,
  tailoringPreferences = null,
  onBackToEntry,
  onSkip,
  onCompleteToTraining,
  onCompleteToProgramDetail,
  onCompleteToCustom,
  onCancel,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
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
  const [equipmentItems, setEquipmentItems] = useState<string[]>(setupSeed.equipmentItems ?? []);
  const [levelTrackWidth, setLevelTrackWidth] = useState(0);
  const levelThumbAnim = useRef(
    new Animated.Value(Math.max(0, LEVEL_SLIDER_OPTIONS.findIndex((option) => option.level === setupSeed.level))),
  ).current;
  const levelFlamePop = useRef(new Animated.Value(1)).current;
  const [secondaryOutcomes, setSecondaryOutcomes] = useState<SetupSecondaryOutcome[]>(
    setupSeed.secondaryOutcomes,
  );
  const [focusAreas, setFocusAreas] = useState<SetupFocusArea[]>(setupSeed.focusAreas);
  const [cautionFlags, setCautionFlags] = useState<SetupCautionFlag[]>(setupSeed.cautionFlags ?? []);
  const [expandedCautionArea, setExpandedCautionArea] = useState<SetupCautionArea | null>(null);
  const [avoidExtraVisible, setAvoidExtraVisible] = useState(() =>
    (setupSeed.cautionFlags ?? []).some((flag) =>
      AVOID_EXTRA_AREA_OPTIONS.some((option) => option.area === flag.area),
    ),
  );
  const [guidanceMode, setGuidanceMode] = useState<SetupGuidanceMode>(setupSeed.guidanceMode);
  const [scheduleMode, setScheduleMode] = useState<SetupScheduleMode>(setupSeed.scheduleMode);
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(setupSeed.weeklyMinutes ?? null);
  const [availableDays, setAvailableDays] = useState<SetupWeekday[]>(setupSeed.availableDays);
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
  const [planReadyView, setPlanReadyView] = useState<'overview' | 'day' | 'progression'>('overview');
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
    () => ['Analyzing your inputs', 'Building your split', 'Matching exercises', 'Finalizing your plan'],
    [],
  );
  const buildingPlanStepSubtitles = useMemo(
    () => [
      'Reading your setup and goals...',
      'Creating training structure...',
      'Pairing lifts to your equipment...',
      'Polishing the first week...',
    ],
    [],
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
      currentWeightKg: currentWeightValue === null ? null : convertWeightToKg(currentWeightValue, unitPreference),
      targetWeightKg: targetWeightValue === null ? null : convertWeightToKg(targetWeightValue, unitPreference),
      unitPreference,
    }),
    [
      automatedProgressionEnabled,
      availableDays,
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
  const recommendedProgramPresentation = useMemo(
    () => (recommendedProgram ? getReadyTemplatePresentation(recommendedProgram) : null),
    [recommendedProgram],
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
            presentation: getReadyTemplatePresentation(template),
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
  const recommendedProgramTags = useMemo(
    () => recommendedProgramPresentation?.tags.slice(0, 3) ?? [],
    [recommendedProgramPresentation],
  );
  const helperSuggestions = useMemo(
    () => buildFirstRunPromptSuggestions(selection, getRecommendedProgramName(activeRecommendedProgramId)),
    [activeRecommendedProgramId, selection],
  );
  const helperPrompt = useMemo(
    () => buildFirstRunHelperPrompt(stage as FirstRunStep, selection, recommendedProgram?.name ?? null),
    [recommendedProgram?.name, selection, stage],
  );
  const locationLabel = useMemo(() => getLocationLabel(trainingEnvironment, equipment), [equipment, trainingEnvironment]);
  const goalLabel = useMemo(() => formatGoalList(goals), [goals]);
  const levelLabel = useMemo(() => getLevelLabel(level), [level]);
  const secondaryOutcomeLabels = useMemo(
    () => secondaryOutcomes.map((outcome) => getSecondaryOutcomeTitle(outcome)),
    [secondaryOutcomes],
  );
  const focusAreaLabels = useMemo(() => focusAreas.map((area) => getFocusAreaTitle(area)), [focusAreas]);
  const focusAreaSummary = useMemo(() => formatFocusAreaList(focusAreas), [focusAreas]);
  const guidanceModeLabel = useMemo(() => getGuidanceModeLabel(guidanceMode), [guidanceMode]);
  const scheduleModeLabel = useMemo(() => getScheduleModeLabel(scheduleMode), [scheduleMode]);
  const projectedDaysPerWeek = recommendedProgram?.daysPerWeek ?? daysPerWeek;
  const projectedRhythm = useMemo(() => {
    return resolveProjectedTrainingDays(selection, projectedDaysPerWeek).map((day) => getWeekdayShortLabel(day));
  }, [projectedDaysPerWeek, selection]);
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
    () => availableDays.map((day) => getWeekdayShortLabel(day)),
    [availableDays],
  );
  const projectedSessions = useMemo(
    () =>
      recommendedProgram
        ? [...recommendedProgram.sessions]
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .map((session) => ({
              id: session.id,
              name: session.name,
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

      if (current.length >= 2) {
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
      });

      setHelperAnswer(result.answer);
      setHelperNote(result.note ?? '');
      setHelperSource(result.source);
      setHelperState('ready');
    } catch {
      setHelperState('error');
      setHelperError('Ask one clear question.');
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
            <Text style={styles.previewKicker}>Start with</Text>
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
          <Text style={styles.previewSectionLabel}>This week</Text>
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
            <Text style={styles.previewSectionLabel}>Coming up</Text>
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
    const selectedSetup = LOCATION_SELECTION_OPTIONS.find((option) => option.id === selectedLocationOptionId) ?? null;
    const otherSetups = LOCATION_SELECTION_OPTIONS.filter((option) => option.id !== selectedLocationOptionId);
    const selectedChips = selectedSetup ? EQUIPMENT_CHIP_CATALOG[selectedSetup.id] ?? [] : [];

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('location'),
      titleLines: ['What can you', 'train with?'],
      topPaneStyle: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyle: styles.locationEquipmentHeadline,
      children: selectedSetup ? (
        <View style={styles.locationCardList}>
          <View style={styles.equipmentExpandedCard}>
            <View style={styles.equipmentExpandedHeader}>
              <OnboardingOptionIcon name={selectedSetup.icon} />
              <View style={styles.equipmentExpandedCopy}>
                <Text style={styles.equipmentExpandedTitle}>{selectedSetup.label}</Text>
                <Text style={styles.equipmentExpandedCount}>
                  {selectedChips.length > 0 ? `${equipmentItems.length} selected` : selectedSetup.subtitle}
                </Text>
              </View>
              <View style={styles.equipmentExpandedCheck}>
                <GymlogIcon name="check" size={13} color="#FFFFFF" />
              </View>
            </View>
            {selectedChips.length > 0 ? (
              <>
                <Text style={styles.equipmentChipsPrompt}>Toggle what you actually have:</Text>
                <View style={styles.equipmentChipsWrap}>
                  {selectedChips.map((item) => {
                    const active = equipmentItems.includes(item);

                    return (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${item}${active ? ', selected' : ''}`}
                        onPress={() => toggleEquipmentItem(selectedSetup, item)}
                        style={[styles.equipmentChip, active && styles.equipmentChipActive]}
                      >
                        <Text style={[styles.equipmentChipText, active && styles.equipmentChipTextActive]}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>

          <Text style={styles.equipmentOrChooseLabel}>OR CHOOSE ANOTHER</Text>
          {otherSetups.map((option) => (
            <LocationChoiceCard
              key={option.id}
              label={option.label}
              subtitle={option.subtitle}
              icon={option.icon}
              active={false}
              compact
              onPress={() => selectEquipmentSetup(option)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.locationCardList}>
          {LOCATION_SELECTION_OPTIONS.map((option) => (
            <LocationChoiceCard
              key={option.id}
              label={option.label}
              subtitle={option.subtitle}
              icon={option.icon}
              focusLabel={option.focusLabel}
              focusTone={option.focusTone}
              active={false}
              onPress={() => selectEquipmentSetup(option)}
            />
          ))}
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
        <View style={[styles.locationTopPane, { height: fixedTopPaneHeight }, topPaneStyle]}>
          <View style={styles.locationTopSlope} />
          <View pointerEvents="none" style={styles.locationProgressBarWrap}>
            <StepDots index={stageIndex} />
          </View>
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
      stepLabel: getQuestionnaireStepLabel('goal'),
      titleLines: ['What do you', 'want most?'],
      subtitle: "We'll build your training around this.",
      options: GOAL_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        subtitle: option.subtitle,
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
    const flames = LEVEL_FLAME_LAYOUTS[selectedLevelIndex] ?? [];

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('level'),
      titleLines: ['Training level'],
      subtitle: 'How much training experience do you have?',
      topPaneStyle: styles.trainingProfileTopPane,
      topCopyStyle: styles.trainingProfileTopCopy,
      titleStyle: styles.trainingProfileHeadline,
      bottomStyle: styles.trainingProfileBottomPane,
      children: (
        <View style={styles.levelStageContent}>
          <View style={styles.levelLogoWrap}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ scale: levelFlamePop }] }]}>
              {flames.map((flame, index) => (
                <View key={`${selectedLevelIndex}-${index}`} style={[styles.levelFlame, { left: flame.x, top: flame.y }]}>
                  <FlameGlyph size={flame.size} opacity={flame.opacity} />
                </View>
              ))}
            </Animated.View>
            <View style={styles.levelLogoRow}>
              <Text style={[styles.levelLogoText, styles.levelLogoInk]}>G</Text>
              <Text style={[styles.levelLogoText, styles.levelLogoPurple]}>AI</Text>
              <Text style={[styles.levelLogoText, styles.levelLogoInk]}>NER</Text>
            </View>
          </View>

          <View style={styles.levelCopyBlock}>
            <Text style={styles.levelTitle}>{selectedLevelOption.label}</Text>
            {selectedLevelOption.lines.map((line) => (
              <Text key={line} style={styles.levelLine}>
                {line}
              </Text>
            ))}
          </View>

          <View
            style={styles.levelSliderTrack}
            onLayout={(event) => setLevelTrackWidth(event.nativeEvent.layout.width)}
          >
            {segmentWidth > 0 ? (
              <Animated.View
                style={[
                  styles.levelSliderThumb,
                  {
                    width: segmentWidth,
                    transform: [
                      {
                        translateX: levelThumbAnim.interpolate({
                          inputRange: [0, LEVEL_SLIDER_OPTIONS.length - 1],
                          outputRange: [0, segmentWidth * (LEVEL_SLIDER_OPTIONS.length - 1)],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ) : null}
            {LEVEL_SLIDER_OPTIONS.map((option, index) => {
              const active = profileLevelSelected && index === selectedLevelIndex;

              return (
                <Pressable
                  key={option.level}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} training level`}
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
                  style={styles.levelSliderSegment}
                >
                  <Text style={[styles.levelSliderLabel, active && styles.levelSliderLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.levelSliderHint}>
            {profileLevelSelected ? 'You can change this anytime.' : 'Pick the level that sounds like you.'}
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
    // switch to self-managed scheduling instead.
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
    setScheduleMode('self_managed');
    setProfileFrequencySelected(true);
  }

  function renderDays() {
    const recommendedDays = getRecommendedDaysForLevel(level);
    const selectedDays = availableDays.length > 0 ? availableDays : DEFAULT_RHYTHM_BY_DAYS[daysPerWeek];
    const restCount = 7 - selectedDays.length;

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('days'),
      titleLines: ['Training days'],
      subtitle: 'How many days per week can you train?',
      topPaneStyle: styles.trainingProfileTopPane,
      topCopyStyle: styles.trainingProfileTopCopy,
      titleStyle: styles.trainingProfileHeadline,
      bottomStyle: styles.trainingProfileBottomPane,
      children: (
        <View style={styles.trainingProfileContent}>
          <View style={styles.daysChipRow}>
            {TRAINING_DAY_COUNT_OPTIONS.map((option) => {
              const active = profileFrequencySelected && daysPerWeek === option;
              const recommended = option === recommendedDays;

              return (
                <View key={option} style={styles.daysChipColumn}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${option} days per week${recommended ? ', recommended for your level' : ''}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => selectTrainingDaysCount(option)}
                    style={[styles.daysChip, active && styles.daysChipActive]}
                  >
                    <Text style={[styles.daysChipText, active && styles.daysChipTextActive]}>{option}</Text>
                  </Pressable>
                  {recommended ? <Text style={styles.daysChipCaption}>Recommended</Text> : null}
                </View>
              );
            })}
          </View>

          <Text style={styles.daysWeekLabel}>TAP DAYS TO ADJUST</Text>
          <View style={styles.daysWeekRow}>
            {WEEKDAY_OPTIONS.map((day) => {
              const dayActive = selectedDays.includes(day);

              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${getWeekdayShortLabel(day)}${dayActive ? ', training day' : ', rest day'}`}
                  accessibilityState={{ selected: dayActive }}
                  onPress={() => toggleTrainingDay(day)}
                  style={[styles.daysWeekCell, dayActive && styles.daysWeekCellActive]}
                >
                  <Text style={[styles.daysWeekCellText, dayActive && styles.daysWeekCellTextActive]}>
                    {WEEKDAY_LETTERS[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.daysSummaryLine}>{`${selectedDays.length} training days · ${restCount} rest`}</Text>
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
    setExpandedCautionArea(area);
  }

  function removeCautionFlag(area: SetupCautionArea) {
    void haptics.select();
    setCautionFlags((current) => current.filter((flag) => flag.area !== area));
    setExpandedCautionArea((current) => (current === area ? null : current));
  }

  function setCautionLevel(area: SetupCautionArea, level: SetupCautionLevel) {
    void haptics.select();
    setCautionFlags((current) => current.map((flag) => (flag.area === area ? { ...flag, level } : flag)));
  }

  function toggleCautionRefinement(area: SetupCautionArea, refinement: string) {
    void haptics.select();
    setCautionFlags((current) =>
      current.map((flag) => {
        if (flag.area !== area) {
          return flag;
        }
        const refinements = flag.refinements.includes(refinement)
          ? flag.refinements.filter((item) => item !== refinement)
          : [...flag.refinements, refinement];
        return { ...flag, refinements };
      }),
    );
  }

  function renderCautionRow(option: { area: SetupCautionArea; label: string }) {
    const flag = cautionFlags.find((item) => item.area === option.area) ?? null;
    const expanded = flag !== null && expandedCautionArea === option.area;
    const colors = flag ? CAUTION_LEVEL_COLORS[flag.level] : null;
    const levelLabel = flag
      ? CAUTION_LEVEL_OPTIONS.find((item) => item.level === flag.level)?.label ?? ''
      : null;
    const refinementOptions = CAUTION_REFINEMENT_OPTIONS[option.area] ?? CAUTION_REFINEMENT_FALLBACK;

    return (
      <View
        key={option.area}
        style={[styles.avoidRow, colors ? { borderColor: colors.ink } : null]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${option.label}${flag ? `, flagged: ${levelLabel}` : ''}`}
          accessibilityState={{ selected: flag !== null, expanded }}
          onPress={() => {
            if (!flag) {
              flagCautionArea(option.area);
              return;
            }
            setExpandedCautionArea((current) => (current === option.area ? null : option.area));
          }}
          style={styles.avoidRowHeader}
        >
          <View style={[styles.avoidRowTile, colors ? { backgroundColor: colors.soft } : null]}>
            <CautionGlyph color={colors ? colors.ink : ONBOARDING_TEXT_MUTED} />
          </View>
          <View style={styles.avoidRowCopy}>
            <Text style={[styles.avoidRowTitle, colors ? { color: colors.ink } : null]}>{option.label}</Text>
            {flag ? <Text style={[styles.avoidRowLevel, { color: colors!.ink }]}>{levelLabel}</Text> : null}
          </View>
          {flag ? (
            <View style={[styles.avoidRowRadio, { borderColor: colors!.ink, backgroundColor: colors!.ink }]}>
              <GymlogIcon name="check" size={12} color="#FFFFFF" />
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
                    accessibilityLabel={`${levelOption.label}: ${levelOption.body}`}
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
                      {active ? <GymlogIcon name="check" size={11} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.avoidLevelCopy}>
                      <Text style={[styles.avoidLevelTitle, active && { color: levelColors.ink }]}>
                        {levelOption.label}
                      </Text>
                      <Text style={styles.avoidLevelBody}>{levelOption.body}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.avoidRefineLabel}>REFINE</Text>
            <View style={styles.avoidRefineRow}>
              {refinementOptions.map((refinement) => {
                const active = flag.refinements.includes(refinement);

                return (
                  <Pressable
                    key={refinement}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={refinement}
                    onPress={() => toggleCautionRefinement(option.area, refinement)}
                    style={[styles.avoidRefineChip, active && styles.avoidRefineChipActive]}
                  >
                    <Text style={[styles.avoidRefineChipText, active && styles.avoidRefineChipTextActive]}>
                      {refinement}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${option.label} flag`}
              onPress={() => removeCautionFlag(option.area)}
              style={styles.avoidRemoveLink}
            >
              <Text style={styles.avoidRemoveText}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  function renderAvoid() {
    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('avoid'),
      titleLines: ['Anything we', 'should avoid?'],
      subtitle: 'Flag a body part and we train around it. Optional.',
      topPaneStyle: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyle: styles.locationEquipmentHeadline,
      children: (
        <View style={styles.avoidList}>
          {AVOID_AREA_OPTIONS.map((option) => renderCautionRow(option))}
          {avoidExtraVisible ? AVOID_EXTRA_AREA_OPTIONS.map((option) => renderCautionRow(option)) : null}

          {!avoidExtraVisible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add something else"
              onPress={() => {
                void haptics.select();
                setAvoidExtraVisible(true);
              }}
              style={styles.avoidGhostRow}
            >
              <Text style={styles.avoidGhostText}>+ Add something else</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nothing to note"
            onPress={() => {
              void haptics.select();
              setCautionFlags([]);
              setExpandedCautionArea(null);
            }}
            style={styles.avoidGhostRow}
          >
            <Text style={styles.avoidGhostText}>Nothing to note</Text>
          </Pressable>
        </View>
      ),
    });
  }

  function renderReview() {
    if (planReadyView === 'progression') {
      return renderPlanReadyProgression();
    }
    if (planReadyView === 'day') {
      return renderPlanReadyDay();
    }
    const planReadyWeeks = planReadyPayload.blockLengthWeeks > 0 ? planReadyPayload.blockLengthWeeks : 4;
    const planReadyPerWeek =
      planReadyPayload.programDaysPerWeek
      || projectedDaysPerWeek
      || planReadyPayload.requestedDaysPerWeek
      || 3;
    const planReadyTotalWorkouts = planReadyWeeks * planReadyPerWeek;
    const planReadySessionLength =
      projectedSessions[0]?.guidance?.estimatedDuration
      ?? getTrainingProfileSetupSummary(level, daysPerWeek).duration.replace(' sessions', '');
    const planReadyMeta = [`${planReadyWeeks}-week plan`, goalLabel, locationLabel]
      .filter((part) => Boolean(part && part.trim()))
      .join('  ·  ');
    const planReadyStats: Array<[string, string]> = [
      [String(planReadyTotalWorkouts), 'workouts total'],
      [`${planReadyWeeks}`, planReadyWeeks === 1 ? 'week' : 'weeks'],
      [planReadySessionLength, 'per session'],
    ];
    const planReadyPrimaryTitle = recommendedProgramPresentation?.title ?? planReadyPayload.title;
    const planReadyWaterfall = recommendation.waterfall;
    const planReadyWhyPrimary =
      planReadyWaterfall && activeRecommendedProgramId === planReadyWaterfall.primaryProgramId
        ? planReadyWaterfall.whyPrimary
        : planReadyWaterfall && activeRecommendedProgramId === planReadyWaterfall.alternativeProgramId
          ? planReadyWaterfall.whyAlternative
          : null;
    const planReadyAlternative = alternativeRecommendationPrograms[0] ?? null;
    const planReadyWhyAlternative = planReadyAlternative
      ? planReadyWaterfall && planReadyAlternative.id === planReadyWaterfall.alternativeProgramId
        ? planReadyWaterfall.whyAlternative
        : planReadyWaterfall && planReadyAlternative.id === planReadyWaterfall.primaryProgramId
          ? planReadyWaterfall.whyPrimary
          : planReadyAlternative.tradeoffNote
      : null;

    return (
      <Animated.View
        style={[
          styles.planReadyOverviewStage,
          {
            paddingTop: insets.top + spacing.lg,
            opacity: planReadyCardOpacity,
            transform: [{ translateX: planReadyCardTranslateX }],
          },
        ]}
      >
        <Text style={styles.planReadyOverviewHeading}>Your program is ready</Text>
        {planReadyMeta ? <Text style={styles.planReadyOverviewMeta}>{planReadyMeta}</Text> : null}

        <View style={styles.planReadyPrimaryCard}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="planReadyCoverGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#5B21B6" />
                <Stop offset="1" stopColor={ONBOARDING_PRIMARY} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx="24" ry="24" fill="url(#planReadyCoverGradient)" />
          </Svg>
          <View style={styles.planReadyPrimaryBadge}>
            <Text style={styles.planReadyPrimaryBadgeText}>RECOMMENDED</Text>
          </View>
          <View style={styles.planReadyPrimaryBody}>
            <Text style={styles.planReadyPrimaryName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {planReadyPrimaryTitle}
            </Text>
            <Text style={styles.planReadyPrimaryMeta}>{`${planReadyPerWeek} workouts a week`}</Text>
            {planReadyWhyPrimary || activeRecommendationMismatchNote ? (
              <Text style={styles.planReadyPrimaryWhy} numberOfLines={3}>
                {planReadyWhyPrimary ?? activeRecommendationMismatchNote}
              </Text>
            ) : null}
            {recommendedProgramTags.length > 0 ? (
              <View style={styles.planReadyPrimaryTagRow}>
                {recommendedProgramTags.map((tag) => (
                  <View key={tag} style={styles.planReadyPrimaryTag}>
                    <Text style={styles.planReadyPrimaryTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.planReadyOverviewStatRow}>
            {planReadyStats.map(([value, label]) => (
              <View key={label} style={styles.planReadyOverviewStat}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.planReadyOverviewStatValue}>
                  {value}
                </Text>
                <Text style={styles.planReadyOverviewStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View the first training week"
            onPress={() => {
              void haptics.select();
              setPlanReadyWorkoutPage(0);
              setPlanReadyView('day');
            }}
            style={({ pressed }) => [styles.planReadyPrimaryLink, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.planReadyPrimaryLinkText}>View the week</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="m9 6 6 6-6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>

        {planReadyAlternative ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to the alternative program ${planReadyAlternative.presentation.title}`}
            onPress={() => {
              void haptics.select();
              setSelectedRecommendationProgramId(planReadyAlternative.id);
            }}
            style={({ pressed }) => [styles.planReadyAltCard, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.planReadyAltCopy}>
              <Text style={styles.planReadyAltEyebrow}>ALTERNATIVE</Text>
              <Text style={styles.planReadyAltName} numberOfLines={1}>
                {planReadyAlternative.presentation.title}
              </Text>
              {planReadyWhyAlternative ? (
                <Text style={styles.planReadyAltWhy} numberOfLines={2}>
                  {planReadyWhyAlternative}
                </Text>
              ) : null}
            </View>
            <View style={styles.planReadyAltCta}>
              <Text style={styles.planReadyAltCtaText}>Switch</Text>
            </View>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  function renderPlanReadyDay() {
    const days = projectedSessions;
    const dayCount = Math.max(days.length, 1);
    const selectedIndex = Math.min(Math.max(planReadyWorkoutPage, 0), dayCount - 1);
    const selectedSession = days[selectedIndex] ?? null;
    const planReadyWeeks = planReadyPayload.blockLengthWeeks > 0 ? planReadyPayload.blockLengthWeeks : 4;
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
    const dayTitle = selectedSession?.name ?? `Day ${selectedIndex + 1}`;
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
            <Text style={styles.planReadyDayKicker}>{`DAY ${selectedIndex + 1} OF ${dayCount}`}</Text>
            <Text style={styles.planReadyDayTitle}>{dayTitle}</Text>
          </View>
          <View style={styles.planReadyDayWeekBadge}>
            <Text style={styles.planReadyDayWeekBadgeText}>{`Week 1 of ${planReadyWeeks}`}</Text>
          </View>
        </View>

        <View style={styles.planReadyDayMetaRow}>
          {dayDuration ? (
            <View style={styles.planReadyDayMetaItem}>
              <GymlogIcon name="tempo" color={ONBOARDING_TEXT_SOFT} size={15} />
              <Text style={styles.planReadyDayMetaText}>{dayDuration}</Text>
            </View>
          ) : null}
          <View style={styles.planReadyDayMetaItem}>
            <GymlogIcon name="progress" color={ONBOARDING_TEXT_SOFT} size={15} />
            <Text style={styles.planReadyDayMetaText}>{levelLabel}</Text>
          </View>
        </View>

        <Text style={styles.planReadyDayExercisesLabel}>
          {`${dayExercises.length} ${dayExercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}`}
        </Text>
        <View style={styles.planReadyDayExerciseList}>
          {dayExercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.planReadyDayExerciseRow}>
              <Text style={styles.planReadyDayExerciseNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.planReadyDayExerciseCopy}>
                <Text style={styles.planReadyDayExerciseName} numberOfLines={1}>{exercise.name}</Text>
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

  function renderPlanReadyProgression() {
    const stageMinHeight = Math.max(
      560,
      Dimensions.get('window').height - insets.top - insets.bottom - spacing.xl,
    );
    const enabled = automatedProgressionEnabled;

    return (
      <Animated.View
        style={[
          styles.planReadyProgressionStage,
          {
            minHeight: stageMinHeight,
            paddingTop: insets.top + spacing.xl,
            opacity: planReadyCardOpacity,
            transform: [{ translateX: planReadyCardTranslateX }],
          },
        ]}
      >
        <Text style={styles.progressionKicker}>ONE LAST THING</Text>
        <Text style={styles.progressionTitle}>Automated progression</Text>
        <Text style={styles.progressionSubtitle}>
          {enabled ? 'On — GAINER adjusts your plan for you.' : "Off — you'll manage these yourself."}
        </Text>

        <View style={[styles.progressionCard, enabled && styles.progressionCardOn]}>
          <View style={styles.progressionToggleRow}>
            <View style={styles.progressionToggleCopy}>
              <Text style={styles.progressionToggleTitle}>Automated progression</Text>
              <Text style={styles.progressionToggleBody}>
                {enabled ? 'GAINER adjusts your plan for you' : "You'll manage these yourself"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Automated progression"
              accessibilityState={{ checked: enabled }}
              onPress={() => {
                void haptics.select();
                setAutomatedProgressionEnabled((current) => !current);
              }}
              style={[styles.progressionSwitchTrack, enabled && styles.progressionSwitchTrackOn]}
            >
              <View style={styles.progressionSwitchThumb} />
            </Pressable>
          </View>

          <View style={styles.progressionDivider} />

          <View style={styles.progressionBulletList}>
            {PROGRESSION_BULLETS.map((bullet) => (
              <View key={bullet} style={styles.progressionBulletRow}>
                {enabled ? (
                  <View style={styles.progressionBulletCheck}>
                    <GymlogIcon name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.progressionBulletCross}>
                    <Text style={styles.progressionBulletCrossText}>✕</Text>
                  </View>
                )}
                <Text style={[styles.progressionBulletText, !enabled && styles.progressionBulletTextOff]}>
                  {bullet}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.progressionNote}>You can change this anytime in Settings.</Text>
      </Animated.View>
    );
  }

  function renderPlanning() {
    const visibleFocusOptions = FOCUS_AREA_OPTIONS.filter((option) => option.area !== 'mobility');

    return renderOnboardingShell({
      stepLabel: getQuestionnaireStepLabel('planning'),
      titleLines: ['What do you', 'want to focus on?'],
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
                  accessibilityLabel={`${option.title}${
                    caution === 'avoid'
                      ? ', flagged avoid entirely'
                      : caution === 'careful'
                        ? ', flagged be careful'
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
                    {option.title}
                  </Text>
                  <View style={[styles.focusListRadio, active && styles.focusListRadioActive]}>
                    {active ? <GymlogIcon name="check" size={12} color={ONBOARDING_PRIMARY} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.focusAreaInfoBox}>
            <View style={styles.focusAreaInfoIcon}>
              <GymlogIcon name="lightning" color="#F2B705" size={20} />
            </View>
            <View style={styles.focusAreaInfoCopy}>
              <Text style={styles.focusAreaInfoTitle}>Why focus areas?</Text>
              <Text style={styles.focusAreaInfoBody}>
                This helps us build a program that prioritizes what matters most to you.
              </Text>
            </View>
            <View style={styles.focusAreaInfoBadge}>
              <Text style={styles.focusAreaInfoBadgeText}>Pick 1-2 areas</Text>
            </View>
          </View>
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
    const recommendationFlowItems = projectedSessions.slice(0, 3).map((session, index) => ({
      id: session.id,
      day: projectedRhythm[index] ?? `Day ${index + 1}`,
      title: formatWorkoutDisplayLabel(session.name, 'Workout'),
      label: index === 0 ? 'Start here' : index === projectedSessions.slice(0, 3).length - 1 ? 'Finish' : 'Then',
    }));

    function renderRecommendationRefinementPanel() {
      if (activeRecommendationRefinement === 'schedule') {
        return (
          <View style={styles.refinementPanel}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleHeaderCopy}>
                <Text style={styles.scheduleTitle}>Week setup</Text>
                <Text style={styles.scheduleBody}>Only if needed.</Text>
              </View>
              <PreviewGlyph dayCount={projectedDaysPerWeek} />
            </View>

            <View style={styles.scheduleMiniRow}>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>Current rhythm</Text>
                <View style={styles.recommendationRhythmRow}>
                  {projectedRhythm.map((day) => (
                    <View key={day} style={styles.recommendationDayPill}>
                      <Text style={styles.recommendationDayText}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>Time</Text>
                <Text style={styles.scheduleMiniValue}>~{effectiveWeeklyMinutes} min</Text>
                <Text style={styles.scheduleMiniMeta}>{scheduleModeLabel}</Text>
              </View>
            </View>

            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Schedule style</Text>
              <View style={styles.choiceRow}>
                {SCHEDULE_MODE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.mode}
                    label={option.title}
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
              <Text style={styles.optionLabel}>Weekly time</Text>
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
                <Text style={styles.optionLabel}>Which days work?</Text>
                <View style={styles.choiceRow}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <ChoiceChip
                      key={day}
                      label={getWeekdayShortLabel(day)}
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
            <Text style={styles.personalizationTitle}>Extra focus</Text>
            <Text style={styles.personalizationBody}>Pick what matters most.</Text>
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
                      {getFocusAreaTitle(area)}
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
            <Text style={styles.buildOwnKicker}>Custom</Text>
            <Text style={styles.buildOwnTitle}>{guidanceMode === 'self_directed' ? 'Use this as your base?' : 'Build your own?'}</Text>
            <Text style={styles.buildOwnBody}>{guidanceMode === 'self_directed' ? 'Open this as your base.' : 'Open a custom version.'}</Text>
            <Pressable
              onPress={() =>
                runAction(() =>
                  onCompleteToCustom(
                    selection,
                    activeRecommendedProgramId,
                    buildFirstRunCustomProgramName(selection),
                  ),
                )
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Build my own</Text>
            </Pressable>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'ai') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>Ask GAINER AI</Text>
            <Text style={styles.personalizationBody}>Ask about this exact fit.</Text>
            <Pressable
              onPress={() => openHelper(helperSuggestions[1] ?? helperSuggestions[0] ?? helperPrompt)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open AI</Text>
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
          <Text style={styles.title}>Start with this week</Text>
          <Text style={styles.body}>Train first. Tweak later.</Text>
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
                <Text style={styles.recommendationSectionLabel}>Coming up</Text>
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
          <Text style={styles.personalizationKicker}>Tune</Text>
          <Text style={styles.personalizationTitle}>Change only what needs it</Text>
          <Text style={styles.personalizationBody}>Leave closed if this fits.</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip
              label="Week"
              active={activeRecommendationRefinement === 'schedule'}
              onPress={() => toggleRecommendationRefinement('schedule')}
            />
            <ChoiceChip
              label="Focus"
              active={activeRecommendationRefinement === 'focus'}
              onPress={() => toggleRecommendationRefinement('focus')}
            />
            <ChoiceChip
              label="Build my own"
              active={activeRecommendationRefinement === 'custom'}
              onPress={() => toggleRecommendationRefinement('custom')}
            />
            <ChoiceChip
              label="GAINER AI"
              active={activeRecommendationRefinement === 'ai'}
              onPress={() => toggleRecommendationRefinement('ai')}
            />
          </View>
          {activeRecommendationRefinement ? renderRecommendationRefinementPanel() : null}
        </SurfaceCard>

        <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))} style={styles.recommendationBackButton}>
          <Text style={styles.secondaryText}>Back to setup</Text>
        </Pressable>
      </View>
    );
  }

  function renderBuildingPlan() {
    const activePhaseIndex = Math.min(buildingPlanPhaseIndex, buildingPlanPhases.length - 1);
    const pulseScale = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.045],
    });
    const pulseOpacity = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.64, 1],
    });
    const buildingPlanAnimatedEllipsis = '.'.repeat(buildingPlanEllipsisStep + 1);

    return (
      <Animated.View style={[styles.buildingPlanScreen, { opacity: buildingPlanScreenOpacity }]}>
        {showBuildingPlanThinking ? (
          <Animated.View style={[styles.buildingPlanThinkingScene, { opacity: buildingPlanThinkingOpacity }]}>
            <View style={styles.buildingPlanThinkingCenter}>
              <Animated.Text style={[styles.buildingPlanThinkingText, { opacity: buildingPlanCaptionOpacity }]}>
                {buildingPlanComplete ? 'Your plan is ready' : `Building your plan${buildingPlanAnimatedEllipsis}`}
              </Animated.Text>

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
                        active && { opacity: pulseOpacity },
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
                          <Animated.View style={[styles.buildingPlanStepActiveDot, { transform: [{ scale: pulseScale }] }]} />
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
      ? profileFrequencySelected
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
      ? 'Saving plan...'
      : stage === 'review'
      ? planReadyView === 'day'
        ? 'Back to plan'
        : planReadyView === 'progression'
        ? 'Start training'
        : 'Continue'
      : stage === 'planning'
      ? 'Build my plan'
      : stage === 'avoid'
      ? cautionFlags.length > 0
        ? 'Continue'
        : 'Skip'
      : 'Continue';
  // The footer stays visible through every plan-ready view: overview continues
  // to the progression screen, the day view returns to the plan, and the
  // progression screen's "Start training" completes onboarding.
  const footerVisible = true;
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

  return (
    <View style={[styles.root, styles.rootLight]}>
      {locationStageActive ? <View pointerEvents="none" style={[styles.locationTopSafeArea, { height: insets.top }]} /> : null}
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
              paddingBottom: stage === 'review'
                ? insets.bottom + spacing.xs
                : locationStageActive
                ? insets.bottom + spacing.xs
                : spacing.md + insets.bottom,
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
                    setPlanReadyView('overview');
                    return;
                  }
                  if (planReadyView === 'overview') {
                    setPlanReadyView('progression');
                    return;
                  }
                  void runAction(() => onCompleteToTraining(selection, activeRecommendedProgramId));
                  return;
                }

                setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
              }}
              disabled={!canContinue || busy}
              style={styles.onboardingPrimaryCTA}
            />

            {stage === 'review' ? (
              planReadyView === 'progression' ? (
                <Pressable onPress={() => setPlanReadyView('overview')} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark, styles.footerBackText]}>Back</Text>
                </Pressable>
              ) : null
            ) : stage === 'location' ? (
              editMode ? (
                <Pressable onPress={() => runAction(() => onCancel?.())} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark, styles.footerBackText]}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => runAction(onBackToEntry ?? onSkip)} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark, styles.footerBackText]}>Back</Text>
                </Pressable>
              )
            ) : (
              <Pressable
                onPress={() => {
                  setStageIndex((current) => Math.max(0, current - 1));
                }}
                disabled={busy}
              >
                <Text style={[styles.secondaryText, styles.secondaryTextDark, styles.footerBackText]}>Back</Text>
              </Pressable>
            )}
          </>
          {busy ? <ActivityIndicator color={ONBOARDING_TEXT} size="small" /> : null}
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
                <Text style={styles.sheetKicker}>GAINER AI</Text>
        <Text style={styles.sheetTitle}>Ask GAINER AI</Text>
              </View>
              <Pressable onPress={() => setHelperVisible(false)}>
                <Text style={styles.sheetClose}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetBody}>Ask one clear question.</Text>

            <TextInput
              value={helperDraft}
              onChangeText={setHelperDraft}
              placeholder="Best first plan?"
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
          <Text style={styles.primaryButtonText}>Ask AI</Text>
            </Pressable>

            {helperState === 'loading' ? (
              <View style={styles.helperStatusBlock}>
                <ActivityIndicator color="#F3F7FF" size="small" />
                <Text style={styles.helperStatusText}>GAINER GAINER AI is answering.</Text>
              </View>
            ) : null}

            {helperState === 'error' ? <Text style={styles.helperErrorText}>{helperError}</Text> : null}

            {helperState === 'ready' && helperAnswer ? (
              <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent} showsVerticalScrollIndicator={false}>
                <View style={styles.answerHeaderRow}>
                  <Text style={styles.answerSection}>Answer</Text>
                  <BadgePill label={helperSource === 'live' ? 'Live' : 'Preview'} accent="neutral" />
                </View>
                {helperNote ? <Text style={styles.answerNote}>{helperNote}</Text> : null}

                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Answer</Text>
                  <Text style={styles.answerText}>{helperAnswer.takeaway}</Text>
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Why</Text>
                  {helperAnswer.why.map((item) => (
                    <Text key={item} style={styles.answerBullet}>- {item}</Text>
                  ))}
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Do next</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootLight: {
    backgroundColor: ONBOARDING_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewLight: {
    backgroundColor: ONBOARDING_BG,
  },
  scrollViewDark: {
    backgroundColor: ONBOARDING_BG,
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
  locationProgressBarWrap: {
    position: 'absolute',
    top: 54,
    left: spacing.lg * 2,
    right: spacing.lg * 2,
    zIndex: 3,
    minHeight: 12,
    justifyContent: 'center',
  },
  dot: {
    flex: 1,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: '#E6DEF6',
  },
  dotLight: {
    backgroundColor: '#E6DEF6',
  },
  dotActive: {
    backgroundColor: ONBOARDING_PRIMARY,
  },
  dotActiveLight: {
    backgroundColor: ONBOARDING_PRIMARY,
  },
  stageBody: {
    gap: spacing.lg,
  },
  locationStageShell: {
    backgroundColor: ONBOARDING_PANEL,
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
  },
  locationTopSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: ONBOARDING_TOP,
    zIndex: 10,
  },
  locationTopPane: {
    backgroundColor: ONBOARDING_TOP,
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
    height: 206,
    paddingTop: 36,
    paddingBottom: 12,
  },
  locationTopSlope: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: -36,
    height: 72,
    backgroundColor: ONBOARDING_PANEL,
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
    paddingTop: 58,
    paddingBottom: 0,
    gap: 2,
  },
  locationTopCopyProfile: {
    paddingTop: 14,
  },
  locationStepLabel: {
    color: ONBOARDING_PRIMARY,
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
    color: ONBOARDING_TEXT,
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
  locationSubtitle: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  locationBottomPane: {
    backgroundColor: ONBOARDING_PANEL,
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
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER_ACTIVE,
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
    color: ONBOARDING_TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  equipmentExpandedCount: {
    color: ONBOARDING_PRIMARY,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  equipmentExpandedCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ONBOARDING_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentChipsPrompt: {
    color: ONBOARDING_TEXT_SOFT,
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
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  equipmentChipActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  equipmentChipText: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  equipmentChipTextActive: {
    color: '#5B21B6',
    fontWeight: '800',
  },
  equipmentOrChooseLabel: {
    color: ONBOARDING_TEXT_MUTED,
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
    width: 280,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  levelLogoText: {
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -0.92,
  },
  levelLogoInk: {
    color: ONBOARDING_TEXT,
  },
  levelLogoPurple: {
    color: ONBOARDING_PRIMARY,
  },
  levelFlame: {
    position: 'absolute',
  },
  levelCopyBlock: {
    alignItems: 'center',
    gap: 3,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  levelTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  levelLine: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 13.5,
    lineHeight: 18.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  levelSliderTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: '#EDE6FB',
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
    backgroundColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
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
  levelSliderLabel: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 14,
    fontWeight: '800',
  },
  levelSliderLabelActive: {
    color: '#FFFFFF',
  },
  levelSliderHint: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 12,
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
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysChipActive: {
    borderColor: ONBOARDING_PRIMARY,
    backgroundColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  daysChipText: {
    color: ONBOARDING_TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  daysChipTextActive: {
    color: '#FFFFFF',
  },
  daysChipCaption: {
    color: ONBOARDING_PRIMARY,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  daysWeekLabel: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 11,
    lineHeight: 14,
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
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysWeekCellActive: {
    borderColor: ONBOARDING_PRIMARY,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  daysWeekCellText: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 14,
    fontWeight: '800',
  },
  daysWeekCellTextActive: {
    color: '#FFFFFF',
  },
  daysSummaryLine: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  avoidList: {
    gap: 8,
  },
  avoidRow: {
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
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
    backgroundColor: '#F1F0F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  avoidRowTitle: {
    color: ONBOARDING_TEXT,
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
    borderColor: ONBOARDING_BORDER,
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
    borderColor: ONBOARDING_BORDER,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  avoidLevelRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidLevelCopy: {
    flex: 1,
    minWidth: 0,
  },
  avoidLevelTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  avoidLevelBody: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  avoidRefineLabel: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  avoidRefineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  avoidRefineChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  avoidRefineChipActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  avoidRefineChipText: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  avoidRefineChipTextActive: {
    color: '#5B21B6',
    fontWeight: '800',
  },
  avoidRemoveLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  avoidRemoveText: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 12.5,
    fontWeight: '700',
  },
  avoidGhostRow: {
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  avoidGhostText: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 13.5,
    fontWeight: '700',
  },
  focusListStack: {
    gap: 7,
  },
  focusListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  focusListRowActive: {
    backgroundColor: ONBOARDING_PRIMARY,
    borderColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  focusListLabel: {
    flex: 1,
    color: ONBOARDING_TEXT,
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
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusListRadioActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  planReadyProgressionStage: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  progressionKicker: {
    color: ONBOARDING_PRIMARY,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  progressionTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  progressionSubtitle: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  progressionCard: {
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER,
    borderRadius: 20,
    padding: 18,
    marginTop: 22,
  },
  progressionCardOn: {
    borderColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  progressionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressionToggleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  progressionToggleTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  progressionToggleBody: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  progressionSwitchTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#E3DAF5',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  progressionSwitchTrackOn: {
    backgroundColor: ONBOARDING_PRIMARY,
    alignItems: 'flex-end',
  },
  progressionSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1E1246',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  progressionDivider: {
    height: 1,
    backgroundColor: ONBOARDING_BORDER,
    marginVertical: 14,
  },
  progressionBulletList: {
    gap: 11,
  },
  progressionBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressionBulletCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ONBOARDING_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressionBulletCross: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F0F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressionBulletCrossText: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
  },
  progressionBulletText: {
    flex: 1,
    color: ONBOARDING_TEXT,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  progressionBulletTextOff: {
    color: ONBOARDING_TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  progressionNote: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  locationStepOneOptionsShift: {
    transform: [{ translateY: -36 }],
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
  locationSectionLabel: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  locationAfterBlock: {
    marginTop: 6,
    gap: 8,
  },
  locationAfterBlockProfile: {
    paddingBottom: 20,
  },
  trainingProfileTopPane: {
    height: 150,
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingBottom: 8,
  },
  trainingProfileTopCopy: {
    paddingTop: 58,
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
  trainingProfileSection: {
    gap: 7,
  },
  trainingProfileExperienceHeader: {
    gap: 3,
  },
  trainingProfileExperienceTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  trainingProfileSectionPrompt: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  trainingProfileSummaryRow: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  trainingProfileSummaryRowActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  trainingProfileSummaryCheck: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ONBOARDING_PRIMARY,
  },
  trainingProfileSummaryText: {
    flex: 1,
    color: ONBOARDING_TEXT,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  trainingProfileSummaryEdit: {
    color: ONBOARDING_PRIMARY,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  trainingExperienceList: {
    gap: 8,
  },
  trainingExperienceCard: {
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingExperienceCardActive: {
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  trainingExperienceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trainingExperienceTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trainingExperienceTitleActive: {
    color: ONBOARDING_TEXT,
  },
  trainingExperienceBody: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  trainingExperienceBodyActive: {
    color: ONBOARDING_TEXT_SOFT,
  },
  trainingProfileRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  trainingProfileRadioActive: {
    borderColor: ONBOARDING_PRIMARY,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  trainingFrequencyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trainingFrequencyBadge: {
    borderRadius: 999,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER_ACTIVE,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  trainingFrequencyBadgeText: {
    color: ONBOARDING_PRIMARY,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trainingGenderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trainingGenderTile: {
    flex: 1,
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 3,
  },
  trainingGenderTileActive: {
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  trainingGenderTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  trainingGenderBody: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  trainingPlanPreviewStrip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
    gap: 10,
  },
  trainingPlanPreviewLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trainingPlanPreviewTitle: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  trainingWeekRhythmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 3,
  },
  trainingWeekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  trainingWeekDayLabel: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trainingWeekDayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingWeekDayIconActive: {
    backgroundColor: ONBOARDING_PRIMARY,
  },
  trainingPlanPreviewDivider: {
    height: 1,
    backgroundColor: '#EFEAF9',
  },
  trainingPlanMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  trainingPlanMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trainingPlanMetricSeparator: {
    width: 1,
    backgroundColor: '#EFEAF9',
    marginHorizontal: 8,
  },
  trainingPlanMetricLabel: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  trainingPlanMetricValue: {
    color: ONBOARDING_TEXT,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  trainingSetupCard: {
    borderRadius: 12,
    backgroundColor: ONBOARDING_PRIMARY_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
  },
  trainingSetupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingSetupTitle: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },
  trainingSetupGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  trainingSetupColumn: {
    flex: 1,
    gap: 5,
  },
  trainingSetupDivider: {
    width: 1,
    backgroundColor: ONBOARDING_BORDER,
  },
  trainingSetupMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  trainingSetupMetricText: {
    flex: 1,
    color: ONBOARDING_TEXT,
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
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
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
    backgroundColor: ONBOARDING_PRIMARY,
    borderColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  locationChoiceCardSubdued: {
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
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
    color: ONBOARDING_TEXT,
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
    backgroundColor: '#F2ECFF',
  },
  locationFocusBadgeGreen: {
    backgroundColor: '#E8F7EE',
  },
  locationFocusBadgeBlue: {
    backgroundColor: '#E1ECFB',
  },
  locationFocusBadgePurple: {
    backgroundColor: '#EFE7FF',
  },
  locationFocusBadgeText: {
    fontSize: 10.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.42,
    textTransform: 'uppercase',
  },
  locationFocusBadgeTextNeutral: {
    color: ONBOARDING_TEXT_SOFT,
  },
  locationFocusBadgeTextGreen: {
    color: '#16A34A',
  },
  locationFocusBadgeTextBlue: {
    color: '#0A84FF',
  },
  locationFocusBadgeTextPurple: {
    color: ONBOARDING_PRIMARY,
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
    color: ONBOARDING_TEXT_SOFT,
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
  locationChoiceBenefitsPanel: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: 7,
  },
  locationChoiceBenefitsKicker: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 1.26,
  },
  locationChoiceBenefitsList: {
    gap: 7,
  },
  locationChoiceBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationChoiceBenefitCheck: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationChoiceBenefitText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  locationChoiceRadio: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  locationChoiceRadioLeading: {
    marginLeft: 0,
    marginRight: 0,
    borderColor: ONBOARDING_BORDER,
  },
  locationChoiceRadioActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  locationChoiceRadioCheck: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  locationChoiceRadioCheckShort: {
    position: 'absolute',
    width: 7,
    height: 2.4,
    left: 1,
    top: 9,
    borderRadius: 2,
    backgroundColor: ONBOARDING_PRIMARY,
    transform: [{ rotate: '45deg' }],
  },
  locationChoiceRadioCheckLong: {
    position: 'absolute',
    width: 13,
    height: 2.4,
    left: 5,
    top: 6,
    borderRadius: 2,
    backgroundColor: ONBOARDING_PRIMARY,
    transform: [{ rotate: '-45deg' }],
  },
  locationStageBody: {
    gap: spacing.md,
  },
  profileStageBody: {
    gap: spacing.sm + 2,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  locationHeroBlock: {
    gap: 2,
  },
  profileHeroBlock: {
    gap: 3,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  kickerLight: {
    color: 'rgba(6,8,11,0.52)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  titleLight: {
    color: '#06080B',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bodyLight: {
    color: 'rgba(6,8,11,0.72)',
  },
  selectionList: {
    gap: spacing.xs + 2,
  },
  locationSelectionList: {
    gap: spacing.xs,
  },
  locationOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  locationOptionCell: {
    width: '48.5%',
  },
  setupOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  goalGridItem: {
    width: '48.4%',
  },
  setupOptionGridItem: {
    width: '47.8%',
  },
  profileCheckList: {
    gap: spacing.xs,
  },
  profileCheckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  profileCheckGridItem: {
    width: '48.8%',
  },
  profileCheckRow: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileCheckRowActive: {
    borderColor: '#06080B',
    backgroundColor: '#F7F8FA',
  },
  profileCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.24)',
    backgroundColor: '#FFFFFF',
  },
  profileCheckBoxActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  profileCheckMark: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
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
    color: '#06080B',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  profileCheckTitleActive: {
    color: '#06080B',
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
    backgroundColor: '#06080B',
  },
  profileCheckBadge: {
    minHeight: 20,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  profileCheckBadgeActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  profileCheckBadgeText: {
    color: 'rgba(6,8,11,0.62)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileCheckBadgeTextActive: {
    color: '#FFFFFF',
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
  ageSliderCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  ageSliderHeader: {
    gap: 2,
  },
  ageSliderEyebrow: {
    color: 'rgba(6,8,11,0.48)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ageSliderValue: {
    color: '#06080B',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  ageSliderTrackArea: {
    height: 22,
    justifyContent: 'center',
  },
  ageSliderTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(6,8,11,0.10)',
  },
  ageSliderTrackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: '#06080B',
  },
  ageSliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: '#06080B',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  ageSliderTickRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ageSliderTickPress: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageSliderTick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(6,8,11,0.24)',
  },
  ageSliderTickActive: {
    backgroundColor: '#06080B',
  },
  ageSliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  ageSliderLabelPress: {
    minHeight: 22,
    justifyContent: 'center',
  },
  ageSliderLabel: {
    color: 'rgba(6,8,11,0.50)',
    fontSize: 11,
    fontWeight: '800',
  },
  ageSliderLabelActive: {
    color: '#06080B',
  },
  bodyweightStepperBlock: {
    gap: 8,
  },
  bodyweightPickerLabel: {
    color: ONBOARDING_TEXT,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bodyweightUnitPill: {
    minWidth: 40,
    minHeight: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  bodyweightUnitPillActive: {
    borderColor: ONBOARDING_PRIMARY,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  bodyweightUnitText: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyweightUnitTextActive: {
    color: '#FFFFFF',
  },
  bodyweightTargetBlock: {
    marginTop: 10,
    gap: 5,
  },
  bodyweightTargetHeader: {
    gap: 2,
  },
  bodyweightTargetHint: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  bodyweightTargetCard: {
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  bodyweightTargetValueWrap: {
    width: 172,
    minHeight: 58,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightTargetValueInput: {
    minWidth: 104,
    color: ONBOARDING_TEXT,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
    padding: 0,
  },
  bodyweightTargetStepButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ONBOARDING_CARD,
    overflow: 'hidden',
  },
  bodyweightTargetStepText: {
    color: ONBOARDING_TEXT,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: -1 }],
  },
  bodyweightTargetMinusText: {
    fontSize: 39,
    lineHeight: 40,
    transform: [{ translateY: -3 }],
  },
  bodyweightTargetAddButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ONBOARDING_PRIMARY,
    paddingHorizontal: spacing.lg,
  },
  bodyweightTargetAddText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  bodyweightStepperUnitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  bodyweightStepperUnitPill: {
    minHeight: 24,
  },
  bodyweightSupportText: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  bodyweightStageShell: {
    backgroundColor: ONBOARDING_PANEL,
  },
  bodyweightTopPane: {
    justifyContent: 'flex-start',
    height: 214,
    paddingTop: 24,
    paddingBottom: 8,
  },
  bodyweightTopCopy: {
    paddingTop: 58,
    paddingBottom: 0,
    gap: 3,
  },
  bodyweightHeadline: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
  },
  bodyweightBottomPane: {
    paddingTop: 0,
  },
  bodyweightGoalBlock: {
    marginTop: 10,
  },
  bodyweightGoalStepList: {
    gap: 18,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  bodyweightGoalPrompt: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: -7,
    marginBottom: 8,
  },
  bodyweightGoalGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  bodyweightGoalTrendIcon: {
    marginBottom: 1,
  },
  bodyweightGoalCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  bodyweightGoalCardWide: {
    flex: 0,
    minHeight: 97,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 15,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: ONBOARDING_CARD,
    overflow: 'hidden',
  },
  bodyweightGoalCardActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
  },
  bodyweightGoalCardWideActive: {
    backgroundColor: ONBOARDING_PRIMARY,
    borderColor: ONBOARDING_PRIMARY,
    shadowColor: ONBOARDING_PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  bodyweightGoalCardActiveBloom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  bodyweightGoalIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightGoalIconBubbleWide: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EFE7FF',
    zIndex: 1,
  },
  bodyweightGoalIconBubbleActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bodyweightGoalCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    zIndex: 1,
  },
  bodyweightGoalCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
  },
  bodyweightGoalCardTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  bodyweightGoalCardTitleActive: {
    color: '#FFFFFF',
  },
  bodyweightGoalCardBody: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  bodyweightGoalCardBodyActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  bodyweightSliderCard: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 14,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  bodyweightSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bodyweightSliderValue: {
    color: ONBOARDING_TEXT,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  bodyweightSliderClearText: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  bodyweightSliderTrackWrap: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  bodyweightSliderTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#E6DEF6',
  },
  bodyweightSliderTrackActive: {
    position: 'absolute',
    left: 0,
    top: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  bodyweightSliderThumb: {
    position: 'absolute',
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ONBOARDING_PRIMARY,
    marginLeft: -4,
  },
  bodyweightSummaryRow: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  bodyweightSummaryCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ONBOARDING_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  bodyweightSummaryValue: {
    color: ONBOARDING_TEXT,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  bodyweightSummaryEdit: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  bodyweightSummaryEditText: {
    color: ONBOARDING_PRIMARY,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  bodyweightTimelineCard: {
    minHeight: 236,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 15,
  },
  bodyweightTimelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  bodyweightTimelineTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  bodyweightTimelineChart: {
    height: 140,
    marginTop: 10,
    overflow: 'hidden',
  },
  bodyweightTimelinePointLabel: {
    position: 'absolute',
    color: ONBOARDING_TEXT,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  bodyweightTimelineStartLabel: {
    left: 3,
    bottom: 0,
  },
  bodyweightTimelineTargetLabel: {
    right: 0,
    top: 0,
    textAlign: 'right',
  },
  bodyweightTimelineDuration: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    color: ONBOARDING_PRIMARY,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  bodyweightTimelineNote: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  focusStageShell: {
    backgroundColor: ONBOARDING_PANEL,
    minHeight: 0,
  },
  focusTopPane: {
    height: 246,
    paddingBottom: 26,
  },
  focusBottomPane: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  focusAreaTopPane: {
    height: 206,
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingBottom: 8,
  },
  bodyweightProgressiveStack: {
    gap: 16,
    paddingTop: 2,
  },
  bodyweightProgressiveHint: {
    alignSelf: 'center',
    maxWidth: 230,
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  focusAreaTopCopy: {
    paddingTop: 58,
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
  focusAreaGrid: {
    gap: 5,
  },
  focusBodyCard: {
    flex: 1,
    minWidth: 0,
    height: 132,
    borderRadius: 18,
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
  },
  focusBodyCardActive: {
    borderWidth: 2,
    borderColor: ONBOARDING_PRIMARY,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  focusBodyCropBox: {
    width: '100%',
    height: 92,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBodyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  focusBodyTitleActive: {
    color: ONBOARDING_PRIMARY,
  },
  focusBodyCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBodyCheckActive: {
    backgroundColor: ONBOARDING_PRIMARY,
    borderColor: ONBOARDING_PRIMARY,
  },
  focusAreaGridRow: {
    flexDirection: 'row',
    gap: 5,
  },
  focusAreaInfoBox: {
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: ONBOARDING_PRIMARY_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  focusAreaInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(127,119,221,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusAreaInfoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  focusAreaInfoTitle: {
    color: ONBOARDING_TEXT,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  focusAreaInfoBody: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  focusAreaInfoBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(127,119,221,0.24)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  focusAreaInfoBadgeText: {
    color: ONBOARDING_TEXT,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  focusBodySelectionStage: {
    borderRadius: radii.md,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.12)',
    padding: spacing.sm,
    gap: 6,
    minHeight: 360,
  },
  focusBodyViewToggle: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  focusBodyViewToggleButton: {
    minHeight: 28,
    minWidth: 62,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  focusBodyViewToggleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  focusBodyViewToggleText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  focusBodyViewToggleTextActive: {
    color: '#06080B',
  },
  focusBodySelectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focusBodyOptionList: {
    width: 120,
    gap: 5,
  },
  focusBodyOptionPill: {
    minHeight: 31,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  focusBodyOptionPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  focusBodyOptionCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBodyOptionCheckActive: {
    backgroundColor: '#06080B',
    borderColor: '#06080B',
  },
  focusBodyOptionText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  focusBodyOptionTextActive: {
    color: '#06080B',
  },
  focusBodyFigure: {
    flex: 1,
    minWidth: 0,
    height: 244,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBodyPersonImage: {
    position: 'absolute',
    top: -14,
    bottom: -12,
    left: -12,
    right: -12,
    width: undefined,
    height: undefined,
    opacity: 0.1,
  },
  focusBodyConditioningGlow: {
    position: 'absolute',
    width: 152,
    height: 256,
    borderRadius: 76,
    backgroundColor: 'rgba(255,255,255,0.03)',
    opacity: 0,
  },
  focusBodyConditioningGlowActive: {
    opacity: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  focusBodyHead: {
    position: 'absolute',
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  focusBodyNeck: {
    position: 'absolute',
    top: 39,
    width: 18,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  focusBodyTorso: {
    position: 'absolute',
    top: 54,
    width: 68,
    height: 86,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.11)',
    overflow: 'hidden',
  },
  focusBodyTorsoActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  focusBodyBaseActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  focusBodyPartActive: {
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderColor: 'rgba(255,255,255,0.76)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  focusBodyCore: {
    position: 'absolute',
    left: 24,
    top: 40,
    width: 20,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  focusBodyChestLeft: {
    position: 'absolute',
    left: 11,
    top: 16,
    width: 24,
    height: 21,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  focusBodyChestRight: {
    position: 'absolute',
    right: 11,
    top: 16,
    width: 24,
    height: 21,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  focusBodyBackPanel: {
    position: 'absolute',
    left: 13,
    right: 13,
    top: 14,
    height: 54,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  focusBodyShoulderLeft: {
    position: 'absolute',
    top: 59,
    left: 34,
    width: 34,
    height: 22,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-18deg' }],
  },
  focusBodyShoulderRight: {
    position: 'absolute',
    top: 59,
    right: 34,
    width: 34,
    height: 22,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '18deg' }],
  },
  focusBodyUpperArmLeft: {
    position: 'absolute',
    top: 78,
    left: 25,
    width: 22,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '18deg' }],
  },
  focusBodyUpperArmRight: {
    position: 'absolute',
    top: 78,
    right: 25,
    width: 22,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '-18deg' }],
  },
  focusBodyForearmLeft: {
    position: 'absolute',
    top: 132,
    left: 15,
    width: 19,
    height: 58,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '28deg' }],
  },
  focusBodyForearmRight: {
    position: 'absolute',
    top: 132,
    right: 15,
    width: 19,
    height: 58,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '-28deg' }],
  },
  focusBodyPelvis: {
    position: 'absolute',
    top: 136,
    width: 58,
    height: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  focusBodyThighLeft: {
    position: 'absolute',
    top: 160,
    left: 57,
    width: 25,
    height: 66,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '8deg' }],
  },
  focusBodyThighRight: {
    position: 'absolute',
    top: 160,
    right: 57,
    width: 25,
    height: 66,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '-8deg' }],
  },
  focusBodyCalfLeft: {
    position: 'absolute',
    top: 220,
    left: 60,
    width: 20,
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '5deg' }],
  },
  focusBodyCalfRight: {
    position: 'absolute',
    top: 220,
    right: 60,
    width: 20,
    height: 48,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '-5deg' }],
  },
  focusBodyHint: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  bodyweightStageContent: {
    paddingTop: 0,
    paddingBottom: 0,
    transform: [{ translateY: -12 }],
  },
  bodyweightStageSupportText: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 13,
  },
  buildingPlanScreen: {
    flex: 1,
    backgroundColor: ONBOARDING_TOP,
  },
  buildingPlanThinkingScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ONBOARDING_TOP,
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
    backgroundColor: '#E6DEF6',
    overflow: 'hidden',
  },
  buildingPlanProgressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  buildingPlanPercentText: {
    color: ONBOARDING_PRIMARY,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  buildingPlanThinkingText: {
    color: ONBOARDING_TEXT,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.56,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 22,
    minHeight: 34,
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
    backgroundColor: ONBOARDING_PRIMARY_SOFT,
  },
  buildingPlanStepIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingPlanStepIconDone: {
    borderWidth: 0,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  buildingPlanStepIconActive: {
    borderColor: ONBOARDING_PRIMARY,
    backgroundColor: ONBOARDING_PRIMARY_SOFT,
  },
  buildingPlanStepActiveDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: ONBOARDING_PRIMARY,
  },
  buildingPlanStepCopy: {
    flex: 1,
    gap: 3,
  },
  buildingPlanStepText: {
    color: ONBOARDING_TEXT,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  buildingPlanStepSubtitle: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  buildingPlanStepTextPending: {
    color: ONBOARDING_TEXT_SOFT,
    fontWeight: '600',
  },
  photoSelectionCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 26, 35, 0.74)',
  },
  photoSelectionCardActive: {
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  photoSelectionSurface: {
    minHeight: 156,
    borderRadius: radii.lg,
  },
  photoSelectionContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  photoSelectionContentPlain: {
    minHeight: 152,
    paddingVertical: spacing.md + 6,
  },
  photoSelectionAnimatedWrap: {
    width: '100%',
  },
  photoSelectionAnimatedWrapPlainActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  photoSelectionSurfacePlainImage: {
    overflow: 'hidden',
    position: 'relative',
    minHeight: 152,
    justifyContent: 'flex-end',
  },
  photoSelectionSurfacePlainAsset: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  photoSelectionPlainShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,11,0.34)',
  },
  photoSelectionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoSelectionCopy: {
    gap: 3,
  },
  photoSelectionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
    maxWidth: '82%',
  },
  photoSelectionTitlePlain: {
    color: '#06080B',
  },
  photoSelectionTitleOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionBody: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    maxWidth: '82%',
  },
  photoSelectionBodyPlain: {
    color: 'rgba(6,8,11,0.84)',
  },
  photoSelectionBodyOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionMeta: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    maxWidth: '78%',
  },
  photoSelectionMetaPlain: {
    color: 'rgba(6,8,11,0.54)',
  },
  photoSelectionMetaOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionCardPlain: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  photoSelectionCardPlainActive: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ translateY: -4 }],
  },
  splitSelectionCard: {
    minHeight: 158,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#131519',
    backgroundColor: '#050607',
    overflow: 'hidden',
    position: 'relative',
  },
  splitSelectionCardActive: {
    borderColor: '#2A2F36',
    backgroundColor: '#0C0F12',
  },
  splitSelectionFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    opacity: 0.85,
  },
  splitSelectionFrameActive: {
    borderColor: 'rgba(255,255,255,0.22)',
  },
  splitSelectionDarkPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050607',
  },
  splitSelectionBottomLeftPane: {
    position: 'absolute',
    left: -88,
    bottom: -28,
    width: '118%',
    height: 88,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '26deg' }],
  },
  splitSelectionBottomLeftPaneActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  splitSelectionLightPane: {
    position: 'absolute',
    top: -18,
    right: -90,
    width: '110%',
    height: 74,
    backgroundColor: 'rgba(11, 54, 56, 0.42)',
    transform: [{ rotate: '26deg' }],
  },
  splitSelectionLightPaneActive: {
    backgroundColor: 'rgba(22, 94, 97, 0.52)',
  },
  splitSelectionDiagonal: {
    position: 'absolute',
    width: '170%',
    left: '-35%',
    top: '49%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionDiagonalActive: {
    backgroundColor: '#FFFFFF',
  },
  splitSelectionDiagonalOffset: {
    position: 'absolute',
    width: '170%',
    left: '-33%',
    top: '49%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.58)',
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionDiagonalOffsetActive: {
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  splitSelectionCornerAccent: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  splitSelectionCornerAccentTopRight: {
    top: 4,
    right: 4,
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionCornerAccentBottomLeft: {
    bottom: 4,
    left: 4,
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionCornerAccentActive: {
    backgroundColor: '#FFFFFF',
  },
  splitSelectionContent: {
    minHeight: 158,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  splitSelectionVariantBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  splitSelectionVariantBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  splitSelectionPrimary: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 0,
  },
  splitSelectionSecondary: {
    display: 'none',
  },
  splitSelectionTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    maxWidth: '84%',
  },
  splitSelectionBody: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  splitSelectionMeta: {
    color: 'rgba(6,8,11,0.72)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  splitSelectionActiveBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  splitSelectionActiveMarkShort: {
    position: 'absolute',
    width: 7,
    height: 2,
    left: 6,
    top: 14,
    borderRadius: 2,
    backgroundColor: '#06080B',
    transform: [{ rotate: '45deg' }],
  },
  splitSelectionActiveMarkLong: {
    position: 'absolute',
    width: 12,
    height: 2,
    left: 10,
    top: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  stageSurface: {
    minHeight: 148,
    borderRadius: radii.lg,
  },
  stageSurfaceContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  stageSurfaceBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stageSurfaceTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
    maxWidth: '82%',
  },
  selectionVisual: {
    width: 116,
    minHeight: 74,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectionVisualChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectionVisualChip: {
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  selectionVisualChipText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  selectionVisualBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 32,
  },
  selectionVisualBar: {
    flex: 1,
    borderRadius: radii.pill,
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
  optionLabelLight: {
    color: 'rgba(6,8,11,0.56)',
  },
  setupOptionCard: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
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
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    borderColor: ONBOARDING_BORDER_ACTIVE,
  },
  setupOptionCardImage: {
    overflow: 'hidden',
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIcon: {
    minHeight: 188,
    overflow: 'hidden',
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIconActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
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
    backgroundColor: ONBOARDING_PRIMARY,
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
    backgroundColor: ONBOARDING_TEXT,
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
  focusSelectionHint: {
    color: ONBOARDING_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  setupOptionCardImageActive: {
    borderColor: ONBOARDING_BORDER_ACTIVE,
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
    color: ONBOARDING_TEXT,
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
    color: ONBOARDING_TEXT_SOFT,
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
    backgroundColor: '#F3F7FF',
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
  snapshotCard: {
    gap: spacing.sm,
  },
  snapshotKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  helperStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  helperStripCopy: {
    flex: 1,
    gap: 2,
  },
  helperStripTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  helperStripBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  helperStripButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  helperStripButtonText: {
    color: '#05070A',
    fontSize: 12,
    fontWeight: '900',
  },
  metricCard: {
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metricCopy: {
    flex: 1,
    gap: 3,
  },
  metricTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  metricBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  metricInputWrap: {
    width: 96,
    gap: 6,
    alignItems: 'center',
  },
  metricInput: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  metricUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recommendationCard: {
    gap: spacing.sm,
  },
  recommendationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scheduleCard: {
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
    borderColor: '#F4FAFF',
    backgroundColor: '#F4FAFF',
  },
  personalizationOptionDisabled: {
    opacity: 0.45,
  },
  personalizationOptionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  personalizationOptionTitleActive: {
    color: '#0B0F14',
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
  buildOwnCard: {
    gap: spacing.sm,
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
    backgroundColor: ONBOARDING_PANEL,
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
  focusFooter: {
    transform: [{ translateY: 0 }],
    paddingTop: spacing.lg,
  },
  footerDarkStage: {
    backgroundColor: ONBOARDING_PANEL,
    borderTopColor: ONBOARDING_BORDER,
  },
  planReadyOverviewStage: {
    paddingBottom: spacing.lg,
  },
  planReadyPrimaryCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    minHeight: 400,
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: spacing.md,
  },
  planReadyPrimaryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  planReadyPrimaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  planReadyPrimaryBody: {
    gap: 6,
  },
  planReadyPrimaryName: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  planReadyPrimaryMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  planReadyPrimaryWhy: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  planReadyPrimaryTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  planReadyPrimaryTag: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  planReadyPrimaryTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  planReadyPrimaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 11,
  },
  planReadyPrimaryLinkText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '800',
  },
  planReadyAltCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: ONBOARDING_CARD,
    padding: 16,
    marginTop: spacing.md,
  },
  planReadyAltCopy: {
    flex: 1,
    gap: 3,
  },
  planReadyAltEyebrow: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  planReadyAltName: {
    color: ONBOARDING_TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  planReadyAltWhy: {
    color: ONBOARDING_TEXT_SOFT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  planReadyAltCta: {
    borderRadius: 999,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER_ACTIVE,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  planReadyAltCtaText: {
    color: ONBOARDING_PRIMARY,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  planReadyOverviewKicker: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1.75,
    color: ONBOARDING_PRIMARY,
  },
  planReadyOverviewHeading: {
    marginTop: 6,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.54,
    color: ONBOARDING_TEXT,
  },
  planReadyOverviewMeta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyOverviewCover: {
    marginTop: 16,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  planReadyOverviewCoverHeadline: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  planReadyOverviewCoverSupport: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
  },
  planReadyOverviewStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  planReadyOverviewStat: {
    flex: 1,
    minWidth: 0,
  },
  planReadyOverviewStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planReadyOverviewStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
  },
  planReadyOverviewWeeks: {
    marginTop: 16,
    gap: 9,
  },
  planReadyOverviewWeekCard: {
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    borderRadius: 14,
    overflow: 'hidden',
  },
  planReadyOverviewWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  planReadyOverviewWeekBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planReadyOverviewWeekBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B21B6',
  },
  planReadyOverviewWeekCopy: {
    flex: 1,
  },
  planReadyOverviewWeekTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyOverviewWeekSubtitle: {
    marginTop: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyOverviewWeekCount: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyOverviewWeekChevron: {
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planReadyOverviewWeekChevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  planReadyOverviewDayList: {
    borderTopWidth: 1,
    borderTopColor: ONBOARDING_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  planReadyOverviewDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: ONBOARDING_PANEL,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planReadyOverviewDayBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planReadyOverviewDayBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5B21B6',
  },
  planReadyOverviewDayCopy: {
    flex: 1,
  },
  planReadyOverviewDayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyOverviewDaySubtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyOverviewDayCta: {
    fontSize: 12.5,
    fontWeight: '800',
    color: ONBOARDING_PRIMARY,
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
    color: ONBOARDING_PRIMARY,
  },
  planReadyDayTitle: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.25,
    color: ONBOARDING_TEXT,
  },
  planReadyDayWeekBadge: {
    backgroundColor: ONBOARDING_CARD_ACTIVE,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  planReadyDayWeekBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5B21B6',
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
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyDayTabs: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
  },
  planReadyDayTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
  },
  planReadyDayTabActive: {
    backgroundColor: ONBOARDING_PRIMARY,
    borderColor: ONBOARDING_PRIMARY,
  },
  planReadyDayTabLetter: {
    fontSize: 15,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyDayTabLetterActive: {
    color: '#FFFFFF',
  },
  planReadyDayTabLabel: {
    marginTop: 1,
    fontSize: 9.5,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyDayTabLabelActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  planReadyDayExercisesLabel: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyDayExerciseList: {
    gap: 8,
  },
  planReadyDayExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: ONBOARDING_CARD,
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  planReadyDayExerciseNumber: {
    width: 20,
    fontSize: 13,
    fontWeight: '800',
    color: ONBOARDING_PRIMARY,
  },
  planReadyDayExerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  planReadyDayExerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyDayExerciseGroup: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.66,
    color: ONBOARDING_TEXT_SOFT,
    textTransform: 'uppercase',
  },
  planReadyDayExerciseRight: {
    alignItems: 'flex-end',
  },
  planReadyDayExerciseSets: {
    fontSize: 13,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyDayExerciseReps: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyAccountStage: {
    justifyContent: 'space-between',
  },
  planReadyAccountTop: {
    flex: 1,
    justifyContent: 'center',
  },
  planReadyAccountLogoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  planReadyAccountLogo: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  planReadyAccountLogoInk: {
    color: ONBOARDING_TEXT,
  },
  planReadyAccountLogoAccent: {
    color: ONBOARDING_PRIMARY,
  },
  planReadyAccountTitle: {
    marginTop: 20,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.54,
    lineHeight: 31,
    color: ONBOARDING_TEXT,
  },
  planReadyAccountSubtitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyAccountProviders: {
    gap: 11,
  },
  planReadyAccountProvider: {
    height: 54,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    borderWidth: 1.5,
    borderColor: ONBOARDING_BORDER,
    backgroundColor: 'transparent',
  },
  planReadyAccountProviderPrimary: {
    backgroundColor: ONBOARDING_CARD,
  },
  planReadyAccountProviderText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: ONBOARDING_TEXT,
  },
  planReadyAccountGoogleMark: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ONBOARDING_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planReadyAccountGoogleMarkText: {
    fontSize: 14,
    fontWeight: '900',
    color: ONBOARDING_PRIMARY,
  },
  planReadyAccountEmail: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 6,
  },
  planReadyAccountEmailText: {
    fontSize: 14,
    fontWeight: '700',
    color: ONBOARDING_TEXT_SOFT,
  },
  planReadyAccountSpinner: {
    marginTop: 8,
  },
  planReadyFixedFooter: {
    backgroundColor: ONBOARDING_PANEL,
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
    backgroundColor: ONBOARDING_PRIMARY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonText: {
    color: ONBOARDING_TEXT,
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
    color: ONBOARDING_TEXT_SOFT,
  },
  secondaryTextLight: {
    color: 'rgba(243,247,255,0.78)',
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

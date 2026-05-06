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
import Svg, { Path } from 'react-native-svg';

import { BadgePill, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { GymlogIcon, GymlogIconName } from '../components/GymlogIcon';
import { OnboardingOptionIcon, OnboardingOptionIconName } from '../components/OnboardingOptionIcon';
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
  initialStage?: SetupStage;
  tailoringPreferences?: TailoringPreferencesInput | null;
  onBackToEntry?: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onCompleteToStartingWeek: (selection: FirstRunSetupSelection, recommendedProgramId: string) => void | Promise<void>;
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
  | 'profile'
  | 'review'
  | 'planning'
  | 'about'
  | 'recommendation';
type HelperState = 'idle' | 'loading' | 'ready' | 'error';
type RecommendationRefinementPanel = 'schedule' | 'focus' | 'custom' | 'ai' | null;
type PlanReadyHeroKey = 'mass' | 'strength' | 'athletic';
type BodyweightGoalMode = 'hidden' | 'optional' | 'required';
type BodyweightGoalIconName = 'up' | 'flat' | 'down';
type LocationSelectionOptionId = SetupTrainingEnvironment;
type FocusBadgeTone = 'neutral' | 'green' | 'blue' | 'purple';
type FocusBadgeInput = string | { label: string; tone?: FocusBadgeTone };

const STAGES: SetupStage[] = ['location', 'goal', 'profile', 'planning', 'about', 'review'];
const ONBOARDING_PROGRESS_STAGES: SetupStage[] = ['location', 'goal', 'profile', 'planning', 'about'];

const DEFAULT_BODYWEIGHT_KG = 70;
const DEFAULT_BODYWEIGHT_LB = 154;
const BODYWEIGHT_INTEGER_LIMITS: Record<UnitPreference, { min: number; max: number }> = {
  kg: { min: 35, max: 220 },
  lb: { min: 77, max: 485 },
};

function clampBodyweightInteger(value: number, unit: UnitPreference) {
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  return Math.min(Math.max(Math.round(value), limits.min), limits.max);
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
  if (trainingEnvironment) {
    return trainingEnvironment;
  }

  switch (equipment) {
    case 'home':
      return 'home_gym';
    case 'minimal':
      return 'minimal_equipment';
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
    body: '',
  },
  {
    gender: 'female',
    title: 'Female',
    body: '',
  },
  {
    gender: 'unspecified',
    title: 'Prefer not to say',
    body: '',
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

const TRAINING_LEVEL_OPTIONS: Array<{
  level: SetupLevel;
  title: string;
  body: string;
  chips: Array<{ label: string; tone: FocusBadgeTone }>;
  icon: OnboardingOptionIconName;
}> = [
  {
    level: 'beginner',
    title: 'Beginner',
    body: '0-1 years of consistent training',
    chips: [
      { label: 'Simpler workouts', tone: 'blue' },
      { label: 'Lower fatigue', tone: 'blue' },
      { label: 'More recovery', tone: 'green' },
    ],
    icon: 'star',
  },
  {
    level: 'intermediate',
    title: 'Intermediate',
    body: '1-3 years of training',
    chips: [
      { label: 'Balanced volume', tone: 'neutral' },
      { label: 'Progressive overload', tone: 'green' },
      { label: 'More variety', tone: 'purple' },
    ],
    icon: 'trend_up',
  },
  {
    level: 'advanced',
    title: 'Advanced',
    body: '3+ years of serious training',
    chips: [
      { label: 'Higher volume', tone: 'purple' },
      { label: 'Advanced progression', tone: 'green' },
      { label: 'Greater workload', tone: 'neutral' },
    ],
    icon: 'trophy',
  },
];

const TRAINING_FREQUENCY_OPTIONS: Array<{
  value: SetupDaysPerWeek;
  title: string;
  body: string;
}> = [
  { value: 2, title: '2', body: 'days' },
  { value: 3, title: '3', body: 'days' },
  { value: 4, title: '4', body: 'days' },
  { value: 5, title: '5', body: 'days' },
  { value: 6, title: '6+', body: 'days' },
];

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
    body: 'Gymlog places the week.',
  },
  {
    mode: 'self_managed',
    title: "I'll manage the days",
    body: 'You pick the days.',
  },
];

const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions();
const REFINEMENT_FOCUS_AREA_OPTIONS: SetupFocusArea[] = FOCUS_AREA_OPTIONS.map((option) => option.area);
const FOCUS_AREA_CARD_ASSETS: Partial<Record<SetupFocusArea, ImageSourcePropType>> = {
  chest: require('../../assets/fitness/selected/focus-chest-anatomy-card.png'),
  back: require('../../assets/fitness/selected/focus-back-anatomy-card.png'),
  shoulders: require('../../assets/fitness/selected/focus-shoulders-anatomy-card.png'),
  arms: require('../../assets/fitness/selected/focus-arms-anatomy-card.png'),
  core: require('../../assets/fitness/selected/focus-abs-anatomy-card.png'),
  quads: require('../../assets/fitness/selected/focus-quads-anatomy-card.png'),
  glutes: require('../../assets/fitness/selected/focus-glutes-anatomy-card.png'),
  hamstrings: require('../../assets/fitness/selected/focus-hamstrings-anatomy-card.png'),
  calves: require('../../assets/fitness/selected/focus-calves-anatomy-card.png'),
  mobility: require('../../assets/fitness/selected/focus-mobility-anatomy-card.png'),
};
const FOCUS_AREA_IMAGE_FRAMES: Partial<Record<SetupFocusArea, ImageStyle>> = {
  chest: { width: '112%', height: '92%' },
  shoulders: { width: '114%', height: '88%' },
  arms: { width: '114%', height: '88%' },
  core: { width: '116%', height: '84%' },
  quads: { width: '118%', height: '80%' },
  glutes: { width: '116%', height: '82%' },
  hamstrings: { width: '118%', height: '80%' },
  calves: { width: '118%', height: '78%' },
  mobility: { width: '116%', height: '86%' },
};
type FocusAreaOnboardingOption = (typeof FOCUS_AREA_OPTIONS)[number];
const PLAN_READY_GYM_BACKDROP_SOURCE = require('../../assets/fitness/selected/plan-ready-empty-gym-backdrop-bw.jpg');
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
    label: 'Home Gym',
    subtitle: 'Train at home with your own equipment.',
    icon: 'home',
  },
  {
    id: 'minimal_equipment',
    equipment: 'minimal',
    trainingEnvironment: 'minimal_equipment',
    label: 'Minimal Equipment',
    subtitle: 'Limited equipment like bands, dumbbells or a bench.',
    icon: 'run',
    focusLabel: 'EFFICIENT',
    focusTone: 'green',
  },
  {
    id: 'bodyweight_only',
    equipment: 'minimal',
    trainingEnvironment: 'bodyweight_only',
    label: 'Bodyweight Only',
    subtitle: 'No equipment needed. Train anywhere.',
    icon: 'bodyweight',
    focusLabel: 'BEGINNER FRIENDLY',
    focusTone: 'blue',
  },
  {
    id: 'running_hybrid',
    equipment: 'minimal',
    trainingEnvironment: 'running_hybrid',
    label: 'Running / Hybrid',
    subtitle: 'Running-focused or mix of running and strength training.',
    icon: 'running_shoe',
    focusLabel: 'CARDIO FOCUSED',
    focusTone: 'purple',
  },
];

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
  active,
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
  active: boolean;
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
      outputRange: [0.94, 1],
    }),
  };
  const outlineStyle = {
    opacity: progress,
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
      <Animated.View pointerEvents="none" style={[styles.locationChoiceActiveOutline, outlineStyle]} />
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
        <View style={styles.locationChoiceRow}>
          {leadingRadio ? radio : null}
          {hideIcon ? null : <OnboardingOptionIcon name={icon} />}
          <View style={[styles.locationChoiceCopy, hideIcon && styles.locationChoiceCopyNoIcon]}>
            <View style={styles.locationChoiceTitleRow}>
              <Text numberOfLines={1} style={[styles.locationChoiceLabel, active && styles.locationChoiceLabelActive]}>
                {label}
              </Text>
              {focusBadge ? (
                <View style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(focusBadge.tone)]}>
                  <Text numberOfLines={1} style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(focusBadge.tone)]}>
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
                  <View key={`${tag.label}:${tag.tone}:${index}`} style={[styles.locationFocusBadge, getLocationFocusBadgeStyle(tag.tone)]}>
                    <Text numberOfLines={1} style={[styles.locationFocusBadgeText, getLocationFocusBadgeTextStyle(tag.tone)]}>
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
        <Pressable
          onPress={() => updateValue(clampedValue - step)}
          style={styles.bodyweightTargetStepButton}
        >
          <Text style={[styles.bodyweightTargetStepText, styles.bodyweightTargetMinusText]}>-</Text>
        </Pressable>
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
          <Text style={styles.bodyweightTargetValueUnit}>{unit}</Text>
        </View>
        <Pressable
          onPress={() => updateValue(clampedValue + step)}
          style={styles.bodyweightTargetStepButton}
        >
          <Text style={styles.bodyweightTargetStepText}>+</Text>
        </Pressable>
      </View>

      {onUnitChange ? (
        <View style={styles.bodyweightStepperUnitRow}>
          {(['kg', 'lb'] as UnitPreference[]).map((option) => {
            const active = unit === option;
            return (
              <Pressable
                key={option}
                onPress={() => onUnitChange(option)}
                style={[styles.bodyweightUnitPill, styles.bodyweightStepperUnitPill, active && styles.bodyweightUnitPillActive]}
              >
                <Text style={[styles.bodyweightUnitText, active && styles.bodyweightUnitTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function BodyweightGoalTrendIcon({ name, color }: { name: BodyweightGoalIconName; color: string }) {
  if (name === 'flat') {
    return (
      <Svg width={24} height={18} viewBox="0 0 24 18" fill="none" style={styles.bodyweightGoalTrendIcon}>
        <Path d="M6 9 H18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  const path = name === 'down' ? 'M12 3 V14' : 'M12 15 V4';
  const arrow = name === 'down' ? 'M7.5 9.5 L12 14 L16.5 9.5' : 'M7.5 8.5 L12 4 L16.5 8.5';

  return (
    <Svg width={24} height={18} viewBox="0 0 24 18" fill="none" style={styles.bodyweightGoalTrendIcon}>
      <Path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={arrow} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BodyweightGoalOptionCard({
  title,
  body,
  icon,
  accentColor,
  active,
  onPress,
}: {
  title: string;
  body: string;
  icon: BodyweightGoalIconName;
  accentColor: string;
  active: boolean;
  onPress: () => void;
}) {
  const iconColor = accentColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.bodyweightGoalCard,
        { borderColor: active ? accentColor : `${accentColor}66` },
        active && styles.bodyweightGoalCardActive,
        active && { borderColor: accentColor },
      ]}
    >
      <BodyweightGoalTrendIcon name={icon} color={iconColor} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bodyweightGoalCardTitle, active && styles.bodyweightGoalCardTitleActive]}>
        {title}
      </Text>
      <Text style={[styles.bodyweightGoalCardBody, active && styles.bodyweightGoalCardBodyActive]}>{body}</Text>
    </Pressable>
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

function BodyweightExpectationCard({
  goal,
}: {
  goal: SetupGoal;
}) {
  const content =
    goal === 'muscle'
      ? {
        title: 'Lean muscle gain',
        body: 'A small surplus supports muscle growth while your plan keeps strength progressing.',
      }
      : goal === 'lean_athletic'
      ? {
        title: 'Lean down',
        body: 'Aim for steady weight loss while keeping strength work and recovery in the plan.',
      }
      : {
        title: 'Maintain',
        body: 'Stay close to your current weight while building consistency and strength.',
      };

  return (
    <View style={styles.bodyweightExpectationCard}>
      <View style={styles.bodyweightExpectationHeader}>
        <View style={styles.bodyweightExpectationIcon}>
          <GymlogIcon name="progress" size={10} color="#FFFFFF" />
        </View>
        <Text style={styles.bodyweightExpectationKicker}>WHAT TO EXPECT</Text>
      </View>
      <Text style={styles.bodyweightExpectationTitle}>{content.title}</Text>
      <Text style={styles.bodyweightExpectationText}>{content.body}</Text>
    </View>
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

  return level === 'advanced' ? 'Advanced' : 'Intermediate';
}

function getTrainingProfileSetupSummary(level: SetupLevel, daysPerWeek: SetupDaysPerWeek) {
  const duration =
    level === 'advanced'
      ? '60-75 min sessions'
      : level === 'intermediate'
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
    level === 'advanced'
      ? 'Workload managed'
      : level === 'intermediate'
        ? 'Progressive balance'
        : 'Recovery focused';

  return {
    workouts: `${daysPerWeek === 6 ? '6+' : daysPerWeek} workouts / week`,
    duration,
    structure,
    recovery,
  };
}

function TrainingSetupMetric({ icon, label }: { icon: GymlogIconName; label: string }) {
  return (
    <View style={styles.trainingSetupMetric}>
      <GymlogIcon name={icon} size={18} color="#06080B" />
      <Text style={styles.trainingSetupMetricText}>{label}</Text>
    </View>
  );
}

function TrainingSectionIcon({ icon }: { icon: GymlogIconName }) {
  return (
    <View style={styles.trainingProfileSectionIcon}>
      <GymlogIcon name={icon} size={16} color="#FFFFFF" />
    </View>
  );
}

export function OnboardingScreen({
  initialUnitPreference,
  readyProgramCount,
  mode = 'first_run',
  initialSelection,
  initialStage,
  tailoringPreferences = null,
  onBackToEntry,
  onSkip,
  onCompleteToStartingWeek,
  onCompleteToProgramDetail,
  onCompleteToCustom,
  onCancel,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const setupSeed = initialSelection ?? DEFAULT_FIRST_RUN_SELECTION;
  const editMode = mode === 'edit';
  const BUILDING_PLAN_TOTAL_MS = 10000;
  const previousUnitPreferenceRef = useRef(initialUnitPreference);
  const [stageIndex, setStageIndex] = useState(() =>
    getStageIndex(initialStage ?? (editMode ? 'review' : 'location')),
  );
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);
  const [showBuildingPlanThinking, setShowBuildingPlanThinking] = useState(false);
  const [buildingPlanPhaseIndex, setBuildingPlanPhaseIndex] = useState(0);
  const [buildingPlanPercent, setBuildingPlanPercent] = useState(0);
  const buildingPlanScreenOpacity = useRef(new Animated.Value(1)).current;
  const buildingPlanEntryOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanTopTranslate = useRef(new Animated.Value(-36)).current;
  const buildingPlanBottomTranslate = useRef(new Animated.Value(36)).current;
  const buildingPlanLogoOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanLogoScale = useRef(new Animated.Value(0.95)).current;
  const buildingPlanThinkingOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanCaptionOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanPulse = useRef(new Animated.Value(0)).current;
  const planReadyCardTranslateX = useRef(new Animated.Value(0)).current;
  const planReadyCardOpacity = useRef(new Animated.Value(1)).current;
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
  const [equipment, setEquipment] = useState<SetupEquipment>(setupSeed.equipment);
  const [trainingEnvironment, setTrainingEnvironment] = useState<SetupTrainingEnvironment>(
    setupSeed.trainingEnvironment,
  );
  const [selectedLocationOptionId, setSelectedLocationOptionId] = useState<LocationSelectionOptionId | null>(() =>
    initialSelection || editMode
      ? getDefaultLocationOptionId(setupSeed.equipment, setupSeed.trainingEnvironment)
      : null,
  );
  const [secondaryOutcomes, setSecondaryOutcomes] = useState<SetupSecondaryOutcome[]>(
    setupSeed.secondaryOutcomes,
  );
  const [focusAreas, setFocusAreas] = useState<SetupFocusArea[]>(setupSeed.focusAreas);
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
  const [bodyweightPickerValue, setBodyweightPickerValue] = useState(() => {
    const seedValue = parseNumberInput(formatWeightInputValue(setupSeed.currentWeightKg, initialUnitPreference));
    return seedValue ?? getDefaultBodyweightForUnit(initialUnitPreference);
  });
  const [bodyweightGoal, setBodyweightGoal] = useState<SetupGoal>(() => getDefaultBodyweightGoal(setupSeed.goal));
  const [busy, setBusy] = useState(false);
  const [activeRecommendationRefinement, setActiveRecommendationRefinement] =
    useState<RecommendationRefinementPanel>(null);
  const [selectedRecommendationProgramId, setSelectedRecommendationProgramId] = useState<string | null>(null);
  const [selectedPlanReadySessionId, setSelectedPlanReadySessionId] = useState<string | null>(null);
  const [planReadyWorkoutPage, setPlanReadyWorkoutPage] = useState(0);
  const [helperVisible, setHelperVisible] = useState(false);
  const [helperDraft, setHelperDraft] = useState('');
  const [helperState, setHelperState] = useState<HelperState>('idle');
  const [helperAnswer, setHelperAnswer] = useState<AICoachAdvice | null>(null);
  const [helperNote, setHelperNote] = useState('');
  const [helperSource, setHelperSource] = useState<'live' | 'preview'>('preview');
  const [helperError, setHelperError] = useState('');

  const stage = STAGES[stageIndex];
  const selectedBodyweightGoalMode = useMemo(() => getBodyweightGoalMode([bodyweightGoal]), [bodyweightGoal]);
  const buildingPlanPhases = useMemo(
    () => ['Building your plan...', 'Thinking through your answers...', 'Almost ready...'],
    [],
  );
  const currentWeightValue = useMemo(() => parseNumberInput(currentWeightDraft), [currentWeightDraft]);
  const targetWeightValue = useMemo(() => parseNumberInput(targetWeightDraft), [targetWeightDraft]);
  const selection = useMemo<FirstRunSetupSelection>(
    () => ({
      gender,
      age,
      ageRange,
      goal,
      goals,
      level,
      daysPerWeek,
      equipment,
      trainingEnvironment,
      secondaryOutcomes,
      focusAreas,
      guidanceMode,
      scheduleMode,
      weeklyMinutes,
      availableDays,
      currentWeightKg: currentWeightValue === null ? null : convertWeightToKg(currentWeightValue, unitPreference),
      targetWeightKg: targetWeightValue === null ? null : convertWeightToKg(targetWeightValue, unitPreference),
      unitPreference,
    }),
    [
      availableDays,
      age,
      ageRange,
      currentWeightValue,
      daysPerWeek,
      equipment,
      focusAreas,
      gender,
      goal,
      goals,
      guidanceMode,
      level,
      scheduleMode,
      secondaryOutcomes,
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
  const planReadyFirstWorkout = projectedSessions[0] ?? null;
  const selectedPlanReadySession = useMemo(
    () => projectedSessions.find((session) => session.id === selectedPlanReadySessionId) ?? null,
    [projectedSessions, selectedPlanReadySessionId],
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
    const parsed = parseNumberInput(currentWeightDraft);
    if (parsed === null) {
      setBodyweightPickerValue(getDefaultBodyweightForUnit(unitPreference));
      return;
    }

    setBodyweightPickerValue(parsed);
  }, [currentWeightDraft, unitPreference]);

  useEffect(() => {
    const nextTarget =
      targetWeightValue === null
        ? getDefaultTargetBodyweight(bodyweightPickerValue, unitPreference, bodyweightGoal)
        : clampTargetBodyweightForGoal(targetWeightValue, bodyweightPickerValue, unitPreference, bodyweightGoal);

    if (selectedBodyweightGoalMode === 'required' && targetWeightValue === null) {
      setTargetBodyweight(nextTarget);
      return;
    }

    if (targetWeightValue !== null && nextTarget !== targetWeightValue) {
      setTargetBodyweight(nextTarget);
    }
  }, [bodyweightGoal, selectedBodyweightGoalMode, bodyweightPickerValue, targetWeightValue, unitPreference]);

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
      buildingPlanPulse.stopAnimation();
      buildingPlanPulse.setValue(0);
      return;
    }

    setBuildingPlanPhaseIndex(0);
    setShowBuildingPlanThinking(false);
    setBuildingPlanPercent(0);
    buildingPlanScreenOpacity.setValue(1);
    buildingPlanEntryOpacity.setValue(0);
    buildingPlanTopTranslate.setValue(-36);
    buildingPlanBottomTranslate.setValue(36);
    buildingPlanLogoOpacity.setValue(0);
    buildingPlanLogoScale.setValue(0.95);
    buildingPlanThinkingOpacity.setValue(0);
    buildingPlanCaptionOpacity.setValue(0);
    buildingPlanPulse.setValue(0);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const startedAt = Date.now();
    const percentIntervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(100, Math.round((elapsed / BUILDING_PLAN_TOTAL_MS) * 100));
      setBuildingPlanPercent(percent);
    }, 80);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildingPlanPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buildingPlanPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.parallel([
      Animated.timing(buildingPlanEntryOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanTopTranslate, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanBottomTranslate, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanLogoOpacity, {
        toValue: 1,
        duration: 500,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanLogoScale, {
        toValue: 1,
        duration: 500,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    timeouts.push(
      setTimeout(() => {
        setShowBuildingPlanThinking(true);
        Animated.timing(buildingPlanThinkingOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        pulseLoop.start();
      }, 1300),
    );

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

    timeouts.push(setTimeout(() => fadeCaption(0), 1800));
    timeouts.push(setTimeout(() => fadeCaption(1), 4600));
    timeouts.push(setTimeout(() => fadeCaption(2), 7400));

    timeouts.push(
      setTimeout(() => {
        setBuildingPlanPercent(100);
        pulseLoop.stop();
        Animated.timing(buildingPlanScreenOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            return;
          }
          setIsBuildingPlan(false);
          setShowBuildingPlanThinking(false);
          setStageIndex(getStageIndex('review'));
        });
      }, BUILDING_PLAN_TOTAL_MS - 500),
    );

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      clearInterval(percentIntervalId);
      pulseLoop.stop();
      buildingPlanScreenOpacity.stopAnimation();
      buildingPlanEntryOpacity.stopAnimation();
      buildingPlanTopTranslate.stopAnimation();
      buildingPlanBottomTranslate.stopAnimation();
      buildingPlanLogoOpacity.stopAnimation();
      buildingPlanLogoScale.stopAnimation();
      buildingPlanThinkingOpacity.stopAnimation();
      buildingPlanCaptionOpacity.stopAnimation();
      buildingPlanPulse.stopAnimation();
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
      buildingPlanPulse.setValue(0);
    };
  }, [
    BUILDING_PLAN_TOTAL_MS,
    buildingPlanBottomTranslate,
    buildingPlanCaptionOpacity,
    buildingPlanEntryOpacity,
    buildingPlanLogoOpacity,
    buildingPlanLogoScale,
    buildingPlanPulse,
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

  function setCurrentBodyweight(value: number) {
    const nextValue = Math.max(0, Math.round(value * 10) / 10);
    setBodyweightPickerValue(nextValue);
    setCurrentWeightDraft(nextValue.toFixed(1));
  }

  function setTargetBodyweight(value: number) {
    const limits = BODYWEIGHT_INTEGER_LIMITS[unitPreference];
    const nextValue = Math.min(Math.max(Math.round(value * 10) / 10, limits.min), limits.max);
    setTargetWeightDraft(nextValue.toFixed(1));
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

  function renderLocation() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 1 OF 5',
      titleLines: ['What equipment do', 'you have access to?'],
      subtitle: 'This helps us build the right program for you.',
      options: LOCATION_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        subtitle: option.subtitle,
        icon: option.icon,
        active: selectedLocationOptionId === option.id,
        onPress: () => {
          setSelectedLocationOptionId(option.id);
          setEquipment(option.equipment);
          setTrainingEnvironment(option.trainingEnvironment);
        },
        focusLabel: option.focusLabel,
        focusTone: option.focusTone,
      })),
      optionsContainerStyle: styles.locationStepOneOptionsShift,
      topPaneStyleOverride: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyleOverride: styles.locationEquipmentHeadline,
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
      active: boolean;
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
                    active={option.active}
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
                  active={option.active}
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
    const fixedTopPaneHeight = Math.min(380, Math.round(locationStageHeight * 0.38) + 40);

    return (
      <View style={[styles.locationStageShell, { minHeight: locationStageHeight }, shellStyle]}>
        <View style={[styles.locationTopPane, { height: fixedTopPaneHeight }, topPaneStyle]}>
          <View style={styles.locationTopSlope} />
          <View style={[styles.locationTopCopy, topCopyStyle]}>
            <View style={styles.locationPaginationWrap}>
              <StepDots index={stageIndex} />
            </View>
            <Text style={[styles.locationStepLabel, stepLabelStyle]}>{stepLabel}</Text>
            {titleLines.map((line) => (
              <Text key={line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84} style={[styles.locationHeadline, titleStyle]}>
                {line}
              </Text>
            ))}
            {subtitle ? <Text style={styles.locationSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={[styles.locationBottomPane, bottomStyle]}>{children}</View>
      </View>
    );
  }

  function renderGoal() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 2 OF 5',
      titleLines: ['WHAT DO YOU', 'WANT MOST?'],
      subtitle: "We'll build your training around this.",
      options: GOAL_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        subtitle: option.subtitle,
        icon: option.icon,
        tags: option.tags,
        active: goal === option.id,
        onPress: () => toggleGoal(option.id),
      })),
      roomyCards: true,
      optionsContainerStyle: styles.locationStepTwoOptionsShift,
      topPaneStyleOverride: styles.locationEquipmentTopPane,
      topCopyStyle: styles.locationEquipmentTopCopy,
      titleStyleOverride: styles.locationEquipmentHeadline,
    });
  }

  function renderProfile() {
    const setupSummary = getTrainingProfileSetupSummary(level, daysPerWeek);

    return renderOnboardingShell({
      stepLabel: 'STEP 3 OF 5',
      titleLines: ['TRAINING', 'PROFILE'],
      subtitle: "We'll tailor your plan to your experience and availability.",
      topPaneStyle: styles.trainingProfileTopPane,
      topCopyStyle: styles.trainingProfileTopCopy,
      titleStyle: styles.trainingProfileHeadline,
      bottomStyle: styles.trainingProfileBottomPane,
      children: (
        <View style={styles.trainingProfileContent}>
          <View style={styles.trainingProfileSection}>
            <View style={styles.trainingProfileSectionHeader}>
              <TrainingSectionIcon icon="strength" />
              <Text style={styles.trainingProfileSectionTitle}>Experience level</Text>
            </View>
            <Text style={styles.trainingProfileSectionPrompt}>How much training experience do you have?</Text>

            <View style={styles.trainingExperienceList}>
              {TRAINING_LEVEL_OPTIONS.map((option) => {
                const active = level === option.level;

                return (
                  <Pressable
                    key={option.level}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.title} experience level`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setLevel(option.level)}
                    style={[styles.trainingExperienceCard, active && styles.trainingExperienceCardActive]}
                  >
                    <OnboardingOptionIcon name={option.icon} />
                    <View style={styles.trainingExperienceCopy}>
                      <Text style={[styles.trainingExperienceTitle, active && styles.trainingExperienceTitleActive]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.trainingExperienceBody, active && styles.trainingExperienceBodyActive]}>
                        {option.body}
                      </Text>
                      <View style={styles.trainingExperienceChipStack}>
                        {[option.chips.slice(0, 2), option.chips.slice(2)].map((chipRow, rowIndex) => (
                          <View key={`${option.level}-chip-row-${rowIndex}`} style={styles.trainingExperienceChipRow}>
                            {chipRow.map((chip) => (
                              <View
                                key={`${chip.label}:${chip.tone}`}
                                style={[
                                  styles.locationFocusBadge,
                                  styles.trainingExperienceChip,
                                  getLocationFocusBadgeStyle(chip.tone),
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.locationFocusBadgeText,
                                    styles.trainingExperienceChipText,
                                    getLocationFocusBadgeTextStyle(chip.tone),
                                  ]}
                                >
                                  {chip.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={[styles.trainingProfileRadio, active && styles.trainingProfileRadioActive]}>
                      {active ? <GymlogIcon name="check" size={14} color="#111111" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.trainingProfileSection}>
            <View style={styles.trainingProfileSectionHeader}>
              <TrainingSectionIcon icon="tempo" />
              <Text style={styles.trainingProfileSectionTitle}>Training frequency</Text>
            </View>
            <Text style={styles.trainingProfileSectionPrompt}>How many days per week can you train?</Text>

            <View style={styles.trainingFrequencyRow}>
              {TRAINING_FREQUENCY_OPTIONS.map((option) => {
                const active = daysPerWeek === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.title} ${option.body} per week`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setDaysPerWeek(option.value)}
                    style={[styles.trainingFrequencyTile, active && styles.trainingFrequencyTileActive]}
                  >
                    <Text style={styles.trainingFrequencyNumber}>{option.title}</Text>
                    <Text style={styles.trainingFrequencyLabel}>{option.body}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.trainingPlanPreviewStrip}>
            <View style={styles.trainingPlanPreviewLead}>
              <GymlogIcon name="lightning" size={12} color="#06080B" />
              <Text style={styles.trainingPlanPreviewTitle}>Plan preview</Text>
            </View>
            <Text numberOfLines={1} style={styles.trainingPlanPreviewText}>
              {setupSummary.workouts} - {setupSummary.duration} - {setupSummary.structure}
            </Text>
          </View>
        </View>
      ),
    });
  }

  function renderReview() {
    const programTitle = recommendedProgramPresentation?.title
      ?? (recommendedProgram ? formatWorkoutDisplayLabel(recommendedProgram.name, 'Program') : 'Starter plan');
    const reviewHeroKey = getPlanReadyHeroKey({ title: programTitle, goal: goalLabel });
    const formatScheduleDuration = (meta: string) => {
      const minutes = meta.match(/^(\d+)/)?.[1];
      return minutes ? `~${minutes} min` : null;
    };
    const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const planReadyScheduleByDay = new Map(
      planReadyPayload.weeklySchedule.map((scheduleDay) => [scheduleDay.weekdayLabel, scheduleDay]),
    );
    const reviewWeekRows = weekDayLabels.map((day) => {
      const scheduleDay = planReadyScheduleByDay.get(day) ?? null;
      const session =
        scheduleDay?.source === 'template'
          ? projectedSessions.find((projectedSession) => projectedSession.id === scheduleDay.id) ?? null
          : null;
      const scheduleExercises =
        scheduleDay?.keyLifts.map((lift, index) => ({
          id: `${scheduleDay.id}-lift-${index}`,
          name: lift,
          prescription: scheduleDay.source === 'template' ? '' : (scheduleDay.note ?? 'Optional'),
          compactPrescription: scheduleDay.source === 'template' ? '' : 'Optional',
          setsLabel: scheduleDay.source === 'template' ? '' : 'Focus',
          repsLabel: scheduleDay.source === 'template' ? '' : 'Optional',
        })) ?? [];

      return {
        day,
        sessionId: session?.id ?? scheduleDay?.id ?? null,
        title: session
          ? formatWorkoutDisplayLabel(session.name, 'Workout')
          : scheduleDay
            ? formatWorkoutDisplayLabel(scheduleDay.name, 'Workout')
            : 'REST DAY',
        body: session?.body ?? scheduleDay?.keyLifts.join(', ') ?? 'Recovery and mobility',
        duration: scheduleDay ? formatScheduleDuration(scheduleDay.meta) : null,
        training: Boolean(scheduleDay),
        hasDetails: Boolean(session),
        guidance: session?.guidance ?? null,
        exercises: session?.exercises ?? scheduleExercises,
        hiddenExerciseCount: session?.hiddenExerciseCount ?? 0,
        detailExercises: session?.detailExercises ?? [],
      };
    });
    const trainingWeekRows = reviewWeekRows.filter((item) => item.training);
    const maxPlanReadyWorkoutPage = Math.max(0, trainingWeekRows.length - 1);
    const planReadyWorkoutPageStart = Math.min(planReadyWorkoutPage, maxPlanReadyWorkoutPage);
    const planReadyActiveWorkout = trainingWeekRows[planReadyWorkoutPageStart] ?? null;
    const planReadyWorkoutCarouselVisible = trainingWeekRows.length > 1;
    const planReadyActiveWorkoutFocusLabel = planReadyActiveWorkout?.title.toLowerCase().includes('lower')
      ? 'Lower focus'
      : planReadyWorkoutPageStart % 2 === 0
        ? 'Upper focus'
        : 'Lower focus';
    const planReadyWorkoutTabs = trainingWeekRows.map((workout, index) => ({
      id: workout.sessionId ?? workout.day,
      index,
      label: workout.title,
    }));
    const planReadyWeeklyOverviewRows = reviewWeekRows.map((item) => ({
      day: item.day,
      training: item.training,
      label: item.training ? 'Train' : 'Recover',
    }));
    const planReadyFitReasons = planReadyPayload.whyThisPlan.slice(0, 5);
    const planReadyOverviewIcons: GymlogIconName[] = ['strength', 'tempo', 'progress', 'recovery'];
    const planReadyOverviewRows: Array<{ label: string; icon: GymlogIconName }> = planReadyPayload.planOverview.map(
      (label, index) => ({
        label,
        icon: planReadyOverviewIcons[index] ?? 'progress',
      }),
    );
    const screenDimensions = Dimensions.get('window');
    const compactPlanReady = screenDimensions.width < 520;
    const planReadyFooterReserve = compactPlanReady ? 56 : 68;
    const planReadyStageMinHeight = Math.max(
      620,
      screenDimensions.height - insets.top - insets.bottom - planReadyFooterReserve,
    );

    return (
      <View
        style={[
          styles.planReadyStage,
          { minHeight: planReadyStageMinHeight },
        ]}
      >
        <Animated.View
          style={[
            styles.planReadyCardShell,
            {
              minHeight: planReadyStageMinHeight,
              opacity: planReadyCardOpacity,
              transform: [{ translateX: planReadyCardTranslateX }],
            },
          ]}
        >
          <View style={styles.planReadyPlanCard}>
            <View style={styles.planReadyHeroCard}>
              <ImageBackground
                source={PLAN_READY_GYM_BACKDROP_SOURCE}
                resizeMode="cover"
                style={[styles.planReadyHeroImage, compactPlanReady && styles.planReadyHeroImageCompact]}
                imageStyle={styles.planReadyHeroImageStyle}
              >
                <View pointerEvents="none" style={styles.planReadyHeroGradient}>
                  <View style={styles.planReadyHeroGradientTop} />
                  <View style={styles.planReadyHeroGradientMiddle} />
                  <View style={styles.planReadyHeroGradientBottom} />
                </View>
                <View pointerEvents="none" style={styles.planReadyHeroTextScrim} />
                <View style={[styles.planReadyHeroCopy, compactPlanReady && styles.planReadyHeroCopyCompact]}>
                  <Text style={[styles.planReadyHeroKicker, compactPlanReady && styles.planReadyHeroKickerCompact]}>YOUR PLAN IS READY</Text>
                  <Text style={[styles.planReadyHeroTitle, compactPlanReady && styles.planReadyHeroTitleCompact]}>{programTitle}</Text>
                  <Text style={[styles.planReadyHeroBody, compactPlanReady && styles.planReadyHeroBodyCompact]}>Built around your goals, schedule and recovery.</Text>
                </View>
              </ImageBackground>
            </View>

            <View style={[styles.planReadyCardContent, compactPlanReady && styles.planReadyCardContentCompact]}>
              <View style={[styles.planReadyWeeklyOverview, compactPlanReady && styles.planReadyWeeklyOverviewCompact]}>
                <View style={[styles.planReadyWeeklyOverviewRow, compactPlanReady && styles.planReadyWeeklyOverviewRowCompact]}>
                  {planReadyWeeklyOverviewRows.map((item) => (
                    <View key={item.day} style={[styles.planReadyWeeklyOverviewDay, compactPlanReady && styles.planReadyWeeklyOverviewDayCompact]}>
                      <Text style={[styles.planReadyWeeklyOverviewDayText, compactPlanReady && styles.planReadyWeeklyOverviewDayTextCompact]}>{item.day}</Text>
                      <View
                        style={[
                          styles.planReadyWeeklyOverviewDot,
                          compactPlanReady && styles.planReadyWeeklyOverviewDotCompact,
                          item.training
                            ? styles.planReadyWeeklyOverviewDotActive
                            : styles.planReadyWeeklyOverviewDotRest,
                        ]}
                      >
                        {item.training ? <GymlogIcon name="check" color="#06080B" size={compactPlanReady ? 8 : 10} /> : null}
                      </View>
                      <Text style={[styles.planReadyWeeklyOverviewLabel, compactPlanReady && styles.planReadyWeeklyOverviewLabelCompact]}>{item.training ? 'Train' : 'Recover'}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.planReadyWorkoutSectionHeader}>
                <Text style={styles.planReadyWorkoutSectionTitle}>YOUR WORKOUT PLAN</Text>
              </View>
              {planReadyWorkoutCarouselVisible ? (
                <View style={styles.planReadyWorkoutCarouselBar}>
                  <View style={styles.planReadyWorkoutCarouselTabs}>
                    {planReadyWorkoutTabs.map((tab) => {
                      const active = tab.index === planReadyWorkoutPageStart;

                      return (
                        <Pressable
                          key={tab.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${tab.label}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => setPlanReadyWorkoutPage(Math.min(tab.index, maxPlanReadyWorkoutPage))}
                          style={[
                            styles.planReadyWorkoutCarouselTab,
                            active && styles.planReadyWorkoutCarouselTabActive,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={[
                              styles.planReadyWorkoutCarouselTabText,
                              active && styles.planReadyWorkoutCarouselTabTextActive,
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View style={styles.planReadyWeekPanel}>
                {planReadyActiveWorkout ? (
                  <View
                    key={planReadyActiveWorkout.day}
                    style={[
                      styles.planReadyWeekPanelRow,
                      styles.planReadyWorkoutDayCard,
                      styles.planReadyWorkoutSingleCard,
                      compactPlanReady && styles.planReadyWeekPanelRowCompact,
                      compactPlanReady && styles.planReadyWorkoutDayCardCompact,
                    ]}
                  >
                    {compactPlanReady ? (
                      <View style={styles.planReadyWorkoutDayHeaderCompact}>
                        <View style={styles.planReadyWorkoutCardMetaRowCompact}>
                          <Text style={[styles.planReadyWeekPanelTitle, styles.planReadyWeekPanelTitleCompact]} numberOfLines={1}>{planReadyActiveWorkout.title}</Text>
                          <View style={styles.planReadyWorkoutHeaderActions}>
                            {planReadyActiveWorkout.duration ? <Text style={[styles.planReadyWeekPanelDuration, styles.planReadyWeekPanelDurationCompact]}>{planReadyActiveWorkout.duration}</Text> : null}
                            {planReadyActiveWorkout.hasDetails && planReadyActiveWorkout.sessionId ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`View ${planReadyActiveWorkout.title} details`}
                                onPress={() => setSelectedPlanReadySessionId(planReadyActiveWorkout.sessionId)}
                                style={[styles.planReadyWorkoutDetailsButton, styles.planReadyWorkoutDetailsButtonCompact]}
                              >
                                <GymlogIcon name="eye" color="#FFFFFF" size={12} />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                        <View style={[styles.planReadyWorkoutFocusChip, styles.planReadyWorkoutFocusChipCompact]}>
                          <Text style={[styles.planReadyWorkoutFocusChipText, styles.planReadyWorkoutFocusChipTextCompact]}>{planReadyActiveWorkoutFocusLabel}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.planReadyWorkoutDayHeader}>
                        <View style={styles.planReadyWeekPanelTitleRow}>
                          <View style={styles.planReadyWorkoutTitleBlock}>
                            <Text style={styles.planReadyWeekPanelTitle} numberOfLines={1}>{planReadyActiveWorkout.title}</Text>
                            <View style={styles.planReadyWorkoutFocusChip}>
                              <Text style={styles.planReadyWorkoutFocusChipText}>{planReadyActiveWorkoutFocusLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.planReadyWorkoutHeaderActions}>
                            {planReadyActiveWorkout.duration ? <Text style={styles.planReadyWeekPanelDuration}>{planReadyActiveWorkout.duration}</Text> : null}
                            {planReadyActiveWorkout.hasDetails && planReadyActiveWorkout.sessionId ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`View ${planReadyActiveWorkout.title} details`}
                                onPress={() => setSelectedPlanReadySessionId(planReadyActiveWorkout.sessionId)}
                                style={styles.planReadyWorkoutDetailsButton}
                              >
                                <GymlogIcon name="eye" color="#FFFFFF" size={14} />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    )}
                    <View style={[styles.planReadyWorkoutInlineExerciseList, compactPlanReady && styles.planReadyWorkoutInlineExerciseListCompact]}>
                      {planReadyActiveWorkout.exercises.map((exercise) => (
                        <View key={exercise.id} style={[styles.planReadyWorkoutInlineExerciseRow, compactPlanReady && styles.planReadyWorkoutInlineExerciseRowCompact]}>
                          <Text style={[styles.planReadyWorkoutInlineExerciseName, compactPlanReady && styles.planReadyWorkoutInlineExerciseNameCompact]} numberOfLines={1}>{exercise.name}</Text>
                          <View style={[styles.planReadyWorkoutInlineExerciseTargets, compactPlanReady && styles.planReadyWorkoutInlineExerciseTargetsCompact]}>
                            {exercise.setsLabel ? (
                              <Text style={[styles.planReadyWorkoutInlineExerciseTarget, compactPlanReady && styles.planReadyWorkoutInlineExerciseTargetCompact]} numberOfLines={1}>
                                {exercise.setsLabel}
                              </Text>
                            ) : null}
                            {exercise.repsLabel ? (
                              <Text style={[styles.planReadyWorkoutInlineExerciseTarget, compactPlanReady && styles.planReadyWorkoutInlineExerciseTargetCompact]} numberOfLines={1}>
                                {exercise.repsLabel}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                      {planReadyActiveWorkout.hiddenExerciseCount > 0 ? (
                        <Text style={[styles.planReadyWorkoutMoreExercises, compactPlanReady && styles.planReadyWorkoutMoreExercisesCompact]}>
                          and {planReadyActiveWorkout.hiddenExerciseCount} more exercises
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={[styles.planReadyFitSummaryPanel, compactPlanReady && styles.planReadyFitSummaryPanelCompact]}>
                <View style={[styles.planReadyFitReasons, compactPlanReady && styles.planReadyFitReasonsCompact]}>
                  <Text style={[styles.planReadyFitSectionTitle, compactPlanReady && styles.planReadyFitSectionTitleCompact]}>WHY THIS PLAN?</Text>
                  {planReadyFitReasons.map((reason) => (
                    <View key={reason} style={[styles.planReadyFitReasonRow, compactPlanReady && styles.planReadyFitReasonRowCompact]}>
                      <GymlogIcon name="check" color="#B8FF6A" size={compactPlanReady ? 12 : 18} />
                      <Text style={[styles.planReadyFitReasonText, compactPlanReady && styles.planReadyFitReasonTextCompact]}>{reason}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.planReadyOverviewCard, compactPlanReady && styles.planReadyOverviewCardCompact]}>
                  <Text style={[styles.planReadyOverviewTitle, compactPlanReady && styles.planReadyOverviewTitleCompact]}>PLAN OVERVIEW</Text>
                  {planReadyOverviewRows.map((row) => (
                    <View key={row.label} style={[styles.planReadyOverviewRow, compactPlanReady && styles.planReadyOverviewRowCompact]}>
                      <GymlogIcon name={row.icon} color="#FFFFFF" size={compactPlanReady ? 13 : 18} />
                      <Text style={[styles.planReadyOverviewText, compactPlanReady && styles.planReadyOverviewTextCompact]}>{row.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  function renderPlanning() {
    const visibleFocusOptions = FOCUS_AREA_OPTIONS.filter((option) => option.area !== 'mobility');
    const focusAreaRows: Array<FocusAreaOnboardingOption[]> = [
      visibleFocusOptions.slice(0, 3),
      visibleFocusOptions.slice(3, 6),
      visibleFocusOptions.slice(6, 9),
    ];

    return renderOnboardingShell({
      stepLabel: 'STEP 4 OF 5',
      titleLines: ['WHAT DO YOU', 'WANT TO FOCUS ON?'],
      topPaneStyle: styles.focusAreaTopPane,
      topCopyStyle: styles.focusAreaTopCopy,
      titleStyle: styles.focusAreaHeadline,
      bottomStyle: styles.focusAreaBottomPane,
      children: (
        <View style={styles.focusAreaContent}>
          <View style={styles.focusAreaGrid}>
            {focusAreaRows.map((row, rowIndex) => (
              <View key={`focus-area-row-${rowIndex}`} style={styles.focusAreaGridRow}>
                {row.map((option) => {
                  const active = focusAreas.includes(option.area);
                  const imageSource = FOCUS_AREA_CARD_ASSETS[option.area];
                  const imageFrameStyle = FOCUS_AREA_IMAGE_FRAMES[option.area];

                  return (
                    <Pressable
                      key={option.area}
                      accessibilityRole="button"
                      accessibilityLabel={option.accessibilityLabel}
                      accessibilityState={{ selected: active }}
                      onPress={() => toggleFocusArea(option.area)}
                      style={[styles.focusAreaCard, active && styles.focusAreaCardActive]}
                    >
                      <View style={styles.focusAreaImageSlot}>
                        {imageSource ? (
                          <Image
                            source={imageSource}
                            resizeMode={imageFrameStyle ? 'contain' : 'cover'}
                            style={[styles.focusAreaImage, imageFrameStyle]}
                          />
                        ) : option.area === 'mobility' ? (
                          <View style={styles.focusAreaIconFallback}>
                            <GymlogIcon name="mobility" color="rgba(255,255,255,0.78)" size={34} />
                          </View>
                        ) : null}
                      </View>
                      <View pointerEvents="none" style={styles.focusAreaTitleScrim} />
                      <View style={[styles.focusAreaCheck, active && styles.focusAreaCheckActive]}>
                        {active ? <GymlogIcon name="check" color="#111111" size={12} /> : null}
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.focusAreaCardTitle}>
                        {option.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
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

  function renderAbout() {
    const bodyweightGoalMode = getBodyweightGoalMode([bodyweightGoal]);
    const targetLimits = getBodyweightTargetLimits(bodyweightPickerValue, unitPreference, bodyweightGoal);
    const targetBodyweight = clampTargetBodyweightForGoal(
      targetWeightValue ?? getDefaultTargetBodyweight(bodyweightPickerValue, unitPreference, bodyweightGoal),
      bodyweightPickerValue,
      unitPreference,
      bodyweightGoal,
    );

    return renderOnboardingShell({
      stepLabel: 'STEP 5 OF 5',
      titleLines: ['TRACK YOUR', 'PROGRESS'],
      subtitle: 'Set your current weight and optional goal.',
      shellStyle: styles.bodyweightStageShell,
      topPaneStyle: styles.bodyweightTopPane,
      topCopyStyle: styles.bodyweightTopCopy,
      titleStyle: styles.bodyweightHeadline,
      bottomStyle: styles.bodyweightBottomPane,
      children: (
        <View style={styles.bodyweightStageContent}>
          <BodyweightStepper
            label="Current weight"
            value={bodyweightPickerValue}
            unit={unitPreference}
            onChange={setCurrentBodyweight}
            onUnitChange={setUnitPreference}
          />

          <View style={styles.bodyweightGoalBlock}>
            <Text style={styles.bodyweightPickerLabel}>Your goal</Text>
            <Text style={styles.bodyweightGoalPrompt}>What's your main goal?</Text>
            <View style={styles.bodyweightGoalGrid}>
              {BODYWEIGHT_GOAL_OPTIONS.map((option) => (
                <BodyweightGoalOptionCard
                  key={option.id}
                  title={option.title}
                  body={option.body}
                  icon={option.icon}
                  accentColor={option.accentColor}
                  active={bodyweightGoal === option.id}
                  onPress={() => {
                    setBodyweightGoal(option.id);
                    setTargetBodyweight(getDefaultTargetBodyweight(bodyweightPickerValue, unitPreference, option.id));
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.bodyweightTargetBlock}>
            <View style={styles.bodyweightTargetHeader}>
              <Text style={styles.bodyweightPickerLabel}>Target weight (optional)</Text>
              <Text style={styles.bodyweightTargetHint}>
                {bodyweightGoalMode === 'required'
                  ? 'Set a target weight to stay on track.'
                  : 'Use this if you want a target to track.'}
              </Text>
            </View>
            <BodyweightTargetSlider
              value={targetBodyweight}
              unit={unitPreference}
              min={targetLimits.min}
              max={targetLimits.max}
              onChange={setTargetBodyweight}
              onClear={() => setTargetWeightDraft('')}
            />
          </View>

          <BodyweightExpectationCard
            goal={bodyweightGoal}
          />

          <Text style={[styles.bodyweightSupportText, styles.bodyweightStageSupportText]}>
            You can update this anytime in your profile.
          </Text>
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
                    onPress={() => toggleFocusArea(area)}
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
            <Text style={styles.personalizationTitle}>Ask AI Coach</Text>
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
                onPress={() => runAction(() => onCompleteToStartingWeek(selection, activeRecommendedProgramId))}
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
              label="AI Coach"
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
    const phase = buildingPlanPhases[Math.min(buildingPlanPhaseIndex, buildingPlanPhases.length - 1)] ?? '';
    const pulseScale = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });
    const pulseOpacity = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.14, 0.32],
    });

    return (
      <Animated.View style={[styles.buildingPlanScreen, { opacity: buildingPlanScreenOpacity }]}>
        <View style={styles.buildingPlanLogoScene}>
          <Animated.View
            style={[
              styles.buildingPlanTopHalf,
              {
                opacity: buildingPlanEntryOpacity,
                transform: [{ translateY: buildingPlanTopTranslate }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.buildingPlanBottomHalf,
              {
                opacity: buildingPlanEntryOpacity,
                transform: [{ translateY: buildingPlanBottomTranslate }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.buildingPlanLogoStack,
              {
                opacity: buildingPlanLogoOpacity,
                transform: [{ scale: buildingPlanLogoScale }],
              },
            ]}
          >
            <Text style={styles.buildingPlanGymText}>GYM</Text>
            <Text style={styles.buildingPlanLogText}>LOG</Text>
          </Animated.View>
        </View>

        {showBuildingPlanThinking ? (
          <Animated.View style={[styles.buildingPlanThinkingScene, { opacity: buildingPlanThinkingOpacity }]}>
            <View style={styles.buildingPlanThinkingCenter}>
              <View style={styles.buildingPlanRingStack}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.buildingPlanRingPulse,
                    {
                      opacity: pulseOpacity,
                      transform: [{ scale: pulseScale }],
                    },
                  ]}
                />
                <View style={styles.buildingPlanRing}>
                  <Text style={styles.buildingPlanRingText}>G</Text>
                  <Text style={styles.buildingPlanPercentText}>{`${buildingPlanPercent}%`}</Text>
                </View>
              </View>
              <Animated.Text style={[styles.buildingPlanThinkingText, { opacity: buildingPlanCaptionOpacity }]}>
                {phase}
              </Animated.Text>
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
      : stage === 'planning'
      ? focusAreas.length > 0
      : stage === 'about' && selectedBodyweightGoalMode === 'required'
      ? targetWeightValue !== null
      : true;
  const locationStageActive =
    stage === 'location' ||
    stage === 'goal' ||
    stage === 'profile' ||
    stage === 'planning' ||
    stage === 'about';
  const standaloneProgressHidden = locationStageActive || stage === 'review';
  const footerPrimaryLabel =
    stage === 'review'
      ? 'START MY PLAN'
      : stage === 'about'
      ? 'Build my first program'
      : 'Continue';
  const footerVisible = true;
  const scrollLockedStage =
    stage === 'location' ||
    stage === 'profile' ||
    stage === 'planning' ||
    stage === 'about' ||
    stage === 'review';
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
    <View style={[styles.root, stage === 'review' ? styles.rootBlack : styles.rootLight]}>
      {locationStageActive ? <View pointerEvents="none" style={[styles.locationTopSafeArea, { height: insets.top }]} /> : null}
      <ScrollView
        style={[styles.scrollView, stage === 'review' ? styles.scrollViewBlack : styles.scrollViewLight]}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!scrollLockedStage}
        bounces={!scrollLockedStage}
        alwaysBounceVertical={!scrollLockedStage}
        overScrollMode={scrollLockedStage ? 'never' : 'auto'}
        keyboardShouldPersistTaps="handled"
      >
        {standaloneProgressHidden ? null : <StepDots index={stageIndex} light />}

        {stage === 'location' ? renderLocation() : null}
        {stage === 'goal' ? renderGoal() : null}
        {stage === 'profile' ? renderProfile() : null}
        {stage === 'planning' ? renderPlanning() : null}
        {stage === 'about' ? renderAbout() : null}
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
            <Pressable
              onPress={() => {
                if (!canContinue || busy) {
                  return;
                }

                if (stage === 'about') {
                  setIsBuildingPlan(true);
                  return;
                }

                if (stage === 'review') {
                  void runAction(() => onCompleteToStartingWeek(selection, activeRecommendedProgramId));
                  return;
                }

                setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
              }}
              style={[
                stage === 'review' ? styles.planReadyFooterUsePlanButton : styles.primaryButton,
                stage === 'review' ? null : styles.primaryButtonDark,
                locationStageActive && styles.locationPrimaryButton,
                (!canContinue || busy) &&
                  (locationStageActive ? styles.locationPrimaryButtonDisabled : styles.buttonDisabled),
              ]}
              disabled={!canContinue || busy}
            >
              <Text
                style={[
                  stage === 'review' ? styles.planReadyFooterUsePlanButtonText : styles.primaryButtonText,
                  stage === 'review' ? null : styles.primaryButtonTextLight,
                  (!canContinue || busy) && locationStageActive && styles.locationPrimaryButtonTextDisabled,
                ]}
              >
                {footerPrimaryLabel}
              </Text>
            </Pressable>

            {stage === 'review' ? null : stage === 'location' ? (
              editMode ? (
                <Pressable onPress={() => runAction(() => onCancel?.())} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => runAction(onBackToEntry ?? onSkip)} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Back</Text>
                </Pressable>
              )
            ) : (
              <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))} disabled={busy}>
                <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Back</Text>
              </Pressable>
            )}
          </>
          {busy ? <ActivityIndicator color="#06080B" size="small" /> : null}
        </View>
      ) : null}

      <Modal
        visible={Boolean(selectedPlanReadySession)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPlanReadySessionId(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedPlanReadySessionId(null)} />
          </View>
          {selectedPlanReadySession ? (
            <View style={[styles.sheet, styles.planReadyDetailSheet]}>
              <View style={styles.planReadyWorkoutDetailCloseRail}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close workout details"
                  onPress={() => setSelectedPlanReadySessionId(null)}
                  style={styles.planReadyWorkoutDetailCloseButton}
                >
                  <Text style={styles.planReadyWorkoutDetailCloseIcon}>X</Text>
                </Pressable>
              </View>

              <View style={styles.planReadyWorkoutDetailHero}>
                <View style={styles.planReadyWorkoutDetailHeroCopy}>
                  <Text style={styles.planReadyWorkoutDetailKicker}>WORKOUT DETAILS</Text>
                  <Text style={styles.planReadyWorkoutDetailTitle}>{formatWorkoutDisplayLabel(selectedPlanReadySession.name, 'Workout')}</Text>
                  <View style={styles.planReadyWorkoutDetailDurationRow}>
                    <GymlogIcon name="tempo" color="#B8FF6A" size={18} />
                    <Text style={styles.planReadyWorkoutDetailDuration}>{selectedPlanReadySession.guidance.estimatedDuration}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.planReadyDetailScroll, styles.planReadyDetailContent]}>
                <View style={styles.planReadyWorkoutDetailBlock}>
                  <View style={styles.planReadyWorkoutDetailIconSlot}>
                    <GymlogIcon name="check" color="#B8FF6A" size={21} />
                  </View>
                  <View style={styles.planReadyWorkoutDetailCopy}>
                    <Text style={styles.planReadyWorkoutDetailText}>{selectedPlanReadySession.guidance.warmup}</Text>
                  </View>
                </View>

                <View style={styles.planReadyWorkoutDetailBlock}>
                  <View style={styles.planReadyWorkoutDetailIconSlot}>
                    <GymlogIcon name="progress" color="#B8FF6A" size={23} />
                  </View>
                  <View style={styles.planReadyWorkoutDetailCopy}>
                    <Text style={styles.planReadyWorkoutDetailLabel}>MAIN FOCUS</Text>
                    <Text style={styles.planReadyWorkoutDetailText}>{selectedPlanReadySession.guidance.mainFocus}</Text>
                  </View>
                </View>

                <View style={styles.planReadyWorkoutExerciseBlock}>
                  <View style={styles.planReadyWorkoutDetailIconSlot}>
                    <GymlogIcon name="strength" color="#B8FF6A" size={22} />
                  </View>
                  <View style={styles.planReadyWorkoutDetailCopy}>
                    <Text style={styles.planReadyWorkoutDetailLabel}>ALL EXERCISES</Text>
                  {selectedPlanReadySession.detailExercises.map((exercise, index) => (
                    <View key={exercise.id} style={styles.planReadyWorkoutExerciseRow}>
                      <View style={styles.planReadyWorkoutExerciseIndexBubble}>
                        <Text style={styles.planReadyWorkoutExerciseIndexText}>{index + 1}</Text>
                      </View>
                      <View style={styles.planReadyWorkoutExerciseCopy}>
                        <Text style={styles.planReadyWorkoutExerciseName}>{exercise.name}</Text>
                        <Text style={styles.planReadyWorkoutExerciseMeta}>{exercise.prescription}</Text>
                      </View>
                    </View>
                  ))}
                  </View>
                </View>

                <View style={styles.planReadyWorkoutDetailBlock}>
                  <View style={styles.planReadyWorkoutDetailIconSlot}>
                    <GymlogIcon name="tempo" color="#B8FF6A" size={22} />
                  </View>
                  <View style={styles.planReadyWorkoutDetailCopy}>
                    <Text style={styles.planReadyWorkoutDetailLabel}>REST</Text>
                    <Text style={styles.planReadyWorkoutDetailText}>{selectedPlanReadySession.guidance.restGuidance}</Text>
                  </View>
                </View>

                <View style={styles.planReadyWorkoutDetailBlock}>
                  <View style={styles.planReadyWorkoutDetailIconSlot}>
                    <GymlogIcon name="progress" color="#B8FF6A" size={22} />
                  </View>
                  <View style={styles.planReadyWorkoutDetailCopy}>
                    <Text style={styles.planReadyWorkoutDetailLabel}>PROGRESSION</Text>
                    <Text style={styles.planReadyWorkoutDetailText}>{selectedPlanReadySession.guidance.progressionHint}</Text>
                  </View>
                </View>

              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={helperVisible} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setHelperVisible(false)} />
          </View>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetKicker}>AI Coach</Text>
        <Text style={styles.sheetTitle}>Ask AI Coach</Text>
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
                <Text style={styles.helperStatusText}>AI Coach is answering.</Text>
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
    backgroundColor: '#FFFFFF',
  },
  rootBlack: {
    backgroundColor: '#000000',
  },
  rootDark: {
    backgroundColor: '#06080B',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewLight: {
    backgroundColor: '#FFFFFF',
  },
  scrollViewBlack: {
    backgroundColor: '#000000',
  },
  scrollViewDark: {
    backgroundColor: '#06080B',
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
  locationPaginationWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 12,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dotLight: {
    backgroundColor: 'rgba(6,8,11,0.10)',
  },
  dotActive: {
    backgroundColor: '#F3F7FF',
  },
  dotActiveLight: {
    backgroundColor: '#06080B',
  },
  stageBody: {
    gap: spacing.lg,
  },
  locationStageShell: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
  },
  locationTopSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  locationTopPane: {
    backgroundColor: '#000000',
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
    height: 248,
    paddingTop: 32,
    paddingBottom: 18,
  },
  locationTopSlope: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: -36,
    height: 72,
    backgroundColor: '#F5F5F5',
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
    paddingTop: 20,
    paddingBottom: 0,
    gap: 3,
  },
  locationTopCopyProfile: {
    paddingTop: 14,
  },
  locationStepLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  locationStepLabelSolid: {
    color: '#FFFFFF',
  },
  locationHeadline: {
    color: '#FFFFFF',
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  locationHeadlineLarge: {
    fontSize: 42,
    lineHeight: 46,
    maxWidth: 180,
  },
  locationEquipmentHeadline: {
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  locationSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  locationBottomPane: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: spacing.lg * 2 - 14,
    paddingTop: 4,
  },
  locationBottomPaneTight: {
    paddingTop: 6,
  },
  locationCardList: {
    gap: 8,
  },
  locationCardListCompact: {
    gap: 8,
  },
  locationStepOneOptionsShift: {
    transform: [{ translateY: -12 }],
  },
  locationStepTwoOptionsShift: {
    transform: [{ translateY: 8 }],
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
    color: 'rgba(6,8,11,0.56)',
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
    height: 248,
    justifyContent: 'flex-start',
    paddingTop: 32,
    paddingBottom: 18,
  },
  trainingProfileTopCopy: {
    paddingTop: 20,
    paddingBottom: 0,
    gap: 3,
  },
  trainingProfileHeadline: {
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  trainingProfileBottomPane: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  trainingProfileContent: {
    gap: 10,
  },
  trainingProfileSection: {
    gap: 4,
  },
  trainingProfileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingProfileSectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingProfileSectionTitle: {
    flex: 1,
    color: '#06080B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },
  trainingProfileSectionPrompt: {
    color: 'rgba(6,8,11,0.66)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  trainingExperienceList: {
    gap: 6,
  },
  trainingExperienceCard: {
    height: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#141414',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
  },
  trainingExperienceCardActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#171717',
    shadowOpacity: 0.08,
  },
  trainingExperienceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trainingExperienceTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  trainingExperienceTitleActive: {
    color: '#FFFFFF',
  },
  trainingExperienceBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  trainingExperienceBodyActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  trainingExperienceChipStack: {
    gap: 1,
    marginTop: 2,
  },
  trainingExperienceChipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 4,
  },
  trainingExperienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trainingExperienceChipCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingExperienceChipCheckActive: {
    borderColor: 'rgba(255,255,255,0.60)',
  },
  trainingExperienceChipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  trainingExperienceChipTextActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  trainingProfileRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  trainingProfileRadioActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  trainingFrequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trainingFrequencyTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  trainingFrequencyTileActive: {
    borderWidth: 2,
    borderColor: '#06080B',
  },
  trainingFrequencyNumber: {
    color: '#06080B',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  trainingFrequencyLabel: {
    color: '#06080B',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  trainingPlanPreviewStrip: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(6,8,11,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: 'center',
    gap: 4,
  },
  trainingPlanPreviewLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trainingPlanPreviewTitle: {
    color: 'rgba(6,8,11,0.58)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  trainingPlanPreviewText: {
    color: '#06080B',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
  },
  trainingSetupCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(6,8,11,0.05)',
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
    color: 'rgba(6,8,11,0.60)',
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
    backgroundColor: 'rgba(6,8,11,0.12)',
  },
  trainingSetupMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  trainingSetupMetricText: {
    flex: 1,
    color: '#06080B',
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
    minHeight: 86,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: '#171717',
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  locationChoiceActiveOutline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  locationChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  locationChoiceCopy: {
    flex: 1,
    gap: 3,
    marginLeft: 12,
  },
  locationChoiceCopyNoIcon: {
    marginLeft: 12,
  },
  locationChoiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
  },
  locationChoiceLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  locationChoiceLabelActive: {
    color: '#FFFFFF',
  },
  locationFocusBadge: {
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  locationFocusBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  locationFocusBadgeGreen: {
    backgroundColor: 'rgba(69,190,126,0.2)',
  },
  locationFocusBadgeBlue: {
    backgroundColor: 'rgba(104,184,255,0.2)',
  },
  locationFocusBadgePurple: {
    backgroundColor: 'rgba(198,139,255,0.2)',
  },
  locationFocusBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  locationFocusBadgeTextNeutral: {
    color: 'rgba(255,255,255,0.88)',
  },
  locationFocusBadgeTextGreen: {
    color: '#8BDEAE',
  },
  locationFocusBadgeTextBlue: {
    color: '#8FCAFF',
  },
  locationFocusBadgeTextPurple: {
    color: '#D9A9FF',
  },
  locationChoiceSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  locationChoiceSubtitleActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  locationChoiceTagRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
  },
  locationChoiceRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  locationChoiceRadioLeading: {
    marginLeft: 0,
    marginRight: 0,
    borderColor: 'rgba(255,255,255,0.58)',
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
    height: 2,
    left: 1,
    top: 9,
    borderRadius: 2,
    backgroundColor: '#111111',
    transform: [{ rotate: '45deg' }],
  },
  locationChoiceRadioCheckLong: {
    position: 'absolute',
    width: 13,
    height: 2,
    left: 5,
    top: 6,
    borderRadius: 2,
    backgroundColor: '#111111',
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
    gap: 6,
  },
  bodyweightPickerLabel: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bodyweightUnitPill: {
    minWidth: 48,
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  bodyweightUnitPillActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  bodyweightUnitText: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
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
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  bodyweightTargetCard: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  bodyweightTargetValueWrap: {
    width: 152,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightTargetValueInput: {
    minWidth: 76,
    color: '#06080B',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'right',
    padding: 0,
  },
  bodyweightTargetValueUnit: {
    color: '#06080B',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    includeFontPadding: false,
    marginLeft: 5,
    marginTop: 7,
  },
  bodyweightTargetStepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  bodyweightTargetStepText: {
    color: '#06080B',
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
    backgroundColor: '#06080B',
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
    gap: spacing.sm,
  },
  bodyweightStepperUnitPill: {
    minHeight: 30,
  },
  bodyweightSupportText: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  bodyweightStageShell: {
    backgroundColor: '#F5F5F5',
  },
  bodyweightTopPane: {
    justifyContent: 'flex-start',
    height: 248,
    paddingTop: 32,
    paddingBottom: 18,
  },
  bodyweightTopCopy: {
    paddingTop: 20,
    paddingBottom: 0,
    gap: 3,
  },
  bodyweightHeadline: {
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  bodyweightBottomPane: {
    paddingTop: 4,
  },
  bodyweightGoalBlock: {
    marginTop: 8,
  },
  bodyweightGoalPrompt: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 10,
    lineHeight: 12,
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
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  bodyweightGoalCardActive: {
    backgroundColor: '#000000',
  },
  bodyweightGoalCardTitle: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'center',
  },
  bodyweightGoalCardTitleActive: {
    color: '#FFFFFF',
  },
  bodyweightGoalCardBody: {
    color: 'rgba(6,8,11,0.56)',
    fontSize: 8.5,
    lineHeight: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  bodyweightGoalCardBodyActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  bodyweightSliderCard: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#FFFFFF',
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
    color: '#06080B',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  bodyweightSliderClearText: {
    color: 'rgba(6,8,11,0.34)',
    fontSize: 9,
    lineHeight: 11,
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
    backgroundColor: 'rgba(6,8,11,0.10)',
  },
  bodyweightSliderTrackActive: {
    position: 'absolute',
    left: 0,
    top: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#06080B',
  },
  bodyweightSliderThumb: {
    position: 'absolute',
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
    marginLeft: -4,
  },
  bodyweightExpectationCard: {
    minHeight: 120,
    borderRadius: 8,
    backgroundColor: '#050505',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  bodyweightExpectationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bodyweightExpectationIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightExpectationKicker: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bodyweightExpectationTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 7,
    marginBottom: 3,
  },
  bodyweightExpectationText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
  },
  focusStageShell: {
    backgroundColor: '#F5F5F5',
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
    height: 248,
    justifyContent: 'flex-start',
    paddingTop: 32,
    paddingBottom: 18,
  },
  focusAreaTopCopy: {
    paddingTop: 20,
    paddingBottom: 0,
    gap: 3,
  },
  focusAreaHeadline: {
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  focusAreaBottomPane: {
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
  focusAreaContent: {
    gap: 7,
  },
  focusAreaGrid: {
    gap: 6,
  },
  focusAreaGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  focusAreaCard: {
    flex: 1,
    minWidth: 0,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 3,
  },
  focusAreaCardActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  focusAreaCardFiller: {
    flex: 1,
    minWidth: 0,
    height: 140,
  },
  focusAreaImageSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#080808',
    justifyContent: 'center',
  },
  focusAreaImage: {
    width: '100%',
    height: '100%',
  },
  focusAreaIconFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080808',
  },
  focusAreaTitleScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  focusAreaCheck: {
    position: 'absolute',
    top: 8,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  focusAreaCheckActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  focusAreaCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  focusAreaInfoBox: {
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: 'rgba(6,8,11,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  focusAreaInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242,183,5,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusAreaInfoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  focusAreaInfoTitle: {
    color: '#06080B',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  focusAreaInfoBody: {
    color: 'rgba(6,8,11,0.58)',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  focusAreaInfoBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(198,139,255,0.20)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  focusAreaInfoBadgeText: {
    color: '#8C4FBD',
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
    paddingTop: 2,
    paddingBottom: 0,
    transform: [{ translateY: -5 }],
  },
  bodyweightStageSupportText: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 13,
  },
  buildingPlanScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  buildingPlanLogoScene: {
    ...StyleSheet.absoluteFillObject,
  },
  buildingPlanTopHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#000000',
  },
  buildingPlanBottomHalf: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#FFFFFF',
  },
  buildingPlanLogoStack: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -78,
  },
  buildingPlanGymText: {
    color: '#FFFFFF',
    fontSize: 84,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanLogText: {
    color: '#000000',
    fontSize: 84,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanThinkingScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg * 2,
  },
  buildingPlanThinkingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  buildingPlanRingStack: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingPlanRingPulse: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buildingPlanRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  buildingPlanRingText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanPercentText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanThinkingText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 26,
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
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#06080B',
    borderColor: '#06080B',
  },
  setupOptionCardImage: {
    overflow: 'hidden',
    borderColor: 'rgba(6,8,11,0.18)',
    backgroundColor: '#06080B',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIcon: {
    minHeight: 188,
    overflow: 'hidden',
    borderColor: 'rgba(6,8,11,0.18)',
    backgroundColor: '#06080B',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIconActive: {
    borderColor: '#F3F7FF',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.16)',
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
    backgroundColor: '#06080B',
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
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  setupOptionCardImageActive: {
    borderColor: '#06080B',
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
    color: '#06080B',
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
    color: 'rgba(6,8,11,0.68)',
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
  planReadyStage: {
    backgroundColor: '#050505',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  planReadyHeader: {
    backgroundColor: '#000000',
    gap: 4,
    paddingTop: spacing.lg,
  },
  planReadyTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  planReadySubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  planReadyCardShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  planReadyPlanCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#0B0B0B',
  },
  planReadyHeroCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 190,
    zIndex: 0,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  planReadyHeroImage: {
    minHeight: 312,
    justifyContent: 'flex-start',
    padding: spacing.md,
  },
  planReadyHeroImageCompact: {
    minHeight: 190,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 6,
  },
  planReadyHeroImageStyle: {
    borderRadius: 0,
    opacity: 0.9,
    transform: [{ scaleX: 1.06 }, { scaleY: 1.12 }, { translateX: 12 }],
  },
  planReadyHeroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  planReadyHeroGradientTop: {
    flex: 0.34,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  planReadyHeroGradientMiddle: {
    flex: 0.30,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  planReadyHeroGradientBottom: {
    flex: 0.36,
    backgroundColor: 'rgba(0,0,0,0.90)',
  },
  planReadyHeroTextScrim: {
    position: 'absolute',
    left: 0,
    top: 96,
    bottom: 0,
    width: '74%',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  planReadyHeroKicker: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  planReadyHeroKickerCompact: {
    fontSize: 11,
    lineHeight: 13,
  },
  planReadyHeroInfoButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planReadyHeroCopy: {
    gap: spacing.sm,
    width: '100%',
    marginTop: 108,
  },
  planReadyHeroCopyCompact: {
    gap: 4,
    marginTop: 26,
  },
  planReadyHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planReadyHeroTitle: {
    color: '#FFFFFF',
    fontSize: 54,
    lineHeight: 57,
    fontWeight: '900',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  planReadyHeroTitleCompact: {
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: 0,
    maxWidth: '78%',
  },
  planReadyHeroTitleDetailsButton: {
    minWidth: 82,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    marginTop: 2,
  },
  planReadyHeroTitleDetailsText: {
    color: '#06080B',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  planReadyHeroBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '700',
    maxWidth: '62%',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  planReadyHeroBodyCompact: {
    fontSize: 13,
    lineHeight: 17,
    maxWidth: '88%',
  },
  planReadyWorkoutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planReadyWorkoutSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  planReadyWorkoutCarouselBar: {
    minHeight: 38,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  planReadyWorkoutCarouselTabs: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planReadyWorkoutCarouselTab: {
    flex: 1,
    minWidth: 0,
    minHeight: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'transparent',
  },
  planReadyWorkoutCarouselTabActive: {
    backgroundColor: 'rgba(198,139,255,0.82)',
  },
  planReadyWorkoutCarouselTabText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  planReadyWorkoutCarouselTabTextActive: {
    color: '#FFFFFF',
  },
  planReadyWeekPanel: {
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'visible',
    gap: spacing.sm,
  },
  planReadyWeekPanelRow: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 304,
  },
  planReadyWorkoutDayCard: {
    flex: 1,
    overflow: 'hidden',
  },
  planReadyWorkoutSingleCard: {
    width: '100%',
  },
  planReadyWorkoutDayCardCompact: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 286,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  planReadyWeekPanelRowLast: {
    borderBottomWidth: 0,
  },
  planReadyWorkoutDayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 52,
  },
  planReadyWorkoutDayHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 9,
    minHeight: 0,
  },
  planReadyWorkoutCardMetaRowCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  planReadyWorkoutHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  planReadyWorkoutDetailsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  planReadyWorkoutDetailsButtonCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  planReadyWorkoutDayMeta: {
    width: 38,
    gap: 2,
  },
  planReadyWorkoutDayMetaCompact: {
    width: 25,
  },
  planReadyWorkoutDayNumber: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  planReadyWorkoutDayNumberCompact: {
    fontSize: 7,
    lineHeight: 8,
  },
  planReadyWorkoutDayName: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  planReadyWorkoutDayNameCompact: {
    fontSize: 7,
    lineHeight: 8,
  },
  planReadyWeekPanelDayPill: {
    width: 52,
    minHeight: 28,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  planReadyWeekPanelDay: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planReadyWeekPanelIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  planReadyWeekPanelIconCompact: {
    width: 12,
    height: 12,
    marginTop: 0,
  },
  planReadyWeekPanelCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  planReadyWeekPanelTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planReadyWeekPanelTitleRowCompact: {
    alignItems: 'flex-start',
    gap: 4,
  },
  planReadyWorkoutTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  planReadyWorkoutTitleBlockCompact: {
    gap: 4,
  },
  planReadyWeekPanelTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  planReadyWeekPanelTitleCompact: {
    maxWidth: '68%',
    flex: 0,
    fontSize: 23,
    lineHeight: 25,
  },
  planReadyWeekPanelDuration: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyWeekPanelDurationCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  planReadyWeekPanelBody: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  planReadyWorkoutInlineExerciseList: {
    gap: 0,
  },
  planReadyWorkoutInlineExerciseListCompact: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  planReadyWorkoutInlineExerciseRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  planReadyWorkoutInlineExerciseRowCompact: {
    minHeight: 35,
    gap: 6,
  },
  planReadyWorkoutInlineExerciseName: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  planReadyWorkoutInlineExerciseNameCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  planReadyWorkoutInlineExerciseTargets: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    minWidth: 168,
  },
  planReadyWorkoutInlineExerciseTargetsCompact: {
    gap: 8,
    minWidth: 122,
  },
  planReadyWorkoutInlineExerciseTarget: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  planReadyWorkoutInlineExerciseTargetCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  planReadyWorkoutMoreExercises: {
    paddingTop: spacing.sm,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  planReadyWorkoutMoreExercisesCompact: {
    paddingTop: 6,
    fontSize: 11,
    lineHeight: 14,
  },
  planReadyWeekPanelRest: {
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planReadyWeekPanelRestText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  planReadyWeeklyOverview: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  planReadyWeeklyOverviewCompact: {
    borderRadius: 16,
    borderColor: 'rgba(198,139,255,0.72)',
    backgroundColor: 'rgba(198,139,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  planReadyWeeklyOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planReadyWeeklyOverviewHeaderCompact: {
    gap: 6,
  },
  planReadyWeeklyOverviewTitle: {
    flex: 1,
    color: '#B8FF6A',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyWeeklyOverviewTitleCompact: {
    color: '#C68BFF',
    fontSize: 14,
    lineHeight: 16,
  },
  planReadyWeeklyOverviewSummary: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  planReadyWeeklyOverviewSummaryCompact: {
    fontSize: 11,
    lineHeight: 13,
  },
  planReadyWeeklyOverviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  planReadyWeeklyOverviewRowCompact: {
    gap: 2,
  },
  planReadyWeeklyOverviewDay: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  planReadyWeeklyOverviewDayCompact: {
    gap: 4,
  },
  planReadyWeeklyOverviewDayText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  planReadyWeeklyOverviewDayTextCompact: {
    fontSize: 8,
    lineHeight: 9,
  },
  planReadyWeeklyOverviewDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
  },
  planReadyWeeklyOverviewDotActive: {
    borderColor: '#B8FF6A',
    backgroundColor: '#B8FF6A',
  },
  planReadyWeeklyOverviewDotRest: {
    borderColor: 'rgba(255,255,255,0.24)',
  },
  planReadyWeeklyOverviewDotCompact: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  planReadyWeeklyOverviewLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
  },
  planReadyWeeklyOverviewLabelCompact: {
    fontSize: 7,
    lineHeight: 8,
  },
  planReadyWeeklyOverviewLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planReadyWeeklyOverviewLegendCompact: {
    gap: 8,
  },
  planReadyWeeklyOverviewLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planReadyWeeklyOverviewLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  planReadyWeeklyOverviewLegendDotActive: {
    borderColor: '#B8FF6A',
    backgroundColor: '#B8FF6A',
  },
  planReadyWeeklyOverviewLegendText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  planReadyWeeklyOverviewLegendTextCompact: {
    fontSize: 8,
    lineHeight: 9,
  },
  planReadyHeroScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  planReadyHeroScheduleDay: {
    width: 32,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyHeroScheduleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planReadyHeroScheduleName: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  planReadyHeroScheduleBody: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  planReadyHeroScheduleMeta: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planReadyHeroRestLine: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingTop: 2,
  },
  planReadyHeroReasonBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingTop: spacing.sm,
    gap: 4,
  },
  planReadyHeroReasonKicker: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  planReadyHeroReason: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  planReadyHeroReasonMuted: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  planReadyHeroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  planReadyHeroChipRowCompact: {
    gap: 6,
    marginTop: spacing.sm,
  },
  planReadyHeroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  planReadyHeroChipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  planReadyHeroChipIcon: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planReadyHeroChipText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  planReadyHeroChipTextCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  planReadyCardContent: {
    flex: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: '#0B0B0B',
  },
  planReadyCardContentCompact: {
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 144,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  planReadyFitSummaryPanel: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: spacing.xl,
  },
  planReadyFitSummaryPanelCompact: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    padding: 14,
    minHeight: 132,
  },
  planReadyFitReasons: {
    flex: 1,
    gap: spacing.md,
  },
  planReadyFitReasonsCompact: {
    flex: 1,
    gap: 8,
  },
  planReadyFitSectionTitle: {
    color: '#B8FF6A',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyFitSectionTitleCompact: {
    maxWidth: '100%',
    fontSize: 12,
    lineHeight: 14,
  },
  planReadyFitReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planReadyFitReasonRowCompact: {
    gap: 7,
  },
  planReadyFitReasonText: {
    flex: 1,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  planReadyFitReasonTextCompact: {
    fontSize: 11.5,
    lineHeight: 14,
  },
  planReadyOverviewCard: {
    width: '40%',
    minWidth: 248,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  planReadyOverviewCardCompact: {
    width: '48%',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 9,
  },
  planReadyOverviewTitle: {
    color: '#B8FF6A',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyOverviewTitleCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  planReadyOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planReadyOverviewRowCompact: {
    gap: 7,
  },
  planReadyOverviewText: {
    flex: 1,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  planReadyOverviewTextCompact: {
    fontSize: 11.5,
    lineHeight: 14,
  },
  planReadyWorkoutGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  planReadyWorkoutGridCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  planReadyWeekPanelRowCompact: {
    minHeight: 0,
  },
  planReadyWorkoutFocusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(198,139,255,0.28)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  planReadyWorkoutFocusChipCompact: {
    marginTop: 0,
    marginLeft: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  planReadyWorkoutFocusChipText: {
    color: '#D7B8FF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  planReadyWorkoutFocusChipTextCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  planReadyWhyMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
  },
  planReadyWhyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  planReadyWhyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  planReadyWhyKicker: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planReadyWhyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  planReadyDetailsButton: {
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
  planReadyDetailsButtonText: {
    color: '#06080B',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  planReadyQuickDetail: {
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingTop: spacing.sm,
  },
  planReadyQuickDetailKicker: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  planReadyQuickDetailText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  planReadyQuickDetailMeta: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  planReadyExpectationPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(198,139,255,0.72)',
    backgroundColor: 'rgba(198,139,255,0.12)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  planReadyExpectationPanelCompact: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  planReadyExpectationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planReadyExpectationHeaderCompact: {
    gap: 8,
  },
  planReadyExpectationBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(198,139,255,0.34)',
  },
  planReadyExpectationBadgeCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  planReadyExpectationTitle: {
    color: '#C68BFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyExpectationTitleCompact: {
    fontSize: 13,
    lineHeight: 15,
  },
  planReadyExpectationItems: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  planReadyExpectationItemsCompact: {
    flexDirection: 'row',
    gap: 8,
  },
  planReadyExpectationItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.18)',
  },
  planReadyExpectationItemCompact: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    borderRightWidth: 0,
    paddingHorizontal: 0,
    gap: 4,
  },
  planReadyExpectationItemCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  planReadyExpectationItemCopyCompact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: 2,
  },
  planReadyExpectationItemTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyExpectationItemTitleCompact: {
    textAlign: 'left',
    fontSize: 8.5,
    lineHeight: 10,
  },
  planReadyExpectationItemBody: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  planReadyExpectationItemBodyCompact: {
    textAlign: 'left',
    fontSize: 7.5,
    lineHeight: 9,
  },
  planReadyInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.lg,
    paddingBottom: 0,
  },
  planReadyInlineActionsCompact: {
    paddingTop: 0,
  },
  planReadyBackButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#111111',
  },
  planReadyBackButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '700',
    marginTop: -2,
  },
  planReadyUsePlanButton: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8FF6A',
  },
  planReadyUsePlanButtonCompact: {
    minHeight: 44,
    maxWidth: 360,
  },
  planReadyUsePlanButtonText: {
    color: '#06080B',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
  planReadyUsePlanButtonTextCompact: {
    fontSize: 19,
    lineHeight: 23,
  },
  planReadyDetailsIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#111111',
  },
  planReadyHeroDetailButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planReadyHeroDetailButtonText: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyWeekCard: {
    borderRadius: 0,
    backgroundColor: '#000000',
    paddingVertical: spacing.md + 2,
    gap: spacing.md,
  },
  planReadySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planReadySectionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planReadySectionMeta: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  planReadyWeekList: {
    gap: spacing.sm,
  },
  planReadyWeekItem: {
    gap: spacing.xs,
  },
  planReadyWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#101010',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  planReadyWeekDay: {
    width: 30,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  planReadyWeekIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  planReadyWeekIconRest: {
    backgroundColor: 'rgba(6,8,11,0.08)',
  },
  planReadyWeekCopy: {
    flex: 1,
    gap: 3,
  },
  planReadyWeekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  planReadyWeekTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  planReadyWeekDuration: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  planReadyWeekBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  planReadyWeekDetailsToggle: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  planReadyWeekDetailPanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  planReadyWeekDetailGrid: {
    gap: spacing.xs,
  },
  planReadyWeekDetailBlock: {
    borderRadius: radii.sm,
    backgroundColor: '#F5F6F8',
    padding: spacing.sm,
    gap: 3,
  },
  planReadyWeekDetailLabel: {
    color: 'rgba(6,8,11,0.52)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planReadyWeekDetailText: {
    color: '#06080B',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  planReadyWeekExerciseBlock: {
    borderRadius: radii.sm,
    backgroundColor: '#F5F6F8',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  planReadyWeekExerciseRow: {
    gap: 2,
  },
  planReadyWeekExerciseName: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyWeekExerciseMeta: {
    color: 'rgba(6,8,11,0.62)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  planReadyRestSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#101010',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  planReadyRestIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  planReadyRestCopy: {
    flex: 1,
    gap: 2,
  },
  planReadyRestLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planReadyRestDays: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyInsightPanel: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  planReadyInsightCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#101010',
    padding: spacing.md,
    gap: spacing.xs,
  },
  planReadyInsightKicker: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  planReadyInsightTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
  },
  planReadyInsightBody: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  planReadyFallbackNote: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    gap: 3,
  },
  planReadyFallbackTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyFallbackBody: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  planReadyFirstWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planReadyFirstWorkoutDuration: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  planReadyWorkoutDetailButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs,
  },
  planReadyWorkoutDetailButtonText: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  planReadyDetailSheet: {
    margin: 0,
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#000000',
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  planReadyWorkoutDetailCloseRail: {
    minHeight: 66,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 30,
  },
  planReadyWorkoutDetailHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 8,
  },
  planReadyWorkoutDetailHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  planReadyWorkoutDetailKicker: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  planReadyWorkoutDetailTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 0,
  },
  planReadyWorkoutDetailDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planReadyWorkoutDetailDuration: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  planReadyWorkoutDetailCloseButton: {
    alignItems: 'center',
  },
  planReadyWorkoutDetailCloseIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    color: '#B8FF6A',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 23,
    lineHeight: 37,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#121212',
  },
  planReadyDetailScroll: {
    flex: 1,
  },
  planReadyDetailContent: {
    gap: 8,
    paddingBottom: spacing.sm,
  },
  planReadyWorkoutDetailGrid: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  planReadyWorkoutDetailBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#101010',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planReadyWorkoutDetailIconSlot: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  planReadyWorkoutDetailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  planReadyWorkoutDetailLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.9,
  },
  planReadyWorkoutDetailText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  planReadyWorkoutExerciseBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#101010',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planReadyWorkoutExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 45,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  planReadyWorkoutExerciseIndexBubble: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B8FF6A',
  },
  planReadyWorkoutExerciseIndexText: {
    color: '#B8FF6A',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  planReadyWorkoutExerciseCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planReadyWorkoutExerciseName: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  planReadyWorkoutExerciseMeta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  planReadyFirstWorkoutAction: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  planReadyOptionsPanel: {
    marginHorizontal: 0,
    marginTop: spacing.xs,
    paddingHorizontal: 0,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl + spacing.lg,
    backgroundColor: '#000000',
    gap: spacing.sm,
  },
  planReadyOptionsTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planReadyOptionsSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  planReadyOptionList: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  planReadyOptionCard: {
    width: '100%',
    minHeight: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#101010',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planReadyOptionCardActive: {
    borderColor: '#FFFFFF',
  },
  planReadyOptionPhoto: {
    width: 132,
    height: 112,
    minHeight: 112,
    marginLeft: 0,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  planReadyOptionImage: {
    borderRadius: radii.sm,
    transform: [{ translateX: 18 }, { scale: 1.8 }],
  },
  planReadyOptionShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  planReadyOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: spacing.sm,
  },
  planReadyOptionMeta: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  planReadyOptionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
  },
  planReadyOptionBody: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  planReadyOptionRadio: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  planReadyOptionRadioActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
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
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: 'rgba(6,8,11,0.08)',
  },
  locationFooter: {
    paddingTop: 0,
    transform: [{ translateY: 0 }],
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  focusFooter: {
    transform: [{ translateY: 0 }],
    paddingTop: spacing.lg,
  },
  footerDarkStage: {
    backgroundColor: '#000000',
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  planReadyFixedFooter: {
    backgroundColor: '#000000',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 0,
    alignItems: 'center',
    gap: 6,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonDark: {
    backgroundColor: '#06080B',
    borderColor: '#06080B',
  },
  reviewPrimaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  reviewPrimaryButtonText: {
    color: '#06080B',
  },
  locationPrimaryButton: {
    minHeight: 44,
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  locationPrimaryButtonDisabled: {
    opacity: 1,
  },
  locationPrimaryButtonTextDisabled: {
    color: 'rgba(255,255,255,0.42)',
  },
  planReadyFooterUsePlanButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8FF6A',
    borderWidth: 1,
    borderColor: '#B8FF6A',
  },
  planReadyFooterUsePlanButtonText: {
    color: '#06080B',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  primaryButtonText: {
    color: '#06080B',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  primaryButtonTextLight: {
    color: '#FFFFFF',
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
    color: 'rgba(6,8,11,0.68)',
  },
  secondaryTextLight: {
    color: 'rgba(243,247,255,0.78)',
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

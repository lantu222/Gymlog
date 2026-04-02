import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BadgePill, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { InlineTip } from '../components/InlineTip';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { convertWeightToKg, formatWeight, formatWeightInputValue, parseNumberInput } from '../lib/format';
import {
  buildScheduleFitNote,
  buildFirstRunCustomProgramName,
  buildFirstRunHelperPrompt,
  buildFirstRunPromptSuggestions,
  buildFirstRunRecommendationReasons,
  buildFirstRunValluContext,
  DEFAULT_FIRST_RUN_SELECTION,
  formatFocusAreaList,
  formatSecondaryOutcomeList,
  FirstRunSetupSelection,
  FirstRunStep,
  getFocusAreaDescription,
  getFocusAreaTitle,
  getGuidanceModeDescription,
  getGuidanceModeLabel,
  getRecommendedProgramName,
  getScheduleModeDescription,
  getScheduleModeLabel,
  getSecondaryOutcomeTitle,
  getWeeklyMinuteOptions,
  getWeekdayShortLabel,
  resolveFirstRunRecommendationWithTailoring,
  resolveProjectedTrainingDays,
  getEffectiveWeeklyMinutes,
} from '../lib/firstRunSetup';
import { buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { requestValluAdvice } from '../lib/valluClient';
import { colors, radii, spacing } from '../theme';
import {
  SetupDaysPerWeek,
  SetupEquipment,
  SetupGoal,
  SetupGuidanceMode,
  SetupFocusArea,
  SetupLevel,
  SetupScheduleMode,
  SetupSecondaryOutcome,
  SetupWeekday,
  UnitPreference,
} from '../types/models';
import { ValluAdvice } from '../types/vallu';

interface OnboardingScreenProps {
  initialUnitPreference: UnitPreference;
  readyProgramCount: number;
  dismissedTipIds: string[];
  onDismissTip: (tipId: string) => void | Promise<void>;
  mode?: 'first_run' | 'edit';
  initialSelection?: FirstRunSetupSelection | null;
  initialStage?: SetupStage;
  tailoringPreferences?: TailoringPreferencesInput | null;
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

type SetupStage = 'location' | 'goal' | 'outcomes' | 'planning' | 'about' | 'recommendation';
type HelperState = 'idle' | 'loading' | 'ready' | 'error';
type RecommendationRefinementPanel = 'schedule' | 'focus' | 'custom' | 'vallu' | null;
type SelectionVisual = {
  accent: SurfaceAccent;
  chips: string[];
  bars: number[];
};

const STAGES: SetupStage[] = ['location', 'goal', 'outcomes', 'planning', 'about', 'recommendation'];

function getStageIndex(stage?: SetupStage) {
  const index = stage ? STAGES.indexOf(stage) : -1;
  return index >= 0 ? index : 0;
}

const LOCATION_OPTIONS: Array<{
  equipment: SetupEquipment;
  title: string;
  body: string;
  meta: string;
  visual: SelectionVisual;
}> = [
  {
    equipment: 'gym',
    title: 'Full gym',
    body: 'Barbell, bench, cable.',
    meta: 'Classic lifting',
    visual: {
      accent: 'blue',
      chips: ['BAR', 'CABLE'],
      bars: [20, 30, 24],
    },
  },
  {
    equipment: 'home',
    title: 'Home setup',
    body: 'DB, bench, bands, rack.',
    meta: 'Easy to repeat',
    visual: {
      accent: 'orange',
      chips: ['DB', 'BAND'],
      bars: [18, 24, 16],
    },
  },
  {
    equipment: 'minimal',
    title: 'Minimal setup',
    body: 'Bodyweight and a few tools.',
    meta: 'Low-friction',
    visual: {
      accent: 'rose',
      chips: ['BW', 'MAT'],
      bars: [10, 18, 12],
    },
  },
];

const GOAL_OPTIONS: Array<{
  goal: SetupGoal;
  title: string;
  body: string;
  visual: SelectionVisual;
}> = [
  {
    goal: 'strength',
    title: 'Get stronger',
    body: 'Heavy lifts. More load.',
    visual: {
      accent: 'blue',
      chips: ['LOAD', 'PR'],
      bars: [14, 22, 30],
    },
  },
  {
    goal: 'muscle',
    title: 'Build muscle',
    body: 'More volume. More size.',
    visual: {
      accent: 'orange',
      chips: ['VOL', 'PUMP'],
      bars: [28, 24, 26],
    },
  },
  {
    goal: 'general',
    title: 'General fitness',
    body: 'Balanced and repeatable.',
    visual: {
      accent: 'neutral',
      chips: ['MOVE', 'LIFT'],
      bars: [18, 22, 18],
    },
  },
  {
    goal: 'run_mobility',
    title: 'Run + mobility',
    body: 'Run work and mobility.',
    visual: {
      accent: 'rose',
      chips: ['RUN', 'MOB'],
      bars: [24, 12, 18],
    },
  },
];

const SECONDARY_OUTCOME_OPTIONS: Array<{
  outcome: SetupSecondaryOutcome;
  body: string;
}> = [
  {
    outcome: 'consistency',
    body: 'Easy to stick with.',
  },
  {
    outcome: 'mobility',
    body: 'Move better.',
  },
  {
    outcome: 'conditioning',
    body: 'Keep your engine up.',
  },
  {
    outcome: 'muscle',
    body: 'Keep some size work.',
  },
  {
    outcome: 'strength',
    body: 'Keep the big lifts moving.',
  },
];

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
    title: 'Recommend it, I will edit',
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

const FOCUS_AREA_OPTIONS: SetupFocusArea[] = ['arms', 'glutes', 'core', 'conditioning'];
const WEEKDAY_OPTIONS: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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

function SelectionCardVisual({
  visual,
  active,
}: {
  visual: SelectionVisual;
  active: boolean;
}) {
  const tokens =
    visual.accent === 'orange'
      ? {
          wash: 'rgba(240, 106, 57, 0.16)',
          border: 'rgba(240, 106, 57, 0.24)',
          chipBackground: 'rgba(240, 106, 57, 0.14)',
          chipBorder: 'rgba(240, 106, 57, 0.26)',
          chipText: '#FFF1E9',
          bar: '#FFB389',
        }
      : visual.accent === 'rose'
        ? {
            wash: 'rgba(191, 74, 105, 0.14)',
            border: 'rgba(191, 74, 105, 0.24)',
            chipBackground: 'rgba(191, 74, 105, 0.16)',
            chipBorder: 'rgba(191, 74, 105, 0.24)',
            chipText: '#FFF2F6',
            bar: '#F39AB2',
          }
        : visual.accent === 'neutral'
          ? {
              wash: 'rgba(255,255,255,0.06)',
              border: 'rgba(255,255,255,0.12)',
              chipBackground: 'rgba(255,255,255,0.08)',
              chipBorder: 'rgba(255,255,255,0.10)',
              chipText: '#E9F1F7',
              bar: '#B9CDDD',
            }
          : {
              wash: 'rgba(85, 138, 189, 0.16)',
              border: 'rgba(85, 138, 189, 0.24)',
              chipBackground: 'rgba(85, 138, 189, 0.16)',
              chipBorder: 'rgba(150, 216, 255, 0.22)',
              chipText: '#E7F6FF',
              bar: '#9ACCFF',
            };

  return (
    <View
      style={[
        styles.selectionVisual,
        {
          backgroundColor: tokens.wash,
          borderColor: active ? tokens.chipBorder : tokens.border,
        },
      ]}
    >
      <View style={styles.selectionVisualChipRow}>
        {visual.chips.map((chip) => (
          <View
            key={chip}
            style={[
              styles.selectionVisualChip,
              {
                backgroundColor: tokens.chipBackground,
                borderColor: tokens.chipBorder,
              },
            ]}
          >
            <Text style={[styles.selectionVisualChipText, { color: tokens.chipText }]}>{chip}</Text>
          </View>
        ))}
      </View>

      <View style={styles.selectionVisualBars}>
        {visual.bars.map((height, index) => (
          <View
            key={`${visual.chips.join('-')}-${index}`}
            style={[
              styles.selectionVisualBar,
              {
                height,
                backgroundColor: tokens.bar,
                opacity: active ? 1 : 0.8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function SelectionCard({
  title,
  body,
  meta,
  active,
  onPress,
  visual,
}: {
  title: string;
  body: string;
  meta: string;
  active: boolean;
  onPress: () => void;
  visual?: SelectionVisual;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.selectionCard, active && styles.selectionCardActive]}>
      <View style={styles.selectionCardMain}>
        <View style={styles.selectionCardCopy}>
          <Text style={[styles.selectionCardTitle, active && styles.selectionCardTitleActive]}>{title}</Text>
          <Text style={styles.selectionCardBody}>{body}</Text>
        </View>
        {visual ? <SelectionCardVisual visual={visual} active={active} /> : null}
      </View>
      <Text style={[styles.selectionCardMeta, active && styles.selectionCardMetaActive]}>{meta}</Text>
    </Pressable>
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

function StepDots({ index }: { index: number }) {
  return (
    <View style={styles.pagination}>
      {STAGES.map((stage, stageIndex) => (
        <View key={stage} style={[styles.dot, stageIndex <= index && styles.dotActive]} />
      ))}
    </View>
  );
}

function getLocationLabel(equipment: SetupEquipment) {
  switch (equipment) {
    case 'gym':
      return 'Full gym';
    case 'home':
      return 'Home setup';
    case 'minimal':
      return 'Minimal setup';
    default:
      return 'Your setup';
  }
}

function getGoalLabel(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return 'Strength';
    case 'muscle':
      return 'Build muscle';
    case 'general':
      return 'General fitness';
    case 'run_mobility':
      return 'Run + mobility';
    default:
      return 'Training';
  }
}

function getLevelLabel(level: SetupLevel) {
  return level === 'beginner' ? 'Beginner' : 'Intermediate';
}

export function OnboardingScreen({
  initialUnitPreference,
  readyProgramCount,
  dismissedTipIds,
  onDismissTip,
  mode = 'first_run',
  initialSelection,
  initialStage,
  tailoringPreferences = null,
  onSkip,
  onCompleteToStartingWeek,
  onCompleteToProgramDetail,
  onCompleteToCustom,
  onCancel,
}: OnboardingScreenProps) {
  const setupSeed = initialSelection ?? DEFAULT_FIRST_RUN_SELECTION;
  const editMode = mode === 'edit';
  const previousUnitPreferenceRef = useRef(initialUnitPreference);
  const [stageIndex, setStageIndex] = useState(() =>
    getStageIndex(initialStage ?? (editMode ? 'recommendation' : 'location')),
  );
  const [goal, setGoal] = useState<SetupGoal>(setupSeed.goal);
  const [level, setLevel] = useState<SetupLevel>(setupSeed.level);
  const [daysPerWeek, setDaysPerWeek] = useState<SetupDaysPerWeek>(setupSeed.daysPerWeek);
  const [equipment, setEquipment] = useState<SetupEquipment>(setupSeed.equipment);
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
  const [busy, setBusy] = useState(false);
  const [activeRecommendationRefinement, setActiveRecommendationRefinement] =
    useState<RecommendationRefinementPanel>(null);
  const [helperVisible, setHelperVisible] = useState(false);
  const [helperDraft, setHelperDraft] = useState('');
  const [helperState, setHelperState] = useState<HelperState>('idle');
  const [helperAnswer, setHelperAnswer] = useState<ValluAdvice | null>(null);
  const [helperNote, setHelperNote] = useState('');
  const [helperSource, setHelperSource] = useState<'live' | 'preview'>('preview');
  const [helperError, setHelperError] = useState('');

  const stage = STAGES[stageIndex];
  const currentWeightValue = useMemo(() => parseNumberInput(currentWeightDraft), [currentWeightDraft]);
  const targetWeightValue = useMemo(() => parseNumberInput(targetWeightDraft), [targetWeightDraft]);
  const selection = useMemo<FirstRunSetupSelection>(
    () => ({
      goal,
      level,
      daysPerWeek,
      equipment,
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
      currentWeightValue,
      daysPerWeek,
      equipment,
      focusAreas,
      goal,
      guidanceMode,
      level,
      scheduleMode,
      secondaryOutcomes,
      targetWeightValue,
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
  const recommendedProgram = useMemo(
    () => getWorkoutTemplateById(recommendation.featuredProgramId),
    [recommendation.featuredProgramId],
  );
  const secondaryProgram = useMemo(
    () => getWorkoutTemplateById(recommendation.secondaryProgramId ?? ''),
    [recommendation.secondaryProgramId],
  );
  const helperSuggestions = useMemo(
    () => buildFirstRunPromptSuggestions(selection, getRecommendedProgramName(recommendation.featuredProgramId)),
    [recommendation.featuredProgramId, selection],
  );
  const helperPrompt = useMemo(
    () => buildFirstRunHelperPrompt(stage as FirstRunStep, selection, recommendedProgram?.name ?? null),
    [recommendedProgram?.name, selection, stage],
  );
  const locationLabel = useMemo(() => getLocationLabel(equipment), [equipment]);
  const goalLabel = useMemo(() => getGoalLabel(goal), [goal]);
  const levelLabel = useMemo(() => getLevelLabel(level), [level]);
  const secondaryOutcomeLabels = useMemo(
    () => secondaryOutcomes.map((outcome) => getSecondaryOutcomeTitle(outcome)),
    [secondaryOutcomes],
  );
  const recommendationLead = useMemo(() => {
    switch (goal) {
      case 'strength':
        return 'Strength first. Easy to repeat.';
      case 'muscle':
        return 'More volume across the week.';
      case 'run_mobility':
        return 'Running and mobility in one week.';
      default:
        return 'Balanced work you can repeat.';
    }
  }, [goal]);
  const focusAreaLabels = useMemo(() => focusAreas.map((area) => getFocusAreaTitle(area)), [focusAreas]);
  const focusAreaSummary = useMemo(() => formatFocusAreaList(focusAreas), [focusAreas]);
  const guidanceModeLabel = useMemo(() => getGuidanceModeLabel(guidanceMode), [guidanceMode]);
  const guidanceModeDescription = useMemo(() => getGuidanceModeDescription(guidanceMode), [guidanceMode]);
  const scheduleModeLabel = useMemo(() => getScheduleModeLabel(scheduleMode), [scheduleMode]);
  const scheduleModeDescription = useMemo(() => getScheduleModeDescription(scheduleMode), [scheduleMode]);
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
  const availableDayLabels = useMemo(
    () => availableDays.map((day) => getWeekdayShortLabel(day)),
    [availableDays],
  );
  const projectedSessions = useMemo(
    () =>
      recommendedProgram
        ? [...recommendedProgram.sessions]
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .slice(0, 3)
            .map((session) => ({
              id: session.id,
              name: session.name,
              body: `${session.exercises.length} exercises`,
            }))
        : [],
    [recommendedProgram],
  );
  const recommendationReasons = useMemo(
    () =>
      buildFirstRunRecommendationReasons(selection, {
        projectedDaysPerWeek,
        estimatedSessionDuration: recommendedProgram?.estimatedSessionDuration ?? null,
        mismatchNote: recommendation.mismatchNote,
      }, recommendationTailoringPreferences),
    [
      projectedDaysPerWeek,
      recommendation.mismatchNote,
      recommendationTailoringPreferences,
      recommendedProgram?.estimatedSessionDuration,
      selection,
    ],
  );
  const tailoringBadgeLabels = useMemo(
    () => buildTailoringBadgeLabels(recommendationTailoringPreferences).slice(0, 3),
    [recommendationTailoringPreferences],
  );

  const activeTipId =
    stage === 'location'
      ? 'setup_location'
      : stage === 'goal'
        ? 'setup_goal'
        : stage === 'outcomes'
          ? 'setup_outcomes'
          : stage === 'planning'
            ? 'setup_planning'
            : stage === 'about'
              ? 'setup_about'
          : 'setup_recommendation';
  const activeTip =
    stage === 'location'
      ? {
          title: 'Use the real setup',
          body: 'Pick what you actually have.',
          accent: 'orange' as const,
        }
      : stage === 'goal'
        ? {
            title: 'One main goal',
            body: 'Pick one target.',
            accent: 'blue' as const,
          }
        : stage === 'outcomes'
          ? {
              title: 'Any side goals?',
              body: 'Pick only a few.',
              accent: 'orange' as const,
            }
          : stage === 'planning'
            ? {
                title: 'How guided?',
                body: 'Match your real week.',
                accent: 'blue' as const,
              }
            : stage === 'about'
              ? {
                  title: 'Need bodyweight?',
                  body: 'Only if it helps.',
                  accent: 'orange' as const,
                }
            : {
                title: 'One clear start',
                body: 'Start here, then tweak.',
                accent: 'rose' as const,
              };

  useEffect(() => {
    setUnitPreference(initialUnitPreference);
  }, [initialUnitPreference]);

  useEffect(() => {
    if (stage !== 'recommendation' && activeRecommendationRefinement !== null) {
      setActiveRecommendationRefinement(null);
    }
  }, [activeRecommendationRefinement, stage]);

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
        return current;
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

  async function askVallu() {
    const prompt = helperDraft.trim();
    if (!prompt) {
      return;
    }

    setHelperState('loading');
    setHelperAnswer(null);
    setHelperNote('');
    setHelperError('');

    try {
      const result = await requestValluAdvice({
        prompt,
        context: buildFirstRunValluContext(selection, readyProgramCount),
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
    return (
      <SurfaceCard accent="blue" emphasis="utility" style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderCopy}>
            <Text style={styles.previewKicker}>What would you start with?</Text>
            <Text style={styles.previewTitle}>{recommendedProgram?.name ?? 'Ready plan'}</Text>
            <Text style={styles.previewBody}>Matched to your answers.</Text>
          </View>
          <View style={styles.previewHeaderAside}>
            <PreviewGlyph dayCount={projectedDaysPerWeek} />
            <BadgePill label={`${projectedDaysPerWeek} days`} accent="blue" />
          </View>
        </View>

        <View style={styles.previewBadgeRow}>
          <BadgePill label={locationLabel} accent="neutral" />
          <BadgePill label={goalLabel} accent="neutral" />
          <BadgePill label={levelLabel} accent="neutral" />
        </View>

        {secondaryOutcomeLabels.length ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>Also important</Text>
            <View style={styles.previewBadgeRow}>
              {secondaryOutcomeLabels.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
            </View>
          </View>
        ) : null}

        {focusAreaLabels.length ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>Extra focus</Text>
            <View style={styles.previewBadgeRow}>
              {focusAreaLabels.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.previewSectionBlock}>
          <Text style={styles.previewSectionLabel}>Plan style</Text>
          <View style={styles.previewBadgeRow}>
            <BadgePill label={guidanceModeLabel} accent="neutral" />
            <BadgePill label={guidanceModeDescription} accent="neutral" />
          </View>
        </View>

        {stage === 'recommendation' ||
        selection.scheduleMode !== DEFAULT_FIRST_RUN_SELECTION.scheduleMode ||
        typeof selection.weeklyMinutes === 'number' ||
        selection.availableDays.length ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>Schedule fit</Text>
            <View style={styles.previewBadgeRow}>
              <BadgePill label={scheduleModeLabel} accent="neutral" />
              <BadgePill label={`~${effectiveWeeklyMinutes} min / week`} accent="neutral" />
            </View>
            {selection.scheduleMode === 'self_managed' && availableDayLabels.length ? (
              <View style={styles.previewBadgeRow}>
                {availableDayLabels.map((label) => (
                  <BadgePill key={label} label={label} accent="neutral" />
                ))}
              </View>
            ) : null}
            <View style={styles.previewBadgeRow}>
              <BadgePill label={scheduleModeDescription} accent="neutral" />
            </View>
            <Text style={styles.previewSupportText}>{scheduleFitNote}</Text>
          </View>
        ) : null}

        {selection.currentWeightKg || selection.targetWeightKg ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>Bodyweight context</Text>
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
          <Text style={styles.previewSectionLabel}>Projected rhythm</Text>
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
            <Text style={styles.previewSectionLabel}>First sessions</Text>
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

        {recommendation.mismatchNote ? <Text style={styles.previewNote}>{recommendation.mismatchNote}</Text> : null}
      </SurfaceCard>
    );
  }

  function renderSelectionSnapshot() {
    return (
      <SurfaceCard accent="orange" emphasis="flat" style={styles.snapshotCard}>
        <Text style={styles.snapshotKicker}>You told Gymlog</Text>
        <View style={styles.previewBadgeRow}>
          <BadgePill label={locationLabel} accent="neutral" />
          <BadgePill label={goalLabel} accent="neutral" />
          <BadgePill label={`${daysPerWeek} days`} accent="neutral" />
          <BadgePill label={levelLabel} accent="neutral" />
          <BadgePill label={guidanceModeLabel} accent="neutral" />
          <BadgePill label={unitPreference} accent="neutral" />
          <BadgePill label={scheduleModeLabel} accent="neutral" />
          <BadgePill label={`~${effectiveWeeklyMinutes} min / week`} accent="neutral" />
        </View>
        {secondaryOutcomeLabels.length ? (
          <View style={styles.previewBadgeRow}>
            {secondaryOutcomeLabels.map((label) => (
              <BadgePill key={label} label={label} accent="neutral" />
            ))}
          </View>
        ) : null}
        {focusAreaLabels.length ? (
          <View style={styles.previewBadgeRow}>
            {focusAreaLabels.map((label) => (
              <BadgePill key={label} label={label} accent="neutral" />
            ))}
          </View>
        ) : null}
        {selection.scheduleMode === 'self_managed' && availableDayLabels.length ? (
          <View style={styles.previewBadgeRow}>
            {availableDayLabels.map((label) => (
              <BadgePill key={label} label={label} accent="neutral" />
            ))}
          </View>
        ) : null}
        {selection.targetWeightKg ? (
          <View style={styles.previewBadgeRow}>
            {selection.currentWeightKg ? (
              <BadgePill label={`Current ${formatWeight(selection.currentWeightKg, unitPreference)}`} accent="neutral" />
            ) : null}
            <BadgePill label={`Target ${formatWeight(selection.targetWeightKg, unitPreference)}`} accent="neutral" />
          </View>
        ) : selection.currentWeightKg ? (
          <View style={styles.previewBadgeRow}>
            <BadgePill label={`Current ${formatWeight(selection.currentWeightKg, unitPreference)}`} accent="neutral" />
          </View>
        ) : null}
      </SurfaceCard>
    );
  }

  function renderLocation() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 1</Text>
          <Text style={styles.title}>Where do you train most often?</Text>
          <Text style={styles.body}>Pick what is real.</Text>
        </View>

        {renderProjectedPreview()}

        <View style={styles.selectionList}>
          {LOCATION_OPTIONS.map((option) => (
            <SelectionCard
              key={option.equipment}
              title={option.title}
              body={option.body}
              meta={option.meta}
              visual={option.visual}
              active={equipment === option.equipment}
              onPress={() => setEquipment(option.equipment)}
            />
          ))}
        </View>

        <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
          <View style={styles.helperStripCopy}>
            <Text style={styles.helperStripTitle}>Need help?</Text>
            <Text style={styles.helperStripBody}>Ask Vallu.</Text>
          </View>
          <Pressable onPress={() => openHelper()} style={styles.helperStripButton}>
            <Text style={styles.helperStripButtonText}>Ask Vallu</Text>
          </Pressable>
        </SurfaceCard>
      </View>
    );
  }

  function renderGoal() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 2</Text>
          <Text style={styles.title}>What is your primary goal?</Text>
          <Text style={styles.body}>Pick one main target.</Text>
        </View>

        <View style={styles.selectionList}>
          {GOAL_OPTIONS.map((option) => (
            <SelectionCard
              key={option.goal}
              title={option.title}
              body={option.body}
              visual={option.visual}
              meta={goal === option.goal ? 'Current direction' : 'Tap to preview this path'}
              active={goal === option.goal}
              onPress={() => setGoal(option.goal)}
            />
          ))}
        </View>

        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>Experience</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip label="Beginner" active={level === 'beginner'} onPress={() => setLevel('beginner')} />
            <ChoiceChip
              label="Intermediate"
              active={level === 'intermediate'}
              onPress={() => setLevel('intermediate')}
            />
          </View>
        </View>

        {renderProjectedPreview()}

        <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
          <View style={styles.helperStripCopy}>
            <Text style={styles.helperStripTitle}>Two goals?</Text>
            <Text style={styles.helperStripBody}>Ask Vallu.</Text>
          </View>
          <Pressable onPress={() => openHelper()} style={styles.helperStripButton}>
            <Text style={styles.helperStripButtonText}>Ask Vallu</Text>
          </Pressable>
        </SurfaceCard>
      </View>
    );
  }

  function renderOutcomes() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 3</Text>
          <Text style={styles.title}>What else matters in this block?</Text>
          <Text style={styles.body}>Pick side priorities.</Text>
        </View>

        <View style={styles.selectionList}>
          {SECONDARY_OUTCOME_OPTIONS.map((option) => {
            const active = secondaryOutcomes.includes(option.outcome);
            return (
              <SelectionCard
                key={option.outcome}
                title={getSecondaryOutcomeTitle(option.outcome)}
                body={option.body}
                meta={active ? 'Included in the projected setup' : 'Tap to keep this in the plan'}
                active={active}
                onPress={() => toggleSecondaryOutcome(option.outcome)}
              />
            );
          })}
        </View>

        {secondaryOutcomes.length ? (
          <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
            <View style={styles.helperStripCopy}>
              <Text style={styles.helperStripTitle}>Also keeping</Text>
              <Text style={styles.helperStripBody}>{formatSecondaryOutcomeList(secondaryOutcomes)}</Text>
            </View>
          </SurfaceCard>
        ) : null}

        {renderProjectedPreview()}

        <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
          <View style={styles.helperStripCopy}>
            <Text style={styles.helperStripTitle}>Not sure?</Text>
            <Text style={styles.helperStripBody}>Ask Vallu.</Text>
          </View>
          <Pressable onPress={() => openHelper()} style={styles.helperStripButton}>
            <Text style={styles.helperStripButtonText}>Ask Vallu</Text>
          </Pressable>
        </SurfaceCard>
      </View>
    );
  }

  function renderPlanning() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 4</Text>
          <Text style={styles.title}>How do you want this planned?</Text>
          <Text style={styles.body}>Pick your setup style.</Text>
        </View>

        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>Days per week</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip label="2 days" active={daysPerWeek === 2} onPress={() => setDaysPerWeek(2)} />
            <ChoiceChip label="3 days" active={daysPerWeek === 3} onPress={() => setDaysPerWeek(3)} />
            <ChoiceChip label="4 days" active={daysPerWeek === 4} onPress={() => setDaysPerWeek(4)} />
          </View>
        </View>

        <View style={styles.selectionList}>
          {GUIDANCE_MODE_OPTIONS.map((option) => (
            <SelectionCard
              key={option.mode}
              title={option.title}
              body={option.body}
              meta={guidanceMode === option.mode ? 'Current planning style' : 'Tap to preview this setup style'}
              active={guidanceMode === option.mode}
              onPress={() => setGuidanceMode(option.mode)}
            />
          ))}
        </View>

        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>Units</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip label="kg" active={unitPreference === 'kg'} onPress={() => setUnitPreference('kg')} />
            <ChoiceChip label="lb" active={unitPreference === 'lb'} onPress={() => setUnitPreference('lb')} />
          </View>
        </View>

        {renderProjectedPreview()}

        <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
          <View style={styles.helperStripCopy}>
            <Text style={styles.helperStripTitle}>Need help?</Text>
            <Text style={styles.helperStripBody}>Ask Vallu.</Text>
          </View>
          <Pressable onPress={() => openHelper()} style={styles.helperStripButton}>
            <Text style={styles.helperStripButtonText}>Ask Vallu</Text>
          </Pressable>
        </SurfaceCard>
      </View>
    );
  }

  function renderAbout() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 5</Text>
          <Text style={styles.title}>Add bodyweight?</Text>
          <Text style={styles.body}>Optional.</Text>
        </View>

        <SurfaceCard accent="blue" emphasis="utility" style={styles.metricCard}>
          <View style={styles.metricRow}>
            <View style={styles.metricCopy}>
              <Text style={styles.metricTitle}>Current bodyweight</Text>
              <Text style={styles.metricBody}>Start point.</Text>
            </View>
            <View style={styles.metricInputWrap}>
              <TextInput
                value={currentWeightDraft}
                onChangeText={setCurrentWeightDraft}
                keyboardType="decimal-pad"
                placeholder={unitPreference === 'kg' ? '82' : '181'}
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accentAlt}
                style={styles.metricInput}
              />
              <Text style={styles.metricUnit}>{unitPreference}</Text>
            </View>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricRow}>
            <View style={styles.metricCopy}>
              <Text style={styles.metricTitle}>Target bodyweight</Text>
              <Text style={styles.metricBody}>Goal weight.</Text>
            </View>
            <View style={styles.metricInputWrap}>
              <TextInput
                value={targetWeightDraft}
                onChangeText={setTargetWeightDraft}
                keyboardType="decimal-pad"
                placeholder={unitPreference === 'kg' ? '78' : '172'}
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.accentAlt}
                style={styles.metricInput}
              />
              <Text style={styles.metricUnit}>{unitPreference}</Text>
            </View>
          </View>
        </SurfaceCard>

        {renderProjectedPreview()}

        <SurfaceCard accent="orange" emphasis="flat" style={styles.helperStrip}>
          <View style={styles.helperStripCopy}>
            <Text style={styles.helperStripTitle}>Need help?</Text>
            <Text style={styles.helperStripBody}>Ask Vallu.</Text>
          </View>
          <Pressable onPress={() => openHelper()} style={styles.helperStripButton}>
            <Text style={styles.helperStripButtonText}>Ask Vallu</Text>
          </Pressable>
        </SurfaceCard>
      </View>
    );
  }

  function renderRecommendation() {
    const recommendationPrimaryLabel = editMode ? 'See updated week' : 'See starting week';
    const recommendationSecondaryLabel = 'Open full plan';

    function renderRecommendationRefinementPanel() {
      if (activeRecommendationRefinement === 'schedule') {
        return (
          <View style={styles.refinementPanel}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleHeaderCopy}>
                <Text style={styles.scheduleTitle}>Shape the week</Text>
                <Text style={styles.scheduleBody}>Only if the week needs a tweak.</Text>
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
            <Text style={styles.personalizationTitle}>Any extra focus?</Text>
            <Text style={styles.personalizationBody}>Pick up to 2.</Text>
            <View style={styles.personalizationGrid}>
              {FOCUS_AREA_OPTIONS.map((area) => {
                const active = focusAreas.includes(area);
                const limitReached = !active && focusAreas.length >= 2;
                return (
                  <Pressable
                    key={area}
                    onPress={() => toggleFocusArea(area)}
                    style={[
                      styles.personalizationOption,
                      active && styles.personalizationOptionActive,
                      limitReached && styles.personalizationOptionDisabled,
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
            <Text style={styles.buildOwnKicker}>Build your own</Text>
            <Text style={styles.buildOwnTitle}>{guidanceMode === 'self_directed' ? 'Turn this into your split?' : 'Build your own instead?'}</Text>
            <Text style={styles.buildOwnBody}>{guidanceMode === 'self_directed' ? 'Open this as your base.' : 'Open a custom version.'}</Text>
            <Pressable
              onPress={() =>
                runAction(() =>
                  onCompleteToCustom(
                    selection,
                    recommendation.featuredProgramId,
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

      if (activeRecommendationRefinement === 'vallu') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>Need a second view?</Text>
            <Text style={styles.personalizationBody}>Ask about this exact fit.</Text>
            <Pressable
              onPress={() => openHelper(helperSuggestions[1] ?? helperSuggestions[0] ?? helperPrompt)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Ask Vallu</Text>
            </Pressable>
          </View>
        );
      }

      return null;
    }

    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>{editMode ? 'Plan fit' : 'Step 6'}</Text>
          <Text style={styles.title}>{editMode ? 'Still the best fit?' : 'Would you start here?'}</Text>
          <Text style={styles.body}>{editMode ? 'Update if needed.' : 'One clear start.'}</Text>
        </View>

        {recommendedProgram ? (
          <SurfaceCard accent="blue" emphasis="hero" style={styles.recommendationCard}>
            <View style={styles.recommendationTopRow}>
              <View style={styles.recommendationBadgeCluster}>
                <BadgePill label="Recommended" accent="blue" />
                <BadgePill label={`${recommendedProgram.daysPerWeek} days`} accent="blue" />
              </View>
              <PreviewGlyph dayCount={projectedDaysPerWeek} />
            </View>
            <Text style={styles.recommendationTitle}>{recommendedProgram.name}</Text>
            <Text style={styles.recommendationBody}>{recommendationLead}</Text>

              {recommendationReasons.length ? (
                <View style={styles.whyFitBlock}>
                  <Text style={styles.recommendationSignalLabel}>Why this fits</Text>
                  {recommendationReasons.slice(0, 3).map((reason) => (
                    <View key={reason} style={styles.whyFitRow}>
                    <View style={styles.whyFitDot} />
                    <Text style={styles.whyFitText}>{reason}</Text>
                  </View>
                  ))}
                </View>
              ) : null}

              {tailoringBadgeLabels.length ? (
                <View style={styles.recommendationChipRow}>
                  {tailoringBadgeLabels.map((label) => (
                    <BadgePill key={label} label={label} accent="orange" />
                  ))}
                </View>
              ) : null}

              <View style={styles.recommendationChipRow}>
                <BadgePill label={locationLabel} accent="neutral" />
                <BadgePill label={goalLabel} accent="neutral" />
                <BadgePill label={levelLabel} accent="neutral" />
                <BadgePill label={guidanceModeLabel} accent="neutral" />
            </View>

            {secondaryOutcomeLabels.length || focusAreaLabels.length ? (
              <View style={styles.recommendationChipRow}>
                {secondaryOutcomeLabels.slice(0, 2).map((label) => (
                  <BadgePill key={label} label={label} accent="neutral" />
                ))}
                {focusAreaLabels.slice(0, 2).map((label) => (
                  <BadgePill key={label} label={label} accent="neutral" />
                ))}
              </View>
            ) : null}

            <View style={styles.recommendationSignalGrid}>
              <View style={styles.recommendationSignalCard}>
                <Text style={styles.recommendationSignalLabel}>Week at a glance</Text>
                <View style={styles.recommendationRhythmRow}>
                  {projectedRhythm.map((day) => (
                    <View key={day} style={styles.recommendationDayPill}>
                      <Text style={styles.recommendationDayText}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.recommendationSignalCard}>
                <Text style={styles.recommendationSignalLabel}>Time budget</Text>
                <Text style={styles.recommendationSignalValue}>~{effectiveWeeklyMinutes} min</Text>
                <Text style={styles.recommendationSignalMeta}>{scheduleModeLabel}</Text>
              </View>
            </View>

            <View style={styles.recommendationActions}>
              <Pressable
                onPress={() => runAction(() => onCompleteToStartingWeek(selection, recommendation.featuredProgramId))}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{recommendationPrimaryLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction(() => onCompleteToProgramDetail(selection, recommendation.featuredProgramId))}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>{recommendationSecondaryLabel}</Text>
              </Pressable>
            </View>

            {projectedSessions.length ? (
              <View style={styles.recommendationSessionGrid}>
                {projectedSessions.slice(0, 3).map((session) => (
                  <View key={session.id} style={styles.recommendationSessionCard}>
                    <Text style={styles.recommendationSessionLabel}>Session</Text>
                    <Text style={styles.recommendationSessionTitle}>{session.name}</Text>
                    <Text style={styles.recommendationSessionBody}>{session.body}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.recommendationSupportText}>{scheduleFitNote}</Text>
            {secondaryProgram ? (
              <Text style={styles.recommendationSecondary}>Optional next pick: {secondaryProgram.name}</Text>
            ) : null}
          </SurfaceCard>
        ) : null}

        <SurfaceCard accent="orange" emphasis="flat" style={styles.personalizationCard}>
          <Text style={styles.personalizationKicker}>Adjust</Text>
          <Text style={styles.personalizationTitle}>Need to change anything?</Text>
          <Text style={styles.personalizationBody}>Only if needed.</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip
              label="Shape week"
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
              label="Ask Vallu"
              active={activeRecommendationRefinement === 'vallu'}
              onPress={() => toggleRecommendationRefinement('vallu')}
            />
          </View>
          {activeRecommendationRefinement ? (
            renderRecommendationRefinementPanel()
          ) : (
            <Text style={styles.personalizationHint}>Leave closed if this fits.</Text>
          )}
        </SurfaceCard>

        <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))} style={styles.recommendationBackButton}>
          <Text style={styles.secondaryText}>Back to setup</Text>
        </Pressable>
      </View>
    );
  }

  const footerPrimaryLabel = stage === 'about' ? 'See recommendation' : 'Continue';
  const footerVisible = stage !== 'recommendation';
  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      footerVisible
        ? {
            paddingBottom: spacing.xxl,
          }
        : null,
    ],
    [footerVisible],
  );

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scrollView} contentContainerStyle={scrollContentStyle} showsVerticalScrollIndicator={false}>
        <StepDots index={stageIndex} />

        {!dismissedTipIds.includes(activeTipId) ? (
          <InlineTip
            title={activeTip.title}
            body={activeTip.body}
            accent={activeTip.accent}
            onDismiss={() => {
              void onDismissTip(activeTipId);
            }}
          />
        ) : null}

        {stage === 'location' ? renderLocation() : null}
        {stage === 'goal' ? renderGoal() : null}
        {stage === 'outcomes' ? renderOutcomes() : null}
        {stage === 'planning' ? renderPlanning() : null}
        {stage === 'about' ? renderAbout() : null}
        {stage === 'recommendation' ? renderRecommendation() : null}
      </ScrollView>

      {footerVisible ? (
        <View style={styles.footer}>
          <>
            <Pressable
              onPress={() => setStageIndex((current) => Math.min(current + 1, STAGES.length - 1))}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{footerPrimaryLabel}</Text>
            </Pressable>

            {stage === 'location' ? (
              editMode ? (
                <Pressable onPress={() => runAction(() => onCancel?.())} disabled={busy}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => runAction(onSkip)} disabled={busy}>
                  <Text style={styles.secondaryText}>Skip for now</Text>
                </Pressable>
              )
            ) : (
              <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            )}
          </>
          {busy ? <ActivityIndicator color={colors.accentAlt} size="small" /> : null}
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
                <Text style={styles.sheetKicker}>Vallu</Text>
                <Text style={styles.sheetTitle}>Need help?</Text>
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
              selectionColor={colors.warning}
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

            <Pressable onPress={askVallu} style={[styles.primaryButton, !helperDraft.trim() && styles.buttonDisabled]}>
              <Text style={styles.primaryButtonText}>Ask Vallu</Text>
            </Pressable>

            {helperState === 'loading' ? (
              <View style={styles.helperStatusBlock}>
                <ActivityIndicator color={colors.warning} size="small" />
                <Text style={styles.helperStatusText}>Vallu is answering.</Text>
              </View>
            ) : null}

            {helperState === 'error' ? <Text style={styles.helperErrorText}>{helperError}</Text> : null}

            {helperState === 'ready' && helperAnswer ? (
              <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent} showsVerticalScrollIndicator={false}>
                <View style={styles.answerHeaderRow}>
                  <Text style={styles.answerSection}>Answer</Text>
                  <BadgePill label={helperSource === 'live' ? 'Live' : 'Preview'} accent="orange" />
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
  scrollView: {
    flex: 1,
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
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dotActive: {
    backgroundColor: colors.accentAlt,
  },
  stageBody: {
    gap: spacing.lg,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.accentAlt,
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
  selectionList: {
    gap: spacing.sm,
  },
  selectionCard: {
    minHeight: 98,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 26, 35, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  selectionCardActive: {
    borderColor: 'rgba(150, 216, 255, 0.28)',
    backgroundColor: colors.accentSoft,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
      elevation: 6,
  },
  selectionCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectionCardCopy: {
    flex: 1,
    gap: 4,
  },
  selectionCardTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  selectionCardTitleActive: {
    color: '#FFFFFF',
  },
  selectionCardBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  selectionCardMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectionCardMetaActive: {
    color: '#DDF4FF',
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
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(85, 138, 189, 0.28)',
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
    color: '#9ACCFF',
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
    borderColor: 'rgba(150, 216, 255, 0.16)',
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  previewGlyphBar: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: '#9ACCFF',
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
    borderColor: 'rgba(150, 216, 255, 0.18)',
    backgroundColor: 'rgba(85, 138, 189, 0.16)',
  },
  previewDayText: {
    color: '#E7F6FF',
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
    color: '#FFD4C3',
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
    color: '#FFB389',
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
    backgroundColor: 'rgba(240, 106, 57, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.26)',
  },
  helperStripButtonText: {
    color: '#FFF1E9',
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
    flex: 1,
  },
  recommendationTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  recommendationMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recommendationBody: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  whyFitBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.16)',
    backgroundColor: 'rgba(9, 13, 19, 0.22)',
  },
  whyFitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  whyFitDot: {
    width: 7,
    height: 7,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: '#96D8FF',
  },
  whyFitText: {
    flex: 1,
    color: '#DCEBFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  recommendationChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationSignalGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recommendationSignalCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.16)',
    backgroundColor: 'rgba(9, 13, 19, 0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  recommendationSignalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationSignalValue: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  recommendationSignalMeta: {
    color: '#D4E9F7',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
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
    borderColor: 'rgba(150, 216, 255, 0.18)',
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
  },
  recommendationDayText: {
    color: '#E7F6FF',
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
    backgroundColor: 'rgba(9, 13, 19, 0.20)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
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
    fontSize: 15,
    fontWeight: '800',
  },
  recommendationSessionBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  recommendationSupportText: {
    color: '#D4E9F7',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  recommendationNote: {
    color: '#FFD4C3',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  recommendationSecondary: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
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
    borderColor: 'rgba(240, 106, 57, 0.16)',
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
    color: '#FFF1E9',
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
    color: '#FFB389',
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
    borderColor: 'rgba(240, 106, 57, 0.18)',
    backgroundColor: 'rgba(18, 24, 33, 0.48)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  personalizationOptionActive: {
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(240, 106, 57, 0.14)',
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
    color: '#FFF4EE',
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
    color: '#F39AB2',
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
    paddingBottom: spacing.xl + spacing.xs,
    paddingTop: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.20)',
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
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
    borderColor: 'rgba(240, 106, 57, 0.24)',
    backgroundColor: 'rgba(20, 28, 39, 0.96)',
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
    color: '#FFB389',
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
    borderColor: 'rgba(240, 106, 57, 0.18)',
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
    borderColor: 'rgba(216, 106, 134, 0.22)',
    backgroundColor: 'rgba(216, 106, 134, 0.12)',
  },
  sheetSuggestionText: {
    color: '#FFF6F9',
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
    color: '#FFD4C3',
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
    color: '#FFD4C3',
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

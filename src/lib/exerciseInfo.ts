import { getComparableLogSets } from './exerciseLog';
import { convertWeightFromKg, formatRepRange, formatShortDate, formatWeight, removeTrailingZeros } from './format';
import { getBestComparableWorkingSet } from './workoutIntelligence';
import { WorkoutExerciseInstance, WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { ExerciseBodyPart, ExerciseCategory, ExerciseEquipment, ExerciseLibraryItem, UnitPreference } from '../types/models';

export type ExerciseInfoTheme = 'press' | 'pull' | 'legs' | 'hinge' | 'arms' | 'core' | 'flow' | 'run' | 'general';

export interface ExerciseInfoCue {
  label: string;
  text: string;
}

export interface ExerciseInfoTrendPoint {
  label: string;
  value: number;
}

export interface ExerciseInfoTrend {
  metricLabel: string;
  unitLabel: string;
  points: ExerciseInfoTrendPoint[];
  latestLabel: string;
  bestLabel: string;
  summaryLabel: string;
  empty: boolean;
}

export interface ExerciseInfoSnapshot {
  theme: ExerciseInfoTheme;
  movementLabel: string;
  thumbnailLabel: string;
  bodyPartLabel: string;
  equipmentLabel: string;
  targetLabel: string;
  targetMeta: string;
  restLabel: string;
  bestLabel: string;
  muscles: string[];
  joints: string[];
  cues: ExerciseInfoCue[];
  noteLabel: string | null;
  trend: ExerciseInfoTrend;
}

interface ExerciseInfoMeta {
  theme: ExerciseInfoTheme;
  movementLabel: string;
  thumbnailLabel: string;
  muscles: string[];
  joints: string[];
  cues: ExerciseInfoCue[];
}

interface ExerciseInfoSnapshotInput {
  exercise: WorkoutExerciseInstance;
  libraryItem?: ExerciseLibraryItem | null;
  previousEntries?: WorkoutSlotHistoryEntry[];
  unitPreference: UnitPreference;
  activeSetIndex: number;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function capitalizeLabel(value: string) {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEquipmentLabel(equipment?: ExerciseEquipment | null) {
  switch (equipment) {
    case 'barbell':
      return 'Barbell';
    case 'dumbbell':
      return 'Dumbbell';
    case 'machine':
      return 'Machine';
    case 'cable':
      return 'Cable';
    case 'bodyweight':
      return 'Bodyweight';
    default:
      return 'General';
  }
}

function formatBodyPartLabel(bodyPart?: ExerciseBodyPart | null) {
  if (!bodyPart) {
    return 'Full body';
  }

  if (bodyPart === 'full body') {
    return 'Full body';
  }

  return capitalizeLabel(bodyPart);
}

function formatRestRange(restSecondsMin: number, restSecondsMax: number) {
  if (restSecondsMin === restSecondsMax) {
    return `${restSecondsMin}s`;
  }

  return `${restSecondsMin}-${restSecondsMax}s`;
}

function formatTodayTarget(
  exercise: WorkoutExerciseInstance,
  unitPreference: UnitPreference,
  activeSetIndex: number,
) {
  const targetSet =
    exercise.sets[activeSetIndex] ??
    exercise.sets.find((set) => set.status === 'pending') ??
    exercise.sets[0] ??
    null;

  if (!targetSet) {
    return {
      label: 'Ready',
      meta: 'Add the next clean set',
    };
  }

  const repLabel = `${formatRepRange(targetSet.plannedRepsMin, targetSet.plannedRepsMax)} reps`;
  const loadLabel =
    typeof targetSet.plannedLoadKg === 'number' && targetSet.plannedLoadKg > 0
      ? `${formatWeight(targetSet.plannedLoadKg, unitPreference)} x ${formatRepRange(targetSet.plannedRepsMin, targetSet.plannedRepsMax)}`
      : repLabel;

  return {
    label: loadLabel,
    meta: `${exercise.sets.length} sets planned`,
  };
}

function formatBestLabel(
  exercise: WorkoutExerciseInstance,
  previousEntries: WorkoutSlotHistoryEntry[],
  unitPreference: UnitPreference,
) {
  const bestSet = getBestComparableWorkingSet(
    previousEntries[0]
      ? {
          weight: previousEntries[0].sets[0]?.loadKg ?? 0,
          repsPerSet: previousEntries[0].sets.map((set) => set.reps),
          sets: previousEntries[0].sets.map((set) => ({
            orderIndex: set.setIndex,
            weight: set.loadKg,
            reps: set.reps,
            kind: 'working' as const,
            outcome: 'completed' as const,
            status: 'completed' as const,
          })),
          skipped: previousEntries[0].skipped,
        }
      : null,
  );

  if (!bestSet) {
    return exercise.trackingMode === 'load_and_reps' ? 'No best yet' : 'No reps yet';
  }

  if (exercise.trackingMode === 'load_and_reps' && bestSet.weight > 0) {
    return `${formatWeight(bestSet.weight, unitPreference)} x ${bestSet.reps}`;
  }

  return `${bestSet.reps} reps`;
}

function formatTrendValue(value: number, unitLabel: string, unitPreference: UnitPreference) {
  if (unitLabel === 'reps') {
    return `${removeTrailingZeros(value)} reps`;
  }

  return `${removeTrailingZeros(convertWeightFromKg(value, unitPreference))} ${unitPreference}`;
}

function buildTrend(previousEntries: WorkoutSlotHistoryEntry[], exercise: WorkoutExerciseInstance, unitPreference: UnitPreference): ExerciseInfoTrend {
  const trendEntries = [...previousEntries]
    .reverse()
    .slice(-6)
    .map((entry) => {
      const comparableSets = getComparableLogSets({
        weight: entry.sets[0]?.loadKg ?? 0,
        repsPerSet: entry.sets.map((set) => set.reps),
        sets: entry.sets.map((set) => ({
          orderIndex: set.setIndex,
          weight: set.loadKg,
          reps: set.reps,
          kind: 'working' as const,
          outcome: 'completed' as const,
          status: 'completed' as const,
        })),
        skipped: entry.skipped,
      });

      if (comparableSets.length === 0) {
        return null;
      }

      const weightedSets = comparableSets.filter((set) => set.weight > 0);
      if (exercise.trackingMode === 'load_and_reps' && weightedSets.length > 0) {
        return {
          label: formatShortDate(entry.performedAt),
          value: weightedSets.reduce((best, set) => Math.max(best, set.weight), 0),
          unitLabel: unitPreference,
        };
      }

      return {
        label: formatShortDate(entry.performedAt),
        value: comparableSets.reduce((best, set) => Math.max(best, set.reps), 0),
        unitLabel: 'reps',
      };
    })
    .filter((entry): entry is { label: string; value: number; unitLabel: string } => Boolean(entry));

  if (trendEntries.length === 0) {
    return {
      metricLabel: exercise.trackingMode === 'load_and_reps' ? 'Top set' : 'Best reps',
      unitLabel: exercise.trackingMode === 'load_and_reps' ? unitPreference : 'reps',
      points: [],
      latestLabel: 'No logs yet',
      bestLabel: 'No best yet',
      summaryLabel: 'Log this lift to build a trend.',
      empty: true,
    };
  }

  const unitLabel = trendEntries[trendEntries.length - 1]?.unitLabel ?? unitPreference;
  const values = trendEntries.map((entry) => entry.value);
  const latestValue = values[values.length - 1] ?? 0;
  const firstValue = values[0] ?? latestValue;
  const bestValue = values.reduce((best, value) => Math.max(best, value), values[0] ?? 0);
  const delta = latestValue - firstValue;
  let summaryLabel = 'Holding steady.';

  if (trendEntries.length === 1) {
    summaryLabel = 'First logged result in this slot.';
  } else if (delta > 0.0001) {
    summaryLabel =
      unitLabel === 'reps'
        ? `Up ${removeTrailingZeros(delta)} reps from the first recent log.`
        : `Up ${removeTrailingZeros(convertWeightFromKg(delta, unitPreference))} ${unitPreference} from the first recent log.`;
  } else if (delta < -0.0001) {
    summaryLabel =
      unitLabel === 'reps'
        ? `Down ${removeTrailingZeros(Math.abs(delta))} reps from the first recent log.`
        : `Down ${removeTrailingZeros(convertWeightFromKg(Math.abs(delta), unitPreference))} ${unitPreference} from the first recent log.`;
  }

  return {
    metricLabel: unitLabel === 'reps' ? 'Best reps' : 'Top set',
    unitLabel,
    points: trendEntries.map((entry) => ({ label: entry.label, value: entry.value })),
    latestLabel: formatTrendValue(latestValue, unitLabel, unitPreference),
    bestLabel: formatTrendValue(bestValue, unitLabel, unitPreference),
    summaryLabel,
    empty: false,
  };
}

function getFallbackMeta(
  bodyPart?: ExerciseBodyPart | null,
  category?: ExerciseCategory | null,
  equipment?: ExerciseEquipment | null,
): ExerciseInfoMeta {
  if (bodyPart === 'legs' || bodyPart === 'glutes') {
    return {
      theme: equipment === 'bodyweight' ? 'flow' : bodyPart === 'glutes' ? 'hinge' : 'legs',
      movementLabel: bodyPart === 'glutes' ? 'Hip hinge' : 'Lower body',
      thumbnailLabel: bodyPart === 'glutes' ? 'Drive through hips' : 'Push through the floor',
      muscles: bodyPart === 'glutes' ? ['Glutes', 'Hamstrings', 'Core'] : ['Quads', 'Glutes', 'Hamstrings'],
      joints: ['Hips', 'Knees', 'Ankles'],
      cues: [
        { label: 'Set up', text: 'Brace before the first rep.' },
        { label: 'Drive', text: 'Stay stacked through the whole rep.' },
        { label: 'Finish', text: 'Stand tall without losing position.' },
      ],
    };
  }

  if (bodyPart === 'back') {
    return {
      theme: 'pull',
      movementLabel: 'Pull',
      thumbnailLabel: 'Pull to ribs',
      muscles: ['Lats', 'Upper back', 'Biceps'],
      joints: ['Shoulders', 'Elbows'],
      cues: [
        { label: 'Set up', text: 'Stay long through the chest.' },
        { label: 'Path', text: 'Pull elbows where the target muscles work.' },
        { label: 'Finish', text: 'Pause before you reset.' },
      ],
    };
  }

  if (bodyPart === 'shoulders') {
    return {
      theme: 'press',
      movementLabel: 'Vertical press',
      thumbnailLabel: 'Stack and press',
      muscles: ['Shoulders', 'Triceps', 'Upper chest'],
      joints: ['Shoulders', 'Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Brace ribs down before pressing.' },
        { label: 'Path', text: 'Press in a clean stacked line.' },
        { label: 'Finish', text: 'Lock in control overhead.' },
      ],
    };
  }

  if (bodyPart === 'biceps' || bodyPart === 'triceps') {
    return {
      theme: 'arms',
      movementLabel: 'Arm isolation',
      thumbnailLabel: 'Smooth arm work',
      muscles: bodyPart === 'biceps' ? ['Biceps', 'Forearms', 'Upper arm'] : ['Triceps', 'Shoulders', 'Upper arm'],
      joints: ['Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Hold the upper arm steady.' },
        { label: 'Path', text: 'Move only through the working joint.' },
        { label: 'Finish', text: 'Keep the last inch clean.' },
      ],
    };
  }

  if (bodyPart === 'core') {
    return {
      theme: category === 'cardio' ? 'run' : 'core',
      movementLabel: category === 'cardio' ? 'Conditioning' : 'Core control',
      thumbnailLabel: category === 'cardio' ? 'Move with rhythm' : 'Brace and move',
      muscles: category === 'cardio' ? ['Core', 'Legs', 'Lungs'] : ['Abs', 'Obliques', 'Hip flexors'],
      joints: category === 'cardio' ? ['Ankles', 'Knees', 'Hips'] : ['Spine', 'Hips'],
      cues: [
        { label: 'Set up', text: 'Exhale and brace before moving.' },
        { label: 'Path', text: 'Control the middle, not just the end.' },
        { label: 'Finish', text: 'Reset before the next clean rep.' },
      ],
    };
  }

  if (equipment === 'bodyweight') {
    return {
      theme: 'flow',
      movementLabel: 'Flow',
      thumbnailLabel: 'Move smooth',
      muscles: ['Full body', 'Core', 'Range'],
      joints: ['Shoulders', 'Hips', 'Spine'],
      cues: [
        { label: 'Set up', text: 'Own the first position first.' },
        { label: 'Path', text: 'Move smoothly through each rep.' },
        { label: 'Finish', text: 'Leave range for the next round.' },
      ],
    };
  }

  return {
    theme: 'general',
    movementLabel: 'General lift',
    thumbnailLabel: 'Move with control',
    muscles: ['Prime mover', 'Support muscles', 'Core'],
    joints: ['Shoulders', 'Hips', 'Knees'],
    cues: [
      { label: 'Set up', text: 'Build tension before the first rep.' },
      { label: 'Path', text: 'Keep the line clean through the middle.' },
      { label: 'Finish', text: 'Reset before rushing the next rep.' },
    ],
  };
}

function getSpecificMeta(normalizedName: string): ExerciseInfoMeta | null {
  if (normalizedName.includes('bench press') && normalizedName.includes('incline')) {
    return {
      theme: 'press',
      movementLabel: 'Incline press',
      thumbnailLabel: 'Press to upper chest',
      muscles: ['Upper chest', 'Shoulders', 'Triceps'],
      joints: ['Shoulders', 'Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Pin shoulder blades before the unrack.' },
        { label: 'Path', text: 'Lower toward the upper chest.' },
        { label: 'Finish', text: 'Drive up without shrugging.' },
      ],
    };
  }

  if (normalizedName === 'bench press' || normalizedName.includes('dumbbell bench press') || normalizedName.includes('machine chest press')) {
    return {
      theme: 'press',
      movementLabel: 'Horizontal press',
      thumbnailLabel: 'Press with leg drive',
      muscles: ['Chest', 'Triceps', 'Front delts'],
      joints: ['Shoulders', 'Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Lock shoulder blades and feet first.' },
        { label: 'Path', text: 'Touch the same line each rep.' },
        { label: 'Finish', text: 'Press back over the shoulders.' },
      ],
    };
  }

  if (normalizedName.includes('overhead press') || normalizedName.includes('shoulder press')) {
    return {
      theme: 'press',
      movementLabel: 'Vertical press',
      thumbnailLabel: 'Stack and press',
      muscles: ['Shoulders', 'Triceps', 'Upper chest'],
      joints: ['Shoulders', 'Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Brace ribs down before the press.' },
        { label: 'Path', text: 'Keep the bar close to your face.' },
        { label: 'Finish', text: 'Reach tall without leaning back.' },
      ],
    };
  }

  if (normalizedName.includes('row')) {
    return {
      theme: 'pull',
      movementLabel: 'Horizontal pull',
      thumbnailLabel: 'Pull to ribs',
      muscles: ['Upper back', 'Lats', 'Biceps'],
      joints: ['Shoulders', 'Elbows'],
      cues: [
        { label: 'Set up', text: 'Stay long through the chest.' },
        { label: 'Path', text: 'Lead with the elbow, not the hand.' },
        { label: 'Finish', text: 'Squeeze before the lower.' },
      ],
    };
  }

  if (normalizedName.includes('pulldown') || normalizedName.includes('pull-up')) {
    return {
      theme: 'pull',
      movementLabel: 'Vertical pull',
      thumbnailLabel: 'Pull elbows down',
      muscles: ['Lats', 'Upper back', 'Biceps'],
      joints: ['Shoulders', 'Elbows'],
      cues: [
        { label: 'Set up', text: 'Start with shoulders packed down.' },
        { label: 'Path', text: 'Drive elbows toward the ribs.' },
        { label: 'Finish', text: 'Control the reach back up.' },
      ],
    };
  }

  if (normalizedName.includes('squat') || normalizedName.includes('leg press')) {
    return {
      theme: 'legs',
      movementLabel: normalizedName.includes('leg press') ? 'Leg press' : 'Squat pattern',
      thumbnailLabel: 'Push through the floor',
      muscles: ['Quads', 'Glutes', 'Core'],
      joints: ['Hips', 'Knees', 'Ankles'],
      cues: [
        { label: 'Set up', text: 'Brace and root before you descend.' },
        { label: 'Path', text: 'Keep the mid-foot loaded.' },
        { label: 'Finish', text: 'Drive up through the same line.' },
      ],
    };
  }

  if (normalizedName.includes('deadlift') || normalizedName.includes('hip thrust')) {
    return {
      theme: 'hinge',
      movementLabel: normalizedName.includes('hip thrust') ? 'Hip drive' : 'Hinge pattern',
      thumbnailLabel: 'Hips back, drive through',
      muscles: ['Glutes', 'Hamstrings', 'Back'],
      joints: ['Hips', 'Knees'],
      cues: [
        { label: 'Set up', text: 'Brace before the hinge starts.' },
        { label: 'Path', text: 'Keep the bar close to the body.' },
        { label: 'Finish', text: 'Stand tall without overextending.' },
      ],
    };
  }

  if (normalizedName.includes('lunge') || normalizedName.includes('split squat')) {
    return {
      theme: 'legs',
      movementLabel: 'Single-leg work',
      thumbnailLabel: 'Stay balanced',
      muscles: ['Quads', 'Glutes', 'Adductors'],
      joints: ['Hips', 'Knees', 'Ankles'],
      cues: [
        { label: 'Set up', text: 'Find balance before the first rep.' },
        { label: 'Path', text: 'Drop straight down, not forward.' },
        { label: 'Finish', text: 'Push through the whole foot.' },
      ],
    };
  }

  if (normalizedName.includes('raise') || normalizedName.includes('curl') || normalizedName.includes('pushdown')) {
    return {
      theme: normalizedName.includes('lateral') || normalizedName.includes('rear delt') ? 'press' : 'arms',
      movementLabel: normalizedName.includes('lateral') || normalizedName.includes('rear delt') ? 'Shoulder isolation' : 'Arm isolation',
      thumbnailLabel: 'Smooth control',
      muscles: normalizedName.includes('lateral') || normalizedName.includes('rear delt')
        ? ['Shoulders', 'Upper back', 'Upper arm']
        : normalizedName.includes('pushdown')
          ? ['Triceps', 'Upper arm', 'Shoulders']
          : ['Biceps', 'Forearms', 'Upper arm'],
      joints: ['Elbows', 'Wrists'],
      cues: [
        { label: 'Set up', text: 'Lock the upper arm in place.' },
        { label: 'Path', text: 'Move only through the target joint.' },
        { label: 'Finish', text: 'Keep the last inch clean.' },
      ],
    };
  }

  if (normalizedName.includes('crunch') || normalizedName.includes('knee raise')) {
    return {
      theme: 'core',
      movementLabel: 'Core control',
      thumbnailLabel: 'Brace and move',
      muscles: ['Abs', 'Obliques', 'Hip flexors'],
      joints: ['Spine', 'Hips'],
      cues: [
        { label: 'Set up', text: 'Exhale before the first crunch.' },
        { label: 'Path', text: 'Move from the trunk, not momentum.' },
        { label: 'Finish', text: 'Reset the brace between reps.' },
      ],
    };
  }

  if (normalizedName.includes('mobility') || normalizedName.includes('stretch') || normalizedName.includes('yoga') || normalizedName.includes('breath')) {
    return {
      theme: 'flow',
      movementLabel: 'Recovery flow',
      thumbnailLabel: 'Move smooth',
      muscles: ['Range', 'Core', 'Recovery'],
      joints: ['Shoulders', 'Hips', 'Spine'],
      cues: [
        { label: 'Set up', text: 'Find the first position before moving.' },
        { label: 'Path', text: 'Stay smooth through the whole flow.' },
        { label: 'Finish', text: 'Breathe before the next rep.' },
      ],
    };
  }

  if (normalizedName.includes('run') || normalizedName.includes('stride')) {
    return {
      theme: 'run',
      movementLabel: 'Running block',
      thumbnailLabel: 'Fast, relaxed rhythm',
      muscles: ['Calves', 'Quads', 'Lungs'],
      joints: ['Ankles', 'Knees', 'Hips'],
      cues: [
        { label: 'Set up', text: 'Start relaxed and tall.' },
        { label: 'Path', text: 'Keep the stride quick, not forced.' },
        { label: 'Finish', text: 'Shut it down smoothly.' },
      ],
    };
  }

  return null;
}

export function getExerciseInfoMeta(exerciseName: string, libraryItem?: ExerciseLibraryItem | null): ExerciseInfoMeta {
  const normalized = normalizeName(exerciseName);
  return (
    getSpecificMeta(normalized) ??
    getFallbackMeta(libraryItem?.bodyPart ?? null, libraryItem?.category ?? null, libraryItem?.equipment ?? null)
  );
}

export function buildExerciseInfoSnapshot({
  exercise,
  libraryItem = null,
  previousEntries = [],
  unitPreference,
  activeSetIndex,
}: ExerciseInfoSnapshotInput): ExerciseInfoSnapshot {
  const meta = getExerciseInfoMeta(exercise.exerciseName, libraryItem);
  const target = formatTodayTarget(exercise, unitPreference, activeSetIndex);

  return {
    theme: meta.theme,
    movementLabel: meta.movementLabel,
    thumbnailLabel: meta.thumbnailLabel,
    bodyPartLabel: formatBodyPartLabel(libraryItem?.bodyPart ?? null),
    equipmentLabel: formatEquipmentLabel(libraryItem?.equipment ?? null),
    targetLabel: target.label,
    targetMeta: target.meta,
    restLabel: formatRestRange(exercise.restSecondsMin, exercise.restSecondsMax),
    bestLabel: formatBestLabel(exercise, previousEntries, unitPreference),
    muscles: meta.muscles,
    joints: meta.joints,
    cues: meta.cues,
    noteLabel: exercise.notes?.trim() ? exercise.notes.trim() : null,
    trend: buildTrend(previousEntries, exercise, unitPreference),
  };
}

import {
  AppPreferences,
  ExerciseBodyPart,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseLibraryItem,
  ExerciseTemplateDraft,
  WorkoutTemplateDraft,
  WorkoutTemplateSessionDraft,
} from '../types/models';
import { AICoachPlanSchema, AICoachPlannedExercise, AICoachPlannedSession } from '../types/aiCoachPlan';
import {
  WorkoutProgressionPriority,
  WorkoutRole,
  WorkoutRuntimeTemplate,
  WorkoutTemplateExercise,
  WorkoutTrackingMode,
} from '../features/workout/workoutTypes';

const AI_COACH_TEMPLATE_ID = 'ai_coach_template';

type PlannedExerciseVariant = 'warmup' | 'primary' | 'secondary' | 'accessory';

interface SlotBlueprint {
  key: string;
  variant: PlannedExerciseVariant;
  name?: string;
  search?: string[];
  bodyParts?: ExerciseBodyPart[];
  categories?: ExerciseCategory[];
}

interface SessionBlueprint {
  key: string;
  name: string;
  focus: string;
  slots: SlotBlueprint[];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAiGoalLabel(goal: ReturnType<typeof mapSetupGoalToAiGoal>) {
  switch (goal) {
    case 'fat_loss':
      return 'Fat Loss';
    case 'muscle':
      return 'Muscle';
    case 'strength':
      return 'Strength';
    default:
      return 'Fitness';
  }
}

function mapSetupGoalToAiGoal(preferences: AppPreferences) {
  if (preferences.aiPlannerGoal) {
    return preferences.aiPlannerGoal;
  }

  switch (preferences.setupGoal) {
    case 'strength':
      return 'strength';
    case 'muscle':
      return 'muscle';
    case 'run_mobility':
      return 'fitness';
    default:
      return 'fitness';
  }
}

function mapSetupDays(preferences: AppPreferences) {
  const rawDays = preferences.aiPlannerDaysPerWeek ?? preferences.setupDaysPerWeek ?? 3;
  if (rawDays <= 1) {
    return 1;
  }

  if (rawDays >= 4) {
    return 4;
  }

  return rawDays as 2 | 3;
}

function mapSetupExperience(preferences: AppPreferences) {
  if (preferences.aiPlannerExperience) {
    return preferences.aiPlannerExperience;
  }

  if (preferences.setupLevel === 'intermediate') {
    return 'intermediate';
  }

  return 'beginner';
}

function mapSetupEquipment(preferences: AppPreferences) {
  if (preferences.aiPlannerEquipment) {
    return preferences.aiPlannerEquipment;
  }

  switch (preferences.setupEquipment) {
    case 'gym':
      return 'full_gym';
    case 'home':
      return 'home_gym';
    case 'minimal':
      return 'minimal';
    default:
      return 'full_gym';
  }
}

function mapSetupSessionMinutes(preferences: AppPreferences, daysPerWeek: number) {
  if (preferences.aiPlannerSessionMinutes) {
    return preferences.aiPlannerSessionMinutes;
  }

  if (preferences.setupWeeklyMinutes && preferences.setupWeeklyMinutes > 0) {
    const inferred = Math.round(preferences.setupWeeklyMinutes / daysPerWeek / 5) * 5;
    return Math.max(30, Math.min(90, inferred));
  }

  return 60;
}

function mapSetupRecovery(preferences: AppPreferences) {
  return preferences.aiPlannerRecovery ?? 'moderate';
}

function resolveAllowedEquipment(equipment: AppPreferences['aiPlannerEquipment']) {
  const allowed = new Set<ExerciseEquipment>();
  switch (equipment) {
    case 'bodyweight':
      allowed.add('bodyweight');
      break;
    case 'minimal':
      allowed.add('dumbbell');
      allowed.add('bodyweight');
      break;
    case 'home_gym':
      allowed.add('barbell');
      allowed.add('dumbbell');
      allowed.add('bodyweight');
      break;
    case 'full_gym':
    default:
      allowed.add('barbell');
      allowed.add('dumbbell');
      allowed.add('machine');
      allowed.add('cable');
      allowed.add('bodyweight');
      break;
  }
  return allowed;
}

function buildSessionBlueprints(goal: ReturnType<typeof mapSetupGoalToAiGoal>, daysPerWeek: number): SessionBlueprint[] {
  const templates: Record<string, SessionBlueprint[]> = {
    1: [
      {
        key: 'full_body',
        name: 'AI Full Body',
        focus: 'Full-body strength and hypertrophy in one slot.',
        slots: [
          { key: 'warmup', variant: 'warmup', name: 'Warm-up flow' },
          { key: 'squat', variant: 'primary', search: ['back squat', 'goblet squat', 'leg press'], bodyParts: ['legs'] },
          { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'cable chest press'], bodyParts: ['chest'] },
          { key: 'row', variant: 'secondary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
          { key: 'hinge', variant: 'secondary', search: ['romanian deadlift', 'hip thrust', 'deadlift'], bodyParts: ['legs', 'glutes', 'back'] },
          { key: 'focus', variant: 'accessory', search: ['cable crunch', 'lateral raise', 'hammer curls'], bodyParts: ['core', 'shoulders', 'biceps'] },
        ],
      },
    ],
    2:
      goal === 'muscle'
        ? [
            {
              key: 'upper',
              name: 'Upper A',
              focus: 'Upper push and pull base.',
              slots: [
                { key: 'warmup_upper', variant: 'warmup', name: 'Upper-body warm-up' },
                { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'cable chest press'], bodyParts: ['chest'] },
                { key: 'row', variant: 'primary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
                { key: 'press', variant: 'secondary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
                { key: 'pull', variant: 'secondary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
                { key: 'arms', variant: 'accessory', search: ['triceps pushdown', 'hammer curls', 'alternate hammer curl'], bodyParts: ['triceps', 'biceps'] },
              ],
            },
            {
              key: 'lower',
              name: 'Lower A',
              focus: 'Lower-body compound work and support.',
              slots: [
                { key: 'warmup_lower', variant: 'warmup', name: 'Lower-body warm-up' },
                { key: 'squat', variant: 'primary', search: ['back squat', 'front squat', 'leg press'], bodyParts: ['legs'] },
                { key: 'hinge', variant: 'primary', search: ['romanian deadlift', 'deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
                { key: 'single_leg', variant: 'secondary', search: ['walking lunge', 'split squat', 'bulgarian split squat'], bodyParts: ['legs', 'glutes'] },
                { key: 'hamstrings', variant: 'accessory', search: ['lying leg curl', 'leg curl'], bodyParts: ['legs'] },
                { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
              ],
            },
          ]
        : [
            {
              key: 'full_body_a',
              name: 'Full Body A',
              focus: 'Squat, press, and row emphasis.',
              slots: [
                { key: 'warmup_lower', variant: 'warmup', name: 'Lower-body warm-up' },
                { key: 'squat', variant: 'primary', search: ['back squat', 'goblet squat', 'leg press'], bodyParts: ['legs'] },
                { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'push-up'], bodyParts: ['chest'] },
                { key: 'row', variant: 'secondary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
                { key: 'split_squat', variant: 'secondary', search: ['walking lunge', 'split squat', 'leg extension'], bodyParts: ['legs', 'glutes'] },
                { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
              ],
            },
            {
              key: 'full_body_b',
              name: 'Full Body B',
              focus: 'Hinge, vertical press, and pull emphasis.',
              slots: [
                { key: 'warmup_upper', variant: 'warmup', name: 'Upper-body warm-up' },
                { key: 'hinge', variant: 'primary', search: ['romanian deadlift', 'deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
                { key: 'press', variant: 'primary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
                { key: 'pull', variant: 'secondary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
                { key: 'chest', variant: 'secondary', search: ['incline dumbbell bench press', 'barbell incline bench press', 'cable chest press'], bodyParts: ['chest'] },
                { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
              ],
            },
          ],
    3:
      goal === 'muscle'
        ? [
            {
              key: 'push',
              name: 'Push',
              focus: 'Chest, shoulders, and triceps.',
              slots: [
                { key: 'warmup_upper', variant: 'warmup', name: 'Push warm-up' },
                { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'cable chest press'], bodyParts: ['chest'] },
                { key: 'press', variant: 'primary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
                { key: 'incline', variant: 'secondary', search: ['barbell incline bench press', 'incline dumbbell bench press'], bodyParts: ['chest'] },
                { key: 'fly', variant: 'accessory', search: ['cable crossover', 'cable chest press', 'pec deck'], bodyParts: ['chest'] },
                { key: 'laterals', variant: 'accessory', search: ['lateral raise', 'cable seated lateral raise'], bodyParts: ['shoulders'] },
                { key: 'triceps', variant: 'accessory', search: ['triceps pushdown', 'lying triceps press', 'close-grip barbell bench press'], bodyParts: ['triceps', 'chest'] },
              ],
            },
            {
              key: 'pull',
              name: 'Pull',
              focus: 'Lats, upper back, and biceps.',
              slots: [
                { key: 'warmup_upper', variant: 'warmup', name: 'Pull warm-up' },
                { key: 'pulldown', variant: 'primary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
                { key: 'row', variant: 'primary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
                { key: 'rear_delt', variant: 'secondary', search: ['rear lateral raise', 'rear delt row', 'face pull'], bodyParts: ['shoulders', 'back'] },
                { key: 'curl', variant: 'accessory', search: ['barbell curl', 'hammer curls', 'alternating dumbbell curl'], bodyParts: ['biceps'] },
                { key: 'back', variant: 'accessory', search: ['back extension', 'hyperextension'], bodyParts: ['back'] },
                { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
              ],
            },
            {
              key: 'legs',
              name: 'Legs',
              focus: 'Quads, hinge strength, and lower-body support.',
              slots: [
                { key: 'warmup_lower', variant: 'warmup', name: 'Legs warm-up' },
                { key: 'squat', variant: 'primary', search: ['back squat', 'front squat', 'leg press'], bodyParts: ['legs'] },
                { key: 'hinge', variant: 'primary', search: ['romanian deadlift', 'deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
                { key: 'single_leg', variant: 'secondary', search: ['walking lunge', 'split squat', 'bulgarian split squat'], bodyParts: ['legs', 'glutes'] },
                { key: 'hamstrings', variant: 'accessory', search: ['lying leg curl', 'leg curl'], bodyParts: ['legs'] },
                { key: 'calves', variant: 'accessory', search: ['calf press', 'standing calf raises', 'seated calf raise'], bodyParts: ['legs'] },
                { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
              ],
            },
          ]
        : goal === 'strength'
          ? [
              {
                key: 'strength_a',
                name: 'Strength A',
                focus: 'Heavy squat and bench base.',
                slots: [
                  { key: 'warmup_lower', variant: 'warmup', name: 'Strength warm-up' },
                  { key: 'squat', variant: 'primary', search: ['back squat', 'front squat', 'leg press'], bodyParts: ['legs'] },
                  { key: 'bench', variant: 'primary', search: ['barbell bench press', 'bench press - powerlifting', 'dumbbell bench press'], bodyParts: ['chest'] },
                  { key: 'row', variant: 'secondary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
                  { key: 'split_squat', variant: 'secondary', search: ['walking lunge', 'split squat'], bodyParts: ['legs', 'glutes'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
              {
                key: 'strength_b',
                name: 'Strength B',
                focus: 'Deadlift and vertical press base.',
                slots: [
                  { key: 'warmup_upper', variant: 'warmup', name: 'Strength warm-up' },
                  { key: 'hinge', variant: 'primary', search: ['deadlift', 'romanian deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
                  { key: 'press', variant: 'primary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
                  { key: 'pull', variant: 'secondary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
                  { key: 'single_leg', variant: 'secondary', search: ['walking lunge', 'split squat', 'leg press'], bodyParts: ['legs'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
              {
                key: 'strength_c',
                name: 'Strength C',
                focus: 'Front squat and incline press support.',
                slots: [
                  { key: 'warmup_lower', variant: 'warmup', name: 'Strength warm-up' },
                  { key: 'front_squat', variant: 'primary', search: ['front squat', 'back squat', 'goblet squat'], bodyParts: ['legs'] },
                  { key: 'incline', variant: 'primary', search: ['barbell incline bench press', 'incline dumbbell bench press'], bodyParts: ['chest'] },
                  { key: 'row', variant: 'secondary', search: ['seated cable row', 'bent over barbell row', 'dumbbell row'], bodyParts: ['back'] },
                  { key: 'hinge', variant: 'secondary', search: ['hip thrust', 'romanian deadlift', 'leg curl'], bodyParts: ['glutes', 'legs', 'back'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
            ]
          : [
              {
                key: 'full_body_a',
                name: 'Full Body A',
                focus: 'Squat, press, and row.',
                slots: [
                  { key: 'warmup_lower', variant: 'warmup', name: 'Warm-up flow' },
                  { key: 'squat', variant: 'primary', search: ['back squat', 'goblet squat', 'leg press'], bodyParts: ['legs'] },
                  { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'push-up'], bodyParts: ['chest'] },
                  { key: 'row', variant: 'secondary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
                  { key: 'laterals', variant: 'accessory', search: ['lateral raise', 'cable seated lateral raise'], bodyParts: ['shoulders'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
              {
                key: 'full_body_b',
                name: 'Full Body B',
                focus: 'Hinge, vertical press, and pull.',
                slots: [
                  { key: 'warmup_upper', variant: 'warmup', name: 'Warm-up flow' },
                  { key: 'hinge', variant: 'primary', search: ['romanian deadlift', 'deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
                  { key: 'press', variant: 'primary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
                  { key: 'pull', variant: 'secondary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
                  { key: 'legs', variant: 'secondary', search: ['walking lunge', 'split squat', 'leg press'], bodyParts: ['legs'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
              {
                key: 'full_body_c',
                name: 'Full Body C',
                focus: 'Lower-body support and chest/back top-up.',
                slots: [
                  { key: 'warmup_lower', variant: 'warmup', name: 'Warm-up flow' },
                  { key: 'front_squat', variant: 'primary', search: ['front squat', 'back squat', 'goblet squat'], bodyParts: ['legs'] },
                  { key: 'incline', variant: 'secondary', search: ['barbell incline bench press', 'incline dumbbell bench press'], bodyParts: ['chest'] },
                  { key: 'row', variant: 'secondary', search: ['seated cable row', 'bent over barbell row', 'dumbbell row'], bodyParts: ['back'] },
                  { key: 'glutes', variant: 'accessory', search: ['hip thrust', 'glute bridge'], bodyParts: ['glutes', 'legs'] },
                  { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
                ],
              },
            ],
    4: [
      {
        key: 'upper_a',
        name: 'Upper A',
        focus: 'Heavy upper press and row.',
        slots: [
          { key: 'warmup_upper', variant: 'warmup', name: 'Upper-body warm-up' },
          { key: 'bench', variant: 'primary', search: ['barbell bench press', 'dumbbell bench press', 'cable chest press'], bodyParts: ['chest'] },
          { key: 'row', variant: 'primary', search: ['bent over barbell row', 'seated cable row', 'dumbbell row'], bodyParts: ['back'] },
          { key: 'press', variant: 'secondary', search: ['barbell shoulder press', 'dumbbell shoulder press', 'arnold press'], bodyParts: ['shoulders'] },
          { key: 'pull', variant: 'secondary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
          { key: 'arms', variant: 'accessory', search: ['triceps pushdown', 'hammer curls', 'barbell curl'], bodyParts: ['triceps', 'biceps'] },
        ],
      },
      {
        key: 'lower_a',
        name: 'Lower A',
        focus: 'Squat-led lower day.',
        slots: [
          { key: 'warmup_lower', variant: 'warmup', name: 'Lower-body warm-up' },
          { key: 'squat', variant: 'primary', search: ['back squat', 'front squat', 'leg press'], bodyParts: ['legs'] },
          { key: 'hinge', variant: 'primary', search: ['romanian deadlift', 'deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
          { key: 'single_leg', variant: 'secondary', search: ['walking lunge', 'split squat', 'bulgarian split squat'], bodyParts: ['legs', 'glutes'] },
          { key: 'hamstrings', variant: 'accessory', search: ['lying leg curl', 'leg curl'], bodyParts: ['legs'] },
          { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
        ],
      },
      {
        key: 'upper_b',
        name: 'Upper B',
        focus: 'Upper volume and shoulder support.',
        slots: [
          { key: 'warmup_upper', variant: 'warmup', name: 'Upper-body warm-up' },
          { key: 'incline', variant: 'primary', search: ['barbell incline bench press', 'incline dumbbell bench press'], bodyParts: ['chest'] },
          { key: 'pull', variant: 'primary', search: ['lat pulldown', 'pull-up', 'chin-up'], bodyParts: ['back'] },
          { key: 'row', variant: 'secondary', search: ['seated cable row', 'dumbbell row', 'bent over barbell row'], bodyParts: ['back'] },
          { key: 'laterals', variant: 'accessory', search: ['lateral raise', 'cable seated lateral raise'], bodyParts: ['shoulders'] },
          { key: 'arms', variant: 'accessory', search: ['barbell curl', 'hammer curls', 'triceps pushdown'], bodyParts: ['biceps', 'triceps'] },
        ],
      },
      {
        key: 'lower_b',
        name: 'Lower B',
        focus: 'Hinge and lower-body support.',
        slots: [
          { key: 'warmup_lower', variant: 'warmup', name: 'Lower-body warm-up' },
          { key: 'hinge', variant: 'primary', search: ['deadlift', 'romanian deadlift', 'hip thrust'], bodyParts: ['legs', 'glutes', 'back'] },
          { key: 'quad', variant: 'primary', search: ['leg press', 'hack squat', 'back squat'], bodyParts: ['legs'] },
          { key: 'single_leg', variant: 'secondary', search: ['walking lunge', 'split squat'], bodyParts: ['legs', 'glutes'] },
          { key: 'glutes', variant: 'accessory', search: ['hip thrust', 'glute bridge'], bodyParts: ['glutes', 'legs'] },
          { key: 'core', variant: 'accessory', search: ['cable crunch', 'ab crunch machine', 'crunch'], bodyParts: ['core'] },
        ],
      },
    ],
  };

  return templates[String(daysPerWeek)] ?? templates[3];
}

function getWarmupExercise(sessionName: string): AICoachPlannedExercise {
  const lower = sessionName.toLowerCase().includes('lower') || sessionName.toLowerCase().includes('leg') || sessionName.toLowerCase().includes('strength');
  return {
    key: `${slugify(sessionName)}_warmup`,
    name: lower ? 'Dynamic lower-body warm-up' : 'Dynamic upper-body warm-up',
    sets: 1,
    repsMin: 8,
    repsMax: 10,
    restSeconds: 30,
    tracked: false,
    libraryItemId: null,
  };
}

function getPrescribedSets(variant: PlannedExerciseVariant, goal: ReturnType<typeof mapSetupGoalToAiGoal>, recovery: ReturnType<typeof mapSetupRecovery>, experience: ReturnType<typeof mapSetupExperience>) {
  if (variant === 'warmup') {
    return 1;
  }

  const base =
    variant === 'primary'
      ? goal === 'strength'
        ? 4
        : 3
      : variant === 'secondary'
        ? 3
        : 2;

  const recoveryDelta = recovery === 'low' ? -1 : recovery === 'high' && variant !== 'accessory' ? 1 : 0;
  const experienceDelta = experience === 'advanced' && variant === 'primary' ? 1 : 0;
  return Math.max(1, base + recoveryDelta + experienceDelta);
}

function getRepRange(variant: PlannedExerciseVariant, goal: ReturnType<typeof mapSetupGoalToAiGoal>) {
  if (variant === 'warmup') {
    return { repsMin: 8, repsMax: 10 };
  }

  if (variant === 'primary') {
    if (goal === 'strength') {
      return { repsMin: 4, repsMax: 6 };
    }

    return { repsMin: 6, repsMax: 8 };
  }

  if (variant === 'secondary') {
    return goal === 'strength' ? { repsMin: 6, repsMax: 8 } : { repsMin: 8, repsMax: 10 };
  }

  return goal === 'muscle' ? { repsMin: 10, repsMax: 15 } : { repsMin: 8, repsMax: 12 };
}

function getRestSeconds(variant: PlannedExerciseVariant, goal: ReturnType<typeof mapSetupGoalToAiGoal>) {
  if (variant === 'warmup') {
    return 30;
  }

  if (variant === 'primary') {
    return goal === 'strength' ? 180 : 120;
  }

  if (variant === 'secondary') {
    return goal === 'strength' ? 120 : 90;
  }

  return 60;
}

function getFocusBodyPart(preferences: AppPreferences): ExerciseBodyPart | null {
  const focus = preferences.setupFocusAreas[0];
  switch (focus) {
    case 'glutes':
      return 'glutes';
    case 'legs':
      return 'legs';
    case 'chest':
      return 'chest';
    case 'shoulders':
      return 'shoulders';
    case 'back':
      return 'back';
    case 'arms':
      return 'biceps';
    case 'core':
      return 'core';
    default:
      return null;
  }
}

function findLibraryItemForQuery(
  items: ExerciseLibraryItem[],
  query: string,
  allowedEquipment: Set<ExerciseEquipment>,
  avoidTerms: string[],
) {
  const normalizedQuery = normalize(query);
  return items.find((item) => {
    if (!allowedEquipment.has(item.equipment)) {
      return false;
    }

    const normalizedName = normalize(item.name);
    if (avoidTerms.some((term) => normalizedName.includes(term))) {
      return false;
    }

    return normalizedName.includes(normalizedQuery);
  });
}

function chooseLibraryExercise(args: {
  items: ExerciseLibraryItem[];
  slot: SlotBlueprint;
  allowedEquipment: Set<ExerciseEquipment>;
  avoidTerms: string[];
  usedIds: Set<string>;
  mustIncludeTerms: string[];
  usedMustIncludeTerms: Set<string>;
}) {
  const { items, slot, allowedEquipment, avoidTerms, usedIds, mustIncludeTerms, usedMustIncludeTerms } = args;
  const prioritizedMustTerms = mustIncludeTerms.filter((term) => {
    if (usedMustIncludeTerms.has(term)) {
      return false;
    }

    const match = findLibraryItemForQuery(items, term, allowedEquipment, avoidTerms);
    if (!match) {
      return false;
    }

    if (slot.bodyParts?.length && !slot.bodyParts.includes(match.bodyPart)) {
      return false;
    }

    return !(slot.categories?.length && !slot.categories.includes(match.category));
  });

  const candidates = [...prioritizedMustTerms, ...(slot.search ?? [])];

  for (const query of candidates) {
    const normalizedQuery = normalize(query);
    const match = items.find((item) => {
      if (usedIds.has(item.id) || !allowedEquipment.has(item.equipment)) {
        return false;
      }

      const normalizedName = normalize(item.name);
      if (avoidTerms.some((term) => normalizedName.includes(term))) {
        return false;
      }

      if (!normalizedName.includes(normalizedQuery)) {
        return false;
      }

      if (slot.bodyParts?.length && !slot.bodyParts.includes(item.bodyPart)) {
        return false;
      }

      if (slot.categories?.length && !slot.categories.includes(item.category)) {
        return false;
      }

      return true;
    });

    if (match) {
      const matchedMustTerm = prioritizedMustTerms.find((term) => normalize(term) === normalizedQuery);
      if (matchedMustTerm) {
        usedMustIncludeTerms.add(matchedMustTerm);
      }
      usedIds.add(match.id);
      return match;
    }
  }

  const fallback = items.find((item) => {
    if (usedIds.has(item.id) || !allowedEquipment.has(item.equipment)) {
      return false;
    }

    const normalizedName = normalize(item.name);
    if (avoidTerms.some((term) => normalizedName.includes(term))) {
      return false;
    }

    if (slot.bodyParts?.length && !slot.bodyParts.includes(item.bodyPart)) {
      return false;
    }

    return !(slot.categories?.length && !slot.categories.includes(item.category));
  });

  if (fallback) {
    usedIds.add(fallback.id);
  }

  return fallback ?? null;
}

function buildPlannedExercise(
  item: ExerciseLibraryItem | null,
  slot: SlotBlueprint,
  goal: ReturnType<typeof mapSetupGoalToAiGoal>,
  recovery: ReturnType<typeof mapSetupRecovery>,
  experience: ReturnType<typeof mapSetupExperience>,
): AICoachPlannedExercise {
  const sets = getPrescribedSets(slot.variant, goal, recovery, experience);
  const repRange = getRepRange(slot.variant, goal);
  return {
    key: slot.key,
    name: item?.name ?? slot.name ?? 'Custom exercise',
    sets,
    repsMin: repRange.repsMin,
    repsMax: repRange.repsMax,
    restSeconds: getRestSeconds(slot.variant, goal),
    tracked: slot.variant !== 'warmup' && slot.variant !== 'accessory',
    libraryItemId: item?.id ?? null,
  };
}

function appendUnplacedMustIncludes(args: {
  sessions: AICoachPlannedSession[];
  items: ExerciseLibraryItem[];
  mustIncludeTerms: string[];
  usedMustIncludeTerms: Set<string>;
  allowedEquipment: Set<ExerciseEquipment>;
  avoidTerms: string[];
  usedIds: Set<string>;
  goal: ReturnType<typeof mapSetupGoalToAiGoal>;
  recovery: ReturnType<typeof mapSetupRecovery>;
  experience: ReturnType<typeof mapSetupExperience>;
  sessionMinutes: number;
}) {
  const {
    sessions,
    items,
    mustIncludeTerms,
    usedMustIncludeTerms,
    allowedEquipment,
    avoidTerms,
    usedIds,
    goal,
    recovery,
    experience,
    sessionMinutes,
  } = args;
  const maxExercises = sessionMinutes <= 45 ? 5 : sessionMinutes >= 75 ? 7 : 6;

  for (const term of mustIncludeTerms) {
    if (usedMustIncludeTerms.has(term)) {
      continue;
    }

    const item = findLibraryItemForQuery(items, term, allowedEquipment, avoidTerms);
    if (!item || usedIds.has(item.id)) {
      continue;
    }

    const preferredSession =
      sessions.find((session) =>
        session.name.toLowerCase().includes('upper') &&
        (item.bodyPart === 'chest' || item.bodyPart === 'back' || item.bodyPart === 'shoulders' || item.bodyPart === 'biceps' || item.bodyPart === 'triceps'),
      ) ??
      sessions.find((session) =>
        session.name.toLowerCase().includes('lower') &&
        (item.bodyPart === 'legs' || item.bodyPart === 'glutes'),
      ) ??
      sessions.find((session) => session.name.toLowerCase().includes('push') && (item.bodyPart === 'chest' || item.bodyPart === 'shoulders' || item.bodyPart === 'triceps')) ??
      sessions.find((session) => session.name.toLowerCase().includes('pull') && (item.bodyPart === 'back' || item.bodyPart === 'biceps')) ??
      sessions.find((session) => session.name.toLowerCase().includes('leg') && (item.bodyPart === 'legs' || item.bodyPart === 'glutes')) ??
      sessions[0];

    if (!preferredSession) {
      continue;
    }

    const extra = buildPlannedExercise(
      item,
      { key: `must_${slugify(term)}`, variant: 'accessory' },
      goal,
      recovery,
      experience,
    );

    if (preferredSession.exercises.length >= maxExercises) {
      preferredSession.exercises[preferredSession.exercises.length - 1] = extra;
    } else {
      preferredSession.exercises.push(extra);
    }

    usedIds.add(item.id);
    usedMustIncludeTerms.add(term);
  }
}

export function buildAiCoachSetupHash(preferences: AppPreferences) {
  return JSON.stringify({
    setupGoal: preferences.setupGoal,
    setupGoals: [...preferences.setupGoals].sort(),
    setupLevel: preferences.setupLevel,
    setupEquipment: preferences.setupEquipment,
    setupFocusAreas: [...preferences.setupFocusAreas].sort(),
    setupDaysPerWeek: preferences.setupDaysPerWeek,
    setupTrainingFeel: preferences.setupTrainingFeel,
    setupWorkoutVariety: preferences.setupWorkoutVariety,
    setupFreeWeightsPreference: preferences.setupFreeWeightsPreference,
    setupBodyweightPreference: preferences.setupBodyweightPreference,
    setupMachinesPreference: preferences.setupMachinesPreference,
    setupShoulderFriendlySwaps: preferences.setupShoulderFriendlySwaps,
    setupElbowFriendlySwaps: preferences.setupElbowFriendlySwaps,
    setupKneeFriendlySwaps: preferences.setupKneeFriendlySwaps,
    bodyweightGoalKg: preferences.bodyweightGoalKg,
    aiPlannerGoal: preferences.aiPlannerGoal,
    aiPlannerDaysPerWeek: preferences.aiPlannerDaysPerWeek,
    aiPlannerExperience: preferences.aiPlannerExperience,
    aiPlannerSessionMinutes: preferences.aiPlannerSessionMinutes,
    aiPlannerEquipment: preferences.aiPlannerEquipment,
    aiPlannerRecovery: preferences.aiPlannerRecovery,
    aiPlannerMustInclude: normalize(preferences.aiPlannerMustInclude),
    aiPlannerAvoid: normalize(preferences.aiPlannerAvoid),
    aiPlannerLimitations: normalize(preferences.aiPlannerLimitations),
  });
}

export function buildAiCoachPlanSchema(preferences: AppPreferences, exerciseLibrary: ExerciseLibraryItem[]): AICoachPlanSchema {
  const goal = mapSetupGoalToAiGoal(preferences);
  const daysPerWeek = mapSetupDays(preferences);
  const experience = mapSetupExperience(preferences);
  const equipment = mapSetupEquipment(preferences);
  const recovery = mapSetupRecovery(preferences);
  const sessionMinutes = mapSetupSessionMinutes(preferences, daysPerWeek);
  const allowedEquipment = resolveAllowedEquipment(equipment);
  const importedLibrary = exerciseLibrary.filter((item) => !item.id.startsWith('lib_'));
  const avoidTerms = splitList(preferences.aiPlannerAvoid).map(normalize);
  const mustIncludeTerms = uniqueStrings(splitList(preferences.aiPlannerMustInclude));
  const usedMustIncludeTerms = new Set<string>();
  const usedIds = new Set<string>();
  const focusBodyPart = getFocusBodyPart(preferences);
  const blueprints = buildSessionBlueprints(goal, daysPerWeek);
  const maxExercises = sessionMinutes <= 45 ? 5 : sessionMinutes >= 75 ? 7 : 6;

  const sessions: AICoachPlannedSession[] = blueprints.map((blueprint, sessionIndex) => {
    const exercises = blueprint.slots
      .map((slot) => {
        if (slot.variant === 'warmup') {
          return getWarmupExercise(blueprint.name);
        }

        const nextSlot = slot.key === 'focus' && focusBodyPart
          ? {
              ...slot,
              bodyParts: [focusBodyPart],
              search:
                focusBodyPart === 'chest'
                  ? ['barbell incline bench press', 'incline dumbbell bench press', 'cable crossover']
                  : focusBodyPart === 'back'
                    ? ['lat pulldown', 'seated cable row', 'dumbbell row']
                    : focusBodyPart === 'shoulders'
                      ? ['lateral raise', 'barbell shoulder press', 'cable shoulder press']
                      : focusBodyPart === 'legs'
                        ? ['leg press', 'walking lunge', 'split squat']
                        : focusBodyPart === 'glutes'
                          ? ['hip thrust', 'glute bridge', 'walking lunge']
                          : focusBodyPart === 'biceps'
                            ? ['barbell curl', 'hammer curls', 'alternating dumbbell curl']
                            : focusBodyPart === 'core'
                              ? ['cable crunch', 'ab crunch machine', 'crunch']
                              : slot.search,
            }
          : slot;

        const item = chooseLibraryExercise({
          items: importedLibrary,
          slot: nextSlot,
          allowedEquipment,
          avoidTerms,
          usedIds,
          mustIncludeTerms,
          usedMustIncludeTerms,
        });
        return buildPlannedExercise(item, nextSlot, goal, recovery, experience);
      })
      .slice(0, maxExercises);

    return {
      key: blueprint.key,
      name: blueprint.name,
      orderIndex: sessionIndex,
      focus: blueprint.focus,
      exercises,
    };
  });

  appendUnplacedMustIncludes({
    sessions,
    items: importedLibrary,
    mustIncludeTerms,
    usedMustIncludeTerms,
    allowedEquipment,
    avoidTerms,
    usedIds,
    goal,
    recovery,
    experience,
    sessionMinutes,
  });

  return {
    title: `AI Coach - ${daysPerWeek} Day ${formatAiGoalLabel(goal)}`,
    summary: `${daysPerWeek} sessions built around ${goal.replace('_', ' ')} with ${sessionMinutes}-minute sessions.`,
    goal,
    daysPerWeek,
    experience,
    equipment,
    recovery,
    sessionMinutes,
    sessions,
  };
}

export function buildAiCoachWorkoutDraft(preferences: AppPreferences, exerciseLibrary: ExerciseLibraryItem[]): WorkoutTemplateDraft {
  const plan = buildAiCoachPlanSchema(preferences, exerciseLibrary);
  const templateId = preferences.aiCoachTemplateId ?? AI_COACH_TEMPLATE_ID;

  return {
    id: templateId,
    name: plan.title,
    sessions: plan.sessions.map((session) => ({
      id: `${templateId}_${slugify(session.key)}`,
      name: session.name,
      exercises: session.exercises.map((exercise) => ({
        id: `${templateId}_${slugify(session.key)}_${slugify(exercise.key)}`,
        name: exercise.name,
        targetSets: exercise.sets,
        repMin: exercise.repsMin,
        repMax: exercise.repsMax,
        restSeconds: exercise.restSeconds,
        trackedDefault: exercise.tracked,
        libraryItemId: exercise.libraryItemId,
      })),
    })),
  };
}

function getTrackingMode(libraryItem: ExerciseLibraryItem | null, exercise: ExerciseTemplateDraft): WorkoutTrackingMode {
  if (libraryItem?.equipment === 'bodyweight') {
    return 'bodyweight';
  }

  if (libraryItem?.category === 'core' || libraryItem?.category === 'cardio') {
    return 'reps_first';
  }

  return 'load_and_reps';
}

function getRole(index: number, libraryItem: ExerciseLibraryItem | null): WorkoutRole {
  if (index === 0) {
    return 'primary';
  }

  if (index <= 2 || libraryItem?.category === 'compound') {
    return 'secondary';
  }

  return 'accessory';
}

function getPriority(role: WorkoutRole): WorkoutProgressionPriority {
  if (role === 'primary') {
    return 'high';
  }

  if (role === 'secondary') {
    return 'medium';
  }

  return 'low';
}

function buildRuntimeExercise(
  templateId: string,
  sessionId: string,
  exercise: ExerciseTemplateDraft,
  index: number,
  exerciseLibrary: ExerciseLibraryItem[],
  defaultRestSeconds: number,
): WorkoutTemplateExercise {
  const libraryItem =
    (exercise.libraryItemId ? exerciseLibrary.find((item) => item.id === exercise.libraryItemId) ?? null : null) ??
    exerciseLibrary.find((item) => normalize(item.name) === normalize(exercise.name)) ??
    null;
  const role = getRole(index, libraryItem);

  return {
    id: exercise.id ?? `${templateId}_${sessionId}_${index + 1}`,
    persistedExerciseTemplateId: exercise.id ?? null,
    exerciseName: exercise.name,
    slotId: `${templateId}_${sessionId}_slot_${index + 1}`,
    role,
    progressionPriority: getPriority(role),
    trackingMode: getTrackingMode(libraryItem, exercise),
    sets: Math.max(1, exercise.targetSets),
    repsMin: Math.max(1, exercise.repMin),
    repsMax: Math.max(exercise.repMin, exercise.repMax),
    restSecondsMin: exercise.restSeconds && exercise.restSeconds > 0 ? exercise.restSeconds : defaultRestSeconds,
    restSecondsMax: exercise.restSeconds && exercise.restSeconds > 0 ? exercise.restSeconds : defaultRestSeconds,
    substitutionGroup: `${templateId}_${sessionId}_${slugify(exercise.name)}`,
  };
}

export function buildAiCoachRuntimeTemplate(
  draft: WorkoutTemplateDraft,
  exerciseLibrary: ExerciseLibraryItem[],
  defaultRestSeconds: number,
): WorkoutRuntimeTemplate {
  return {
    id: draft.id ?? AI_COACH_TEMPLATE_ID,
    name: draft.name,
    defaultScheduleMode: 'rolling_sequence',
    sessions: draft.sessions.map((session, sessionIndex) => {
      const sessionId = session.id ?? `${draft.id ?? AI_COACH_TEMPLATE_ID}_session_${sessionIndex + 1}`;
      return {
        id: sessionId,
        name: session.name,
        orderIndex: sessionIndex,
        exercises: session.exercises.map((exercise, exerciseIndex) =>
          buildRuntimeExercise(draft.id ?? AI_COACH_TEMPLATE_ID, sessionId, exercise, exerciseIndex, exerciseLibrary, defaultRestSeconds),
        ),
      };
    }),
  };
}

export function getAiCoachNextSessionId(
  templateId: string,
  runtimeTemplate: WorkoutRuntimeTemplate,
  completedTemplateSessionCount: number,
) {
  if (runtimeTemplate.sessions.length === 0) {
    throw new Error(`AI Coach template ${templateId} has no sessions.`);
  }

  const nextIndex = completedTemplateSessionCount % runtimeTemplate.sessions.length;
  return runtimeTemplate.sessions[nextIndex]?.id ?? runtimeTemplate.sessions[0].id;
}

export function getAiCoachTemplateId(preferences: AppPreferences) {
  return preferences.aiCoachTemplateId ?? AI_COACH_TEMPLATE_ID;
}

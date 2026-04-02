import { adaptLegacyWorkoutTemplateToRuntimeTemplate } from '../features/workout/customWorkoutAdapter';
import { WorkoutRuntimeTemplate, WorkoutTemplateSession, WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { ExerciseLibraryItem, ExerciseTemplate, WorkoutTemplate } from '../types/models';
import { pluralize } from './format';
import { buildWorkoutTemplateSessions } from './workoutTemplateSessions';

export interface HomeQuickLaunchSessionData {
  launchKey: string;
  label: string;
  meta: string;
}

export interface HomeQuickLaunchWorkoutData {
  workoutId: string;
  title: string;
  subtitle: string;
  sessions: HomeQuickLaunchSessionData[];
}

export interface HomeQuickLaunchBuildResult {
  workouts: HomeQuickLaunchWorkoutData[];
  runtimeTemplatesByLaunchKey: Record<string, WorkoutRuntimeTemplate>;
}

interface BuildHomeQuickLaunchOptions {
  selectedCoreTemplate: WorkoutTemplateV1 | null;
  customTemplates: WorkoutTemplate[];
  getWorkoutExercises: (workoutTemplateId: string) => ExerciseTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  maxCustomWorkouts?: number;
}

function buildCoreSessionRuntimeTemplate(
  template: WorkoutTemplateV1,
  templateSession: WorkoutTemplateSession,
): WorkoutRuntimeTemplate {
  return {
    id: template.id,
    name: `${template.name} - ${templateSession.name}`,
    defaultScheduleMode: template.defaultScheduleMode,
    sessions: [
      {
        ...templateSession,
        exercises: templateSession.exercises.map((exercise) => ({ ...exercise })),
      },
    ],
  };
}

export function buildHomeQuickLaunchWorkouts({
  selectedCoreTemplate,
  customTemplates,
  getWorkoutExercises,
  exerciseLibrary,
  defaultRestSeconds,
  maxCustomWorkouts = 2,
}: BuildHomeQuickLaunchOptions): HomeQuickLaunchBuildResult {
  const runtimeTemplatesByLaunchKey: Record<string, WorkoutRuntimeTemplate> = {};
  const workouts: HomeQuickLaunchWorkoutData[] = [];

  if (selectedCoreTemplate) {
    const sessions = [...selectedCoreTemplate.sessions]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((session) => {
        const launchKey = `${selectedCoreTemplate.id}:${session.id}`;
        runtimeTemplatesByLaunchKey[launchKey] = buildCoreSessionRuntimeTemplate(selectedCoreTemplate, session);

        return {
          launchKey,
          label: session.name,
          meta: pluralize(session.exercises.length, 'exercise'),
        };
      });

    workouts.push({
      workoutId: selectedCoreTemplate.id,
      title: selectedCoreTemplate.name,
      subtitle: `${pluralize(sessions.length, 'session')} ready`,
      sessions,
    });
  }

  const customLaunchWorkouts = [...customTemplates]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, maxCustomWorkouts)
    .map((template) => {
      const sessions = buildWorkoutTemplateSessions(template, getWorkoutExercises(template.id));
      const runtimeTemplate = adaptLegacyWorkoutTemplateToRuntimeTemplate(
        template,
        sessions,
        exerciseLibrary,
        defaultRestSeconds,
      );
      const launchKey = `${template.id}:custom`;
      runtimeTemplatesByLaunchKey[launchKey] = runtimeTemplate;

      return {
        workoutId: template.id,
        title: template.name,
        subtitle: 'Custom workout',
        sessions: [
          {
            launchKey,
            label: 'Start',
            meta: pluralize(sessions.reduce((sum, session) => sum + session.exercises.length, 0), 'exercise'),
          },
        ],
      } satisfies HomeQuickLaunchWorkoutData;
    });

  workouts.push(...customLaunchWorkouts);

  return {
    workouts,
    runtimeTemplatesByLaunchKey,
  };
}

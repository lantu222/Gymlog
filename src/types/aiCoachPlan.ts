import { AiPlannerDaysPerWeek, AiPlannerEquipment, AiPlannerExperience, AiPlannerGoal, AiPlannerRecovery } from './models';

export interface AICoachPlannedExercise {
  key: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  tracked: boolean;
  libraryItemId: string | null;
}

export interface AICoachPlannedSession {
  key: string;
  name: string;
  orderIndex: number;
  focus: string;
  exercises: AICoachPlannedExercise[];
}

export interface AICoachPlanSchema {
  title: string;
  summary: string;
  goal: AiPlannerGoal;
  daysPerWeek: AiPlannerDaysPerWeek;
  experience: AiPlannerExperience;
  equipment: AiPlannerEquipment;
  recovery: AiPlannerRecovery;
  sessionMinutes: number;
  sessions: AICoachPlannedSession[];
}

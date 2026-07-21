/**
 * Exercise → 3D pose gate (3D exercise media).
 *
 * Maps an exercise name to a render-independent pose function plus how the rig
 * should be dressed. v1 ships the squat in two variants — loaded (bar + rack)
 * and bodyweight (arms forward, no implement). Anything unregistered returns
 * null and the media zone stays photo-only. Phase 4 registers the other lifts.
 */
import { computeSquatSkeleton } from '../../lib/exerciseRig/squat';
import { RigSkeleton } from '../../lib/exerciseRig/types';

export type PoseFn = (t: number) => RigSkeleton;

export interface ExercisePose {
  poseFn: PoseFn;
  /** False hides the barbell + rack (bodyweight variants). */
  showImplement: boolean;
}

const barbellSquat: ExercisePose = {
  poseFn: (t) => computeSquatSkeleton(t, 'barbell'),
  showImplement: true,
};

const bodyweightSquat: ExercisePose = {
  poseFn: (t) => computeSquatSkeleton(t, 'bodyweight'),
  showImplement: false,
};

// Keyed by normalized (lowercased, trimmed) exercise name.
const POSE_REGISTRY: Record<string, ExercisePose> = {
  squat: barbellSquat,
  'back squat': barbellSquat,
  'barbell squat': barbellSquat,
  'barbell back squat': barbellSquat,
  'bodyweight squat': bodyweightSquat,
  'air squat': bodyweightSquat,
};

export function getExercisePose(name: string): ExercisePose | null {
  return POSE_REGISTRY[name.trim().toLowerCase()] ?? null;
}

export function hasExercise3D(name: string): boolean {
  return getExercisePose(name) !== null;
}

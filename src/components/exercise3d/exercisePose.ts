/**
 * Exercise → 3D pose gate (3D exercise media).
 *
 * Maps an exercise name to a render-independent pose function. v1 ships only the
 * Back Squat rig, so everything else returns null and the media zone falls back
 * to the existing photo/initials tier. Phase 4 registers the remaining lifts
 * here — each a `(t) => RigSkeleton` sharing the same body + implement renderer.
 */
import { computeSquatSkeleton } from '../../lib/exerciseRig/squat';
import { RigSkeleton } from '../../lib/exerciseRig/types';

export type PoseFn = (t: number) => RigSkeleton;

// Keyed by normalized (lowercased, trimmed) exercise name.
const POSE_REGISTRY: Record<string, PoseFn> = {
  squat: computeSquatSkeleton,
  'back squat': computeSquatSkeleton,
  'barbell squat': computeSquatSkeleton,
  'barbell back squat': computeSquatSkeleton,
};

export function getExercisePoseFn(name: string): PoseFn | null {
  return POSE_REGISTRY[name.trim().toLowerCase()] ?? null;
}

export function hasExercise3D(name: string): boolean {
  return getExercisePoseFn(name) !== null;
}

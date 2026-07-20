/**
 * Render-independent exercise-rig vocabulary (3D exercise media).
 *
 * These types are the shared "source of truth" between the 3D renderer (ideal
 * pose out) and a possible future camera form-check (user pose in): both speak
 * named joint positions in the same coordinate space. Nothing here depends on
 * three.js — it is plain math so it can run in tests, a headless GLB bake, or a
 * comparison pipeline. See design_handoff RIG_RENDER_INDEPENDENT.md.
 *
 * Coordinate space: metres, y-up, athlete facing +z, base (floor) at y=0.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Full skeleton for one animation frame — every joint the shared mesh rig and a
 * pose comparison both care about. Left/right are the athlete's own sides
 * (mirrored on x). `barCenter` is the implement anchor (bar/dumbbell/handle).
 */
export interface RigSkeleton {
  ankleL: Vec3;
  ankleR: Vec3;
  kneeL: Vec3;
  kneeR: Vec3;
  hipL: Vec3;
  hipR: Vec3;
  /** Hip midpoint — where the pelvis mesh sits. */
  pelvis: Vec3;
  /** Spine top / shoulder girdle centre. */
  chest: Vec3;
  neckEnd: Vec3;
  head: Vec3;
  shoulderL: Vec3;
  shoulderR: Vec3;
  elbowL: Vec3;
  elbowR: Vec3;
  handL: Vec3;
  handR: Vec3;
  footL: Vec3;
  footR: Vec3;
  barCenter: Vec3;
}

export type RigJointName = keyof RigSkeleton;

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

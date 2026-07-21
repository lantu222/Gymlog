/**
 * Back Squat — pure pose model (3D exercise media, pilot lift).
 *
 * Render-independent per design_handoff RIG_RENDER_INDEPENDENT.md: this file is
 * plain math (no three.js). It exposes the driver joint angles and the full
 * forward-kinematics skeleton so the same source feeds the renderer, a GLB
 * keyframe bake, and a future form comparison.
 *
 * ── Angle convention ─────────────────────────────────────────────────────
 * t ∈ [0,1], 0 = top (standing), 1 = bottom of the squat. Each driver angle
 * scales linearly with t and is measured in DEGREES:
 *   - shinLean:  the shin's forward lean from VERTICAL (0° = shin straight up).
 *   - hipFlex:   hip flexion from FULL EXTENSION (0° = standing, torso in line
 *                with the thigh).
 *   - torsoLean: the torso's forward lean from VERTICAL (0° = upright).
 * Positive angles all lean the joint FORWARD (toward +z, the facing direction).
 * A future pose-estimation pipeline must align to this same convention.
 *
 * Coordinate space: metres, y-up, athlete facing +z, floor at y=0.
 */

import { RigSkeleton, Vec3, vec3 } from './types';

export interface SquatAngles {
  shinLeanDeg: number;
  hipFlexDeg: number;
  torsoLeanDeg: number;
}

/**
 * Same leg/torso kinematics, different upper body: 'barbell' racks a bar on the
 * shoulders, 'bodyweight' reaches the arms forward as a counterbalance (and the
 * renderer hides the bar + rack).
 */
export type SquatVariant = 'barbell' | 'bodyweight';

// Peak angles at the bottom of the squat (t = 1). Tuned by eye in the prototype.
const SHIN_LEAN_MAX_DEG = 32;
const HIP_FLEX_MAX_DEG = 100;
const TORSO_LEAN_MAX_DEG = 45;

// Segment lengths (metres): thigh, shin, torso.
const THIGH = 0.44;
const SHIN = 0.43;
const TORSO = 0.52;

// Ankle is fixed to the platform; hip inset is slightly narrower than the ankle.
const ANKLE_X = 0.18;
const ANKLE_Y = 0.09;
const HIP_X = 0.15;

const DEG = Math.PI / 180;

/** Driver angles at scrub position t (pure, the documented convention above). */
export function squatAngles(t: number): SquatAngles {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    shinLeanDeg: SHIN_LEAN_MAX_DEG * clamped,
    hipFlexDeg: HIP_FLEX_MAX_DEG * clamped,
    torsoLeanDeg: TORSO_LEAN_MAX_DEG * clamped,
  };
}

/**
 * Full skeleton at scrub position t via forward kinematics from the driver
 * angles + fixed segment lengths. Pure — returns plain Vec3s, no three.js.
 */
export function computeSquatSkeleton(t: number, variant: SquatVariant = 'barbell'): RigSkeleton {
  const { shinLeanDeg, hipFlexDeg, torsoLeanDeg } = squatAngles(t);
  const shin = shinLeanDeg * DEG;
  const hip = hipFlexDeg * DEG;
  const torso = torsoLeanDeg * DEG;

  const side = (sx: -1 | 1) => {
    const ankle = vec3(ANKLE_X * sx, ANKLE_Y, 0);
    // Shin rises from the ankle, leaning forward (+z) by the shin angle.
    const knee = vec3(ANKLE_X * sx, ankle.y + SHIN * Math.cos(shin), ankle.z + SHIN * Math.sin(shin));
    // Thigh rises from the knee; the hip travels back (−z) as flexion grows.
    const hipJoint = vec3(HIP_X * sx, knee.y + THIGH * Math.cos(hip), knee.z - THIGH * Math.sin(hip));
    const foot = vec3(ANKLE_X * sx, 0.046, 0.055);
    return { ankle, knee, hipJoint, foot };
  };

  const left = side(-1);
  const right = side(1);

  // Hip midpoint (symmetric on y,z; centred on x).
  const pelvis = vec3(0, left.hipJoint.y, left.hipJoint.z);
  // Torso rises from the pelvis, leaning forward (+z) by the torso angle.
  const chest = vec3(0, pelvis.y + TORSO * Math.cos(torso), pelvis.z + TORSO * Math.sin(torso));

  // Neck + head continue along the torso direction.
  const dir = normalize(sub(chest, pelvis));
  const neckEnd = add(chest, scale(dir, 0.1));
  const head = add(chest, scale(dir, 0.19));

  // High-bar: the bar sits just above and behind the shoulders.
  const barCenter = vec3(0, chest.y + 0.05, chest.z - 0.07);

  const arm = (sx: -1 | 1) => {
    const shoulder = vec3(0.21 * sx, chest.y, chest.z);
    if (variant === 'bodyweight') {
      // Arms reach forward as a counterbalance (no bar to hold).
      const elbow = vec3(0.23 * sx, chest.y - 0.06, chest.z + 0.26);
      const hand = vec3(0.21 * sx, chest.y - 0.1, chest.z + 0.52);
      return { shoulder, hand, elbow };
    }
    const hand = vec3(0.4 * sx, barCenter.y, barCenter.z);
    const elbow = vec3(0.25 * sx, barCenter.y - 0.17, barCenter.z + 0.01);
    return { shoulder, hand, elbow };
  };

  const leftArm = arm(-1);
  const rightArm = arm(1);

  return {
    ankleL: left.ankle,
    ankleR: right.ankle,
    kneeL: left.knee,
    kneeR: right.knee,
    hipL: left.hipJoint,
    hipR: right.hipJoint,
    pelvis,
    chest,
    neckEnd,
    head,
    shoulderL: leftArm.shoulder,
    shoulderR: rightArm.shoulder,
    elbowL: leftArm.elbow,
    elbowR: rightArm.elbow,
    handL: leftArm.hand,
    handR: rightArm.hand,
    footL: left.foot,
    footR: right.foot,
    barCenter,
  };
}

/* ── tiny pure vector helpers (kept local so the module stays three-free) ── */
function sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}
function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}
function scale(a: Vec3, k: number): Vec3 {
  return vec3(a.x * k, a.y * k, a.z * k);
}
function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return vec3(a.x / len, a.y / len, a.z / len);
}

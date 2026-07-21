/**
 * Squat rig — the thin three.js renderer for the pure squat skeleton.
 *
 * `buildSquatRig` constructs the shared athlete meshes + a squat rack + the
 * barbell once. `applyPose` maps a render-independent RigSkeleton
 * (src/lib/exerciseRig) onto those meshes each frame. Geometry, materials and
 * proportions are ported verbatim from the design prototype. All three.js lives
 * here; the pose math stays pure in src/lib/exerciseRig.
 */
import * as THREE from 'three';

import { RigSkeleton, Vec3 } from '../../lib/exerciseRig/types';
import { createRigMaterials, RigMaterials } from './rigMaterials';

export interface SquatRigHandles {
  thighL: THREE.Mesh;
  thighR: THREE.Mesh;
  shinL: THREE.Mesh;
  shinR: THREE.Mesh;
  torso: THREE.Mesh;
  neck: THREE.Mesh;
  upperarmL: THREE.Mesh;
  upperarmR: THREE.Mesh;
  forearmL: THREE.Mesh;
  forearmR: THREE.Mesh;
  hipL: THREE.Mesh;
  hipR: THREE.Mesh;
  kneeL: THREE.Mesh;
  kneeR: THREE.Mesh;
  ankleL: THREE.Mesh;
  ankleR: THREE.Mesh;
  shoulderL: THREE.Mesh;
  shoulderR: THREE.Mesh;
  elbowL: THREE.Mesh;
  elbowR: THREE.Mesh;
  handL: THREE.Mesh;
  handR: THREE.Mesh;
  pelvis: THREE.Mesh;
  head: THREE.Mesh;
  footL: THREE.Mesh;
  footR: THREE.Mesh;
}

export interface SquatRig {
  root: THREE.Group;
  rig: SquatRigHandles;
  bar: THREE.Group;
  materials: RigMaterials;
  dispose: () => void;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface SquatRigOptions {
  /** Bodyweight variants hide the loaded bar and the rack it came off. */
  showImplement?: boolean;
}

export function buildSquatRig({ showImplement = true }: SquatRigOptions = {}): SquatRig {
  const materials = createRigMaterials();
  const root = new THREE.Group();
  root.name = 'squat-scene';

  const disposables: Array<{ dispose: () => void }> = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    disposables.push(geo);
    return m;
  };

  // ── rack (static) ──
  const rack = new THREE.Group();
  rack.visible = showImplement;
  root.add(rack);
  mesh(new THREE.BoxGeometry(1.9, 0.02, 1.5), materials.rubber, rack).position.set(0, 0.011, 0);
  for (const sx of [-1, 1] as const) {
    mesh(new THREE.BoxGeometry(0.075, 1.85, 0.075), materials.steel, rack).position.set(0.55 * sx, 0.945, -0.35);
    mesh(new THREE.BoxGeometry(0.09, 0.04, 0.75), materials.steel, rack).position.set(0.55 * sx, 0.042, -0.18);
    mesh(new THREE.BoxGeometry(0.06, 0.07, 0.17), materials.accent, rack).position.set(0.55 * sx, 1.33, -0.245);
    mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), materials.accent, rack).position.set(0.55 * sx, 1.395, -0.175);
  }
  mesh(new THREE.BoxGeometry(1.175, 0.075, 0.075), materials.steel, rack).position.set(0, 1.83, -0.35);
  const pull = mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.3, 24), materials.chrome, rack);
  pull.rotation.z = Math.PI / 2;
  pull.position.set(0, 1.9, -0.35);

  // ── barbell (follows the shoulders) ──
  const bar = new THREE.Group();
  bar.visible = showImplement;
  root.add(bar);
  const shaft = mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 24), materials.chrome, bar);
  shaft.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1] as const) {
    const sl = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 24), materials.chrome, bar);
    sl.rotation.z = Math.PI / 2;
    sl.position.x = 0.95 * sx;
    const p1 = mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.032, 40), materials.accent, bar);
    p1.rotation.z = Math.PI / 2;
    p1.position.x = 0.85 * sx;
    const p2 = mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.032, 40), materials.accent, bar);
    p2.rotation.z = Math.PI / 2;
    p2.position.x = 0.888 * sx;
    const col = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24), materials.steel, bar);
    col.rotation.z = Math.PI / 2;
    col.position.x = 0.92 * sx;
  }

  // ── athlete ──
  const fig = new THREE.Group();
  root.add(fig);
  const unitCyl = (r: number) => new THREE.CylinderGeometry(r, r * 0.85, 1, 20);
  const limb = (r: number) => mesh(unitCyl(r), materials.body, fig);
  const ball = (r: number, mat: THREE.Material = materials.joint) => mesh(new THREE.SphereGeometry(r, 24, 16), mat, fig);

  const rig: SquatRigHandles = {
    thighL: limb(0.062),
    thighR: limb(0.062),
    shinL: limb(0.048),
    shinR: limb(0.048),
    torso: mesh(new THREE.CylinderGeometry(0.105, 0.125, 1, 24), materials.body, fig),
    neck: limb(0.04),
    upperarmL: limb(0.042),
    upperarmR: limb(0.042),
    forearmL: limb(0.036),
    forearmR: limb(0.036),
    hipL: ball(0.07),
    hipR: ball(0.07),
    kneeL: ball(0.062),
    kneeR: ball(0.062),
    ankleL: ball(0.05),
    ankleR: ball(0.05),
    shoulderL: ball(0.065),
    shoulderR: ball(0.065),
    elbowL: ball(0.045),
    elbowR: ball(0.045),
    handL: ball(0.045, materials.body),
    handR: ball(0.045, materials.body),
    pelvis: ball(0.11, materials.body),
    head: ball(0.105, materials.body),
    footL: mesh(new THREE.BoxGeometry(0.095, 0.05, 0.26), materials.rubber, fig),
    footR: mesh(new THREE.BoxGeometry(0.095, 0.05, 0.26), materials.rubber, fig),
  };
  rig.pelvis.scale.set(1.35, 0.85, 1);

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
    Object.values(materials).forEach((m) => m.dispose());
  };

  return { root, rig, bar, materials, dispose };
}

// Reusable temporaries so applyPose allocates nothing per frame.
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

const v = (out: THREE.Vector3, p: Vec3) => out.set(p.x, p.y, p.z);

/** Place + orient + scale a unit cylinder so it spans from a to b. */
function seg(m: THREE.Mesh, a: Vec3, b: Vec3): void {
  v(_a, a);
  v(_b, b);
  _d.subVectors(_b, _a);
  const len = _d.length();
  m.position.copy(_a).addScaledVector(_d, 0.5);
  m.quaternion.setFromUnitVectors(Y_AXIS, _d.normalize());
  m.scale.set(1, len, 1);
}

const setPos = (m: THREE.Mesh, p: Vec3) => m.position.set(p.x, p.y, p.z);

/** Map a render-independent skeleton onto the rig meshes (thin three layer). */
export function applySquatPose(rig: SquatRigHandles, bar: THREE.Group, s: RigSkeleton): void {
  setPos(rig.ankleL, s.ankleL);
  setPos(rig.ankleR, s.ankleR);
  setPos(rig.kneeL, s.kneeL);
  setPos(rig.kneeR, s.kneeR);
  setPos(rig.hipL, s.hipL);
  setPos(rig.hipR, s.hipR);
  setPos(rig.footL, s.footL);
  setPos(rig.footR, s.footR);
  seg(rig.shinL, s.ankleL, s.kneeL);
  seg(rig.shinR, s.ankleR, s.kneeR);
  seg(rig.thighL, s.hipL, s.kneeL);
  seg(rig.thighR, s.hipR, s.kneeR);

  setPos(rig.pelvis, s.pelvis);
  seg(rig.torso, s.pelvis, s.chest);
  seg(rig.neck, s.chest, s.neckEnd);
  setPos(rig.head, s.head);

  bar.position.set(s.barCenter.x, s.barCenter.y, s.barCenter.z);

  setPos(rig.shoulderL, s.shoulderL);
  setPos(rig.shoulderR, s.shoulderR);
  setPos(rig.elbowL, s.elbowL);
  setPos(rig.elbowR, s.elbowR);
  setPos(rig.handL, s.handL);
  setPos(rig.handR, s.handR);
  seg(rig.upperarmL, s.shoulderL, s.elbowL);
  seg(rig.upperarmR, s.shoulderR, s.elbowR);
  seg(rig.forearmL, s.elbowL, s.handL);
  seg(rig.forearmR, s.elbowR, s.handR);
}

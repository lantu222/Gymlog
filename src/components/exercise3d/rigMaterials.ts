/**
 * Shared PBR materials for the 3D exercise rig (design_handoff palette).
 * MeshStandardMaterial, metalness kept ≤ 0.4 — there is no env map in-scene, so
 * higher metalness renders near-black. Created once and reused across all parts.
 */
import * as THREE from 'three';

export interface RigMaterials {
  steel: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  body: THREE.MeshStandardMaterial;
  joint: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
}

export function createRigMaterials(): RigMaterials {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x34363e, metalness: 0.35, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x7c5cfc, metalness: 0.15, roughness: 0.5 }),
    body: new THREE.MeshStandardMaterial({ color: 0xdcdde2, metalness: 0.05, roughness: 0.6 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x6d6f7a, metalness: 0.2, roughness: 0.5 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xbcc1ca, metalness: 0.4, roughness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1e1f24, metalness: 0, roughness: 0.9 }),
  };
}

export function disposeRigMaterials(materials: RigMaterials): void {
  Object.values(materials).forEach((material) => material.dispose());
}

export const STAGE_BG = '#f4f3f7';

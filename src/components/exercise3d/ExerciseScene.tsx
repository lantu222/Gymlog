/**
 * ExerciseScene — reusable 3D exercise view (react-three-fiber/native).
 *
 * Renders the squat rig lit on the GAINER stage background and drives its pose
 * from a `t` prop (0 = top, 1 = bottom). This is the component the guided-player
 * media zone mounts in phase 3; here in phase 2 it is verified standalone. The
 * scene is animation-cheap: the rig is built once and only its transforms are
 * mutated each frame from the pure skeleton.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';

import { computeSquatSkeleton } from '../../lib/exerciseRig/squat';
import { STAGE_BG } from './rigMaterials';
import { applySquatPose, buildSquatRig } from './squatRig';

interface ExerciseSceneProps {
  /** Scrub position 0..1 (0 = top/standing, 1 = bottom). */
  t: number;
  style?: StyleProp<ViewStyle>;
}

// Lifts the athlete so its mid-torso sits near the origin the camera aims at.
const SCENE_Y_OFFSET = -0.9;

function SquatContent({ tRef }: { tRef: React.MutableRefObject<number> }) {
  const squat = useMemo(() => buildSquatRig(), []);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    squat.root.position.y = SCENE_Y_OFFSET;
    // Seed the standing pose immediately so the first frame is correct.
    applySquatPose(squat.rig, squat.bar, computeSquatSkeleton(tRef.current));
    return () => squat.dispose();
  }, [squat, tRef]);

  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const lastT = useRef<number>(NaN);
  useFrame(() => {
    if (tRef.current !== lastT.current) {
      lastT.current = tRef.current;
      applySquatPose(squat.rig, squat.bar, computeSquatSkeleton(tRef.current));
    }
  });

  return <primitive object={squat.root} />;
}

export function ExerciseScene({ t, style }: ExerciseSceneProps) {
  const tRef = useRef(t);
  tRef.current = t;

  return (
    <View style={[{ flex: 1 }, style]}>
      <Canvas camera={{ position: [2.4, 0.5, 3.1], fov: 42 }} gl={{ antialias: true }}>
        <color attach="background" args={[STAGE_BG]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <SquatContent tRef={tRef} />
      </Canvas>
    </View>
  );
}

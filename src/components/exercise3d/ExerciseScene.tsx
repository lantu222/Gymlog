/**
 * ExerciseScene — reusable 3D exercise view (react-three-fiber/native).
 *
 * Renders the athlete rig lit on the GAINER stage and drives its pose from
 * shared refs so no React re-render is needed per frame:
 *   - tRef      : current scrub position 0..1 (0 = top, 1 = bottom)
 *   - playingRef: when true, the tempo loop advances t = (1 − cos(phase)) / 2
 * The rig is built once; only transforms mutate each frame. `paused` flips the
 * Canvas to `frameloop="never"` so a backgrounded / paused set stops rendering
 * entirely (battery). Manual scrubbing and the loop both write tRef; onFrameT
 * reports the loop's position back so the scrubber slider can follow.
 *
 * v1 renders the squat rig; poseFn defaults to the squat skeleton. Other lifts
 * (phase 4) pass their own poseFn — the body + barbell renderer is shared.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';

import { computeSquatSkeleton } from '../../lib/exerciseRig/squat';
import { PoseFn } from './exercisePose';
import { STAGE_BG } from './rigMaterials';
import { applySquatPose, buildSquatRig } from './squatRig';

interface ExerciseSceneProps {
  tRef: React.MutableRefObject<number>;
  playingRef: React.MutableRefObject<boolean>;
  poseFn?: PoseFn;
  paused?: boolean;
  onFrameT?: (t: number) => void;
  style?: StyleProp<ViewStyle>;
}

// Lifts the athlete so its mid-torso sits near the origin the camera aims at.
const SCENE_Y_OFFSET = -0.85;
// Pulled back + narrow fov so the whole athlete fits even in a short, wide media
// tile (the set screen is only ~190 px tall). Tuned for the worst-case height.
const CAMERA_POSITION: [number, number, number] = [3.3, 0.75, 4.3];
const CAMERA_FOV = 34;
// Tempo: ~2.8 s per full rep (matches the prototype), advanced by real dt.
const TEMPO = Math.PI / 1.4;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function SceneContent({
  tRef,
  playingRef,
  poseFn,
  onFrameT,
}: {
  tRef: React.MutableRefObject<number>;
  playingRef: React.MutableRefObject<boolean>;
  poseFn: PoseFn;
  onFrameT?: (t: number) => void;
}) {
  const squat = useMemo(() => buildSquatRig(), []);
  const camera = useThree((state) => state.camera);
  const phase = useRef(Math.acos(1 - 2 * clamp01(tRef.current)));
  const wasPlaying = useRef(false);
  const lastReport = useRef(0);

  useEffect(() => {
    squat.root.position.y = SCENE_Y_OFFSET;
    camera.lookAt(0, 0, 0);
    applySquatPose(squat.rig, squat.bar, poseFn(clamp01(tRef.current)));
    return () => squat.dispose();
  }, [squat, camera, poseFn, tRef]);

  useFrame((state, dt) => {
    const playing = playingRef.current;
    if (playing) {
      // On the rising edge, reseed the phase from the current scrub position so
      // the loop resumes from where the user left it (no jump).
      if (!wasPlaying.current) {
        phase.current = Math.acos(1 - 2 * clamp01(tRef.current));
      }
      phase.current += Math.min(dt, 0.05) * TEMPO;
      tRef.current = (1 - Math.cos(phase.current)) / 2;
      if (onFrameT && state.clock.elapsedTime - lastReport.current > 0.1) {
        lastReport.current = state.clock.elapsedTime;
        onFrameT(tRef.current);
      }
    }
    wasPlaying.current = playing;
    applySquatPose(squat.rig, squat.bar, poseFn(clamp01(tRef.current)));
  });

  return <primitive object={squat.root} />;
}

export function ExerciseScene({
  tRef,
  playingRef,
  poseFn = computeSquatSkeleton,
  paused = false,
  onFrameT,
  style,
}: ExerciseSceneProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        frameloop={paused ? 'never' : 'always'}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[STAGE_BG]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <SceneContent tRef={tRef} playingRef={playingRef} poseFn={poseFn} onFrameT={onFrameT} />
      </Canvas>
    </View>
  );
}

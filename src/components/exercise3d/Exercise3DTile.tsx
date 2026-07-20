/**
 * Exercise3DTile — the 3D media-zone tier for the guided player.
 *
 * Fills the media rectangle with the looping 3D exercise animation plus a
 * compact scrubber (drag to inspect, play/pause the rep tempo). Inside a set it
 * auto-loops the movement; the canvas stops rendering when the app is
 * backgrounded (battery). The last scrub position is remembered per exercise.
 * Only mounted when getExercisePoseFn(name) resolves — the caller falls back to
 * the photo/initials tier otherwise.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HG } from '../../lightTheme';
import { ExerciseScene } from './ExerciseScene';
import { getExercisePoseFn } from './exercisePose';

// In-memory per-exercise scrub position (survives step changes within a session).
const T_MEMORY = new Map<string, number>();

interface Exercise3DTileProps {
  name: string;
  height: number;
  muscle?: string | null;
  /** Inside a strength set the movement auto-loops; on the position step it waits. */
  autoPlay?: boolean;
}

export function Exercise3DTile({ name, height, muscle, autoPlay = false }: Exercise3DTileProps) {
  const poseFn = useMemo(() => getExercisePoseFn(name), [name]);
  const memoryKey = name.trim().toLowerCase();

  const tRef = useRef(T_MEMORY.get(memoryKey) ?? 0);
  const playingRef = useRef(autoPlay);
  const [playing, setPlaying] = useState(autoPlay);
  const [pct, setPct] = useState(Math.round(tRef.current * 100));
  const [bgPaused, setBgPaused] = useState(false);
  const trackWidth = useRef(1);

  // Pause rendering when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setBgPaused(state !== 'active'));
    return () => sub.remove();
  }, []);

  // Remember the scrub position when this exercise's tile unmounts.
  useEffect(
    () => () => {
      T_MEMORY.set(memoryKey, tRef.current);
    },
    [memoryKey],
  );

  const setPlayingBoth = (next: boolean) => {
    playingRef.current = next;
    setPlaying(next);
  };

  const scrubTo = (clientX: number) => {
    const w = trackWidth.current || 1;
    const t = Math.max(0, Math.min(1, clientX / w));
    tRef.current = t;
    setPct(Math.round(t * 100));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setPlayingBoth(false);
          scrubTo(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => scrubTo(evt.nativeEvent.locationX),
      }),
    [],
  );

  if (!poseFn) {
    return null;
  }

  return (
    <View style={[styles.tile, { height }]}>
      <ExerciseScene
        tRef={tRef}
        playingRef={playingRef}
        poseFn={poseFn}
        paused={bgPaused}
        onFrameT={(t) => setPct(Math.round(t * 100))}
      />

      {muscle ? (
        <View style={styles.muscleChip}>
          <Text style={styles.muscleChipText}>{muscle.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.scrubCard}>
        <Pressable style={styles.playBtn} onPress={() => setPlayingBoth(!playing)} hitSlop={6}>
          <Svg width={15} height={15} viewBox="0 0 16 16">
            {playing ? (
              <Path d="M2.5 1.5h3.6v13H2.5zM9.9 1.5h3.6v13H9.9z" fill="#fff" />
            ) : (
              <Path d="M3 1.5 14 8 3 14.5z" fill="#fff" />
            )}
          </Svg>
        </Pressable>

        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>TOP</Text>
            <Text style={styles.label}>BOTTOM</Text>
          </View>
          <View
            style={styles.track}
            onLayout={(e) => {
              trackWidth.current = e.nativeEvent.layout.width;
            }}
            {...pan.panHandlers}
          >
            <View style={[styles.trackFill, { width: `${pct}%` }]} />
            <View style={[styles.thumb, { left: `${pct}%` }]} />
          </View>
        </View>

        <Text style={styles.pct}>{pct}%</Text>
      </View>
    </View>
  );
}

const ACCENT = '#7C5CFC';

const styles = StyleSheet.create({
  tile: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6DAF8',
    backgroundColor: '#f4f3f7',
  },
  muscleChip: {
    position: 'absolute',
    left: 16,
    top: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  muscleChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, color: HG.purpleDark },
  scrubCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E6E3F2',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, color: '#7a7885' },
  track: { height: 22, borderRadius: 999, backgroundColor: '#E9E1FA', justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: ACCENT },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: ACCENT,
    marginLeft: -9,
  },
  pct: { fontSize: 15, fontWeight: '800', color: HG.ink, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
});

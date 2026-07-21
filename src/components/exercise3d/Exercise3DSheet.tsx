/**
 * Exercise3DSheet — the on-demand "how is this done" 3D view.
 *
 * Opened from the media-zone 3D button. The media zone itself keeps showing the
 * flat photo; this sheet is where the movement is actually taught: a large 3D
 * rig looping the rep, plus a scrubber to inspect any point of the lift.
 * Rendering only happens while the sheet is open (and stops when the app is
 * backgrounded), so the 3D costs nothing during normal training.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { HG } from '../../lightTheme';
import { ExerciseScene } from './ExerciseScene';
import { getExercisePoseFn } from './exercisePose';

// In-memory per-exercise scrub position, so reopening resumes the same frame.
const T_MEMORY = new Map<string, number>();

interface Exercise3DSheetProps {
  name: string;
  muscle?: string | null;
  visible: boolean;
  onClose: () => void;
}

export function Exercise3DSheet({ name, muscle, visible, onClose }: Exercise3DSheetProps) {
  const poseFn = useMemo(() => getExercisePoseFn(name), [name]);
  const memoryKey = name.trim().toLowerCase();

  const tRef = useRef(T_MEMORY.get(memoryKey) ?? 0);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [pct, setPct] = useState(Math.round(tRef.current * 100));
  const [bgPaused, setBgPaused] = useState(false);
  const trackWidth = useRef(1);

  // Autoplay whenever the sheet opens; remember the frame when it closes.
  useEffect(() => {
    if (visible) {
      playingRef.current = true;
      setPlaying(true);
    } else {
      T_MEMORY.set(memoryKey, tRef.current);
    }
  }, [visible, memoryKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setBgPaused(state !== 'active'));
    return () => sub.remove();
  }, []);

  const setPlayingBoth = (next: boolean) => {
    playingRef.current = next;
    setPlaying(next);
  };

  const scrubTo = (x: number) => {
    const w = trackWidth.current || 1;
    const t = Math.max(0, Math.min(1, x / w));
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>HOW IT'S DONE</Text>
            <Text style={styles.title} numberOfLines={1}>
              {name}
            </Text>
            {muscle ? <Text style={styles.muscle}>{muscle[0].toUpperCase() + muscle.slice(1)}</Text> : null}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.stage}>
          <ExerciseScene
            tRef={tRef}
            playingRef={playingRef}
            poseFn={poseFn}
            paused={bgPaused || !visible}
            onFrameT={(t) => setPct(Math.round(t * 100))}
          />
        </View>

        <View style={styles.scrubCard}>
          <Pressable style={styles.playBtn} onPress={() => setPlayingBoth(!playing)} hitSlop={6}>
            <Svg width={16} height={16} viewBox="0 0 16 16">
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

        <Text style={styles.hint}>Drag the slider to inspect any point of the lift.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const ACCENT = '#7C5CFC';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HG.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: HG.purple },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: HG.ink, marginTop: 3 },
  muscle: { fontSize: 13, fontWeight: '600', color: HG.muted, marginTop: 2 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
  },
  stage: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6DAF8',
    backgroundColor: '#f4f3f7',
  },
  scrubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E3F2',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  playBtn: { width: 44, height: 44, borderRadius: 999, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: '#7a7885' },
  track: { height: 24, borderRadius: 999, backgroundColor: '#E9E1FA', justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: ACCENT },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: ACCENT,
    marginLeft: -10,
  },
  pct: { fontSize: 17, fontWeight: '800', color: HG.ink, fontVariant: ['tabular-nums'], minWidth: 46, textAlign: 'right' },
  hint: { textAlign: 'center', fontSize: 12.5, fontWeight: '600', color: HG.faint, marginTop: 12, marginBottom: 8 },
});

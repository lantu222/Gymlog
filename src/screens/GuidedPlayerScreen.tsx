/**
 * GAINER Guided Player (design_handoff_guided_player).
 *
 * Full-screen Freeletics-style session mode: Warm-up (timed drills) → Workout
 * (strength sets + rests) → Cooldown (stretches) → dark session summary. One
 * thing on screen at a time. The step list itself is pure
 * (src/lib/guidedPlayer.ts); this screen owns timers, dispatches into
 * WorkoutProvider (so list view / resume stay in sync) and the visuals.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  GuidedDrill,
  GuidedStep,
  GuidedSetTarget,
  buildGuidedDrillsFromBlock,
  buildGuidedSteps,
  estimateGuidedDurationMinutes,
  findGuidedLibraryIndex,
  findGuidedPhaseStart,
  findGuidedSessionPr,
  findGuidedTopSet,
  buildGuidedCoachMessage,
  formatGuidedCountdown,
  formatGuidedTarget,
  getGuidedBackTargetIndex,
  getGuidedInitials,
  getGuidedNextName,
  getGuidedNextPreview,
  getGuidedPhaseLabel,
  getGuidedSessionTitle,
  getGuidedSkipTargetIndex,
  getGuidedStepLabel,
  resolveGuidedResumeIndex,
  resolveGuidedSetTarget,
} from '../lib/guidedPlayer';
import { getDrillLibraryName } from '../lib/drillMedia';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { getDefaultCooldown, getDefaultWarmup } from '../lib/homeSessionHero';
import { Exercise3DSheet } from '../components/exercise3d/Exercise3DSheet';
import { hasExercise3D } from '../components/exercise3d/exercisePose';
import { removeTrailingZeros } from '../lib/format';
import { t } from '../lib/i18n';
import { haptics } from '../utils/haptics';
import { useRestEndAlert } from '../hooks/useRestEndAlert';
import { sound, type CueSound } from '../utils/sound';
import { HG } from '../lightTheme';
import { AppLanguage, ExerciseLibraryItem, UnitPreference } from '../types/models';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { useKeepScreenAwake } from '../utils/keepAwake';
import { getHistoryEntriesForExercise } from '../features/workout/workoutState';
import { WorkoutExerciseInstance } from '../features/workout/workoutTypes';

// Dark palette for rest / finish takeovers (guided-shared.jsx GPD).
const GPD = {
  bg1: '#241B4A',
  bg2: '#17112E',
  ink: '#F4F1FF',
  muted: '#A79FC4',
  faint: '#7C739E',
  line: 'rgba(255,255,255,0.12)',
  purple: '#9B6DFF',
  green: '#37D08A',
  amber: '#F5B93B',
};

const SPLASH_MS = 2300;

export interface GuidedWeekProgress {
  weekLabel: string;
  done: number;
  target: number;
}

export interface GuidedNextUp {
  name: string;
  weekday: string;
}

interface GuidedPlayerScreenProps {
  unitPreference: UnitPreference;
  language?: AppLanguage;
  exerciseLibrary: ExerciseLibraryItem[];
  soundCuesEnabled: boolean;
  /** Keep the display on for the whole guided session. */
  keepScreenAwake?: boolean;
  onToggleSoundCues: (next: boolean) => void;
  entryEyebrow: string;
  weekProgress: GuidedWeekProgress | null;
  nextUp: GuidedNextUp | null;
  onLeave: () => void;
  onSwitchToListView: () => void;
  onEndSession: () => void;
  onFinishSession: () => void;
  isSavingWorkout: boolean;
}

/* ── icons ── */
function GPIcon({ name, size = 22, color = '#fff', sw = 2.2 }: { name: string; size?: number; color?: string; sw?: number }) {
  const paths: Record<string, React.ReactNode> = {
    x: <Path d="M6 6l12 12M18 6L6 18" />,
    pause: <Path d="M9 5v14M15 5v14" />,
    play: <Path d="M8 5l11 7-11 7z" />,
    skip: <Path d="M5 5l9 7-9 7zM18 5v14" />,
    back: <Path d="M19 5l-9 7 9 7zM6 5v14" />,
    check: <Path d="M4.5 12.5l5 5L19.5 7" />,
    chevR: <Path d="M9 6l6 6-6 6" />,
    sound: (
      <>
        <Path d="M4 9v6h4l5 4V5L8 9z" />
        <Path d="M16.5 8.5a5 5 0 010 7" />
      </>
    ),
    mute: (
      <>
        <Path d="M4 9v6h4l5 4V5L8 9z" />
        <Path d="M17 9l4 6M21 9l-4 6" />
      </>
    ),
    plus: <Path d="M12 5v14M5 12h14" />,
    list: <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    video: (
      <>
        <Rect x="3" y="6.5" width="12.5" height="11" rx="3" />
        <Path d="M15.5 10.5l5-2.6v8.2l-5-2.6z" />
      </>
    ),
    clock: (
      <>
        <Circle cx="12" cy="12" r="8.5" />
        <Path d="M12 7.5V12l3 2" />
      </>
    ),
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}

/* ── step entrance: fade + 14px rise ── */
function StepIn({ children, stepKey, style }: { children: React.ReactNode; stepKey: string; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [anim, stepKey]);
  return (
    <Animated.View
      style={[
        { flex: 1, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── pop-in for countdown digits / badges ── */
function PopIn({ children, popKey }: { children: React.ReactNode; popKey: string | number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.3, 1.4, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [anim, popKey]);
  return (
    <Animated.View
      style={{
        opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ── media zone: photo when the library has one, brand-panel initials otherwise ── */
function MediaZone({
  name,
  library,
  height,
  mode = 'drill',
  showActions = true,
  fit = 'contain',
}: {
  name: string;
  library: ExerciseLibraryItem[];
  height: number;
  mode?: 'drill' | 'position' | 'set';
  /** Set screen v4 moves the how-it's-done button into the top bar. */
  showActions?: boolean;
  /** v4 fills the set card edge to edge; other steps keep the whole frame. */
  fit?: 'contain' | 'cover';
}) {
  const match = useMemo(() => {
    // Warmup/cooldown drills are generated copy with no library entry of their
    // own — they borrow a photo from the exercise that shows the same position.
    const lookupName = getDrillLibraryName(name) ?? name;
    const index = findGuidedLibraryIndex(lookupName, library.map((item) => item.name));
    return index === null ? null : library[index];
  }, [name, library]);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [name]);

  const imageUrl = match?.imageUrls?.[0] ?? null;
  const muscle = match?.primaryMuscles?.[0] ?? null;

  // The media zone always shows the flat photo (or initials). Exercises that
  // have a 3D rig get a button in the top-right corner that opens the animated
  // "how it's done" sheet — so the 3D only renders on demand, never during
  // normal training. Warmup drills never have a rig. The muscle chip was
  // dropped in the v4 pass (user: the label added nothing on any exercise).
  const has3D = showActions && mode !== 'drill' && hasExercise3D(name);
  const [sheetOpen, setSheetOpen] = useState(false);

  const overlays = (
    <>
      {has3D ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Watch how ${name} is done`}
            onPress={() => setSheetOpen(true)}
            style={styles.media3dButton}
            hitSlop={8}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={HG.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <Path d="M15 10.5 20 7.5v9l-5-3z" />
            </Svg>
          </Pressable>
          <Exercise3DSheet
            name={name}
            muscle={muscle}
            instructions={match?.instructions ?? undefined}
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        </>
      ) : null}
    </>
  );

  if (imageUrl && !imageFailed) {
    return (
      <View style={[styles.mediaZone, { height, backgroundColor: '#FFFFFF', borderColor: '#E6DAF8' }]}>
        <Image
          source={{ uri: imageUrl }}
          resizeMode={fit}
          style={{ width: '100%', height: '100%' }}
          onError={() => setImageFailed(true)}
        />
        {overlays}
      </View>
    );
  }

  const initials = getGuidedInitials(name);
  return (
    <View style={[styles.mediaZone, { height, backgroundColor: '#E9DCFA', borderColor: '#E6DAF8' }]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="gpPanel" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F1E9FF" />
              <Stop offset="0.6" stopColor="#E4D5FB" />
              <Stop offset="1" stopColor="#DCCBF8" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gpPanel)" />
        </Svg>
      </View>
      <Text style={styles.mediaInitials}>{initials}</Text>
      {overlays}
    </View>
  );
}

/**
 * Rest countdown drawn as a draining ring. `plannedSeconds` sets the full
 * circle; ±15s can push the remaining time past it, so the ring grows to the
 * largest value it has seen for this rest instead of overflowing.
 */
function RestRing({
  stepKey,
  leftSeconds,
  plannedSeconds,
  size = 244,
  children,
}: {
  stepKey: number;
  leftSeconds: number;
  plannedSeconds: number;
  size?: number;
  children: React.ReactNode;
}) {
  const [total, setTotal] = useState(Math.max(1, plannedSeconds));

  useEffect(() => {
    setTotal(Math.max(1, plannedSeconds));
  }, [stepKey, plannedSeconds]);

  useEffect(() => {
    setTotal((current) => (leftSeconds > current ? leftSeconds : current));
  }, [leftSeconds]);

  const strokeWidth = 10;
  const radius = (size - strokeWidth * 1.6) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, leftSeconds / total));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E9E1FA" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={HG.purple}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          // Start the arc at 12 o'clock and drain clockwise.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ── shared small components ── */
function TopBar({
  dark,
  label,
  muted,
  onMute,
  onExit,
  video,
}: {
  dark: boolean;
  label: string;
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  /**
   * Set screen v4: the right slot shows the how-it's-done camera instead of
   * mute, and mute moves down beside pause.
   */
  video?: { label: string; onPress: () => void } | null;
}) {
  const iconColor = dark ? GPD.ink : HG.ink;
  const buttonStyle = [styles.topBtn, dark ? styles.topBtnDark : null];
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onExit} style={buttonStyle} hitSlop={8}>
        <GPIcon name="x" size={19} color={iconColor} />
      </Pressable>
      <Text style={[styles.topLabel, { color: dark ? GPD.muted : HG.muted }]} numberOfLines={1}>
        {label}
      </Text>
      {video ? (
        <Pressable accessibilityRole="button" accessibilityLabel={video.label} onPress={video.onPress} style={buttonStyle} hitSlop={8}>
          <GPIcon name="video" size={20} color={iconColor} sw={2.1} />
        </Pressable>
      ) : (
        <Pressable onPress={onMute} style={buttonStyle} hitSlop={8}>
          <GPIcon name={muted ? 'mute' : 'sound'} size={19} color={muted ? (dark ? GPD.faint : HG.faint) : iconColor} />
        </Pressable>
      )}
    </View>
  );
}

function ProgressRail({
  groups,
  current,
  dark,
  dotIndex,
  dotsDone,
}: {
  groups: Array<{ phase: string; setCount?: number }>;
  current: number;
  dark: boolean;
  dotIndex: number;
  dotsDone: number;
}) {
  return (
    <View style={styles.rail}>
      {groups.map((group, index) => {
        const isCurrent = index === current;
        const done = index < current;
        const phaseGap = index > 0 && group.phase !== groups[index - 1].phase ? 9 : 0;
        if (isCurrent && (group.setCount ?? 0) > 1) {
          return (
            <View
              key={index}
              style={[
                styles.railSetPill,
                {
                  marginLeft: 5 + phaseGap,
                  backgroundColor: dark ? 'rgba(155,109,255,0.25)' : HG.purpleLight,
                  borderColor: dark ? GPD.purple : HG.purple,
                },
              ]}
            >
              {Array.from({ length: group.setCount ?? 0 }).map((_, dot) => (
                <View
                  key={dot}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      dot < dotsDone
                        ? dark
                          ? GPD.purple
                          : HG.purple
                        : dot === dotIndex
                          ? dark
                            ? GPD.ink
                            : HG.purple
                          : dark
                            ? 'rgba(255,255,255,0.25)'
                            : '#CFC3EA',
                    opacity: dot === dotIndex && dot >= dotsDone ? 0.9 : 1,
                  }}
                />
              ))}
            </View>
          );
        }
        return (
          <View
            key={index}
            style={{
              flex: isCurrent ? 2 : 1,
              marginLeft: index === 0 ? 0 : 5 + phaseGap,
              height: isCurrent ? 7 : 5,
              borderRadius: 999,
              backgroundColor:
                done || isCurrent ? (dark ? GPD.purple : HG.purple) : dark ? 'rgba(255,255,255,0.14)' : '#E4DBF5',
              opacity: done ? 0.85 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

function NextLine({ text, dark, language }: { text: string | null; dark: boolean; language: AppLanguage }) {
  if (!text) {
    return <View style={{ height: 20 }} />;
  }
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 26 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: dark ? GPD.muted : HG.muted }} numberOfLines={1}>
        <Text style={{ color: dark ? GPD.faint : HG.faint }}>{t(language, 'guided.next.prefix')}</Text>
        {text}
      </Text>
    </View>
  );
}

function NameBlock({
  name,
  hasHowTo,
  language,
  onHow,
}: {
  name: string;
  hasHowTo: boolean;
  language: AppLanguage;
  onHow: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 26, alignItems: 'center' }}>
      <Text style={styles.exerciseName} numberOfLines={2}>
        {exerciseNameLabel(language, name)}
      </Text>
      {hasHowTo ? (
        <Pressable onPress={onHow} style={styles.cueRow}>
          <Text style={styles.howToLink}>{t(language, 'guided.howTo')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CtrlBtn({
  icon,
  label,
  onPress,
  big,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  big?: boolean;
}) {
  const size = big ? 62 : 52;
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 66 }}>
      <View style={[styles.ctrlCircle, { width: size, height: size }]}>
        <GPIcon name={icon} size={big ? 24 : 21} color={HG.ink} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: HG.muted }}>{label}</Text>
    </Pressable>
  );
}

function BigBtn({
  label,
  onPress,
  color = HG.green,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.bigBtn, { backgroundColor: color, opacity: disabled ? 0.6 : 1, shadowColor: color }]}
    >
      <GPIcon name="check" size={20} color="#fff" sw={2.6} />
      <Text style={styles.bigBtnText}>{label}</Text>
    </Pressable>
  );
}

function GhostBtn({
  label,
  onPress,
  icon,
  dark,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  dark?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.ghostBtn,
        dark ? { borderColor: GPD.line, backgroundColor: 'rgba(255,255,255,0.06)' } : null,
      ]}
    >
      {icon ? <GPIcon name={icon} size={17} color={dark ? GPD.ink : HG.ink} /> : null}
      <Text style={[styles.ghostBtnText, dark ? { color: GPD.ink } : null]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  unit,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1, color: HG.muted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable style={styles.stepperBtn} onPress={() => onChange(Math.max(min, Number((value - step).toFixed(1))))}>
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>
        <View style={{ minWidth: 58, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: HG.ink, fontVariant: ['tabular-nums'] }}>
            {removeTrailingZeros(value)}
          </Text>
          {unit ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: HG.muted, marginLeft: 2 }}>{unit}</Text> : null}
        </View>
        <Pressable style={styles.stepperBtn} onPress={() => onChange(Number((value + step).toFixed(1)))}>
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── bottom sheet ── */
function GPSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ══════════════════════════════ screen ══════════════════════════════ */

export function GuidedPlayerScreen({
  unitPreference,
  language = 'en',
  exerciseLibrary,
  soundCuesEnabled,
  keepScreenAwake = false,
  onToggleSoundCues,
  entryEyebrow,
  weekProgress,
  nextUp,
  onLeave,
  onSwitchToListView,
  onEndSession,
  onFinishSession,
  isSavingWorkout,
}: GuidedPlayerScreenProps) {
  const workout = useWorkoutContext();
  const session = workout.activeSession;
  useKeepScreenAwake(keepScreenAwake, 'guided-player');

  // The catalog names sessions in English; the focus half of the name reads in
  // the user's language, the plan brand in front of it does not.
  const sessionTitle = localizeWorkoutFocus(getGuidedSessionTitle(session?.templateName ?? '', language), language);

  const warmupDrills = useMemo<GuidedDrill[]>(
    () => buildGuidedDrillsFromBlock(getDefaultWarmup(sessionTitle, language)),
    [sessionTitle, language],
  );
  const cooldownDrills = useMemo<GuidedDrill[]>(
    () => buildGuidedDrillsFromBlock(getDefaultCooldown(sessionTitle, language)),
    [sessionTitle, language],
  );

  const exercises = session?.exercises ?? [];
  const stepPlan = useMemo(
    () =>
      buildGuidedSteps(
        {
          warmup: warmupDrills,
          exercises: exercises.map((exercise) => ({
            slotId: exercise.slotId,
            name: exercise.exerciseName,
            restSeconds: exercise.restSecondsMin,
            setCount: exercise.sets.length,
            skipped: exercise.status === 'skipped',
          })),
          cooldown: cooldownDrills,
        },
        language,
      ),
    // Rebuild only when the structural shape changes, not on every set log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      warmupDrills,
      cooldownDrills,
      language,
      exercises.map((exercise) => `${exercise.slotId}:${exercise.sets.length}:${exercise.status === 'skipped' ? 's' : ''}`).join('|'),
    ],
  );
  const { steps, groups } = stepPlan;

  const exerciseBySlot = useMemo(() => {
    const map = new Map<string, WorkoutExerciseInstance>();
    exercises.forEach((exercise) => map.set(exercise.slotId, exercise));
    return map;
  }, [exercises]);

  const isSetCompleted = useCallback(
    (slotId: string, setIndex: number) =>
      exerciseBySlot.get(slotId)?.sets.find((set) => set.setIndex === setIndex)?.status === 'completed',
    [exerciseBySlot],
  );

  const resolveTarget = useCallback(
    (slotId: string, setIndex: number): GuidedSetTarget | null => {
      const exercise = exerciseBySlot.get(slotId);
      if (!exercise) {
        return null;
      }
      return resolveGuidedSetTarget(exercise.sets, setIndex, exercise.trackingMode);
    },
    [exerciseBySlot],
  );

  /* ── mode + step position ── */
  const [mode, setMode] = useState<'entry' | 'player'>('entry');
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const step: GuidedStep = steps[Math.min(stepIndex, steps.length - 1)] ?? { type: 'finish' };

  /* ── timers ── */
  const [remainingMs, setRemainingMs] = useState(0);
  const remainingRef = useRef(0);
  /**
   * Wall-clock deadline for the running step. Android throttles (and with the
   * screen off, stops) JS timers in the background, so the remaining time is
   * derived from the clock instead of accumulated ticks — a rest keeps running
   * while the phone is pocketed and is correct the moment we come back.
   * Null while paused or on an untimed step.
   */
  const endsAtRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const lastBeepSecondRef = useRef<number | null>(null);
  /**
   * The in-app timer cannot fire while Android has our JS suspended, so a rest
   * deadline is handed to the system as a scheduled notification too. Dropped
   * the moment the rest is skipped, paused, adjusted or finished in-app.
   */
  const syncRestNotification = useRestEndAlert(language);

  const [paused, setPaused] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  // v4 set screen: the top-bar camera opens the 3D rig from screen level, so
  // the media zone no longer carries its own button.
  const [setVideoOpen, setSetVideoOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const frozen = paused || howtoOpen || exitOpen || pauseSheetOpen;

  const stepSeconds = (target: GuidedStep): number => {
    switch (target.type) {
      case 'ready':
        return 3;
      case 'drill':
      case 'rest':
      case 'position':
        return target.seconds;
      case 'splash':
        return SPLASH_MS / 1000;
      default:
        return 0;
    }
  };

  // The speaker button drives the persistent "Cue sounds" preference, so the
  // in-workout shortcut and the settings toggle stay one source of truth.
  const muted = !soundCuesEnabled;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const cue = useCallback((kind: CueSound) => {
    // Haptics always fire — the speaker toggle silences audio only, and a buzz
    // is the discreet channel anyway.
    if (kind === 'tick') {
      void haptics.select();
    } else if (kind === 'go' || kind === 'rest') {
      void haptics.impactMedium();
    } else {
      void haptics.success();
    }
    if (mutedRef.current) {
      return;
    }
    sound[kind]();
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(0, index), steps.length - 1);
      setPaused(false);
      setPauseSheetOpen(false);
      setHowtoOpen(false);
      const target = steps[clamped];
      remainingRef.current = stepSeconds(target) * 1000;
      setRemainingMs(remainingRef.current);
      firedRef.current = false;
      lastBeepSecondRef.current = null;
      setStepIndex(clamped);
      workout.setGuidedStep(clamped);
      if (target.type === 'drill') {
        cue('go');
      } else if (target.type === 'finish') {
        cue('finish');
      }
    },
    [steps, workout, cue],
  );

  /** ±15s / +10s: shift the leftover time, the deadline and any pending alert. */
  const adjustRemaining = (deltaMs: number, floorMs = 0) => {
    const next = Math.max(floorMs, remainingRef.current + deltaMs);
    remainingRef.current = next;
    if (endsAtRef.current !== null) {
      endsAtRef.current = Date.now() + next;
      if (step.type === 'rest') {
        void syncRestNotification(endsAtRef.current, exerciseNameLabel(language, getGuidedNextName(steps, stepIndex) ?? ''));
      }
    }
    setRemainingMs(next);
  };

  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const advance = useCallback(() => {
    goToRef.current(Math.min(stepIndex + 1, steps.length - 1));
  }, [stepIndex, steps.length]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (mode !== 'player' || frozen) {
      // Pausing freezes the leftover time; the deadline is re-derived on resume.
      endsAtRef.current = null;
      return;
    }
    const timed = step.type === 'ready' || step.type === 'drill' || step.type === 'rest' || step.type === 'position' || step.type === 'splash';
    if (!timed) {
      endsAtRef.current = null;
      return;
    }

    endsAtRef.current = Date.now() + Math.max(0, remainingRef.current);

    // A rest is the one wait long enough to put the phone down for, so its
    // deadline also goes to the OS — that alert is what reaches the user when
    // Android has suspended us.
    if (step.type === 'rest') {
      void syncRestNotification(endsAtRef.current, exerciseNameLabel(language, getGuidedNextName(steps, stepIndex) ?? ''));
    }

    const settle = () => {
      const endsAt = endsAtRef.current;
      if (endsAt === null) {
        return;
      }
      const previous = remainingRef.current;
      const next = endsAt - Date.now();
      remainingRef.current = next;

      // 3·2·1 ticks on drills/rests/ready.
      if (step.type !== 'splash') {
        const previousSecond = Math.ceil(previous / 1000);
        const nextSecond = Math.ceil(Math.max(next, 0) / 1000);
        if (nextSecond < previousSecond && nextSecond <= 3 && nextSecond >= 1 && lastBeepSecondRef.current !== nextSecond) {
          lastBeepSecondRef.current = nextSecond;
          cue('tick');
        }
      }

      if (next <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          clearInterval(interval);
          // Rest running out is the one transition the user may not be looking
          // at — but a cue fired minutes late (we were backgrounded when it
          // expired) is noise, so only sound it if we caught the moment.
          if (step.type === 'rest' && next > -1500) {
            cue('rest');
          }
          advanceRef.current();
        }
        return;
      }
      setRemainingMs(next);
    };

    const interval = setInterval(settle, 100);
    // Coming back from background: reconcile with the clock immediately rather
    // than waiting for the next tick.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        settle();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      // Leaving the rest — by advancing, skipping or pausing — retires its alert.
      void syncRestNotification(null, null);
    };
  }, [mode, frozen, stepIndex, step.type, cue, steps, syncRestNotification]);

  /* ── hardware back: exit sheet in player, plain leave on entry ── */
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'player') {
        setExitOpen(true);
        return true;
      }
      onLeave();
      return true;
    });
    return () => handler.remove();
  }, [mode, onLeave]);

  if (!session) {
    return <View style={{ flex: 1, backgroundColor: HG.bg }} />;
  }

  const completedSetCount = exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.status === 'completed').length,
    0,
  );

  /* ── actions ── */
  const startAt = (index: number) => {
    setMode('player');
    goTo(index);
  };

  const resumeIndex = resolveGuidedResumeIndex(steps, session.ui.guidedStepIndex ?? null, isSetCompleted);
  const showResume = resumeIndex > 0 && steps[resumeIndex]?.type !== 'finish';

  const confirmSet = (slotId: string, setIndex: number, reps: number, loadKg: number | null) => {
    workout.updateSetDraft(slotId, setIndex, {
      repsText: String(reps),
      loadText: loadKg === null ? '' : removeTrailingZeros(loadKg),
    });
    workout.completeSet(slotId, setIndex, unitPreference);
    cue('done');
    advance();
  };

  const skipCurrent = () => {
    goTo(getGuidedSkipTargetIndex(steps, stepIndex));
  };

  const backOne = () => {
    const target = getGuidedBackTargetIndex(steps, stepIndex);
    const targetStep = steps[target];
    if (targetStep?.type === 'set' && isSetCompleted(targetStep.slotId, targetStep.setIndex)) {
      workout.undoSet(targetStep.slotId, targetStep.setIndex);
    }
    goTo(target);
  };

  const handleEndSession = () => {
    setExitOpen(false);
    if (completedSetCount > 0) {
      Alert.alert('End session?', `${completedSetCount} logged set${completedSetCount === 1 ? '' : 's'} will be discarded.`, [
        { text: 'Keep training', style: 'cancel' },
        { text: 'End session', style: 'destructive', onPress: onEndSession },
      ]);
      return;
    }
    onEndSession();
  };

  // Only the finish celebration goes dark — rest stays on the light theme.
  const dark = mode === 'player' && step.type === 'finish';
  const nextPreview = mode === 'player' ? getGuidedNextPreview(steps, stepIndex, resolveTarget, language) : null;

  const libraryFor = (name: string) => {
    const index = findGuidedLibraryIndex(name, exerciseLibrary.map((item) => item.name));
    return index === null ? null : exerciseLibrary[index];
  };

  /* ── entry data ── */
  const workStart = findGuidedPhaseStart(steps, 'work');
  const cooldownStart = findGuidedPhaseStart(steps, 'cooldown');
  const activeExercises = exercises.filter((exercise) => exercise.status !== 'skipped' && exercise.sets.length > 0);
  const totalSets = activeExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const durationMinutes = estimateGuidedDurationMinutes(steps);
  const warmupSecondsTotal = warmupDrills.reduce((sum, drill) => sum + drill.seconds + 3, 0);
  const cooldownSecondsTotal = cooldownDrills.reduce((sum, drill) => sum + drill.seconds + 3, 0);

  const secondsLeft = remainingMs / 1000;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? GPD.bg2 : HG.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} backgroundColor={dark ? GPD.bg1 : HG.bg} />
      {dark ? (
        <View style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <SvgLinearGradient id="gpDark" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={GPD.bg1} />
                <Stop offset="1" stopColor={GPD.bg2} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#gpDark)" />
          </Svg>
        </View>
      ) : null}

      {mode === 'entry' && (
        <StepIn stepKey="entry">
          <View style={styles.entryRoot}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.entryEyebrow}>{entryEyebrow}</Text>
              <Pressable onPress={onLeave} style={styles.topBtn} hitSlop={8}>
                <GPIcon name="x" size={19} color={HG.ink} />
              </Pressable>
            </View>
            <Text style={styles.entryTitle} numberOfLines={2}>
              {sessionTitle}
            </Text>
            <Text style={styles.entrySub}>
              {[
                activeExercises.length === 1
                  ? t(language, 'guided.count.exerciseOne')
                  : t(language, 'guided.count.exerciseMany', { count: activeExercises.length }),
                t(language, 'guided.count.sets', { count: totalSets }),
                t(language, 'guided.entry.duration', { min: durationMinutes }),
              ].join(' · ')}
            </Text>

            {showResume && (
              <Pressable style={styles.resumeCard} onPress={() => startAt(resumeIndex)}>
                <GPIcon name="play" size={18} color={HG.purpleDark} sw={2.4} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: HG.purpleDark }}>
                    {t(language, 'guided.entry.resume')}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: HG.purple, marginTop: 1 }} numberOfLines={1}>
                    {getGuidedStepLabel(steps[resumeIndex], language)}
                  </Text>
                </View>
                <GPIcon name="chevR" size={17} color={HG.purpleDark} />
              </Pressable>
            )}

            <ScrollView
              style={{ flex: 1, marginTop: 18 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {[
                warmupDrills.length > 0
                  ? {
                      key: 'warmup',
                      label: t(language, 'guided.phase.warmup'),
                      sub: `${t(language, 'guided.count.timedDrills', { count: warmupDrills.length })} · ${t(language, 'guided.entry.duration', { min: Math.max(1, Math.round(warmupSecondsTotal / 60)) })}`,
                      rows: warmupDrills.map((drill) => ({ left: drill.name, right: formatDrillLength(drill.seconds) })),
                    }
                  : null,
                workStart !== null
                  ? {
                      key: 'work',
                      label: t(language, 'guided.phase.workout'),
                      sub: `${
                        activeExercises.length === 1
                          ? t(language, 'guided.count.exerciseOne')
                          : t(language, 'guided.count.exerciseMany', { count: activeExercises.length })
                      } · ${t(language, 'guided.count.sets', { count: totalSets })}`,
                      rows: activeExercises.map((exercise) => ({
                        left: exercise.exerciseName,
                        right: `${exercise.sets.length} × ${formatRepRangeLabel(exercise.sets[0])}`,
                      })),
                    }
                  : null,
                cooldownStart !== null
                  ? {
                      key: 'cooldown',
                      label: t(language, 'guided.phase.cooldown'),
                      sub: `${t(language, 'guided.count.stretchMany', { count: cooldownDrills.length })} · ${cooldownSecondsTotal < 90 ? `~${Math.round(cooldownSecondsTotal / 5) * 5} sec` : t(language, 'guided.entry.duration', { min: Math.round(cooldownSecondsTotal / 60) })}`,
                      rows: cooldownDrills.map((drill) => ({ left: drill.name, right: formatDrillLength(drill.seconds) })),
                    }
                  : null,
              ]
                .filter(
                  (item): item is { key: string; label: string; sub: string; rows: Array<{ left: string; right: string }> } =>
                    item !== null,
                )
                .map((phase) => {
                  const expanded = expandedPhases.includes(phase.key);
                  return (
                    <View key={phase.key} style={styles.phaseCard}>
                      <Pressable
                        style={styles.phaseHeader}
                        onPress={() =>
                          setExpandedPhases((current) =>
                            current.includes(phase.key)
                              ? current.filter((key) => key !== phase.key)
                              : [...current, phase.key],
                          )
                        }
                      >
                        <View style={styles.phasePlay}>
                          <GPIcon name="play" size={17} color={HG.purple} sw={2.4} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 17.5, fontWeight: '800', color: HG.ink }}>{phase.label}</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: HG.muted, marginTop: 3 }}>{phase.sub}</Text>
                        </View>
                        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                          <GPIcon name="chevR" size={18} color={HG.faint} />
                        </View>
                      </Pressable>
                      {expanded && (
                        <View style={styles.phaseRows}>
                          {phase.rows.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.phaseRow}>
                              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: HG.ink }} numberOfLines={1}>
                                {row.left}
                              </Text>
                              <Text style={{ fontSize: 13.5, fontWeight: '600', color: HG.muted, fontVariant: ['tabular-nums'] }}>
                                {row.right}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
            </ScrollView>

            <Pressable style={styles.startCta} onPress={() => startAt(0)}>
              <GPIcon name="play" size={19} color="#fff" sw={2.5} />
              <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#fff' }}>{t(language, 'guided.entry.start')}</Text>
            </Pressable>
          </View>
        </StepIn>
      )}

      {mode === 'player' && step.type !== 'finish' && (
        <>
          <TopBar
            dark={dark}
            label={getGuidedPhaseLabel(step, language)}
            muted={muted}
            onMute={() => onToggleSoundCues(!soundCuesEnabled)}
            onExit={() => setExitOpen(true)}
            // v4: on a set the right slot teaches the movement; mute moves down.
            video={
              step.type === 'set'
                ? {
                    label: t(language, 'guided.a11y.watchHowTo', { name: step.exerciseName }),
                    onPress: () =>
                      hasExercise3D(step.exerciseName) ? setSetVideoOpen(true) : setHowtoOpen(true),
                  }
                : null
            }
          />

          {step.type === 'splash' && (
            <StepIn stepKey={`splash-${stepIndex}`}>
              <Pressable style={styles.splashRoot} onPress={advance}>
                {step.doneLabel ? (
                  <PopIn popKey={stepIndex}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <View style={styles.splashCheck}>
                        <GPIcon name="check" size={16} color={HG.green} sw={2.8} />
                      </View>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: HG.green }}>{step.doneLabel}</Text>
                    </View>
                  </PopIn>
                ) : null}
                <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 2, color: HG.muted }}>
                  {t(language, 'guided.upNext')}
                </Text>
                <Text style={styles.splashTitle}>{step.title}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: HG.muted }}>{step.sub}</Text>
              </Pressable>
            </StepIn>
          )}

          {step.type === 'ready' && (
            <StepIn stepKey={`ready-${stepIndex}`}>
              <View style={styles.splashRoot}>
                <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 2, color: HG.purple }}>
                  {t(language, 'guided.getReady')}
                </Text>
                <PopIn popKey={Math.max(1, Math.ceil(secondsLeft))}>
                  <Text style={styles.readyDigit}>{Math.max(1, Math.ceil(secondsLeft))}</Text>
                </PopIn>
                <Text style={{ fontSize: 22, fontWeight: '800', color: HG.ink, marginTop: 16, textAlign: 'center' }}>
                  {step.drillName}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: HG.muted, marginTop: 4 }}>{step.seconds}s</Text>
              </View>
            </StepIn>
          )}

          {step.type === 'drill' && (
            <StepIn stepKey={`drill-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                <MediaZone name={step.drillName} library={exerciseLibrary} height={270} mode="drill" />
                <View style={{ height: 20 }} />
                <NameBlock
                  name={step.drillName}
                  hasHowTo={Boolean(libraryFor(step.drillName)?.instructions?.length)}
                  language={language}
                  onHow={() => setHowtoOpen(true)}
                />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                  <Text
                    style={[
                      styles.drillCountdown,
                      { color: secondsLeft <= 3.05 ? HG.green : HG.ink },
                    ]}
                  >
                    {formatGuidedCountdown(secondsLeft)}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.7, color: HG.muted, marginTop: 6 }}>
                    {t(language, 'guided.secondsLeft')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, paddingBottom: 12 }}>
                  <CtrlBtn
                    icon="plus"
                    label="+10s"
                    onPress={() => adjustRemaining(10000)}
                  />
                  <CtrlBtn
                    icon={paused ? 'play' : 'pause'}
                    label={t(language, paused ? 'guided.resume' : 'guided.pause')}
                    big
                    onPress={() => {
                      if (paused) {
                        setPaused(false);
                      } else {
                        setPaused(true);
                        setPauseSheetOpen(true);
                      }
                    }}
                  />
                  <CtrlBtn icon="skip" label={t(language, 'guided.skip')} onPress={skipCurrent} />
                </View>
                <NextLine text={nextPreview?.line ?? null} dark={false} language={language} />
              </View>
            </StepIn>
          )}

          {step.type === 'position' && (
            <StepIn stepKey={`position-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                <MediaZone name={step.exerciseName} library={exerciseLibrary} height={300} mode="position" />
                <View style={{ height: 16 }} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 2, color: HG.purple, textAlign: 'center' }}>
                  {t(language, 'guided.getIntoPosition')}
                </Text>
                <View style={{ height: 6 }} />
                <NameBlock
                  name={step.exerciseName}
                  // Exercises with a 3D rig teach the movement inside that sheet.
                  hasHowTo={
                    Boolean(libraryFor(step.exerciseName)?.instructions?.length) && !hasExercise3D(step.exerciseName)
                  }
                  language={language}
                  onHow={() => setHowtoOpen(true)}
                />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: HG.muted }}>{t(language, 'guided.firstSet')}</Text>
                  <Text style={styles.positionTarget}>
                    {(() => {
                      const target = resolveTarget(step.slotId, 0);
                      return target ? formatGuidedTarget(target, language) : '';
                    })()}
                  </Text>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: HG.faint, marginTop: 8 }}>
                    {t(language, 'guided.startingIn', { time: formatGuidedCountdown(secondsLeft) })}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
                  <BigBtn label={t(language, 'guided.imReady')} onPress={advance} />
                </View>
              </View>
            </StepIn>
          )}

          {step.type === 'set' && (
            <SetStepView
              key={`set-${stepIndex}`}
              stepIndex={stepIndex}
              step={step}
              exercise={exerciseBySlot.get(step.slotId) ?? null}
              library={exerciseLibrary}
              language={language}
              elapsedSeconds={session.elapsedSeconds}
              muted={muted}
              paused={paused}
              resolveTarget={resolveTarget}
              nextName={exerciseNameLabel(language, getGuidedNextName(steps, stepIndex) ?? '')}
              onToggleMute={() => onToggleSoundCues(!soundCuesEnabled)}
              onPause={() => {
                setPaused(true);
                setPauseSheetOpen(true);
              }}
              onSwitchToList={onSwitchToListView}
              onConfirm={confirmSet}
            />
          )}

          {step.type === 'rest' && (
            <StepIn stepKey={`rest-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <RestRing stepKey={stepIndex} leftSeconds={secondsLeft} plannedSeconds={step.seconds}>
                    <Text style={styles.restRingLabel}>{t(language, 'guided.rest')}</Text>
                    <Text style={styles.restCountdown}>{formatGuidedCountdown(secondsLeft)}</Text>
                    {paused ? (
                      <Text style={{ fontSize: 13, fontWeight: '800', color: HG.muted, letterSpacing: 1.6 }}>
                        {t(language, 'guided.paused')}
                      </Text>
                    ) : null}
                  </RestRing>
                </View>
                <View style={{ paddingHorizontal: 24, paddingBottom: 10, gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <GhostBtn label="−15s" onPress={() => adjustRemaining(-15000, 1000)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GhostBtn label="+15s" onPress={() => adjustRemaining(15000)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        icon={paused ? 'play' : 'pause'}
                        label={t(language, paused ? 'guided.resume' : 'guided.pause')}
                        onPress={() => setPaused((value) => !value)}
                      />
                    </View>
                  </View>
                  <Pressable style={styles.skipRestBtn} onPress={advance}>
                    <GPIcon name="skip" size={18} color="#fff" />
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>{t(language, 'guided.skipRest')}</Text>
                  </Pressable>
                </View>
                <ProgressRail
                  groups={groups}
                  current={step.groupIndex}
                  dark={false}
                  dotIndex={step.setIndex}
                  dotsDone={exerciseBySlot.get(step.slotId)?.sets.filter((set) => set.status === 'completed').length ?? 0}
                />
              </View>
            </StepIn>
          )}

          {(step.type === 'drill' || step.type === 'set' || step.type === 'ready' || step.type === 'position') && (
            <ProgressRail
              groups={groups}
              current={step.groupIndex}
              dark={false}
              dotIndex={step.type === 'set' ? step.setIndex : 0}
              dotsDone={
                step.type === 'set' || step.type === 'position'
                  ? exerciseBySlot.get(step.slotId)?.sets.filter((set) => set.status === 'completed').length ?? 0
                  : 0
              }
            />
          )}
        </>
      )}

      {mode === 'player' && step.type === 'finish' && (
        <FinishView
          sessionTitle={sessionTitle}
          elapsedSeconds={session.elapsedSeconds}
          exercises={exercises}
          history={workout.history}
          weekProgress={weekProgress}
          nextUp={nextUp}
          isSaving={isSavingWorkout}
          language={language}
          onFinish={onFinishSession}
        />
      )}

      {step.type === 'set' ? (
        <Exercise3DSheet
          name={step.exerciseName}
          muscle={libraryFor(step.exerciseName)?.primaryMuscles?.[0] ?? null}
          instructions={libraryFor(step.exerciseName)?.instructions ?? undefined}
          visible={setVideoOpen}
          onClose={() => setSetVideoOpen(false)}
        />
      ) : null}

      {howtoOpen && (
        <HowToSheetView
          libraryItem={
            step.type === 'drill' || step.type === 'ready'
              ? libraryFor(step.drillName)
              : step.type === 'set' || step.type === 'position'
                ? libraryFor(step.exerciseName)
                : null
          }
          fallbackName={getGuidedStepLabel(step, language)}
          onClose={() => {
            setHowtoOpen(false);
          }}
        />
      )}

      {exitOpen && (
        <GPSheet onClose={() => setExitOpen(false)}>
          <Text style={styles.sheetTitle}>{t(language, 'guided.exit.title')}</Text>
          <View style={{ gap: 10 }}>
            <BigBtn label={t(language, 'guided.exit.keep')} onPress={() => setExitOpen(false)} />
            <GhostBtn icon="list" label={t(language, 'guided.exit.list')} onPress={onSwitchToListView} />
            <GhostBtn icon="x" label={t(language, 'guided.exit.end')} onPress={handleEndSession} />
          </View>
          <Text style={styles.sheetFootnote}>{t(language, 'guided.exit.footnote')}</Text>
        </GPSheet>
      )}

      {pauseSheetOpen && (
        <GPSheet
          onClose={() => {
            setPauseSheetOpen(false);
            setPaused(false);
          }}
        >
          <Text style={styles.sheetTitle}>{t(language, 'guided.pauseSheet.title')}</Text>
          <View style={{ gap: 10 }}>
            <BigBtn
              label={t(language, 'guided.resume')}
              color={HG.purple}
              onPress={() => {
                setPauseSheetOpen(false);
                setPaused(false);
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <GhostBtn icon="back" label={t(language, 'guided.pauseSheet.backOne')} onPress={backOne} />
              </View>
              <View style={{ flex: 1 }}>
                <GhostBtn icon="skip" label={t(language, 'guided.pauseSheet.skipThis')} onPress={skipCurrent} />
              </View>
            </View>
          </View>
        </GPSheet>
      )}
    </View>
  );
}

/** "3 min" for whole minutes, otherwise plain seconds ("50s"). */
function formatDrillLength(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  if (seconds >= 90) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

/** "3–5" from the planned rep range, collapsing equal bounds to "5". */
function formatRepRangeLabel(set: { plannedRepsMin: number; plannedRepsMax: number } | undefined): string {
  if (!set) {
    return '';
  }
  if (set.plannedRepsMin === set.plannedRepsMax) {
    return `${set.plannedRepsMax}`;
  }
  return `${set.plannedRepsMin}–${set.plannedRepsMax}`;
}

/**
 * Session clock for the set screen's top-right readout: m:ss, growing to
 * h:mm:ss so a session left running overnight stays readable.
 */
function formatSessionClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const seconds = String(safe % 60).padStart(2, '0');
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) {
    return `${minutes}:${seconds}`;
  }
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${seconds}`;
}

/**
 * One number + its unit in the v4 target block. Same hand as every other
 * figure in the player (ExtraBold, tabular, tight tracking) so the set screen
 * doesn't read as a different typeface from the countdowns and labels.
 */
function TargetNumber({ value, unit, size }: { value: string | number; unit: string; size: number }) {
  return (
    <Text
      style={{
        fontSize: size,
        fontWeight: '800',
        letterSpacing: -size * 0.038,
        color: HG.ink,
        lineHeight: size * 1.05,
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
      {unit ? (
        <Text style={{ fontSize: size * 0.34, fontWeight: '800', color: HG.faint, letterSpacing: 0 }}>{unit}</Text>
      ) : null}
    </Text>
  );
}

/* ── strength set step v4 (owns the reps/kg steppers) ── */
function SetStepView({
  stepIndex,
  step,
  exercise,
  library,
  language,
  elapsedSeconds,
  muted,
  paused,
  resolveTarget,
  nextName,
  onToggleMute,
  onPause,
  onSwitchToList,
  onConfirm,
}: {
  stepIndex: number;
  step: Extract<GuidedStep, { type: 'set' }>;
  exercise: WorkoutExerciseInstance | null;
  library: ExerciseLibraryItem[];
  language: AppLanguage;
  elapsedSeconds: number;
  muted: boolean;
  paused: boolean;
  resolveTarget: (slotId: string, setIndex: number) => GuidedSetTarget | null;
  nextName: string | null;
  onToggleMute: () => void;
  onPause: () => void;
  onSwitchToList: () => void;
  onConfirm: (slotId: string, setIndex: number, reps: number, loadKg: number | null) => void;
}) {
  const target = resolveTarget(step.slotId, step.setIndex);
  const bodyweight = exercise?.trackingMode === 'bodyweight';
  const [edit, setEdit] = useState(false);
  const [reps, setReps] = useState(target?.reps ?? 8);
  const [kg, setKg] = useState(target?.loadKg ?? 0);

  useEffect(() => {
    setEdit(false);
    setReps(target?.reps ?? 8);
    setKg(target?.loadKg ?? 0);
    // Re-derive when the step changes (target identity follows the step).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Reps carry the big figure; weight only appears when the lift is loaded.
  const repsSize = bodyweight || kg <= 0 ? 98 : 84;

  return (
    <StepIn stepKey={`set-${stepIndex}`}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <MediaZone name={step.exerciseName} library={library} height={236} mode="set" showActions={false} fit="cover" />

        {/* set counter + dots on the left, session clock on the right */}
        <View style={styles.setMetaRow}>
          <View style={styles.setMetaLeft}>
            <Text style={styles.setCounter}>
              {t(language, 'guided.setOfCount', { index: step.setIndex + 1, count: step.setCount })}
            </Text>
            <View style={styles.setDots}>
              {Array.from({ length: step.setCount }).map((_, index) => {
                const done = index < step.setIndex;
                const current = index === step.setIndex;
                return (
                  <View
                    key={index}
                    style={[
                      styles.setDot,
                      { borderColor: done || current ? HG.purple : HG.faint },
                      done && { backgroundColor: HG.purple },
                    ]}
                  >
                    {done ? <GPIcon name="check" size={12} color="#FFFFFF" sw={3} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.setClock}>
            <GPIcon name="clock" size={19} color={HG.muted} sw={2} />
            <Text style={styles.setClockText}>{formatSessionClock(elapsedSeconds)}</Text>
          </View>
        </View>

        <View style={styles.setNameRow}>
          <Text style={styles.setName} numberOfLines={2}>
            {exerciseNameLabel(language, step.exerciseName)}
          </Text>
        </View>

        <View style={styles.setTargetArea}>
          {!edit ? (
            <Pressable onPress={() => setEdit(true)} style={styles.setTargetStack}>
              <View style={styles.setTargetRow}>
                <TargetNumber value={step.setIndex + 1} unit="" size={42} />
                <Text style={styles.setTargetLabel}>{t(language, 'guided.numLabel.set')}</Text>
                <TargetNumber value={reps} unit="×" size={repsSize} />
                <Text style={styles.setTargetLabel}>{t(language, 'guided.reps')}</Text>
              </View>
              {!bodyweight && kg > 0 ? (
                <View style={styles.setTargetRow}>
                  <TargetNumber value={removeTrailingZeros(kg)} unit="kg" size={58} />
                  <Text style={styles.setTargetLabel}>{t(language, 'guided.weight')}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={{ alignSelf: 'stretch', gap: 16 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Stepper label={t(language, 'guided.reps')} value={reps} step={1} min={1} onChange={setReps} />
                {!bodyweight ? (
                  <Stepper label={t(language, 'guided.weight')} value={kg} unit="kg" step={2.5} min={0} onChange={setKg} />
                ) : null}
              </View>
              <Pressable onPress={() => setEdit(false)} hitSlop={10} style={{ alignSelf: 'center' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: HG.purple }}>{t(language, 'guided.back')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.logSet')}
            onPress={() => onConfirm(step.slotId, step.setIndex, reps, bodyweight ? null : kg)}
            style={({ pressed }) => [styles.setLogButton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.setLogButtonText}>{t(language, 'guided.logSet')}</Text>
          </Pressable>
        </View>

        {/* pause + mute sit together under the CTA (v4); the list view used to
            hide behind the exit sheet, so it rides along as a labelled pill */}
        <View style={styles.setControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, paused ? 'guided.resume' : 'guided.pause')}
            onPress={onPause}
            style={styles.setRoundBtn}
          >
            <GPIcon name={paused ? 'play' : 'pause'} size={24} color={HG.ink} sw={2.2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.a11y.sound')}
            onPress={onToggleMute}
            style={styles.setRoundBtn}
          >
            <GPIcon name={muted ? 'mute' : 'sound'} size={24} color={muted ? HG.faint : HG.ink} sw={2.2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.exit.list')}
            onPress={onSwitchToList}
            style={styles.setListBtn}
          >
            <GPIcon name="list" size={20} color={HG.ink} sw={2.2} />
            <Text style={styles.setListBtnText}>{t(language, 'guided.listShort')}</Text>
          </Pressable>
        </View>

        <NextLine text={nextName} dark={false} language={language} />
      </View>
    </StepIn>
  );
}

/* ── dark scrollable session summary ── */
function FinishView({
  sessionTitle,
  elapsedSeconds,
  exercises,
  history,
  weekProgress,
  nextUp,
  isSaving,
  language,
  onFinish,
}: {
  sessionTitle: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseInstance[];
  history: ReturnType<typeof useWorkoutContext>['history'];
  weekProgress: GuidedWeekProgress | null;
  nextUp: GuidedNextUp | null;
  isSaving: boolean;
  language: AppLanguage;
  onFinish: () => void;
}) {
  const completedSets = exercises.flatMap((exercise) => exercise.sets.filter((set) => set.status === 'completed'));
  const volumeKg = completedSets.reduce((sum, set) => sum + (set.actualLoadKg ?? 0) * (set.actualReps ?? 0), 0);
  const minutes = Math.floor(elapsedSeconds / 60);
  const durationLabel = `${minutes}:${String(Math.max(0, elapsedSeconds % 60)).padStart(2, '0')}`;

  const pr = findGuidedSessionPr(exercises, (exerciseIndex) => {
    const entries = getHistoryEntriesForExercise(history, exercises[exerciseIndex]);
    // Exclude today's just-written entries: history is only appended on save,
    // which has not happened yet, so everything here is prior sessions.
    let best = 0;
    for (const entry of entries) {
      for (const set of entry.sets) {
        if (set.loadKg > best) {
          best = set.loadKg;
        }
      }
    }
    return best > 0 ? best : null;
  });
  const coach = buildGuidedCoachMessage({ pr, topSet: findGuidedTopSet(exercises) }, language);

  const weekSegments = weekProgress ? Math.max(weekProgress.target, weekProgress.done, 1) : 0;

  return (
    <StepIn stepKey="finish">
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 11 }}
          showsVerticalScrollIndicator={false}
        >
          {weekProgress ? (
            <View style={styles.finishCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: GPD.purple }}>
                  {weekProgress.weekLabel}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: GPD.muted }}>
                  {weekProgress.done}/{weekProgress.target}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 9 }}>
                {Array.from({ length: weekSegments }).map((_, index) => (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 99,
                      backgroundColor: index < weekProgress.done ? GPD.green : 'rgba(255,255,255,0.14)',
                    }}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: GPD.ink, marginTop: 10 }}>
                {weekProgress.done === 1
                  ? t(language, 'guided.finish.towardGoalOne')
                  : t(language, 'guided.finish.towardGoalMany', { count: weekProgress.done })}
              </Text>
            </View>
          ) : null}

          <Text style={styles.finishTitle}>{t(language, 'guided.finish.title', { title: sessionTitle })}</Text>

          {pr ? (
            <View style={[styles.finishCard, { alignItems: 'center' }]}>
              <View style={styles.prPill}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: GPD.amber }}>
                  {t(language, 'guided.finish.newRecord')}
                </Text>
              </View>
              <PopIn popKey="pr">
                <Text style={styles.prValue}>
                  {removeTrailingZeros(pr.bestKg)}
                  <Text style={{ fontSize: 17, color: GPD.muted }}> kg</Text>
                </Text>
              </PopIn>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: GPD.muted, marginTop: 6 }}>{pr.exerciseName}</Text>
              <View style={styles.prDeltaPill}>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: GPD.green }}>
                  ↑ +{removeTrailingZeros(pr.deltaKg)} kg
                </Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.finishCard, { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 }]}>
            {[
              { value: durationLabel, label: t(language, 'guided.finish.duration') },
              { value: `${completedSets.length}`, label: t(language, 'guided.finish.sets') },
              { value: `${Math.round(volumeKg)} kg`, label: t(language, 'guided.finish.volume') },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 19, fontWeight: '800', color: GPD.ink }}>{stat.value}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: GPD.muted, marginTop: 3 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.finishCard}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: GPD.purple }}>
              {t(language, 'guided.finish.coach')}
            </Text>
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: GPD.ink, marginTop: 6, lineHeight: 21 }}>
              {coach.message}
            </Text>
            {coach.sub ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: GPD.muted, marginTop: 4 }}>{coach.sub}</Text>
            ) : null}
          </View>

          {nextUp ? (
            <View style={styles.finishCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: GPD.green }}>
                  {t(language, 'guided.finish.nextUp')}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: GPD.muted }}>{nextUp.weekday.toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: GPD.ink, marginTop: 6 }}>{nextUp.name}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.finishFooter}>
          <Pressable style={styles.finishGhostBtn} onPress={isSaving ? undefined : onFinish}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: GPD.ink }}>{t(language, 'guided.finish.done')}</Text>
          </Pressable>
          <Pressable
            style={[styles.finishContinueBtn, { opacity: isSaving ? 0.6 : 1 }]}
            onPress={isSaving ? undefined : onFinish}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0C2A1C' }}>
              {t(language, isSaving ? 'guided.finish.saving' : 'guided.finish.continue')}
            </Text>
          </Pressable>
        </View>
      </View>
    </StepIn>
  );
}

function HowToSheetView({
  libraryItem,
  fallbackName,
  onClose,
}: {
  libraryItem: ExerciseLibraryItem | null;
  fallbackName: string;
  onClose: () => void;
}) {
  return (
    <GPSheet onClose={onClose}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: HG.ink }}>{libraryItem?.name ?? fallbackName}</Text>
      {libraryItem?.primaryMuscles?.[0] ? (
        <Text style={{ fontSize: 13, fontWeight: '700', color: HG.purple, marginTop: 4 }}>
          {libraryItem.primaryMuscles[0][0].toUpperCase() + libraryItem.primaryMuscles[0].slice(1)}
        </Text>
      ) : null}
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 13, marginTop: 18, paddingBottom: 8 }}>
          {(libraryItem?.instructions ?? []).map((instruction, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
              <View style={styles.howToNumber}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: HG.purpleDark }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: HG.ink, lineHeight: 22 }}>{instruction}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </GPSheet>
  );
}

const styles = StyleSheet.create({
  /* entry */
  entryRoot: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  entryEyebrow: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.5, color: HG.muted },
  entryTitle: { marginTop: 8, marginBottom: 4, fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: HG.ink },
  entrySub: { fontSize: 14.5, fontWeight: '600', color: HG.muted },
  resumeCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: HG.purpleLight,
    borderWidth: 1.5,
    borderColor: HG.purple,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  phaseCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
    borderRadius: 18,
    paddingHorizontal: 15,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 18,
  },
  phaseRows: {
    borderTopWidth: 1,
    borderTopColor: '#EFE9FB',
    paddingVertical: 8,
    marginBottom: 6,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 57,
    paddingRight: 4,
  },
  phasePlay: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCta: {
    height: 60,
    borderRadius: 19,
    backgroundColor: HG.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 18,
    shadowColor: HG.green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },

  /* chrome */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
  },
  topBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: GPD.line,
  },
  topLabel: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.6, marginHorizontal: 8 },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  railSetPill: {
    flex: 2.6,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  /* media */
  mediaZone: {
    height: 250,
    marginTop: 12,
    // Wider than the rest of the content so the exercise photo reads bigger.
    marginHorizontal: 10,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mediaInitials: { fontSize: 118, fontWeight: '800', letterSpacing: -5, color: 'rgba(124,58,237,0.22)' },
  // Top-right affordance that opens the animated 3D how-to for this exercise.
  media3dButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E6DAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* splash / ready */
  splashRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  splashCheck: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: HG.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { fontSize: 46, fontWeight: '800', letterSpacing: -1.4, color: HG.ink, textAlign: 'center' },
  readyDigit: { fontSize: 150, fontWeight: '800', letterSpacing: -7, color: HG.ink, lineHeight: 160, fontVariant: ['tabular-nums'] },

  /* drill / set */
  exerciseName: { fontSize: 27, fontWeight: '800', letterSpacing: -0.5, color: HG.ink, lineHeight: 31, textAlign: 'center' },
  cueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 7, maxWidth: '100%' },
  howToLink: { fontSize: 13, fontWeight: '800', color: HG.purple },
  drillCountdown: { fontSize: 104, fontWeight: '800', letterSpacing: -4, lineHeight: 110, fontVariant: ['tabular-nums'] },
  ctrlCircle: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  /* set screen v4 */
  setMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  setMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setCounter: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: HG.purple, fontVariant: ['tabular-nums'] },
  setDots: { flexDirection: 'row', gap: 5 },
  setDot: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setClock: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  setClockText: { fontSize: 19, fontWeight: '800', color: HG.muted, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  setNameRow: { paddingTop: 6, paddingHorizontal: 24 },
  setName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.63, color: HG.ink, lineHeight: 24 },
  setTargetArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  setTargetStack: { alignItems: 'center', gap: 4, maxWidth: '100%' },
  setTargetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  setTargetLabel: { fontSize: 21, fontWeight: '800', letterSpacing: -0.63, color: HG.ink, lineHeight: 23 },
  setLogButton: {
    height: 64,
    borderRadius: 20,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  setLogButtonText: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.19 },
  setControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 4 },
  setListBtn: {
    height: 60,
    borderRadius: 999,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HG.border,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  setListBtnText: { fontSize: 15, fontWeight: '800', color: HG.ink, letterSpacing: -0.15 },
  setRoundBtn: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  positionTarget: { fontSize: 44, fontWeight: '800', letterSpacing: -1.3, color: HG.ink, fontVariant: ['tabular-nums'] },
  bigBtn: {
    height: 60,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.33,
    shadowRadius: 24,
    elevation: 6,
  },
  bigBtnText: { fontSize: 16.5, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  ghostBtn: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E4DBF5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostBtnText: { fontSize: 14.5, fontWeight: '800', color: HG.ink },
  stepperBtn: {
    width: 38,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E4DBF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 20, fontWeight: '800', color: HG.purple },

  /* rest (light theme like every other in-workout screen) */
  // The ring itself carries the purple; label and figure stay ink so the
  // countdown reads like every other number in the player.
  restRingLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2.6, color: HG.ink },
  restCountdown: {
    fontSize: 76,
    fontWeight: '800',
    letterSpacing: -2.9,
    color: HG.ink,
    lineHeight: 80,
    fontVariant: ['tabular-nums'],
  },
  skipRestBtn: {
    height: 56,
    borderRadius: 17,
    backgroundColor: HG.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 6,
  },

  /* finish */
  finishCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: GPD.line,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 17,
  },
  finishTitle: { marginTop: 6, marginHorizontal: 2, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: GPD.ink },
  prPill: { backgroundColor: 'rgba(245,185,59,0.14)', paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  prValue: { fontSize: 46, fontWeight: '800', letterSpacing: -1.4, color: GPD.ink, marginTop: 12, lineHeight: 50 },
  prDeltaPill: {
    backgroundColor: 'rgba(55,208,138,0.13)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 9,
  },
  finishFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: GPD.line,
  },
  finishGhostBtn: {
    flex: 1,
    height: 54,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: GPD.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishContinueBtn: {
    flex: 1.4,
    height: 54,
    borderRadius: 17,
    backgroundColor: GPD.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GPD.green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 6,
  },

  /* sheets */
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(14,8,30,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 30,
    maxHeight: '78%',
  },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E4DBF5', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: HG.ink, marginBottom: 16 },
  sheetFootnote: {
    fontSize: 12.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 19,
  },
  howToNumber: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

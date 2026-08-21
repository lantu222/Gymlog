/**
 * Vinha Guided Player (design_handoff_guided_player).
 *
 * Full-screen Freeletics-style session mode: Warm-up (timed drills) → Workout
 * (strength sets + rests) → Cooldown (stretches) → save. One thing on screen
 * at a time. The summary lives in WorkoutCompletionScreen, not here. The step list itself is pure
 * (src/lib/guidedPlayer.ts); this screen owns timers, dispatches into
 * WorkoutProvider (so list view / resume stay in sync) and the visuals.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  FeColorMatrix,
  Filter,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  GuidedDrill,
  GuidedStep,
  GuidedSetTarget,
  GUIDED_READY_SECONDS,
  buildGuidedDrillsFromBlock,
  buildGuidedSteps,
  getGuidedStepPlanKey,
  findGuidedLibraryIndex,
  getGuidedPhaseSkipTargetIndex,
  findGuidedPhaseStart,
  findGuidedSessionPr,
  findGuidedTopSet,
  buildGuidedCoachMessage,
  dialHoldIntervalMs,
  formatGuidedCountdown,
  formatGuidedTarget,
  getGuidedBackTargetIndex,
  getGuidedInitials,
  getGuidedNextName,
  getGuidedNextPreview,
  getGuidedPhaseLabel,
  getGuidedSessionTitle,
  getGuidedSkipTargetIndex,
  getGuidedStepAnchor,
  getGuidedStepLabel,
  isGuidedExerciseOut,
  resolveGuidedResumeIndex,
  resolveGuidedSetTarget,
} from '../lib/guidedPlayer';
import { getExerciseInstructions } from '../lib/exerciseInstructions';
import { SetPanelHistory, SetPanels } from '../components/SetPanels';
import { getDrillLibraryName } from '../lib/drillMedia';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { libraryLabel } from '../lib/libraryLabel';
import { localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { classifySessionFocus, getDefaultCooldown, getDefaultWarmup } from '../lib/homeSessionHero';
import { Exercise3DSheet } from '../components/exercise3d/Exercise3DSheet';
import { hasExercise3D } from '../components/exercise3d/exercisePose';
import { formatShortDate, removeTrailingZeros } from '../lib/format';
import { estimateSessionMinutes } from '../lib/sessionDuration';
import { t } from '../lib/i18n';
import { haptics } from '../utils/haptics';
import { subscribeRestActions, useRestEndAlert } from '../hooks/useRestEndAlert';
import { sound, type CueSound } from '../utils/sound';
import { readableOn, Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { AppLanguage, ExerciseLibraryItem, UnitPreference } from '../types/models';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { elapsedSecondsOf } from '../features/workout/workoutState';
import { buildSwapOptionsForSlot, TailoringPreferencesInput } from '../lib/tailoringFit';
import { buildExerciseSearchHaystack, exerciseMatchesQuery } from '../lib/exerciseSearch';
import { getPopularExerciseLibraryOrder } from '../lib/exerciseSuggestions';
import { useKeepScreenAwake } from '../utils/keepAwake';
import { getHistoryEntriesForExercise } from '../features/workout/workoutState';
import {
  isTimedTrackingMode,
  isUnloadedTrackingMode,
  WorkoutExerciseInstance,
} from '../features/workout/workoutTypes';

/**
 * Duotone ramps: where black lands, and where white lands. Light theme keeps
 * the photo airy so it sits on the lilac surface; dark theme keeps it deep so
 * it does not glare mid-set.
 */
const DUOTONE = {
  light: { shadow: [0.298, 0.227, 0.478], light: [1, 1, 1] },
  dark: { shadow: [0.09, 0.063, 0.169], light: [0.851, 0.8, 0.961] },
} as const;

/** Rec.601 luma weights — the same ones feColorMatrix's own saturate uses. */
const LUMA = [0.299, 0.587, 0.114] as const;

/**
 * The whole duotone as one feColorMatrix.
 *
 * The textbook recipe is saturate-to-grey followed by an feComponentTransfer
 * table per channel, and on Android the transfer node is ignored — the photo
 * came out plain greyscale. A single matrix does both steps at once and is the
 * one filter primitive that definitely renders: each output channel is the
 * luma weights scaled by that channel's ramp span, with the shadow end as the
 * constant term. Verified on device; do not "simplify" it back into two nodes.
 */
function duotoneMatrix(shadow: readonly number[], light: readonly number[]) {
  const row = (index: number) => {
    const span = light[index] - shadow[index];
    return [LUMA[0] * span, LUMA[1] * span, LUMA[2] * span, 0, shadow[index]];
  };
  return [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0]
    .map((value) => value.toFixed(4))
    .join(' ');
}

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
  /** Equipment chips the user actually has; null when the setup never said. */
  availableEquipment?: string[] | null;
  /** Ranks the swap list the same way the list logger does. */
  tailoringPreferences?: TailoringPreferencesInput | null;
  exerciseLibrary: ExerciseLibraryItem[];
  soundCuesEnabled: boolean;
  /** Keep the display on for the whole guided session. */
  keepScreenAwake?: boolean;
  onToggleSoundCues: (next: boolean) => void;
  entryEyebrow: string;
  weekProgress: GuidedWeekProgress | null;
  nextUp: GuidedNextUp | null;
  onLeave: () => void;
  onEndSession: () => void;
  onFinishSession: () => void;
  isSavingWorkout: boolean;
  /** Rest & alerts settings (design: Background Timer). */
  restAlerts?: { alerts: boolean; warning: boolean; ongoing: boolean };
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
    // Pencil: the "this card opens" mark on a closed dial.
    edit: <Path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3zM13.5 6.5l3 3" />,
    arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
    list: <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    // Two arrows passing: swapping one lift for another.
    swap: <Path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
    // The actions menu. It shared the list glyph with the swap button, and two
    // identical icons side by side is two buttons that look like one.
    dots: <Path d="M5 12h.01M12 12h.01M19 12h.01" />,
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
    shield: <Path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 8.5-4.1-.9-7-4.3-7-8.5V6z" />,
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
  // Interpolated once: the player re-renders every second on the timer, and a
  // per-render interpolate leaks native nodes (disconnectAnimatedNodes crash).
  const translateY = useRef(anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] })).current;
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
    <Animated.View style={[{ flex: 1, opacity: anim, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ── pop-in for countdown digits / badges ── */
function PopIn({ children, popKey }: { children: React.ReactNode; popKey: string | number }) {
  const anim = useRef(new Animated.Value(0)).current;
  // Same rule as StepIn: one interpolation per value, never per render.
  const popStyle = useRef({
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  }).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.3, 1.4, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [anim, popKey]);
  return <Animated.View style={popStyle}>{children}</Animated.View>;
}

/* ── media zone: photo when the library has one, brand-panel initials otherwise ── */
function MediaZone({
  name,
  library,
  height,
  mode = 'drill',
  showActions = true,
  fit = 'contain',
  language = 'en',
}: {
  name: string;
  library: ExerciseLibraryItem[];
  height: number;
  mode?: 'drill' | 'position' | 'set';
  /** Set screen v4 moves the how-it's-done button into the top bar. */
  showActions?: boolean;
  /** v4 fills the set card edge to edge; other steps keep the whole frame. */
  fit?: 'contain' | 'cover';
  language?: AppLanguage;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const match = useMemo(() => {
    // Warmup/cooldown drills are generated copy with no library entry of their
    // own — they borrow a photo from the exercise that shows the same position.
    const lookupName = getDrillLibraryName(name) ?? name;
    const index = findGuidedLibraryIndex(lookupName, library.map((item) => item.name));
    return index === null ? null : library[index];
  }, [name, library]);
  const themeName = useThemeName();
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
            accessibilityLabel={t(language, 'guided.a11y.watchHowTo', { name: exerciseNameLabel(language, name) })}
            onPress={() => setSheetOpen(true)}
            style={styles.media3dButton}
            hitSlop={8}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <Path d="M15 10.5 20 7.5v9l-5-3z" />
            </Svg>
          </Pressable>
          <Exercise3DSheet
            name={name}
            muscle={muscle}
            language={language}
            instructions={getExerciseInstructions(match?.name, match?.instructions, language)}
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        </>
      ) : null}
    </>
  );

  const initials = getGuidedInitials(name);
  // The panel is the FLOOR, not the fallback. It used to render only after
  // onError, so a photo that was merely slow left a blank white card filling
  // half the screen with nothing in it — and onError never fires while a
  // request is still in flight. Drawing the panel underneath means the media
  // zone is never empty: the photo arrives on top of it, or it does not.
  const panel = (
    <>
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
    </>
  );

  if (imageUrl && !imageFailed) {
    const ramp = DUOTONE[themeName];
    return (
      <View style={[styles.mediaZone, { height, backgroundColor: '#E9DCFA', borderColor: '#E6DAF8' }]}>
        {panel}
        {/* The library photos are stock gym shots — red walls, yellow floors —
            and during a set the photo is the biggest thing on the screen, so
            the app looked like two products. Desaturate, then map luminance
            onto a two-colour brand ramp: same picture, same information, our
            colour world. Done at render time rather than baked, which is the
            only way the treatment can follow the theme. */}
        <View style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <Filter id="vinhaDuotone" x="0" y="0" width="100%" height="100%">
                <FeColorMatrix type="matrix" values={duotoneMatrix(ramp.shadow, ramp.light)} />
              </Filter>
            </Defs>
            <SvgImage
              href={{ uri: imageUrl }}
              width="100%"
              height="100%"
              preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
              filter="url(#vinhaDuotone)"
            />
          </Svg>
        </View>
        {overlays}
      </View>
    );
  }

  return (
    <View style={[styles.mediaZone, { height, backgroundColor: '#E9DCFA', borderColor: '#E6DAF8' }]}>
      {panel}
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
  const theme = useTheme();

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
          stroke={theme.purple}
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
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const iconColor = dark ? GPD.ink : theme.ink;
  const buttonStyle = [styles.topBtn, dark ? styles.topBtnDark : null];
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onExit} style={buttonStyle} hitSlop={8}>
        <GPIcon name="x" size={19} color={iconColor} />
      </Pressable>
      <Text style={[styles.topLabel, { color: dark ? GPD.muted : theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
      {video ? (
        <Pressable accessibilityRole="button" accessibilityLabel={video.label} onPress={video.onPress} style={buttonStyle} hitSlop={8}>
          <GPIcon name="video" size={20} color={iconColor} sw={2.1} />
        </Pressable>
      ) : (
        <Pressable onPress={onMute} style={buttonStyle} hitSlop={8}>
          <GPIcon name={muted ? 'mute' : 'sound'} size={19} color={muted ? (dark ? GPD.faint : theme.faint) : iconColor} />
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
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

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
                  backgroundColor: dark ? 'rgba(155,109,255,0.25)' : theme.purpleLight,
                  borderColor: dark ? GPD.purple : theme.purple,
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
                          : theme.purple
                        : dot === dotIndex
                          ? dark
                            ? GPD.ink
                            : theme.purple
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
                done || isCurrent ? (dark ? GPD.purple : theme.purple) : dark ? 'rgba(255,255,255,0.14)' : '#E4DBF5',
              opacity: done ? 0.85 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

function NextLine({ text, dark, language }: { text: string | null; dark: boolean; language: AppLanguage }) {
  const theme = useTheme();

  if (!text) {
    return <View style={{ height: 20 }} />;
  }
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 26 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: dark ? GPD.muted : theme.muted }} numberOfLines={1}>
        <Text style={{ color: dark ? GPD.faint : theme.faint }}>{t(language, 'guided.next.prefix')}</Text>
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
  const styles = useThemedStyles(makeStyles);

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
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const size = big ? 62 : 52;
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 66 }}>
      <View style={[styles.ctrlCircle, { width: size, height: size }]}>
        <GPIcon name={icon} size={big ? 24 : 21} color={theme.ink} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>{label}</Text>
    </Pressable>
  );
}

function BigBtn({
  label,
  onPress,
  color: colorProp,
  icon = 'check',
  disabled,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  /** A green tick on a button that stops something reads as confirm. */
  icon?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = colorProp ?? theme.green;
  // Derived from the fill, not fixed: callers paint this button `theme.ink` to
  // mean "the quiet one", and ink is near-white under the dark theme — so a
  // hard-coded white label made the button read as blank.
  const foreground = readableOn(color);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.bigBtn, { backgroundColor: color, opacity: disabled ? 0.6 : 1, shadowColor: color }]}
    >
      <GPIcon name={icon} size={20} color={foreground} sw={2.6} />
      <Text style={[styles.bigBtnText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

function GhostBtn({
  label,
  onPress,
  icon,
  dark,
  danger,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  dark?: boolean;
  /** Throws work away. Named for what it does, not for the colour it takes. */
  danger?: boolean;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);
  const tint = danger ? theme.danger : dark ? GPD.ink : theme.ink;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.ghostBtn,
        dark ? { borderColor: GPD.line, backgroundColor: 'rgba(255,255,255,0.06)' } : null,
        danger ? { borderColor: theme.danger } : null,
      ]}
    >
      {icon ? <GPIcon name={icon} size={17} color={tint} /> : null}
      <Text style={[styles.ghostBtnText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

/* ── set-screen dial ── */

/**
 * A −/+ button that steps once on tap and runs while held, speeding up.
 *
 * Pressable's onLongPress fires instead of onPress when the finger stays
 * down, so a tap is exactly one step and a hold is one step plus a run that
 * ends on release. The run schedules itself with setTimeout rather than
 * setInterval so the interval can shorten mid-hold (dialHoldIntervalMs).
 */
function DialButton({
  glyph,
  accessibilityLabel,
  onStep,
}: {
  glyph: '−' | '+';
  accessibilityLabel: string;
  onStep: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticksRef = useRef(0);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stopRun = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    ticksRef.current = 0;
  }, []);

  const runTick = useCallback(() => {
    onStepRef.current();
    ticksRef.current += 1;
    timerRef.current = setTimeout(runTick, dialHoldIntervalMs(ticksRef.current));
  }, []);

  // A hold that outlives the button (step change, unmount) must not keep
  // stepping a number nobody can see.
  useEffect(() => stopRun, [stopRun]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => onStepRef.current()}
      onLongPress={runTick}
      delayLongPress={350}
      onPressOut={stopRun}
      style={({ pressed }) => [styles.setDialBtn, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.setDialBtnText}>{glyph}</Text>
    </Pressable>
  );
}

/**
 * One dial: a label, a number, and −/+ that only exist while the card is
 * open. Closed, the whole card is one tap target that opens it; open, the
 * number sits between two buttons and the card reads as active.
 */
function DialCard({
  label,
  value,
  unit,
  open,
  onToggle,
  onStep,
  downLabel,
  upLabel,
  editHint,
  wide,
  faint,
}: {
  label: string;
  value: string;
  unit: string | null;
  open: boolean;
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  downLabel: string;
  upLabel: string;
  /** Screen-reader hint on the closed card. */
  editHint: string;
  wide: boolean;
  faint: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const number = (
    <View style={styles.setDialValue}>
      <Text
        style={[styles.setDialNumber, open && styles.setDialNumberOpen, faint && { color: theme.faint }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      {unit ? <Text style={styles.setDialUnit}>{unit}</Text> : null}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}
      accessibilityHint={editHint}
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.setDialCard,
        wide && styles.setDialCardWide,
        open && styles.setDialCardOpen,
        pressed && !open && { opacity: 0.85 },
      ]}
    >
      <View style={styles.setDialLabelRow}>
        <Text style={[styles.setDialLabel, open && { color: theme.purple }]}>{label}</Text>
        {!open ? <GPIcon name="edit" size={13} color={theme.faint} sw={2.2} /> : null}
      </View>
      {open ? (
        <View style={styles.setDialControls}>
          <DialButton glyph="−" accessibilityLabel={downLabel} onStep={() => onStep(-1)} />
          {number}
          <DialButton glyph="+" accessibilityLabel={upLabel} onStep={() => onStep(1)} />
        </View>
      ) : (
        <View style={styles.setDialControls}>{number}</View>
      )}
    </Pressable>
  );
}

/* ── bottom sheet ── */
function GPSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  // The sheet's own 30 was a guess at the phone's navigation bar, and on a
  // three-button handset the last row and the footnote sat behind it. Measured
  // rather than guessed — reported twice, on two different sheets.
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 30 }]} onPress={() => undefined}>
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
  availableEquipment = null,
  tailoringPreferences = null,
  exerciseLibrary,
  soundCuesEnabled,
  keepScreenAwake = false,
  onToggleSoundCues,
  entryEyebrow,
  weekProgress,
  nextUp,
  onLeave,
  onEndSession,
  onFinishSession,
  isSavingWorkout,
  restAlerts = { alerts: true, warning: true, ongoing: true },
}: GuidedPlayerScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The resolved theme, for the status bar: the player has its own dark
  // gradient on the finish step and that is a different question.
  const themeName = useThemeName();
  const workout = useWorkoutContext();
  const session = workout.activeSession;

  /**
   * The session clock, derived here rather than ticked into global state.
   *
   * The provider used to dispatch a tick every second for any active session,
   * and every tick made a new state object — so the whole app re-rendered once
   * a second on every screen, including screens with no clock on them, for as
   * long as a workout sat unfinished. The two other logging screens already
   * derive this locally; this was the last consumer keeping the shared clock
   * alive for a number only this screen shows.
   */
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const sessionStartedAt = session?.startedAt ?? null;
  useEffect(() => {
    if (!sessionStartedAt) {
      return undefined;
    }
    const timer = setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sessionStartedAt]);
  // The same function the saved duration uses, so the clock on screen and the
  // number in history cannot disagree about how long the workout took.
  const derivedElapsedSeconds = session ? elapsedSecondsOf(session, clockNowMs) : 0;
  useKeepScreenAwake(keepScreenAwake, 'guided-player');

  // The catalog names sessions in English; the focus half of the name reads in
  // the user's language, the plan brand in front of it does not.
  const sessionTitle = localizeWorkoutFocus(getGuidedSessionTitle(session?.templateName ?? '', language), language);

  // From the exercises, not from `sessionTitle` — that string is localized one
  // line above, and feeding it to the classifier is exactly how every Finnish
  // session ended up with the same generic warmup.
  const focusKind = useMemo(
    () => classifySessionFocus((session?.exercises ?? []).map((exercise) => exercise.exerciseName)),
    [session?.exercises],
  );
  const warmupDrills = useMemo<GuidedDrill[]>(
    () => buildGuidedDrillsFromBlock(getDefaultWarmup(focusKind, language, availableEquipment)),
    [focusKind, language, availableEquipment],
  );
  const cooldownDrills = useMemo<GuidedDrill[]>(
    () => buildGuidedDrillsFromBlock(getDefaultCooldown(focusKind, language, availableEquipment)),
    [focusKind, language, availableEquipment],
  );

  const exercises = session?.exercises ?? [];
  const guidedExercises = exercises.map((exercise) => ({
    slotId: exercise.slotId,
    name: exercise.exerciseName,
    restSeconds: exercise.restSecondsMin,
    setCount: exercise.sets.length,
    // Not `status === 'skipped'`: a lift with one logged set and the rest
    // skipped is `completed` for saving (the set counts) but still out of the
    // plan (nothing left to do). See isGuidedExerciseOut.
    skipped: isGuidedExerciseOut(exercise),
  }));
  const stepPlan = useMemo(
    () =>
      buildGuidedSteps({ warmup: warmupDrills, exercises: guidedExercises, cooldown: cooldownDrills }, language),
    // Rebuild only when the shape of the session changes, not on every set log.
    // The key must cover everything the steps bake in — see getGuidedStepPlanKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warmupDrills, cooldownDrills, language, getGuidedStepPlanKey(guidedExercises)],
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
      return resolveGuidedSetTarget(
        exercise.sets,
        setIndex,
        exercise.trackingMode,
        exercise.swappedAfterSetIndex,
      );
    },
    [exerciseBySlot],
  );

  /* ── mode + step position ── */
  const [mode, setMode] = useState<'entry' | 'player'>('entry');
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const step: GuidedStep = steps[Math.min(stepIndex, steps.length - 1)] ?? { type: 'finish' };
  const stepRef = useRef(step);
  stepRef.current = step;

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
  // What the lock-screen card says between rests: the session and its lift.
  const sessionCard = useMemo(() => {
    if (!session) {
      return null;
    }
    const started = new Date(session.startedAt);
    const time = `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`;
    const total = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const done = session.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((set) => set.status === 'completed').length,
      0,
    );
    const current = session.exercises.find((ex) => ex.sets.some((set) => set.status !== 'completed' && set.status !== 'skipped'));
    return {
      title: t(language, 'rest.notify.sessionTitle', {
        session: sessionTitle,
        exercise: current ? exerciseNameLabel(language, current.exerciseName) : '',
      }),
      body: t(language, 'rest.notify.sessionBody', { done, total, time }),
    };
  }, [language, session, sessionTitle]);
  const syncRestNotification = useRestEndAlert(language, {
    warning: restAlerts.warning,
    ongoing: restAlerts.ongoing,
    session: sessionCard,
  });

  // Lock-screen actions land in App and come here over the bus. The guided
  // rest is a timed step, so "+30 s" is the same move as the +15s button and
  // "skip" is the same as advancing.
  useEffect(
    () =>
      subscribeRestActions((action) => {
        if (stepRef.current?.type !== 'rest') {
          return;
        }
        if (action.kind === 'extend') {
          adjustRemainingRef.current(action.seconds * 1000);
        } else if (action.kind === 'skip') {
          advanceRef.current();
        }
      }),
    [],
  );

  const [paused, setPaused] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  // v4 set screen: the top-bar camera opens the 3D rig from screen level, so
  // the media zone no longer carries its own button.
  const [setVideoOpen, setSetVideoOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapQuery, setSwapQuery] = useState('');
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const frozen = paused || howtoOpen || exitOpen || pauseSheetOpen || swapOpen;

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
      // Index for old readers, anchor for the resume: the index goes stale
      // the moment the plan is rebuilt, the anchor does not.
      workout.setGuidedStep(clamped, getGuidedStepAnchor(target));
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
  const adjustRemainingRef = useRef(adjustRemaining);
  adjustRemainingRef.current = adjustRemaining;
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
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
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

  const resumeIndex = resolveGuidedResumeIndex(
    steps,
    session.ui.guidedStepIndex ?? null,
    isSetCompleted,
    session.ui.guidedResumeAnchor ?? null,
  );
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

  /**
   * The whole warmup or cooldown, not one drill of it. Five drills is five taps
   * to the bar, and the reader who wants to warm up their own way wants out of
   * the block rather than out of the session.
   */
  const skipPhase = () => {
    goTo(getGuidedPhaseSkipTargetIndex(steps, stepIndex));
  };
  const skippablePhase =
    'phase' in step && (step.phase === 'warmup' || step.phase === 'cooldown') ? step.phase : null;

  /* ── exercise-level actions ──────────────────────────────────────────────
     Swap, skip and add-set used to live only in the list logger, so the only
     way to do any of them was to leave the guided flow entirely — and all
     three are things a gym makes you do (rack taken, shoulder complaining,
     one more set in you). They hang off the pause sheet because that is
     already the "I need to do something else" surface. */
  // Rest counts too. A rest only ever falls BETWEEN sets of one exercise, so
  // the lift it belongs to is unambiguous — and resting is exactly when you
  // notice somebody has taken the machine you were going back to.
  const actionSlotId =
    step.type === 'set' || step.type === 'position' || step.type === 'rest' ? step.slotId : null;
  const actionExercise = actionSlotId ? exerciseBySlot.get(actionSlotId) ?? null : null;
  /**
   * What the panels above the set have to show for this lift.
   *
   * Resolved here rather than inside the panel because the library lookup is
   * the player's own (a warm-up drill borrows the photo of the exercise that
   * shows the same position), and because slot history is the workout store's,
   * not a component's.
   */
  const setPanelSource = useMemo(() => {
    if (step.type !== 'set') {
      return null;
    }
    const { exerciseName: name, slotId } = step;
    const lookupName = getDrillLibraryName(name) ?? name;
    const index = findGuidedLibraryIndex(lookupName, exerciseLibrary.map((item) => item.name));
    const match = index === null ? null : exerciseLibrary[index];
    const entries = workout.history.slotHistory[slotId] ?? [];
    // The most recent session that actually logged something. A skipped or
    // empty entry is not a "last time" — it is a day this lift did not happen.
    const last =
      [...entries]
        .filter((entry) => !entry.skipped && entry.sets.length > 0)
        .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())[0] ?? null;
    const heaviest = last ? Math.max(...last.sets.map((set) => set.loadKg)) : 0;

    const history: SetPanelHistory | null = last
      ? {
          performedAt: last.performedAt,
          sets: last.sets.map((set) => ({
            setIndex: set.setIndex + 1,
            loadKg: set.loadKg,
            reps: set.reps,
            // Marked only when it beats the others — every set at the same
            // weight would otherwise light the whole panel up.
            isRecord: heaviest > 0 && set.loadKg === heaviest && last.sets.some((other) => other.loadKg < heaviest),
          })),
        }
      : null;

    return {
      history,
      instructions: getExerciseInstructions(match?.name, match?.instructions, language),
      imageUrl: match?.imageUrls?.[0] ?? null,
      initials: exerciseNameLabel(language, name).slice(0, 2).toUpperCase(),
    };
  }, [exerciseLibrary, language, step, workout.history.slotHistory]);

  const swapOptions = useMemo(() => {
    if (!actionExercise) {
      return [];
    }
    return buildSwapOptionsForSlot(
      actionExercise.substitutionGroup,
      actionExercise.exerciseName,
      tailoringPreferences,
    );
  }, [actionExercise, tailoringPreferences]);

  /** The programme's own alternatives, which are better answers than a search. */
  const swapSuggestions = useMemo(() => {
    const query = swapQuery.trim();
    const names = swapOptions.map((option) => option.exerciseName);
    if (!query) {
      return names;
    }
    return names.filter((name) =>
      exerciseMatchesQuery(`${name} ${exerciseNameLabel(language, name)}`.toLowerCase(), query),
    );
  }, [language, swapOptions, swapQuery]);

  /**
   * Everything else the library holds.
   *
   * Capped while there is no query: 873 rows inside a sheet is a scroll, not a
   * choice. Typing lifts the cap to something a reader can still read through.
   */
  const swapLibrary = useMemo(() => {
    const query = swapQuery.trim();
    const suggested = new Set(swapOptions.map((option) => option.exerciseName));
    // Matched on the displayed name as well as the stored one: the plan may
    // hold "Barbell Squat" where the library holds "Back Squat", and both read
    // "Takakyykky" — so the lift you are standing at was offered as something
    // to swap it for.
    const current = actionExercise?.exerciseName;
    const currentLabel = current ? exerciseNameLabel(language, current) : null;
    const pool = exerciseLibrary.filter(
      (item) =>
        item.name !== current &&
        exerciseNameLabel(language, item.name) !== currentLabel &&
        !suggested.has(item.name),
    );
    if (!query) {
      const popular = getPopularExerciseLibraryOrder(exerciseLibrary);
      return [...pool]
        .sort((left, right) => (popular.get(left.id) ?? 1e6) - (popular.get(right.id) ?? 1e6))
        .slice(0, 25);
    }
    return pool
      .filter((item) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), query))
      .slice(0, 40);
  }, [actionExercise, exerciseLibrary, language, swapOptions, swapQuery]);

  const applySwap = (exerciseName: string) => {
    if (!actionExercise) {
      return;
    }
    workout.swapExercise(
      actionExercise.slotId,
      exerciseName,
      actionExercise.substitutionGroup,
      unitPreference,
    );
    setSwapOpen(false);
    setSwapQuery('');
    setPaused(false);
  };

  // Skipping an exercise removes its steps from the list, so the index we are
  // sitting on stops meaning what it meant. Re-resolve once the rebuilt steps
  // arrive rather than guessing an offset.
  // Where to land once the rebuilt steps arrive. Removing an exercise deletes
  // the block it occupied, so whatever followed it slides down into the index
  // that block STARTED at — which makes that index the next exercise, and the
  // cooldown or the finish when the skipped one was last.
  //
  // This used to ask resolveGuidedResumeIndex instead, and that resolver
  // answers 0 when no set has been completed yet. Skipping the very first
  // exercise before logging anything — the rack is taken, so you move on —
  // threw the user back to the start of the warm-up.
  const resyncTargetRef = useRef<number | null>(null);
  useEffect(() => {
    const target = resyncTargetRef.current;
    if (target === null) {
      return;
    }
    resyncTargetRef.current = null;
    goToRef.current(Math.min(target, steps.length - 1));
  }, [steps]);

  const handleSkipExercise = () => {
    if (!actionSlotId) {
      return;
    }
    const blockStart = steps.findIndex(
      (candidate) =>
        (candidate.type === 'position' || candidate.type === 'set') &&
        candidate.slotId === actionSlotId,
    );
    resyncTargetRef.current = blockStart >= 0 ? blockStart : stepIndex;
    workout.skipExercise(actionSlotId);
    setPauseSheetOpen(false);
    setPaused(false);
  };

  const handleAddSet = () => {
    if (!actionSlotId) {
      return;
    }
    workout.addSet(actionSlotId);
    setPauseSheetOpen(false);
    setPaused(false);
  };

  const backOne = () => {
    const target = getGuidedBackTargetIndex(steps, stepIndex);
    const targetStep = steps[target];
    if (targetStep?.type === 'set' && isSetCompleted(targetStep.slotId, targetStep.setIndex)) {
      workout.undoSet(targetStep.slotId, targetStep.setIndex);
    }
    goTo(target);
  };

  /**
   * Confirming that the logged sets may be thrown away.
   *
   * The app's own dialog, not `Alert.alert`. The platform one is a grey box
   * with teal buttons dropped into the middle of a near-black screen — it reads
   * as another app's, on the one screen where the reader is being asked to
   * agree to losing work. The same question is asked with a themed dialog when
   * a programme is removed, and that one looks like it belongs here.
   */
  const handleEndSession = () => {
    setExitOpen(false);
    if (completedSetCount > 0) {
      setConfirmingEnd(true);
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
  // The named constant, not a literal 3 — this is the same ready-countdown
  // estimateRoutineBlockSeconds adds for Home, and the two have to move together.
  const warmupSecondsTotal = warmupDrills.reduce((sum, drill) => sum + drill.seconds + GUIDED_READY_SECONDS, 0);
  const cooldownSecondsTotal = cooldownDrills.reduce((sum, drill) => sum + drill.seconds + GUIDED_READY_SECONDS, 0);
  // The one session-length formula, shared with Home — this screen used to add
  // up its own steps at a flat 35 s per set and land on a different number
  // than the screen the user had just come from.
  const durationMinutes = estimateSessionMinutes({
    exercises: activeExercises.map((exercise) => ({
      sets: exercise.sets.length,
      reps: exercise.sets[0]?.plannedRepsMax ?? 8,
      timed: isTimedTrackingMode(exercise.trackingMode),
      restSeconds: exercise.restSecondsMin,
    })),
    warmupSeconds: warmupSecondsTotal,
    cooldownSeconds: cooldownSecondsTotal,
  });

  const secondsLeft = remainingMs / 1000;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? GPD.bg2 : theme.bg }}>
      {/* `dark` is the finish step's own gradient, not the theme. Read as the
          status bar's answer it painted near-black icons on the dark theme's
          near-black background, and the phone's own clock disappeared for the
          length of a workout. Reported from a gym floor 2026-08-21. */}
      <StatusBar
        style={dark || themeName === 'dark' ? 'light' : 'dark'}
        backgroundColor={dark ? GPD.bg1 : theme.bg}
      />
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
                <GPIcon name="x" size={19} color={theme.ink} />
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

            {/* Resume is the strongest action on this screen when it exists, so
                it follows the same rule as the rest: pressable is `highlight`.
                Left violet it would have been the one button in dark that
                still was. */}
            {showResume && (
              <Pressable style={styles.resumeCard} onPress={() => startAt(resumeIndex)}>
                <GPIcon name="play" size={18} color={theme.highlight} sw={2.4} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.highlight }}>
                    {t(language, 'guided.entry.resume')}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.muted, marginTop: 1 }} numberOfLines={1}>
                    {getGuidedStepLabel(steps[resumeIndex], language)}
                  </Text>
                </View>
                <GPIcon name="chevR" size={17} color={theme.highlight} />
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
                        // Through the same translation every other name on
                        // this screen goes through — this row listed "Back
                        // Squat" under a Finnish heading while the player
                        // itself said Takakyykky.
                        left: exerciseNameLabel(language, exercise.exerciseName),
                        right: `${exercise.sets.length} × ${formatRepRangeLabel(exercise.sets[0])}${
                          isTimedTrackingMode(exercise.trackingMode) ? ' s' : ''
                        }`,
                      })),
                    }
                  : null,
                cooldownStart !== null
                  ? {
                      key: 'cooldown',
                      label: t(language, 'guided.phase.cooldown'),
                      sub: `${t(language, 'guided.count.stretchMany', { count: cooldownDrills.length })} · ${cooldownSecondsTotal < 90 ? `~${t(language, 'logger.secondsValue', { count: Math.round(cooldownSecondsTotal / 5) * 5 })}` : t(language, 'guided.entry.duration', { min: Math.round(cooldownSecondsTotal / 60) })}`,
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
                          <GPIcon name="play" size={17} color={theme.highlight} sw={2.4} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 17.5, fontWeight: '800', color: theme.ink }}>{phase.label}</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: theme.muted, marginTop: 3 }}>{phase.sub}</Text>
                        </View>
                        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                          <GPIcon name="chevR" size={18} color={theme.faint} />
                        </View>
                      </Pressable>
                      {expanded && (
                        <View style={styles.phaseRows}>
                          {phase.rows.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.phaseRow}>
                              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: theme.ink }} numberOfLines={1}>
                                {row.left}
                              </Text>
                              <Text style={{ fontSize: 13.5, fontWeight: '600', color: theme.muted, fontVariant: ['tabular-nums'] }}>
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
              {/* White would be unreadable on the dark theme's orange; that is
                  what `onHighlight` is for. It stays white in light. */}
              <GPIcon name="play" size={19} color={theme.onHighlight} sw={2.5} />
              <Text style={{ fontSize: 16.5, fontWeight: '800', color: theme.onHighlight }}>
                {t(language, 'guided.entry.start')}
              </Text>
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
                    // Screen readers heard "Katso, miten Chest-Supported Row
                    // tehdään" while the screen showed Rintatuettu soutu.
                    label: t(language, 'guided.a11y.watchHowTo', { name: exerciseNameLabel(language, step.exerciseName) }),
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
                        <GPIcon name="check" size={16} color={theme.green} sw={2.8} />
                      </View>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.green }}>{step.doneLabel}</Text>
                    </View>
                  </PopIn>
                ) : null}
                <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 2, color: theme.muted }}>
                  {t(language, 'guided.upNext')}
                </Text>
                <Text style={styles.splashTitle}>{step.title}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.muted }}>{step.sub}</Text>
                {/* The block is a suggestion, not a gate. Its own screen is
                    where a reader decides to warm up their own way. */}
                {skippablePhase ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={skipPhase}
                    style={{ marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <GPIcon name="skip" size={15} color={theme.muted} sw={2.4} />
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: theme.muted }}>
                      {t(language, `guided.skipBlock.${skippablePhase}` as 'guided.skipBlock.warmup')}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            </StepIn>
          )}

          {step.type === 'ready' && (
            <StepIn stepKey={`ready-${stepIndex}`}>
              <View style={styles.splashRoot}>
                <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 2, color: theme.purple }}>
                  {t(language, 'guided.getReady')}
                </Text>
                <PopIn popKey={Math.max(1, Math.ceil(secondsLeft))}>
                  <Text style={styles.readyDigit}>{Math.max(1, Math.ceil(secondsLeft))}</Text>
                </PopIn>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.ink, marginTop: 16, textAlign: 'center' }}>
                  {step.drillName}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.muted, marginTop: 4 }}>{step.seconds}s</Text>
              </View>
            </StepIn>
          )}

          {step.type === 'drill' && (
            <StepIn stepKey={`drill-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                <MediaZone name={step.drillName} library={exerciseLibrary} height={270} mode="drill" language={language} />
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
                      { color: secondsLeft <= 3.05 ? theme.green : theme.ink },
                    ]}
                  >
                    {formatGuidedCountdown(secondsLeft)}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.7, color: theme.muted, marginTop: 6 }}>
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
              {/* Stripped to the four things you need while walking to the rack
                  (user, 2026-08-02): what is next, how much of it, how long you
                  have, and a way to stop the clock. The photo, the how-to link
                  and the first-set breakdown all moved off this screen — you
                  are not reading, you are walking. */}
              <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 2, color: theme.purple }}>
                  {t(language, 'guided.nextUp')}
                </Text>
                <Text style={styles.positionName} numberOfLines={2}>
                  {exerciseNameLabel(language, step.exerciseName)}
                </Text>
                {(() => {
                  const exercise = exerciseBySlot.get(step.slotId);
                  const target = resolveTarget(step.slotId, 0);
                  if (!exercise || !target) {
                    return null;
                  }
                  return (
                    <Text style={styles.positionPlan}>
                      {t(
                        language,
                        isTimedTrackingMode(exercise.trackingMode)
                          ? 'guided.prescriptionHold'
                          : 'guided.prescription',
                        {
                          sets: exercise.sets.length,
                          reps: target.reps,
                        },
                      )}
                    </Text>
                  );
                })()}
                <View style={{ height: 18 }} />
                <Text
                  style={[
                    styles.drillCountdown,
                    { color: secondsLeft <= 3.05 ? theme.green : theme.ink },
                  ]}
                >
                  {formatGuidedCountdown(secondsLeft)}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.7, color: theme.muted }}>
                  {t(language, paused ? 'guided.stopped' : 'guided.untilStart')}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
                {/* One control, both jobs: stop the clock to take your time,
                    and start the set when you are standing there. A separate
                    "I'm ready" button on top of a stop button would be two
                    ways to say the same thing. */}
                <BigBtn
                  label={t(language, paused ? 'guided.imReady' : 'guided.stopClock')}
                  icon={paused ? 'check' : 'pause'}
                  color={paused ? undefined : theme.ink}
                  onPress={() => {
                    if (paused) {
                      setPaused(false);
                      advance();
                      return;
                    }
                    setPaused(true);
                  }}
                />
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
              elapsedSeconds={derivedElapsedSeconds}
              muted={muted}
              paused={paused}
              resolveTarget={resolveTarget}
              onToggleMute={() => onToggleSoundCues(!soundCuesEnabled)}
              // Pause pauses, and nothing else. It used to open the actions
              // sheet on the way, so the one control you reach for when the
              // rack is taken put five decisions in front of you first.
              onPause={() => {
                if (paused) {
                  setPaused(false);
                  workout.resumeWorkout();
                  return;
                }
                setPaused(true);
                workout.pauseWorkout();
              }}
              onOpenActions={() => setPauseSheetOpen(true)}
              panels={setPanelSource}
              onSwapExercise={() => setSwapOpen(true)}
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
                    {/* No "PAUSED" caption: the button below it has already
                        flipped to Jatka, and a ring frozen mid-sweep is not
                        ambiguous. Asked for 2026-08-21. */}
                  </RestRing>
                </View>
                <View style={{ paddingHorizontal: 24, paddingBottom: 10, gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        label="−15s"
                        onPress={() => {
                          // The rest ring is the one control you use without
                          // looking at it.
                          void haptics.select();
                          adjustRemaining(-15000, 1000);
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        label="+15s"
                        onPress={() => {
                          void haptics.select();
                          adjustRemaining(15000);
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        icon={paused ? 'play' : 'pause'}
                        label={t(language, paused ? 'guided.resume' : 'guided.pause')}
                        onPress={() => setPaused((value) => !value)}
                      />
                    </View>
                  </View>
                  <GhostBtn
                    icon="swap"
                    label={t(language, 'guided.swap.action')}
                    onPress={() => setSwapOpen(true)}
                  />
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
          isSaving={isSavingWorkout}
          language={language}
          onFinish={onFinishSession}
        />
      )}

      {step.type === 'set' ? (
        <Exercise3DSheet
          name={step.exerciseName}
          muscle={libraryFor(step.exerciseName)?.primaryMuscles?.[0] ?? null}
          language={language}
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
          language={language}
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
            {completedSetCount > 0 ? (
              // Leaving the gym after three of six lifts used to mean either
              // skipping through the rest to reach the finish step, or losing
              // the three. This is the same save the finish step runs — the
              // session ends where it is, and what was logged is kept.
              <GhostBtn
                icon="check"
                label={t(language, 'guided.exit.finishSave')}
                onPress={() => {
                  setExitOpen(false);
                  onFinishSession();
                }}
              />
            ) : null}
            {/* Red, because this is the one that throws the sets away. It read
                like the third of three equal choices. */}
            <GhostBtn icon="x" danger label={t(language, 'guided.exit.end')} onPress={handleEndSession} />
          </View>
          <Text style={styles.sheetFootnote}>
            {completedSetCount > 0
              ? t(language, completedSetCount === 1 ? 'guided.exit.footnoteSavedOne' : 'guided.exit.footnoteSavedMany', {
                  count: completedSetCount,
                })
              : t(language, 'guided.exit.footnote')}
          </Text>
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
              color={theme.purple}
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
            {/* Mid-block, the same escape: this sheet is already the "I need to
                do something else" surface. */}
            {skippablePhase ? (
              <GhostBtn
                icon="skip"
                label={t(language, `guided.skipBlock.${skippablePhase}` as 'guided.skipBlock.warmup')}
                onPress={() => {
                  setPauseSheetOpen(false);
                  skipPhase();
                }}
              />
            ) : null}
            {actionExercise ? (
              <>
                <Text style={styles.sheetFootnote}>
                  {exerciseNameLabel(language, actionExercise.exerciseName)}
                </Text>
                <GhostBtn
                  icon="plus"
                  label={t(language, 'guided.action.addSet')}
                  onPress={handleAddSet}
                />
                {/* No longer gated on the substitution group: the sheet
                    searches the whole library, so there is always something
                    behind this row. */}
                {actionExercise ? (
                  <GhostBtn
                    icon="swap"
                    label={t(language, 'guided.action.swap')}
                    onPress={() => {
                      setPauseSheetOpen(false);
                      setSwapOpen(true);
                    }}
                  />
                ) : null}
                <GhostBtn
                  icon="x"
                  label={t(language, 'guided.action.skipExercise')}
                  onPress={handleSkipExercise}
                />
              </>
            ) : null}
          </View>
        </GPSheet>
      )}

      {/* Swapping a lift.

          This used to be the substitution group and nothing else, and the
          button that opened it hid itself when that group was empty — which is
          exactly the moment a reader wants it, standing at a machine somebody
          else is using. The group is still the top of the list, because a
          programme's own alternatives are better answers than a search. The
          library is under it so there is always an answer at all. */}
      <ConfirmDialog
        language={language}
        visible={confirmingEnd}
        destructive
        title={t(language, 'guided.endConfirm.title')}
        message={t(
          language,
          completedSetCount === 1 ? 'guided.endConfirm.bodyOne' : 'guided.endConfirm.bodyMany',
          { count: completedSetCount },
        )}
        confirmLabel={t(language, 'guided.exit.end')}
        cancelLabel={t(language, 'guided.exit.keep')}
        onCancel={() => setConfirmingEnd(false)}
        onConfirm={() => {
          setConfirmingEnd(false);
          onEndSession();
        }}
      />

      {swapOpen && actionExercise && (
        <GPSheet
          onClose={() => {
            setSwapOpen(false);
            setSwapQuery('');
            setPaused(false);
          }}
        >
          <Text style={styles.sheetTitle}>
            {t(language, 'guided.swap.title', {
              name: exerciseNameLabel(language, actionExercise.exerciseName),
            })}
          </Text>

          <TextInput
            value={swapQuery}
            onChangeText={setSwapQuery}
            placeholder={t(language, 'guided.swap.search')}
            placeholderTextColor={theme.faint}
            style={styles.swapSearch}
            autoCorrect={false}
            returnKeyType="search"
          />

          <ScrollView style={styles.swapList} keyboardShouldPersistTaps="handled">
            {swapSuggestions.length > 0 ? (
              <>
                <Text style={styles.swapSectionLabel}>{t(language, 'guided.swap.suggested')}</Text>
                <View style={{ gap: 10 }}>
                  {swapSuggestions.map((name) => (
                    <GhostBtn
                      key={`suggested-${name}`}
                      icon="check"
                      label={exerciseNameLabel(language, name)}
                      onPress={() => applySwap(name)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.swapSectionLabel}>{t(language, 'guided.swap.library')}</Text>
            {swapLibrary.length > 0 ? (
              <View style={{ gap: 10 }}>
                {swapLibrary.map((item) => (
                  <GhostBtn
                    key={item.id}
                    label={exerciseNameLabel(language, item.name)}
                    onPress={() => applySwap(item.name)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.sheetFootnote}>{t(language, 'guided.swap.noMatch')}</Text>
            )}
          </ScrollView>

          <Text style={styles.sheetFootnote}>{t(language, 'guided.swap.footnote')}</Text>
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
  onToggleMute,
  onPause,
  onOpenActions,
  panels,
  onSwapExercise,
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
  onToggleMute: () => void;
  onPause: () => void;
  onOpenActions: () => void;
  /** Resolved by the player; null falls back to the plain photo. */
  panels: {
    history: SetPanelHistory | null;
    instructions: string[];
    imageUrl: string | null;
    initials: string;
  } | null;
  /** Null when this exercise has no catalog alternatives. */
  onSwapExercise: () => void;
  onConfirm: (slotId: string, setIndex: number, reps: number, loadKg: number | null) => void;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const target = resolveTarget(step.slotId, step.setIndex);
  // A hold logs no weight either, so it takes the same wide layout — but its
  // number is seconds, and seconds are dialled in fives, not ones.
  const bodyweight = exercise ? isUnloadedTrackingMode(exercise.trackingMode) : false;
  const timed = exercise ? isTimedTrackingMode(exercise.trackingMode) : false;
  const [reps, setReps] = useState(target?.reps ?? 8);
  const [kg, setKg] = useState(target?.loadKg ?? 0);
  /** Which dial is open for editing; null = both locked. */
  const [dial, setDial] = useState<'reps' | 'weight' | null>(null);

  useEffect(() => {
    setDial(null);
    setReps(target?.reps ?? 8);
    setKg(target?.loadKg ?? 0);
    // Re-derive when the step changes — and when the exercise under the step
    // changes, which is what a swap does without moving the index. Keying on
    // stepIndex alone left the old lift's weight sitting in local state after a
    // swap: the store had already dropped it, the screen still showed it, and
    // pressing Log would have written it. The visible number always wins, so it
    // has to be the one the store agrees with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, step.exerciseName]);

  /**
   * The weight the gate picked, shown as such only while the number on screen
   * is still that one — the moment the stepper moves it, it is the user's
   * weight and the badge has no business claiming otherwise.
   */
  const untouched = target?.loadKg != null && Math.abs(kg - target.loadKg) < 0.001;
  const autoFromKg = untouched && target?.autoProgressedFromKg != null ? target.autoProgressedFromKg : null;
  /**
   * A weight carried in from the same lift in another program or an empty
   * workout. It is a real number the user lifted, but not one this slot has
   * seen — so it says when, rather than appearing out of nowhere. The AUTO
   * badge wins when both apply, which cannot currently happen (the gate never
   * runs on borrowed history) but would be the more specific claim if it did.
   */
  const prefilledFrom = untouched && !autoFromKg ? target?.prefilledFromPerformedAt ?? null : null;
  /**
   * The load had earned a jump and the recovery read held it.
   *
   * The other two badges explain a number that changed. This one explains a
   * number that did not — which is the harder thing to notice and the reason
   * it needs saying at all. A hold nobody sees is indistinguishable from the
   * feature not existing.
   */
  const heldForFatigue = untouched && !autoFromKg && !prefilledFrom && target?.heldForFatigue === true;

  return (
    <StepIn stepKey={`set-${stepIndex}`}>
      {/* The whole screen is the "close the dial" target: a tap that no
          card, button or control claims lands here and shuts whichever dial
          is open. Nested Pressables take their own taps first, so this only
          ever sees the empty space. */}
      <Pressable
        style={{ flex: 1, minHeight: 0 }}
        onPress={dial ? () => setDial(null) : undefined}
        accessible={false}
      >
        {/* Three panels where the photo was. A photo answers "what does this
            look like", which is a question you have once; "what did I lift last
            time" is the one you have standing at the rack. */}
        {panels ? (
          <SetPanels
            height={236}
            language={language}
            history={panels.history}
            instructions={panels.instructions}
            imageUrl={panels.imageUrl}
            initials={panels.initials}
          />
        ) : (
          <MediaZone name={step.exerciseName} library={library} height={236} mode="set" showActions={false} fit="cover" language={language} />
        )}

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
                      { borderColor: done || current ? theme.purple : theme.faint },
                      done && { backgroundColor: theme.purple },
                    ]}
                  >
                    {done ? <GPIcon name="check" size={12} color="#FFFFFF" sw={3} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.setClock}>
            <GPIcon name="clock" size={19} color={theme.muted} sw={2} />
            <Text style={styles.setClockText}>{formatSessionClock(elapsedSeconds)}</Text>
          </View>
        </View>

        <View style={styles.setNameRow}>
          <Text style={styles.setName} numberOfLines={2}>
            {exerciseNameLabel(language, step.exerciseName)}
          </Text>
        </View>

        <View style={styles.setTargetArea}>
          {/* Two dials, side by side: what you did and what was on the bar.
              This used to be a "1 SARJA 6 TOISTOA" headline (the set number
              repeating the "Sarja 1/3" above it) that opened a stepper on tap
              — and that stepper, built for a row, was squeezed to nothing in
              the column and drew its buttons over the number.

              The dials are locked until tapped: with the −/+ always live, a
              thumb resting on the screen between sets changed the number
              without anyone meaning it to. Tap a card to open it, tap again
              or log the set to close it. Hold a button to run. */}
          <View style={styles.setDialRow}>
            <DialCard
              label={t(language, timed ? 'guided.seconds' : 'guided.reps')}
              value={String(reps)}
              unit={null}
              open={dial === 'reps'}
              onToggle={() => setDial((current) => (current === 'reps' ? null : 'reps'))}
              onStep={(direction) => setReps((current) => Math.max(timed ? 5 : 1, current + direction * (timed ? 5 : 1)))}
              downLabel={t(language, timed ? 'guided.a11y.secondsDown' : 'guided.a11y.repsDown')}
              upLabel={t(language, timed ? 'guided.a11y.secondsUp' : 'guided.a11y.repsUp')}
              editHint={t(language, 'guided.a11y.tapToEdit')}
              wide={bodyweight}
              faint={false}
            />

            {/* Weight is decided BEFORE the set. Loaded lifts always get it —
                an unset weight is a faint zero to dial in, never a claim that
                the bar is empty. */}
            {!bodyweight ? (
              <DialCard
                label={t(language, 'guided.weight')}
                value={removeTrailingZeros(kg)}
                unit="kg"
                open={dial === 'weight'}
                onToggle={() => setDial((current) => (current === 'weight' ? null : 'weight'))}
                onStep={(direction) => setKg((current) => Math.max(0, Number((current + direction * 2.5).toFixed(1))))}
                downLabel={t(language, 'guided.a11y.weightDown')}
                upLabel={t(language, 'guided.a11y.weightUp')}
                editHint={t(language, 'guided.a11y.tapToEdit')}
                wide={false}
                faint={kg <= 0}
              />
            ) : null}
          </View>

          {/* Badges about the weight sit under the row, not inside the card,
              so a badge does not make one card taller than the other. */}
          {!bodyweight ? (
            <View style={styles.setBadgeRow}>
                {/* Automated progression is Pro-gated upstream (resolveProgressionOptions),
                    so this badge only ever renders for an unlocked account — and only
                    when the load moved, which is the one case the user did not choose
                    the weight themselves. */}
                {autoFromKg !== null ? (
                  <View style={styles.setAutoBadge}>
                    <GPIcon name="arrowUp" size={13} color={theme.purple} sw={2.8} />
                    <Text style={styles.setAutoBadgeText}>
                      {t(language, 'guided.autoLoad', { kg: removeTrailingZeros(kg - autoFromKg) })}
                    </Text>
                  </View>
                ) : prefilledFrom ? (
                  <View style={styles.setAutoBadge}>
                    <GPIcon name="clock" size={13} color={theme.purple} sw={2.4} />
                    <Text style={styles.setAutoBadgeText}>
                      {t(language, 'guided.carriedFrom', { date: formatShortDate(prefilledFrom, language) })}
                    </Text>
                  </View>
                ) : heldForFatigue ? (
                  <View style={styles.setHoldBadge}>
                    <GPIcon name="shield" size={13} color={theme.green} sw={2.2} />
                    <Text style={styles.setHoldBadgeText}>{t(language, 'guided.heldForRecovery')}</Text>
                  </View>
                ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.logSet')}
            onPress={() => {
              setDial(null);
              onConfirm(step.slotId, step.setIndex, reps, bodyweight ? null : kg);
            }}
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
            <GPIcon name={paused ? 'play' : 'pause'} size={24} color={theme.ink} sw={2.2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.a11y.sound')}
            onPress={onToggleMute}
            style={styles.setRoundBtn}
          >
            <GPIcon name={muted ? 'mute' : 'sound'} size={24} color={muted ? theme.faint : theme.ink} sw={2.2} />
          </Pressable>
          {/* Everything pause used to put in your way — go back one, skip this,
              add a set, skip the exercise — lives behind its own button now. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.a11y.actions')}
            onPress={onOpenActions}
            style={styles.setRoundBtn}
          >
            <GPIcon name="dots" size={24} color={theme.ink} sw={2.2} />
          </Pressable>
          {/* Was "List" — the table logger is gone, and this slot now does the
              one thing people left the guided flow for. Same icon on purpose:
              the button did not move, only what it opens. Hidden when the
              exercise has no alternatives, rather than opening an empty sheet. */}
          {onSwapExercise ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'guided.action.swap')}
              onPress={onSwapExercise}
              style={styles.setListBtn}
            >
              <GPIcon name="swap" size={20} color={theme.ink} sw={2.2} />
              <Text style={styles.setListBtnText}>{t(language, 'guided.swapShort')}</Text>
            </Pressable>
          ) : null}
        </View>
        {/* No "Seuraava · …" line here: on a set it named the same lift's next
            set, which the dots above already say. The drills keep theirs — a
            next drill with its seconds is worth a line. */}
      </Pressable>
    </StepIn>
  );
}

/* ── dark scrollable session summary ── */
/**
 * The last step: the save, and nothing else.
 *
 * This used to be a summary — week bar, title, PR card, duration/sets/volume,
 * a coach line, next up — and then Workout Complete opened straight after it
 * with the same facts and more of them. Two finish screens, the first a
 * thinner version of the second, which is why it read as the poor relation.
 *
 * The week bar and the next session moved to Workout Complete; the PR, the
 * stats and the coach line were already there. What is left is the one thing
 * that belongs between the last set and the summary: saying the workout is
 * being written down, so a slow save is never a blank screen.
 */
function FinishView({
  sessionTitle,
  isSaving,
  language,
  onFinish,
}: {
  sessionTitle: string;
  isSaving: boolean;
  language: AppLanguage;
  onFinish: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const firedRef = useRef(false);

  // Fires once on arrival: the summary is the destination now, so there is
  // nothing here to read and nothing to press.
  useEffect(() => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    onFinish();
  }, [onFinish]);

  return (
    <StepIn stepKey="finish">
      <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={styles.finishTitle}>{t(language, 'guided.finish.title', { title: sessionTitle })}</Text>
        <ActivityIndicator size="large" color={GPD.green} />
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: GPD.muted }}>
          {t(language, isSaving ? 'guided.finish.saving' : 'guided.finish.continue')}
        </Text>
      </View>
    </StepIn>
  );
}

function HowToSheetView({
  libraryItem,
  fallbackName,
  language,
  onClose,
}: {
  libraryItem: ExerciseLibraryItem | null;
  /** The step's own label, already in the reader's language. */
  fallbackName: string;
  language: AppLanguage;
  onClose: () => void;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  // The sheet is titled with the same name the step showed, not the library
  // row's English — the two read differently ("Takakyykky" over "Barbell Full
  // Squat") and the user tapped the former.
  return (
    <GPSheet onClose={onClose}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.ink }}>{fallbackName}</Text>
      {libraryItem?.primaryMuscles?.[0] ? (
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.purple, marginTop: 4 }}>
          {libraryLabel(libraryItem.primaryMuscles[0], language)}
        </Text>
      ) : null}
      <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 13, marginTop: 18, paddingBottom: 8 }}>
          {(libraryItem?.instructions ?? []).map((instruction, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
              <View style={styles.howToNumber}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.purpleDark }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.ink, lineHeight: 22 }}>{instruction}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </GPSheet>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  /* entry */
  entryRoot: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  entryEyebrow: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.5, color: theme.muted },
  entryTitle: { marginTop: 8, marginBottom: 4, fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: theme.ink },
  entrySub: { fontSize: 14.5, fontWeight: '600', color: theme.muted },
  resumeCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.highlightSoft,
    borderWidth: 1.5,
    borderColor: theme.highlight,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  phaseCard: {
    backgroundColor: theme.surface,
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
  // `highlight` is the "you can press this" colour — violet in light, orange in
  // dark, where violet is left carrying brand and structure.
  phasePlay: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.highlightSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `accent`, not `green`: this is the "do the thing" button, the same one
  // Home's Start workout is, and in dark that action colour is orange while
  // green keeps meaning *done*. In light both tokens are the same green, so
  // nothing moves there.
  startCta: {
    height: 60,
    borderRadius: 19,
    backgroundColor: theme.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 18,
    shadowColor: theme.accent,
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
    backgroundColor: theme.surface,
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
    backgroundColor: theme.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { fontSize: 46, fontWeight: '800', letterSpacing: -1.4, color: theme.ink, textAlign: 'center' },
  readyDigit: { fontSize: 150, fontWeight: '800', letterSpacing: -7, color: theme.ink, lineHeight: 160, fontVariant: ['tabular-nums'] },

  /* drill / set */
  exerciseName: { fontSize: 27, fontWeight: '800', letterSpacing: -0.5, color: theme.ink, lineHeight: 31, textAlign: 'center' },
  cueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 7, maxWidth: '100%' },
  howToLink: { fontSize: 13, fontWeight: '800', color: theme.purple },
  positionName: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: theme.ink,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  positionPlan: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.muted,
  },
  drillCountdown: { fontSize: 104, fontWeight: '800', letterSpacing: -4, lineHeight: 110, fontVariant: ['tabular-nums'] },
  ctrlCircle: {
    borderRadius: 999,
    backgroundColor: theme.surface,
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
  setCounter: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: theme.purple, fontVariant: ['tabular-nums'] },
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
  setClockText: { fontSize: 19, fontWeight: '800', color: theme.muted, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  setNameRow: { paddingTop: 6, paddingHorizontal: 24 },
  setName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.63, color: theme.ink, lineHeight: 24 },
  setTargetArea: { flex: 1, minHeight: 0, justifyContent: 'center', paddingHorizontal: 22, gap: 10 },
  // Two dials of equal width. Each is a card, so the reps dial no longer
  // floats as a bare headline over a boxed weight — same shape, same weight.
  setDialRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  setDialCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
  },
  // A bodyweight lift has one dial; it takes the row rather than half of it.
  setDialCardWide: { flex: 1 },
  // Open: the border says which card the buttons belong to.
  setDialCardOpen: { borderColor: theme.purple, backgroundColor: theme.surface },
  setDialLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  setDialLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1, color: theme.muted },
  // Same height open or closed — the number does not jump when the buttons
  // appear beside it.
  setDialControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42 },
  setDialBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDialBtnText: { fontSize: 22, fontWeight: '800', color: theme.purple, lineHeight: 26 },
  // The value shrinks (flexShrink + adjustsFontSizeToFit on the number) rather
  // than pushing the buttons out of the card: "100 kg" is a real weight and
  // has to fit next to two 40dp buttons in half a screen.
  setDialValue: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 2, flexShrink: 1, minWidth: 0 },
  setDialNumber: {
    flexShrink: 1,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.3,
    color: theme.ink,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 44,
  },
  // Open, the number shares the row with two buttons and is sized so that
  // "72.5" fits at this size outright — with the size auto-fitting, "72.5"
  // shrank and "75" did not, and the number jumped on every other tap. One
  // size for every value up to four characters; the auto-fit stays only as a
  // safety net for "102.5".
  setDialNumberOpen: { fontSize: 28, lineHeight: 32, letterSpacing: -1 },
  setDialUnit: { fontSize: 14, fontWeight: '800', color: theme.faint },
  setBadgeRow: { alignItems: 'center', minHeight: 27 },
  setAutoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 11,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.purpleSoft,
  },
  setAutoBadgeText: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, color: theme.purple },
  // Green, not purple: purple marks a load the app RAISED. A hold is the app
  // protecting the session — the same colour would read as the same event
  // with a different word, and green is the app's "this is deliberate and
  // fine" rather than an alarm, which a held weight is not.
  setHoldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 11,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.greenSoft,
  },
  setHoldBadgeText: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, color: theme.green },
  // 64 → 52 and a lighter shadow: the button had the height of the two dials
  // above it put together, and the shadow made it read taller still.
  setLogButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  setLogButtonText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.17 },
  setControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 10 },
  setListBtn: {
    height: 60,
    borderRadius: 999,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  setListBtnText: { fontSize: 15, fontWeight: '800', color: theme.ink, letterSpacing: -0.15 },
  setRoundBtn: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
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
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostBtnText: { fontSize: 14.5, fontWeight: '800', color: theme.ink },

  /* rest (light theme like every other in-workout screen) */
  // The ring itself carries the purple; label and figure stay ink so the
  // countdown reads like every other number in the player.
  restRingLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2.6, color: theme.ink },
  restCountdown: {
    fontSize: 76,
    fontWeight: '800',
    letterSpacing: -2.9,
    color: theme.ink,
    lineHeight: 80,
    fontVariant: ['tabular-nums'],
  },
  skipRestBtn: {
    height: 56,
    borderRadius: 17,
    backgroundColor: theme.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 6,
  },

  /* finish */
  finishTitle: { marginTop: 6, marginHorizontal: 2, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: GPD.ink },

  /* sheets */
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(14,8,30,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 30,
    maxHeight: '78%',
  },
  swapSearch: {
    marginBottom: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 14,
    color: theme.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  swapList: {
    // Bounded so the footnote below it stays on screen; the sheet's own
    // maxHeight cannot do this on its own with a list inside it.
    maxHeight: 380,
  },
  swapSectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E4DBF5', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: theme.ink, marginBottom: 16 },
  sheetFootnote: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 19,
  },
  howToNumber: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

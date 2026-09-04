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
  getGuidedPhaseRail,
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
  buildGuidedRunSheet,
  getGuidedNextName,
  getGuidedNextPreview,
  getGuidedPhaseLabel,
  getGuidedSessionTitle,
  getGuidedSkipTargetIndex,
  getGuidedStepAnchor,
  getGuidedStepLabel,
  isGuidedExerciseOut,
  resolveGuidedOpening,
  resolveGuidedSetTarget,
} from '../lib/guidedPlayer';
import {
  buildLastTimeLine,
  buildOverviewScheme,
  buildProgressionPill,
  findLastTimeSession,
  LastTimeSessionLike,
} from '../lib/sessionOverviewRows';
import {
  formatLastOwnBlock,
  OwnBlockPhase,
  OwnBlockStats,
  recordOwnBlock,
  shouldOfferAlwaysOwn,
} from '../lib/ownBlockHistory';
import { resolveMovement } from '../lib/sessionMovement';
import { buildWarmupBrief } from '../lib/warmupBrief';
import { commitDialWeight, stepDialWeight } from '../lib/weightDial';
import { getExerciseInstructions } from '../lib/exerciseInstructions';
import { getExerciseTeaching } from '../lib/exerciseTeaching';
import { buildExerciseSheetHistory, LastTimeView } from '../lib/exerciseSheetHistory';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { CtaShimmer } from '../components/CtaShimmer';
import { getDrillLibraryName } from '../lib/drillMedia';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { libraryLabel } from '../lib/libraryLabel';
import { localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { classifySessionFocus, getDefaultCooldown, getDefaultWarmup } from '../lib/homeSessionHero';
import { formatShortDate, formatWeight, parseNumberInput, removeTrailingZeros } from '../lib/format';
import { estimateSessionMinutes } from '../lib/sessionDuration';
import { t } from '../lib/i18n';
import { haptics } from '../utils/haptics';
import { subscribeRestActions, useRestEndAlert } from '../hooks/useRestEndAlert';
import { useRestAlertPermissionMoment } from '../hooks/useRestAlertPermissionMoment';
import { RestAlertsSheet } from '../components/RestAlertsSheet';
import { RestAlertAskOutcome } from '../lib/restAlertAnswer';
import { sound, type CueSound } from '../utils/sound';
import { readableOn, Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { AppLanguage, ExerciseLibraryItem, UnitPreference } from '../types/models';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { elapsedSecondsOf } from '../features/workout/workoutState';
import { buildSwapOptionsForSlot, TailoringPreferencesInput } from '../lib/tailoringFit';
import { exerciseMatchesQuery, rankExerciseMatches } from '../lib/exerciseSearch';
import { getPopularExerciseLibraryOrder } from '../lib/exerciseSuggestions';
import { useKeepScreenAwake } from '../utils/keepAwake';
import {
  getHistoryEntriesForExercise,
  resolveInstanceBorrowRepWindow,
} from '../features/workout/workoutState';
import { resolveLastTimeEntry } from '../lib/exerciseHistoryLookup';
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
  green: '#37D08A',
};

const SPLASH_MS = 2300;

/** How many set dots the row will draw before it stops counting in dots. */
const SET_DOT_CAP = 9;

/**
 * A phase splash that offers the "do it yourself" fork. Those wait for a
 * tap; the work splash is a beat between phases and passes on its own.
 */
function splashCarriesChoice(target: GuidedStep) {
  return target.type === 'splash' && (target.phase === 'warmup' || target.phase === 'cooldown');
}

/**
 * How long a step runs on the clock. Module scope, not a closure: the screen
 * can now mount straight onto a resumed step, and the timer it opens with has
 * to be armed before the first render rather than by the goTo that no longer
 * happens.
 */
function stepSeconds(target: GuidedStep): number {
  switch (target.type) {
    case 'ready':
      return 3;
    case 'drill':
    case 'rest':
    case 'position':
      return target.seconds;
    case 'splash':
      return splashCarriesChoice(target) ? 0 : SPLASH_MS / 1000;
    // An interval's work bout runs on the clock like everything else here.
    // An ordinary set does not: it ends when the reader says it ended.
    case 'set':
      return target.interval?.workSeconds ?? 0;
    default:
      return 0;
  }
}

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
  /**
   * The reader's own warm-up / cool-down picks.
   *
   * Without these the player coached the drill they replaced: the swap showed
   * on Home and in the day editor and never reached the one screen that
   * actually runs it (found in review, 2026-08-31).
   */
  routineDrillOverrides?: Record<string, string>;
  /** Ranks the swap list the same way the list logger does. */
  tailoringPreferences?: TailoringPreferencesInput | null;
  exerciseLibrary: ExerciseLibraryItem[];
  soundCuesEnabled: boolean;
  /** Keep the display on for the whole guided session. */
  keepScreenAwake?: boolean;
  onToggleSoundCues: (next: boolean) => void;
  entryEyebrow: string;
  /**
   * Every finished session, so the overview can find the last run of this same
   * day. Which one that is depends on the live session's template ids, which
   * this screen holds and the caller does not.
   */
  completedSessions?: ReadonlyArray<LastTimeSessionLike>;
  /** How the reader's own warm-ups have gone — see lib/ownBlockHistory.ts. */
  ownBlockStats?: OwnBlockStats;
  /** The standing "skip the drills" choice, if they have made one. */
  alwaysOwnWarmup?: boolean;
  /** One finished self-run block, for the "last time you took" line. */
  onRecordOwnBlock?: (phase: OwnBlockPhase, seconds: number) => void;
  onSetAlwaysOwnWarmup?: (next: boolean) => void;
  /** The Learn section's own two facts, so the sheet can show and change them. */
  learnedExerciseIds?: string[];
  techniqueChecks?: Record<string, number[]>;
  onToggleTechniqueStatement?: (libraryItemId: string, index: number) => void;
  onToggleExerciseLearned?: (libraryItemId: string) => void;
  weekProgress: GuidedWeekProgress | null;
  nextUp: GuidedNextUp | null;
  onLeave: () => void;
  onEndSession: () => void;
  onFinishSession: () => void;
  isSavingWorkout: boolean;
  /** Rest & alerts settings (design: Background Timer). */
  restAlerts?: { alerts: boolean; warning: boolean; ongoing: boolean; asked: boolean };
  /** The first-rest permission sheet was answered — see restAlertsAnswered. */
  onRestAlertsAnswered?: (outcome: RestAlertAskOutcome) => void;
  /**
   * The reader asked to CONTINUE, not to open the session.
   *
   * Set by the paths whose own button already said "Resume workout" — Home's
   * hero, the lock-screen card. Opening the overview after that is the app
   * asking a question the reader has already answered.
   */
  autoResume?: boolean;
}

/**
 * A set by its own index, not by where it sits in the array.
 *
 * Today those are the same thing — sets are only ever appended and only ever
 * removed from the end, so `setIndex` tracks position. The reducer looks sets
 * up by the field anyway (`sets.find(item => item.setIndex === …)`), and two
 * readers of one fact disagreeing quietly is exactly the class of bug this
 * screen has already shipped once. So this one asks the same question the
 * reducer does, and a "remove the middle set" that arrives later cannot make
 * the rest screen show the wrong set's numbers.
 */
function findSetByIndex(
  exercise: WorkoutExerciseInstance | null | undefined,
  setIndex: number,
): WorkoutExerciseInstance['sets'][number] | null {
  return exercise?.sets.find((item) => item.setIndex === setIndex) ?? null;
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
    chevD: <Path d="M6 9l6 6 6-6" />,
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
    minus: <Path d="M5 12h14" />,
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
    info: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 11v5.5M12 7.6v.1" />
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

  // The media zone always shows the flat photo (or initials). A 3D rig with
  // an on-demand sheet lived here until 2026-08-26 ("poistetaan kaikki 3d
  // videot mitä tehtiin, palaan tähän joskus myöhemmin") — the HowToSheet
  // with written instructions is the how-to path now. The muscle chip was
  // dropped in the v4 pass (user: the label added nothing on any exercise).
  const overlays = null;

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
  /** The arc's colour. An interval's work bout draws it in the highlight. */
  stroke,
  children,
}: {
  stepKey: number;
  leftSeconds: number;
  plannedSeconds: number;
  size?: number;
  stroke?: string;
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
  /*
   * A drained ring is a full ring, not an empty one.
   *
   * The arc shrinks as the wait runs down, so at zero it had no length at all
   * and the only thing left on screen was the track — which meant the rest
   * screen's "the wait is over" state was drawn in the track's colour instead
   * of the accent it asks for (device 2026-09-04). Now the arc closes back up
   * at zero and takes the over-colour with it.
   */
  const over = leftSeconds <= 0;
  const fraction = over ? 1 : Math.max(0, Math.min(1, leftSeconds / total));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* The track was a light-theme hex on both themes: a bright lilac ring
            on a near-black page, brighter than the arc it was backing. */}
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.purpleLight} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke ?? theme.purple}
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
  clock,
  muted,
  onMute,
  onExit,
  video,
}: {
  dark: boolean;
  label: string;
  /**
   * Session elapsed, m:ss. The one clock in the session, and it belongs here:
   * it is the only number that is true on every screen, so anywhere else it
   * has to be drawn again — and it was, on the set screen, in a row that runs
   * out of width the moment a lift has a long name.
   */
  clock: string | null;
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  /**
   * Set screen v4: the right slot shows the how-it's-done camera instead of
   * mute, and mute moves down beside pause.
   */
  /** `active` lights the button while the panel it opens is showing. */
  video?: { label: string; onPress: () => void; active?: boolean } | null;
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
        {clock ? `${label} · ${clock}` : label}
      </Text>
      {video ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: video.active }}
          accessibilityLabel={video.label}
          onPress={video.onPress}
          style={[buttonStyle, video.active ? styles.topBtnActive : null]}
          hitSlop={8}
        >
          <GPIcon name="video" size={20} color={video.active ? theme.purple : iconColor} sw={2.1} />
        </Pressable>
      ) : (
        <Pressable onPress={onMute} style={buttonStyle} hitSlop={8}>
          <GPIcon name={muted ? 'mute' : 'sound'} size={19} color={muted ? (dark ? GPD.faint : theme.faint) : iconColor} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * The rail is also the way in to the run sheet.
 *
 * It was already the only thing on screen that stood for the whole session
 * rather than for this moment of it — it just could not be read, being dots.
 * Making it the handle keeps the player at one control per screen: nothing new
 * appears, the thing that was already there answers a question it was already
 * being asked ("Treenin aikana ei ole mitään keinoa nähdä seuraavaa liikettä",
 * #bugs 2026-08-27).
 */
function ProgressRail({
  groups,
  current,
  dotIndex,
  dotsDone,
  onPress,
  openLabel,
}: {
  /**
   * One phase's groups, not the session's — three drills, five exercises, two
   * stretches. Sliced by `getGuidedPhaseRail`; where in the session that phase
   * sits is what the top bar says.
   */
  groups: Array<{ phase: string; setCount?: number }>;
  current: number;
  dotIndex: number;
  dotsDone: number;
  onPress?: () => void;
  openLabel?: string;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const Rail = onPress ? Pressable : View;

  return (
    <Rail
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? openLabel : undefined}
      onPress={onPress}
      // The dots are small and the bar is thin; the target is the strip.
      hitSlop={onPress ? 10 : undefined}
      style={styles.rail}
    >
      {groups.map((group, index) => {
        const isCurrent = index === current;
        const done = index < current;
        // No phase gap any more: the rail holds one phase, so every segment
        // in it is the same kind of thing and they space evenly.
        if (isCurrent && (group.setCount ?? 0) > 1) {
          return (
            <View
              key={index}
              style={[
                styles.railSetPill,
                {
                  marginLeft: 5,
                  backgroundColor: theme.highlightSoft,
                  // The rim marks the current exercise; done and still-to-come
                  // are flat bars. Amber held this job from 2026-09-01, when
                  // the problem was that current and done were the same violet
                  // told apart by two pixels of height. `highlight` solves that
                  // as well as amber did and gives amber back to caution, which
                  // the session now uses for a flagged body part.
                  borderColor: theme.highlight,
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
                        ? theme.green
                        : dot === dotIndex
                          ? theme.highlight
                          : theme.faint,
                    opacity: dot === dotIndex && dot >= dotsDone ? 0.9 : dot < dotsDone ? 1 : 0.45,
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
              marginLeft: index === 0 ? 0 : 5,
              height: isCurrent ? 7 : 5,
              borderRadius: 999,
              // Three states, three meanings, and the same two colours the
              // rest of the session uses: green is done, `highlight` is where
              // you are, and what is still coming is neither.
              //
              // Current was amber from 2026-09-01, which fixed the real
              // problem — current and done were both violet, told apart by two
              // pixels of height at arm's length — with the one colour the
              // flow now needs for a flagged body part. `highlight` separates
              // them just as far and means the same thing here it means on
              // every button.
              backgroundColor: isCurrent ? theme.highlight : done ? theme.green : theme.faint,
              opacity: isCurrent ? 1 : done ? 0.85 : 0.35,
            }}
          />
        );
      })}
    </Rail>
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
  shimmer,
  tall,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  /** A green tick on a button that stops something reads as confirm. */
  icon?: string;
  disabled?: boolean;
  /**
   * A band of light across the button as the screen arrives — the same mark
   * the Home CTA wears (design 2026-08-26). Opt-in: it belongs on the one
   * button a screen exists to get pressed, not on every button.
   */
  shimmer?: boolean;
  /** For a screen whose whole job is this one decision. */
  tall?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Orange, not green. The dark theme collapses the two accent families —
  // anything pressable is orange, violet carries brand — and green is the
  // colour of "done", not of "press me". A green "Valmis — aloita treeni" put
  // the finished colour on the button that starts the thing (#bugs 2026-08-26).
  const color = colorProp ?? theme.accent;
  // Derived from the fill, not fixed: callers paint this button `theme.ink` to
  // mean "the quiet one", and ink is near-white under the dark theme — so a
  // hard-coded white label made the button read as blank.
  const foreground = readableOn(color);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.bigBtn,
        tall && styles.bigBtnTall,
        { backgroundColor: color, opacity: disabled ? 0.6 : 1, shadowColor: color },
      ]}
    >
      {shimmer && !disabled ? <CtaShimmer tint={`${foreground}55`} /> : null}
      <GPIcon name={icon} size={tall ? 23 : 20} color={foreground} sw={2.6} />
      <Text style={[styles.bigBtnText, tall && styles.bigBtnTextTall, { color: foreground }]}>{label}</Text>
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
  onCommit,
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
  /**
   * Commit a typed value. Given, the open card lets the number be written
   * instead of only stepped — which is what the pencil on the closed card has
   * been promising all along (#bugs 2026-08-27, "ei voi valita tasan 12 kg").
   */
  onCommit?: (text: string) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState<string | null>(null);

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
          {onCommit ? (
            <View style={styles.setDialValue}>
              <TextInput
                value={draft ?? value}
                onChangeText={setDraft}
                onFocus={() => setDraft(value)}
                onBlur={() => {
                  if (draft !== null) {
                    onCommit(draft);
                    setDraft(null);
                  }
                }}
                onSubmitEditing={() => {
                  if (draft !== null) {
                    onCommit(draft);
                    setDraft(null);
                  }
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
                selectTextOnFocus
                accessibilityLabel={label}
                style={[styles.setDialNumber, styles.setDialNumberOpen, faint && { color: theme.faint }]}
              />
              {unit ? <Text style={styles.setDialUnit}>{unit}</Text> : null}
            </View>
          ) : (
            number
          )}
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
  routineDrillOverrides = {},
  tailoringPreferences = null,
  exerciseLibrary,
  soundCuesEnabled,
  keepScreenAwake = false,
  onToggleSoundCues,
  entryEyebrow,
  completedSessions = [],
  ownBlockStats = {},
  alwaysOwnWarmup = false,
  onRecordOwnBlock,
  onSetAlwaysOwnWarmup,
  learnedExerciseIds = [],
  techniqueChecks = {},
  onToggleTechniqueStatement,
  onToggleExerciseLearned,
  weekProgress,
  nextUp,
  onLeave,
  onEndSession,
  onFinishSession,
  isSavingWorkout,
  restAlerts = { alerts: true, warning: true, ongoing: true, asked: false },
  onRestAlertsAnswered,
  autoResume = false,
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
    () =>
      buildGuidedDrillsFromBlock(
        getDefaultWarmup(focusKind, language, availableEquipment, routineDrillOverrides),
      ),
    [focusKind, language, availableEquipment, routineDrillOverrides],
  );
  const cooldownDrills = useMemo<GuidedDrill[]>(
    () =>
      buildGuidedDrillsFromBlock(
        getDefaultCooldown(focusKind, language, availableEquipment, routineDrillOverrides),
      ),
    [focusKind, language, availableEquipment, routineDrillOverrides],
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
  /**
   * Where this mount opens.
   *
   * "Resume workout" on Home used to land here on the overview, because the
   * screen unmounts when you leave and always came back at `entry`. The button
   * said continue and delivered a menu (#bugs 2026-08-29) — so an arrival that
   * explicitly asks to resume goes straight to the set, and every other
   * arrival still gets the overview it was built for.
   *
   * Computed once, in a ref, because it is an opening position and not a
   * derived value: recomputing it as sets get logged would drag the screen
   * back to wherever the store's anchor points.
   */
  const openingStepRef = useRef<number | null>(null);
  if (openingStepRef.current === null) {
    openingStepRef.current = session
      ? resolveGuidedOpening({
          steps,
          storedIndex: session.ui.guidedStepIndex ?? null,
          anchor: session.ui.guidedResumeAnchor ?? null,
          isSetCompleted,
          autoResume,
        }).stepIndex
      : 0;
  }
  const openingStep = openingStepRef.current;
  const [mode, setMode] = useState<'entry' | 'player'>(openingStep > 0 ? 'player' : 'entry');
  /*
   * The workout opens; the warm-up and the recovery do not.
   *
   * All three used to start closed, which made the overview a screen of three
   * closed doors — the reader had to open the one that holds the session to
   * see the session. The block that carries the weights is the one they came
   * to read.
   */
  const [expandedPhases, setExpandedPhases] = useState<string[]>(['work']);
  const [stepIndex, setStepIndex] = useState(openingStep);
  const step: GuidedStep = steps[Math.min(stepIndex, steps.length - 1)] ?? { type: 'finish' };
  const stepRef = useRef(step);
  stepRef.current = step;

  /* ── timers ── */
  // Seeded from the opening step, not from zero: mounting straight onto a
  // timed step (a walk-up, a drill) with nothing on the clock would expire it
  // on the first tick.
  const openingMs = stepSeconds(steps[openingStep] ?? { type: 'finish' }) * 1000;
  const [remainingMs, setRemainingMs] = useState(openingMs);
  const remainingRef = useRef(openingMs);
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
  const syncRestEndAlert = useRestEndAlert(language, {
    warning: restAlerts.warning,
    ongoing: restAlerts.ongoing,
    session: sessionCard,
  });
  /**
   * The OS mirror of a rest, behind the same switch the empty workout
   * honours: the phone's master notifications switch silences rest alerts
   * too (user 2026-08-22). This screen used to hand every rest to the OS
   * regardless, which on a fresh install meant a ladder behind a permission
   * nobody had been asked for — nothing fired, and nothing said so.
   */
  const syncRestNotification = useCallback(
    (endsAtMs: number | null, nextName?: string | null) =>
      syncRestEndAlert(restAlerts.alerts ? endsAtMs : null, nextName),
    [restAlerts.alerts, syncRestEndAlert],
  );

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
  /**
   * Doing a block your own way.
   *
   * The block used to offer "Skip warmup", which named the wrong thing: a
   * reader with their own five minutes on the bike is not skipping the
   * warmup, they are doing it — the guided drills are what they are leaving
   * (user 2026-08-26). So the block is left by SAYING you will do it
   * yourself, and the app waits with a clock instead of jumping straight to
   * the first lift. The step index does not move until you come back, so
   * backgrounding the app mid-warmup returns you here rather than to a set
   * you never started.
   */
  const [ownBlock, setOwnBlock] = useState<{ phase: 'warmup' | 'cooldown'; startedAt: number } | null>(
    null,
  );
  /** The "always start with my own warm-up" offer, once it has been earned. */
  const [alwaysOwnAsk, setAlwaysOwnAsk] = useState(false);
  /**
   * The set screen's exercise info (history, how-to, photo). It opens from the
   * header's right-hand button now, so the state lives beside the header
   * rather than inside the set view (user 2026-08-26). Reset on every step, so
   * each lift starts quiet — the rule the old tab followed too.
   */
  const [setPanelsOpen, setSetPanelsOpen] = useState(false);
  // v4 set screen: the top-bar camera opens the 3D rig from screen level, so
  // the media zone no longer carries its own button.
  const [exitOpen, setExitOpen] = useState(false);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  /** The session as a list, opened from the rail. Read-only — it moves nothing. */
  const [runSheetOpen, setRunSheetOpen] = useState(false);
  const [confirmingSkipExercise, setConfirmingSkipExercise] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapQuery, setSwapQuery] = useState('');
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  /** The lift whose final set was just logged — a one-second check-splash
      before the next exercise's walk-up screen. Null = no splash showing. */
  // The permission moment (rule 05): at the first rest, in context, once.
  // The rest step's index is the rest's identity — a new rest is a new step.
  // Paused or not does not matter here: a paused rest is still that rest.
  // No grant handler of its own — the sheet freezes the step (below), and
  // unfreezing re-runs the step effect, which mirrors the rest through the
  // same switch as every other rest.
  const restAsk = useRestAlertPermissionMoment({
    restRunning: mode === 'player' && step.type === 'rest',
    restKey: step.type === 'rest' ? stepIndex : null,
    asked: restAlerts.asked,
    alertsWanted: restAlerts.alerts,
    onAnswered: onRestAlertsAnswered,
  });
  // The permission sheet freezes the step like every other sheet: a short
  // rest expiring behind the ask would walk the reader onto a set screen
  // they did not come back for (PR review).
  const frozen = paused || howtoOpen || exitOpen || pauseSheetOpen || swapOpen || ownBlock !== null || restAsk.sheetOpen;
  // Seconds since the reader said they would do it themselves. Derived from
  // the session clock's tick so it needs no timer of its own.
  const ownElapsedSeconds = ownBlock ? Math.max(0, Math.floor((clockNowMs - ownBlock.startedAt) / 1000)) : 0;

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
      setSetPanelsOpen(false);
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
  /**
   * What a running-out timer does. Everything but an interval just advances;
   * an interval's work bout also LOGS itself, because the whole point of the
   * interval screen is that the reader never taps it — assigned below, where
   * confirmSet exists.
   */
  const expireRef = useRef<() => void>(() => advanceRef.current());

  useEffect(() => {
    if (mode !== 'player' || frozen) {
      // Pausing freezes the leftover time; the deadline is re-derived on resume.
      endsAtRef.current = null;
      return;
    }
    // Not `position` any more: walking to another machine is not time-bound,
    // so that screen has no clock to run (user 2026-09-04).
    const timed =
      step.type === 'ready' ||
      step.type === 'drill' ||
      step.type === 'rest' ||
      (step.type === 'splash' && !splashCarriesChoice(step)) ||
      (step.type === 'set' && step.interval !== undefined);
    if (!timed) {
      endsAtRef.current = null;
      return;
    }
    /** A rest waits for the reader; an interval's walk is part of the rhythm. */
    const restHoldsAtZero = step.type === 'rest' && !step.recoveryKind;

    /*
     * The clamp is for a step that has not started, not for a rest that is
     * already over.
     *
     * A rest counts on past zero, so its leftover is negative — and clamping
     * that to 0 threw the overtime away every time anything froze the timer:
     * open the exit dialog on a rest showing "+3:20 over", cancel it, and the
     * count started again from zero. `restHoldsAtZero` is exactly the case
     * where a negative remainder is a real number to keep.
     */
    endsAtRef.current =
      Date.now() + (restHoldsAtZero ? remainingRef.current : Math.max(0, remainingRef.current));

    // A rest is the one wait long enough to put the phone down for, so its
    // deadline also goes to the OS — that alert is what reaches the user when
    // Android has suspended us. Not once it has already passed, though: a
    // deadline in the past is an alert that fires the moment it is set.
    if (step.type === 'rest' && endsAtRef.current > Date.now()) {
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
          // Rest running out is the one transition the user may not be looking
          // at — but a cue fired minutes late (we were backgrounded when it
          // expired) is noise, so only sound it if we caught the moment.
          if (step.type === 'rest' && next > -1500) {
            // An interval's recovery ending means "go" — the next thing is a
            // work bout, not a set you walk up to in your own time.
            cue(step.recoveryKind ? 'go' : 'rest');
          }
          if (!restHoldsAtZero) {
            clearInterval(interval);
            expireRef.current();
            return;
          }
        }
        /*
         * An ordinary rest does not advance itself.
         *
         * Every other timed step here runs out into the next one, which is
         * right for a drill and for an interval's walk — those are a rhythm
         * you are standing in. A rest is a wait you end: the phone was in a
         * pocket, the rack was busy, the set before it was harder than it
         * looked. Advancing on the reader's behalf put them on a set screen
         * they had not asked for and had not seen start.
         *
         * So the clock keeps running past zero and the screen says READY and
         * how far over. Deciding to go is the reader's; the app's job is to
         * have told them they can (design: session flow, screen 7).
         */
        setRemainingMs(next);
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

  // Same resolver the opening position came from, so the card at the top, the
  // button at the bottom and the step this screen mounted on cannot disagree.
  const opening = resolveGuidedOpening({
    steps,
    storedIndex: session.ui.guidedStepIndex ?? null,
    anchor: session.ui.guidedResumeAnchor ?? null,
    isSetCompleted,
    autoResume: false,
  });
  const resumeIndex = opening.resumeIndex;
  const showResume = opening.primaryAction === 'resume';

  const confirmSet = (slotId: string, setIndex: number, reps: number, loadKg: number | null) => {
    workout.updateSetDraft(slotId, setIndex, {
      repsText: String(reps),
      loadText: loadKg === null ? '' : removeTrailingZeros(loadKg),
    });
    workout.completeSet(slotId, setIndex, unitPreference);
    cue('done');
    // The beat the finished lift is owed (user 2026-08-23) is on the walk-up
    // screen itself now, as a green card the reader can look at for as long as
    // they like — rather than a splash that covered that screen for three and
    // a half seconds and then took itself away.
    advance();
  };

  // The interval work bout logs the seconds its name promised and runs on.
  // Unloaded on purpose: a treadmill speed is not a weight, and asking for
  // one mid-sprint is asking for nothing.
  expireRef.current = () => {
    const current = steps[stepIndex];
    if (current?.type === 'set' && current.interval) {
      confirmSet(current.slotId, current.setIndex, current.interval.workSeconds, null);
      return;
    }
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

  /**
   * Leaving the free timer.
   *
   * The duration is recorded here rather than on every tick: a block abandoned
   * by pressing "do the guided drills instead" is not a block that took four
   * minutes, and the "last time you took" line has to be a time somebody
   * actually spent.
   */
  const finishOwnBlock = (completed: boolean) => {
    const current = ownBlock;
    setOwnBlock(null);
    if (!current) {
      return;
    }
    if (completed) {
      const seconds = Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000));
      onRecordOwnBlock?.(current.phase, seconds);
      // Asked after the recorded third, so the count the offer reads includes
      // the one just finished.
      if (
        current.phase === 'warmup'
        && shouldOfferAlwaysOwn(recordOwnBlock(ownBlockStats, 'warmup', seconds), 'warmup', alwaysOwnWarmup)
      ) {
        setAlwaysOwnAsk(true);
      }
      skipPhase();
    }
  };

  /**
   * The standing choice, honoured.
   *
   * A reader who has said "always my own" should not meet the fork again — so
   * the warm-up gate opens straight into the timer. The way back out is on
   * that screen, and taking it clears the standing choice: the app assumed,
   * the reader disagreed, so the assumption goes.
   */
  const gateIsWarmupSplash = step.type === 'splash' && step.phase === 'warmup';
  useEffect(() => {
    if (alwaysOwnWarmup && mode === 'player' && gateIsWarmupSplash && !ownBlock) {
      setOwnBlock({ phase: 'warmup', startedAt: Date.now() });
    }
    // Only the arrival matters; re-running on every ownBlock change would
    // reopen the timer the moment the reader closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysOwnWarmup, mode, gateIsWarmupSplash]);


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
    /*
     * Through the same resolver the prefill uses, with the same inputs.
     *
     * This read `slotHistory[slotId]` and stopped there, while the prefill fell
     * through to the slot's unscoped key and then to a name lookup — so the
     * first time a lift came round in a new slot the table said "first time on
     * this exercise" directly above a weight badged "LAST TIME · 27.8."
     * (#bugs 2026-08-29). Same question, one reader.
     */
    const instance = exerciseBySlot.get(slotId) ?? null;
    const resolved = resolveLastTimeEntry({
      slotHistory: workout.history.slotHistory,
      slotId,
      templateSlotId: instance?.templateSlotId ?? null,
      exerciseName: name,
      requireLoaded: instance ? !isUnloadedTrackingMode(instance.trackingMode) : false,
      repWindow: instance ? resolveInstanceBorrowRepWindow(instance) : null,
    });
    const last = resolved?.entry ?? null;
    const heaviest = last ? Math.max(...last.sets.map((set) => set.loadKg)) : 0;

    const history: LastTimeView | null = last
      ? {
          performedAt: last.performedAt,
          // Said out loud rather than passed off as this slot's own record —
          // it is a real number, lifted on a different day.
          borrowed: resolved?.borrowed ?? false,
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
  }, [exerciseBySlot, exerciseLibrary, language, step, workout.history.slotHistory]);

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
    // Best answer first, popularity breaking ties — the same rule as the
    // pickers, so the swap sheet does not disagree with them.
    const popular = getPopularExerciseLibraryOrder(exerciseLibrary);
    return rankExerciseMatches(pool, query, language, (item) => popular.get(item.id)).slice(0, 40);
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

  /**
   * The bar under the step: this phase's segments, and where in them we are.
   * A step with no group of its own (a splash, the finish) keeps the phase it
   * belongs to by falling back on group 0, which the rail then clamps.
   */
  /**
   * The drills the gate is offering, with the body part each one is there for.
   *
   * The purpose line is derived from the drill's stand-in library row rather
   * than written per drill: every drill has one, so the column is never half
   * empty, and a hand-written reason for forty drills is forty strings to keep
   * true in two languages.
   */
  const gateDrills = useMemo(() => {
    if (!skippablePhase) {
      return [] as Array<{ name: string; why: string | null; seconds: number }>;
    }
    const source = skippablePhase === 'warmup' ? warmupDrills : cooldownDrills;
    return source.map((drill) => {
      const item = libraryFor(getDrillLibraryName(drill.name) ?? drill.name);
      return {
        name: drill.name,
        why: item?.bodyPart ? libraryLabel(item.bodyPart, language) : null,
        seconds: drill.seconds,
      };
    });
    // libraryFor closes over exerciseLibrary and is stable enough for this:
    // the library is seeded once per load and does not change mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skippablePhase, warmupDrills, cooldownDrills, exerciseLibrary, language]);

  const ownLastTimeLine = ownBlock ? formatLastOwnBlock(ownBlockStats, ownBlock.phase, language) : null;
  /** What the workout is about to load, for the reader warming up their own way. */
  const warmupBrief = useMemo(
    () =>
      buildWarmupBrief(
        activeExercises.map((exercise) => ({
          exerciseName: exercise.exerciseName,
          bodyPart: libraryFor(exercise.exerciseName)?.bodyPart ?? null,
          setCount: exercise.sets.length,
          repsLabel: formatRepRangeLabel(exercise.sets[0]),
          timed: isTimedTrackingMode(exercise.trackingMode),
          loadKg: resolveTarget(exercise.slotId, 0)?.loadKg ?? null,
        })),
        language,
        unitPreference,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExercises, exerciseLibrary, language, resolveTarget, unitPreference],
  );

  /**
   * The sheet's WATCH FOR chips: this lift's common mistakes.
   *
   * Three lifts have hand-written teaching, so the chip row is usually empty —
   * and empty is the honest state. A generic "keep good form" chip on the
   * other eight hundred would be furniture with an alarm on it.
   */
  const sheetWatchFor = useMemo(() => {
    if (step.type !== 'set') {
      return [] as Array<{ text: string; flagged: boolean }>;
    }
    // The library's name, for the same reason the Learn tab uses it.
    const teaching = getExerciseTeaching(libraryFor(step.exerciseName)?.name ?? step.exerciseName, language);
    if (!teaching) {
      return [];
    }
    return teaching.mistakes.map((mistake) => ({ text: mistake.mistake, flagged: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseLibrary, language, step]);

  /**
   * The Learn tab's payload, or null when this lift has no teaching written.
   *
   * The same self-audit the Learn section shows, at the moment it is actually
   * about: the set is done and the reader is standing over the bar. Only for
   * the lifts that have it — a third tab with nothing in it is worse than two
   * tabs (user 2026-09-04).
   */
  const sheetLearn = useMemo(() => {
    if (step.type !== 'set') {
      return null;
    }
    /*
     * Looked up by the LIBRARY's name for this lift, not the plan's.
     *
     * The teaching table is keyed the way the library names things — "Barbell
     * Bench Press - Medium Grip" — while a programme calls the same lift
     * "Bench Press". Asking with the plan's name found nothing for every lift
     * that has teaching, which is every lift this tab exists for (device
     * 2026-09-04).
     */
    const item = libraryFor(step.exerciseName);
    const teaching = getExerciseTeaching(item?.name ?? step.exerciseName, language);
    const libraryId = item?.id ?? null;
    if (!teaching || teaching.check.length === 0 || !libraryId || !onToggleTechniqueStatement) {
      return null;
    }
    return {
      cues: teaching.cues,
      check: teaching.check,
      checked: techniqueChecks[libraryId] ?? [],
      learned: learnedExerciseIds.includes(libraryId),
      onToggleStatement: (index: number) => onToggleTechniqueStatement(libraryId, index),
      onToggleLearned: () => onToggleExerciseLearned?.(libraryId),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exerciseLibrary,
    language,
    learnedExerciseIds,
    onToggleExerciseLearned,
    onToggleTechniqueStatement,
    step,
    techniqueChecks,
  ]);

  /** Eight sessions of top sets, today's included and growing set by set. */
  const sheetHistory = useMemo(() => {
    const slotId = step.type === 'set' ? step.slotId : null;
    const instance = slotId ? exerciseBySlot.get(slotId) ?? null : null;
    const past = getHistoryEntriesForExercise(workout.history, instance).map((entry) => ({
      performedAt: entry.performedAt,
      sets: entry.sets.map((set) => ({ loadKg: set.loadKg, reps: set.reps })),
    }));
    const todaySets = (instance?.sets ?? [])
      .filter((set) => set.status === 'completed')
      .map((set) => ({ loadKg: set.actualLoadKg ?? 0, reps: set.actualReps ?? 0 }));
    return buildExerciseSheetHistory(
      past,
      todaySets.length > 0 ? { performedAt: new Date().toISOString(), sets: todaySets } : null,
      language,
      instance?.trackingMode ?? 'load_and_reps',
      unitPreference,
    );
  }, [exerciseBySlot, language, step, unitPreference, workout.history]);

  /* ── rest screen ───────────────────────────────────────────────────────── */
  /** The set that was just logged, as one line: "Penkkipunnerrus · 62,5 kg × 7". */
  const restLogged = (() => {
    if (step.type !== 'rest' || step.recoveryKind) {
      return null;
    }
    const set = findSetByIndex(exerciseBySlot.get(step.slotId), step.setIndex);
    if (!set || set.status !== 'completed') {
      return null;
    }
    const reps = set.actualReps ?? 0;
    const load = set.actualLoadKg ?? 0;
    const name = exerciseNameLabel(language, step.exerciseName);
    return load > 0
      ? `${name} · ${formatWeight(load, unitPreference)} × ${reps}`
      : `${name} · ${t(language, 'guided.target.reps', { reps })}`;
  })();

  /** What the rest is resting for: the next set of the same lift. */
  const restNextSet = (() => {
    if (step.type !== 'rest' || step.recoveryKind) {
      return null;
    }
    const next = steps[stepIndex + 1];
    if (!next || next.type !== 'set') {
      return null;
    }
    const target = resolveTarget(next.slotId, next.setIndex);
    return {
      index: next.setIndex,
      count: next.setCount,
      reps: target?.reps ?? 0,
      timed: target?.timed === true,
      pickKg: target?.loadKg ?? null,
      /** The jump the gate just made, so the options sit on its own grid. */
      stepKg:
        target?.autoProgressedFromKg != null && target.loadKg != null
          ? Math.abs(target.loadKg - target.autoProgressedFromKg)
          : undefined,
      slotId: next.slotId,
    };
  })();

  /**
   * The weight the reader picked on the rest screen, when they picked one.
   *
   * Reset by the step change rather than held across rests: each rest is about
   * one set, and a choice made three sets ago is not an answer to this one.
   */
  /**
   * Correcting the set just logged, without leaving the rest.
   *
   * Edit used to walk back to the set screen — which showed a set that was
   * already logged, and whose Log button the reducer refuses (a completed set
   * cannot be completed twice). So the way back was a way to nowhere. The
   * numbers are changed here instead, on the screen that is asking about them.
   */
  const [restEditOpen, setRestEditOpen] = useState(false);
  useEffect(() => {
    setRestEditOpen(false);
  }, [stepIndex]);

  const restLastKg = setPanelSource?.history?.sets.length
    ? Math.max(...setPanelSource.history.sets.map((set) => set.loadKg))
    : null;
  const restChosenKg = restNextSet?.pickKg ?? 0;
  /** How the committed weight compares with the last session — "+2,5 kg". */
  const restTargetMove =
    restNextSet && restChosenKg > 0
      ? resolveMovement(
          {
            exerciseName: step.type === 'rest' ? step.exerciseName : '',
            todayTopKg: restChosenKg,
            todayTopReps: restNextSet.reps,
            previousTopKg: restLastKg,
          },
          language,
          unitPreference,
        )
      : null;
  const restIsOver = step.type === 'rest' && !step.recoveryKind && secondsLeft <= 0;

  /** Into the next set. The weight is the gate's, and the rest screen said so. */
  const startRestNextSet = () => {
    advance();
  };

  /* ── walking to the next machine ───────────────────────────────────────── */
  /** The lift that just ended, when there is one behind this walk-up. */
  const walkDone = (() => {
    if (step.type !== 'position') {
      return null;
    }
    const previous = steps
      .slice(0, stepIndex)
      .reverse()
      .find((candidate) => candidate.type === 'set' || candidate.type === 'splash');
    if (!previous || previous.type !== 'set') {
      return null;
    }
    const instance = exerciseBySlot.get(previous.slotId);
    const done = (instance?.sets ?? []).filter((set) => set.status === 'completed');
    if (done.length === 0) {
      return null;
    }
    const heaviest = Math.max(...done.map((set) => set.actualLoadKg ?? 0));
    return {
      label:
        heaviest > 0
          ? t(language, 'guided.walk.done', { weight: formatWeight(heaviest, unitPreference) })
          : t(language, 'guided.walk.doneReps'),
      name: exerciseNameLabel(language, previous.exerciseName),
      pills: done.map((set) => `${set.actualReps ?? 0}`),
    };
  })();

  /** Today's prescription for the lift being walked to, and last time's. */
  const walkNext = (() => {
    if (step.type !== 'position') {
      return null;
    }
    const instance = exerciseBySlot.get(step.slotId);
    const target = resolveTarget(step.slotId, 0);
    if (!instance || !target) {
      return null;
    }
    const last = setPanelSource?.history ?? null;
    const lastHeaviest = last?.sets.length ? Math.max(...last.sets.map((set) => set.loadKg)) : 0;
    return {
      todayValue:
        target.loadKg != null && target.loadKg > 0
          ? formatWeight(target.loadKg, unitPreference)
          : t(language, target.timed ? 'guided.target.seconds' : 'guided.target.reps', {
              reps: target.reps,
            }),
      planLine: t(language, 'guided.walk.plan', {
        sets: instance.sets.length,
        reps: target.reps,
        // The prescription's own upper bound, which is the number the rest
        // timer actually runs.
        rest: instance.restSecondsMax,
      }),
      lastValue: lastHeaviest > 0 ? formatWeight(lastHeaviest, unitPreference) : null,
      lastReps: last?.sets.length ? last.sets.map((set) => set.reps).join(' · ') : null,
    };
  })();

  const railGroupIndex = step.type === 'finish' || step.type === 'splash' ? 0 : step.groupIndex;
  const phaseRail = useMemo(() => getGuidedPhaseRail(groups, railGroupIndex), [groups, railGroupIndex]);

  /*
   * The overview's two new claims: what the last run of this same day cost,
   * and whether the gate moved anything for today.
   *
   * Memoized because this screen re-renders ten times a second while a timer
   * runs, and neither of these is a per-tick value — one scans the whole
   * session history, the other walks every exercise. Both are read on the
   * entry screen only, which has no running clock at all.
   */
  const lastTimeLine = useMemo(
    () =>
      buildLastTimeLine(
        session
          ? findLastTimeSession(completedSessions, session.templateId, session.templateSessionId)
          : null,
        language,
        unitPreference,
      ),
    [completedSessions, language, session, unitPreference],
  );
  const progressionPill = useMemo(
    () =>
      buildProgressionPill(
        activeExercises.map((exercise) => {
          const target = resolveTarget(exercise.slotId, 0);
          return {
            loadKg: target?.loadKg ?? null,
            autoProgressedFromKg: target?.autoProgressedFromKg ?? null,
            reps: target?.reps ?? 0,
            autoProgressedFromReps: target?.autoProgressedFromReps ?? null,
          };
        }),
        language,
        unitPreference,
      ),
    [activeExercises, language, resolveTarget, unitPreference],
  );

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

            {/* What the same session cost last time, and what the gate moved
                for today. The pill is the whole reason the weights on the rows
                below are worth reading — without it the overview showed a plan
                and never said which part of it is new. */}
            {lastTimeLine || progressionPill ? (
              <View style={styles.entryLastRow}>
                {lastTimeLine ? (
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.entryLastLabel}>{t(language, 'guided.entry.lastTime')}</Text>
                    <Text style={styles.entryLastValue} numberOfLines={1}>
                      {lastTimeLine}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {progressionPill ? (
                  <View style={styles.entryProgressPill}>
                    <Text style={styles.entryProgressPillText} numberOfLines={1}>
                      {progressionPill}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

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
                        right: buildOverviewScheme(
                          {
                            exerciseName: exercise.exerciseName,
                            setCount: exercise.sets.length,
                            repsLabel: formatRepRangeLabel(exercise.sets[0]),
                            timed: isTimedTrackingMode(exercise.trackingMode),
                            loadKg: resolveTarget(exercise.slotId, 0)?.loadKg ?? null,
                          },
                          language,
                          unitPreference,
                        ),
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
                  (
                    item,
                  ): item is {
                    key: string;
                    label: string;
                    sub: string;
                    rows: Array<{ left: string; right: string }>;
                  } => item !== null,
                )
                .map((phase, phaseIndex) => {
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
                        {/* A number, not a play glyph. Three play triangles
                            above a fourth on the CTA read as four ways to
                            start the session; only one of them was. The
                            numbers say the same thing the cards mean — this is
                            the order they happen in. */}
                        <View style={styles.phaseStep}>
                          <Text style={styles.phaseStepText}>{phaseIndex + 1}</Text>
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
                            <View key={rowIndex} style={styles.phaseRowGroup}>
                              <View style={styles.phaseRow}>
                                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: theme.ink }} numberOfLines={1}>
                                  {row.left}
                                </Text>
                                <Text style={{ fontSize: 13.5, fontWeight: '600', color: theme.muted, fontVariant: ['tabular-nums'] }}>
                                  {row.right}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
            </ScrollView>

            {/*
              The pinned button is whatever the session actually needs next.
              It always said "Start session" and always jumped to step 0, even
              with half the workout logged — so a reader who came back through
              Home's "Resume workout" met a screen whose biggest, lowest,
              thumb-nearest button offered to walk them through it again, with
              the real resume a quiet card up at the top. One of them was
              pressed, and it was not the quiet one (#bugs 2026-08-29).

              Nothing was lost — starting over only moves the step pointer —
              but "start" is not what that button did to a session in progress,
              and it should not have been the one under the thumb.
            */}
            {/* Starting over stays available — quietly, and saying so.
                ABOVE the button, not below it: this root pads 14px off the
                bottom with no safe-area inset, and that strip is where Android
                draws its own controls. Anything put there is a control the
                reader has to fight the system bar for, which this app has
                already shipped twice (#bugs 2026-08-28). */}
            {showResume ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => startAt(0)}
                style={styles.startOverLink}
              >
                <Text style={styles.startOverText}>{t(language, 'guided.entry.startOver')}</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              style={styles.startCta}
              onPress={() => startAt(showResume ? resumeIndex : 0)}
            >
              {/* White would be unreadable on the dark theme's orange; that is
                  what `onHighlight` is for. It stays white in light. */}
              <GPIcon name="play" size={19} color={theme.onHighlight} sw={2.5} />
              <Text style={{ fontSize: 16.5, fontWeight: '800', color: theme.onHighlight }}>
                {t(language, showResume ? 'guided.entry.resume' : 'guided.entry.start')}
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
            clock={formatSessionClock(derivedElapsedSeconds)}
            muted={muted}
            onMute={() => onToggleSoundCues(!soundCuesEnabled)}
            onExit={() => setExitOpen(true)}
            // The right slot is the sound toggle again, on every screen of the
            // session. It held the set screen's info button from 2026-08-26,
            // which meant the one control the design says lives in exactly one
            // place lived in two — and the info it opened is on the lift's own
            // card now, where the reader is already looking.
          />

          {step.type === 'splash' && (
            <StepIn stepKey={`splash-${stepIndex}`}>
              {/* A splash that asks a question waits for the answer. The work
                  splash is a beat between phases and still passes on its own;
                  the warmup and recovery ones carry a fork, and a choice on a
                  2.3-second timer is a choice you reach for and miss (user
                  2026-08-26). */}
              <Pressable
                style={skippablePhase ? styles.splashChoiceRoot : styles.splashRoot}
                onPress={splashCarriesChoice(step) ? undefined : advance}
                disabled={splashCarriesChoice(step)}
              >
                {/* The block name owns the upper half; the decision sits down
                    where a thumb already is (user 2026-08-26). */}
                <View style={skippablePhase ? styles.splashChoiceCopy : styles.splashCopy}>
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
                  {/* The list sits with the title rather than on top of the
                      buttons: down there it left a hand's width of nothing
                      under the heading and read as part of the footer (user
                      2026-09-04). It is what the heading is describing.

                      Capped and scrollable so five drills cannot push the
                      title off a short screen — the cap is high enough that
                      four fit without scrolling. */}
                  {gateDrills.length > 0 ? (
                    <ScrollView
                      style={styles.gateCard}
                      contentContainerStyle={{ paddingVertical: 4 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {gateDrills.map((drill, index) => (
                        <View key={`${drill.name}-${index}`} style={styles.gateRow}>
                          <Text style={styles.gateRowIndex}>{index + 1}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.gateRowName} numberOfLines={1}>
                              {drill.name}
                            </Text>
                          </View>
                          <Text style={styles.gateRowLength}>{formatDrillLength(drill.seconds)}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
                {/* The block is a suggestion, not a gate — and leaving it is a
                    real choice, so it gets a real button rather than a muted
                    line of text nobody found (user 2026-08-26). */}
                {skippablePhase ? (
                  <View style={{ alignSelf: 'stretch', gap: 12 }}>
                    <BigBtn
                      tall
                      icon="play"
                      color={theme.accent}
                      label={t(language, `guided.own.start.${skippablePhase}` as 'guided.own.start.warmup')}
                      onPress={advance}
                    />
                    {/* The second way to do the same block. It says what it
                        does on its own second line rather than leaning on a
                        hint above it, so the fork is two buttons and not two
                        buttons plus a sentence explaining them. */}
                    {/* One line. The second line explained what the words
                        already say, and two of them made the button read as a
                        paragraph with a border (user 2026-09-04). */}
                    <Pressable
                      accessibilityRole="button"
                      style={styles.gateOwnBtn}
                      onPress={() => setOwnBlock({ phase: skippablePhase, startedAt: Date.now() })}
                    >
                      <Text style={styles.gateOwnLabel}>
                        {t(language, `guided.own.${skippablePhase}` as 'guided.own.warmup')}
                      </Text>
                    </Pressable>
                  </View>
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
              {/* Changing exercises is not time-bound.
                  This screen counted down fifteen seconds and offered a button
                  to stop the clock, which is a wait the reader did not ask for
                  plus a control to undo it. Walking to another machine takes
                  as long as it takes — sometimes the rack is busy — so there
                  is no clock here at all now (user 2026-09-04). What is left
                  is what the walk is actually for: the lift you just finished,
                  acknowledged, and the one you are walking to, with the
                  numbers you will need when you get there.

                  The two-zone shape from 2026-08-26 stands: what is coming at
                  the top, the action at the bottom. */}
              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingTop: 28, paddingHorizontal: 24, paddingBottom: 8, gap: 14 }}
                showsVerticalScrollIndicator={false}
              >
                {/* The lift that just ended. It used to be a splash that
                    covered this screen for three and a half seconds; the beat
                    it was buying is bought better by being here, where the
                    reader can look at it for as long as they like and the app
                    does not have to guess how long that is. */}
                {walkDone ? (
                  <View style={styles.walkDoneCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.splashCheck}>
                        <GPIcon name="check" size={14} color={theme.green} sw={2.8} />
                      </View>
                      <Text style={styles.walkDoneLabel}>{walkDone.label}</Text>
                    </View>
                    <Text style={styles.walkDoneName} numberOfLines={1}>
                      {walkDone.name}
                    </Text>
                    <View style={styles.walkDonePills}>
                      {walkDone.pills.map((pill, index) => (
                        <View key={index} style={styles.walkDonePill}>
                          <Text style={styles.walkDonePillText}>{pill}</Text>
                        </View>
                      ))}
                      {/* "10 10" does not say ten of what (user 2026-09-04).
                          Small, after the pills, because it is true of all of
                          them and repeating it inside each one is furniture. */}
                      <Text style={styles.walkDonePillUnit}>{t(language, 'guided.reps').toLowerCase()}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 2, color: theme.highlight }}>
                    {t(language, 'guided.nextUp')}
                  </Text>
                  <Text style={styles.positionName} numberOfLines={2}>
                    {exerciseNameLabel(language, step.exerciseName)}
                  </Text>
                </View>

                {/* Bigger. The shape was right and the box was not (user
                    2026-09-04) — and the screen has the room, having lost a
                    countdown. */}
                <MediaZone
                  name={step.exerciseName}
                  library={exerciseLibrary}
                  height={230}
                  mode="set"
                  showActions={false}
                  fit="cover"
                  language={language}
                />

                {/* Two cards, one question each: what today asks of you, and
                    what you did last time. The plan used to be one line of
                    small print under the name. */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.walkStat, { borderColor: theme.highlight }]}>
                    <Text style={styles.walkStatLabel}>{t(language, 'guided.walk.today')}</Text>
                    <Text style={[styles.walkStatValue, { color: theme.highlight }]}>
                      {walkNext?.todayValue ?? '—'}
                    </Text>
                    {walkNext?.planLine ? (
                      <Text style={styles.walkStatSub}>{walkNext.planLine}</Text>
                    ) : null}
                  </View>
                  <View style={styles.walkStat}>
                    <Text style={styles.walkStatLabel}>{t(language, 'guided.walk.last')}</Text>
                    <Text style={styles.walkStatValue}>{walkNext?.lastValue ?? '—'}</Text>
                    {walkNext?.lastReps ? (
                      <Text style={styles.walkStatSub}>{walkNext.lastReps}</Text>
                    ) : null}
                  </View>
                </View>
              </ScrollView>
              <View style={{ paddingHorizontal: 22, paddingBottom: 14, gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setSwapOpen(true)}
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={styles.startOverText}>{t(language, 'guided.walk.swap')}</Text>
                </Pressable>
                <BigBtn
                  shimmer
                  label={t(language, 'guided.walk.startFirst')}
                  icon="play"
                  onPress={advance}
                />
              </View>
            </StepIn>
          )}

          {/* An interval work bout: a clock, not a form. The dials, the log
              button and the weight are all absent on purpose — you are running
              (user 2026-08-26, "juoksuihin pitää keksiä oma ui"). */}
          {step.type === 'set' && step.interval && (
            <StepIn stepKey={`interval-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Text style={styles.intervalRound}>
                    {t(language, 'guided.interval.round', {
                      index: step.setIndex + 1,
                      count: step.setCount,
                    })}
                  </Text>
                  <RestRing
                    stepKey={stepIndex}
                    leftSeconds={secondsLeft}
                    plannedSeconds={step.interval.workSeconds}
                    stroke={theme.highlight}
                  >
                    <Text style={[styles.intervalPhase, { color: theme.highlight }]}>
                      {t(language, step.interval.workKind === 'run' ? 'guided.interval.run' : 'guided.interval.hard')}
                    </Text>
                    <Text style={styles.restCountdown}>{formatGuidedCountdown(secondsLeft)}</Text>
                  </RestRing>
                  {/* What comes next, so the pace is a decision made before it
                      arrives rather than a surprise at zero. */}
                  <Text style={styles.intervalNext}>
                    {t(language, 'guided.interval.then', {
                      phase: t(
                        language,
                        step.interval.recoveryKind === 'walk'
                          ? 'guided.interval.walk'
                          : step.interval.recoveryKind === 'rest'
                            ? 'guided.interval.rest'
                            : 'guided.interval.easy',
                      ),
                      seconds: step.interval.recoverySeconds,
                    })}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 24, paddingBottom: 10, gap: 12 }}>
                  <BigBtn
                    label={t(language, paused ? 'guided.resume' : 'guided.pause')}
                    icon={paused ? 'play' : 'pause'}
                    color={paused ? undefined : theme.ink}
                    onPress={() => setPaused((value) => !value)}
                  />
                  {/* Paused, the one other thing worth offering: leaving this
                      exercise. An interval has no set to log, no weight to
                      change and no rest to shorten, so the full actions sheet
                      would be five decisions where there is one (#bugs
                      2026-08-26, "ohita tämä liike ei muita valintoja"). */}
                  {paused ? (
                    <GhostBtn
                      icon="x"
                      label={t(language, 'guided.action.skipExercise')}
                      onPress={handleSkipExercise}
                    />
                  ) : null}
                </View>
                {/* No rail here: a `set` step already gets one from the shared
                    branch below, and adding a second drew the bar twice
                    (#bugs 2026-08-26, "alapalkki on virheellinen"). */}
              </View>
            </StepIn>
          )}

          {step.type === 'set' && !step.interval && (
            <SetStepView
              key={`set-${stepIndex}`}
              stepIndex={stepIndex}
              step={step}
              exercise={exerciseBySlot.get(step.slotId) ?? null}
              language={language}
              paused={paused}
              resolveTarget={resolveTarget}
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
              onAddSet={() => {
                void haptics.select();
                workout.addSet(step.slotId);
              }}
              /**
               * Only when there is a set to take: more than one, and the last
               * one still pending. A control that refuses on press is a
               * control the reader tries twice; the reducer refuses too, so
               * this decides what is DRAWN, not what is allowed.
               */
              onRemoveSet={
                (() => {
                  const exercise = workout.activeSession?.exercises.find(
                    (candidate) => candidate.slotId === step.slotId,
                  );
                  const sets = exercise?.sets ?? [];
                  if (sets.length <= 1 || sets[sets.length - 1]?.status !== 'pending') {
                    return null;
                  }
                  return () => {
                    void haptics.select();
                    workout.removeSet(step.slotId);
                  };
                })()
              }
              panels={setPanelSource}
              onOpenSheet={() => setSetPanelsOpen(true)}
              onConfirm={confirmSet}
            />
          )}

          {step.type === 'rest' && (
            <StepIn stepKey={`rest-${stepIndex}`}>
              <View style={{ flex: 1, minHeight: 0 }}>
                {/* What was just logged, and a way to fix it.
                    Rest is when a mis-typed rep count is noticed, and until
                    now the only way back was the hardware back button. */}
                {restLogged ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.restLoggedCard}
                    onPress={() => setRestEditOpen(true)}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.restLoggedLabel}>
                        {t(language, 'guided.rest.logged', { index: step.setIndex + 1 })}
                      </Text>
                      <Text style={styles.restLoggedValue} numberOfLines={1}>
                        {restLogged}
                      </Text>
                    </View>
                    <Text style={styles.restLoggedEdit}>{t(language, 'guided.rest.edit')}</Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <RestRing
                    stepKey={stepIndex}
                    leftSeconds={Math.max(0, secondsLeft)}
                    plannedSeconds={step.seconds}
                    // Neutral while the wait is a wait; accent the moment it
                    // is over, because that is when the ring has something to
                    // say. An interval's easy half is a phase of the work, not
                    // a pause in it: green, the colour recovery wears
                    // everywhere else in the app.
                    /*
                     * Neutral while the wait is a wait, accent once it is over.
                     *
                     * The resting ring used to take RestRing's default, which
                     * is `purple` — and in the light theme `purple` and
                     * `highlight` are the same violet, so the ring the design
                     * says should turn at zero did not turn at all (device
                     * 2026-09-04). Naming the resting colour makes the change
                     * a change in both themes.
                     */
                    stroke={
                      step.recoveryKind ? theme.green : restIsOver ? theme.highlight : theme.muted
                    }
                  >
                    <Text
                      style={[styles.restRingLabel, step.recoveryKind ? { color: theme.greenInk } : null]}
                    >
                      {step.recoveryKind
                        ? t(
                            language,
                            step.recoveryKind === 'walk'
                              ? 'guided.interval.walk'
                              : step.recoveryKind === 'rest'
                                ? 'guided.interval.rest'
                                : 'guided.interval.easy',
                          )
                        : restIsOver
                          ? t(language, 'guided.rest.ready')
                          : t(language, 'guided.rest')}
                    </Text>
                    <Text style={styles.restCountdown}>
                      {formatGuidedCountdown(Math.max(0, secondsLeft))}
                    </Text>
                    {/* How long the rest was, and — once it is over — how far
                        past it you are. The reader who put the phone down
                        comes back to a number that says how long they have
                        been standing there rather than to a screen that has
                        already moved on without them. */}
                    <Text style={styles.restOfLabel}>
                      {restIsOver
                        ? t(language, 'guided.rest.over', {
                            // m:ss, not the drill formatter's bare seconds:
                            // "+6 over" does not say six of what (device
                            // 2026-09-04).
                            clock: formatSessionClock(Math.floor(Math.abs(secondsLeft))),
                          })
                        : t(language, 'guided.rest.of', {
                            clock: formatGuidedCountdown(step.seconds),
                          })}
                    </Text>
                    {/* No "PAUSED" caption: the button below it has already
                        flipped to Jatka, and a ring frozen mid-sweep is not
                        ambiguous. Asked for 2026-08-21. */}
                  </RestRing>
                  {/* The set that is coming, and the weight it will carry.
                      Three options rather than a dial: the decision is made
                      here, and the set screen still has the free stepper for
                      the reader who wants a number off this grid. */}
                  {!step.recoveryKind && restNextSet ? (
                    <View style={styles.restNextCard}>
                      <Text style={styles.restNextLabel}>
                        {t(language, 'guided.rest.nextSet', {
                          index: restNextSet.index + 1,
                          count: restNextSet.count,
                        })}
                      </Text>
                      <Text style={styles.restNextTarget}>
                        {t(language, restNextSet.timed ? 'guided.rest.targetHold' : 'guided.rest.target', {
                          reps: restNextSet.reps,
                        })}
                      </Text>
                      {/* One weight, and the app stands behind it.
                          Three options asked the reader to make a decision the
                          progression engine had already made — and asking is
                          the opposite of the promise (user 2026-09-04). The
                          number is still theirs to change: the set screen's
                          dial is two taps away and always was. */}
                      {restChosenKg > 0 ? (
                        <View style={styles.restTargetRow}>
                          <Text style={styles.restTargetWeight}>
                            {formatWeight(restChosenKg, unitPreference)}
                          </Text>
                          {restTargetMove?.label ? (
                            <View
                              style={[
                                styles.restTargetDelta,
                                restTargetMove.kind === 'up' && { backgroundColor: theme.greenSoft },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.restTargetDeltaText,
                                  restTargetMove.kind === 'up' && { color: theme.greenInk },
                                ]}
                              >
                                {restTargetMove.label}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <View style={{ paddingHorizontal: 24, paddingBottom: 10, gap: 12 }}>
                  {/* What comes back after the easy half — the same forward
                      look the work bout gives. */}
                  {step.recoveryKind ? (
                    <Text style={[styles.intervalNext, { textAlign: 'center' }]}>
                      {t(language, 'guided.interval.thenWork')}
                    </Text>
                  ) : null}
                  {/* Once the wait is over the row goes with it: three
                      controls for shortening a wait that has already ended are
                      three controls that do nothing, above the one button that
                      does (device 2026-09-04). */}
                  <View style={{ flexDirection: 'row', gap: 10, display: restIsOver ? 'none' : 'flex' }}>
                    {/* No ±15 s on an interval: its two halves are the rhythm
                        the machine is set to, and stretching one desyncs the
                        reader from the belt they are standing on. */}
                    {step.recoveryKind ? null : (
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
                    )}
                    {step.recoveryKind ? null : (
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        label="+15s"
                        onPress={() => {
                          void haptics.select();
                          adjustRemaining(15000);
                        }}
                      />
                    </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <GhostBtn
                        icon={paused ? 'play' : 'pause'}
                        label={t(language, paused ? 'guided.resume' : 'guided.pause')}
                        onPress={() => setPaused((value) => !value)}
                      />
                    </View>
                  </View>
                  {/* No "Swap exercise" here any more (user 2026-08-23): rest
                      is rest, and the swap lives behind the set screen's menu.
                      And no "skip rest" on an interval's easy half: skipping
                      the walk is skipping half the exercise, not shortening a
                      wait (#bugs 2026-08-26). Pause stays on both. */}
                  {step.recoveryKind ? null : restIsOver ? (
                    /* The rest is over and the screen says so; this is the
                       reader saying they are ready. Nothing advanced on its
                       own, so this button is the only thing that does. */
                    <Pressable
                      accessibilityRole="button"
                      style={styles.restStartBtn}
                      onPress={() => {
                        void haptics.select();
                        startRestNextSet();
                      }}
                    >
                      <GPIcon name="play" size={18} color={theme.onHighlight} sw={2.5} />
                      <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.onHighlight }}>
                        {restNextSet
                          ? t(
                              language,
                              restChosenKg > 0 ? 'guided.rest.startSetWeight' : 'guided.rest.startSet',
                              {
                                index: restNextSet.index + 1,
                                weight: formatWeight(restChosenKg, unitPreference),
                              },
                            )
                          : t(language, 'guided.skipRest')}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.skipRestBtn} onPress={startRestNextSet}>
                      <GPIcon name="skip" size={18} color={theme.ink} />
                      <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.ink }}>{t(language, 'guided.skipRest')}</Text>
                    </Pressable>
                  )}
                  {/* Paused on the easy half: the same single way out as the
                      work bout, and nothing else. */}
                  {step.recoveryKind && paused ? (
                    <GhostBtn
                      icon="x"
                      label={t(language, 'guided.action.skipExercise')}
                      onPress={handleSkipExercise}
                    />
                  ) : null}
                  {/* What the rest is for. The line already existed and was
                      drawn on warm-up drills only, so the half of the session
                      you actually wait through was the half that never said
                      what was coming. */}
                  {step.recoveryKind ? null : (
                    <NextLine text={nextPreview?.line ?? null} dark={false} language={language} />
                  )}
                </View>
                <ProgressRail
                  groups={phaseRail.groups}
                  current={phaseRail.current}
                  dotIndex={step.setIndex}
                  dotsDone={exerciseBySlot.get(step.slotId)?.sets.filter((set) => set.status === 'completed').length ?? 0}
                  onPress={() => setRunSheetOpen(true)}
                  openLabel={t(language, 'guided.runSheet.open')}
                />
              </View>
            </StepIn>
          )}

          {(step.type === 'drill' || step.type === 'set' || step.type === 'ready' || step.type === 'position') && (
            <ProgressRail
              groups={phaseRail.groups}
              current={phaseRail.current}
              dotIndex={step.type === 'set' ? step.setIndex : 0}
              dotsDone={
                step.type === 'set' || step.type === 'position'
                  ? exerciseBySlot.get(step.slotId)?.sets.filter((set) => set.status === 'completed').length ?? 0
                  : 0
              }
              onPress={() => setRunSheetOpen(true)}
              openLabel={t(language, 'guided.runSheet.open')}
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


      {/* The waiting room for a block you are doing yourself. A clock that
          counts UP, because the app does not know how long your warmup takes
          and should not pretend to — and the drills it would have run, quiet,
          as a reminder rather than a list to obey. */}
      {ownBlock && (
        <View style={styles.ownBlockSheet}>
          {/* The overlay covers the player, top bar included — so it draws its
              own. Without it this was the one screen in the session with no
              way out, no session clock and no sound toggle (device
              2026-09-04). */}
          <TopBar
            dark={false}
            label={t(
              language,
              ownBlock.phase === 'warmup' ? 'guided.label.warmup' : 'guided.label.cooldown',
            )}
            clock={formatSessionClock(derivedElapsedSeconds)}
            muted={muted}
            onMute={() => onToggleSoundCues(!soundCuesEnabled)}
            onExit={() => setExitOpen(true)}
          />
          {/* Scrolls, because the loads card grows with the session: five
              areas and a flagged one is a card, not a caption. */}
          <ScrollView
            style={{ flex: 1 }}
            // Centred, like every other full-screen block in the player. Left
            // ragged against a centred title it read as crooked (user
            // 2026-09-04).
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingHorizontal: 28,
              paddingVertical: 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.ownBlockEyebrow}>
              {t(
                language,
                ownBlock.phase === 'warmup' ? 'guided.own.state.warmup' : 'guided.own.state.cooldown',
              )}
            </Text>
            <Text style={styles.splashTitle}>{t(language, 'guided.own.title')}</Text>
            {/* Smaller than the drill countdowns on purpose: this clock is a
                record of how long you have taken, not a number to beat. */}
            <Text style={styles.ownBlockClock}>{formatSessionClock(ownElapsedSeconds)}</Text>
            {ownLastTimeLine ? <Text style={styles.ownBlockHint}>{ownLastTimeLine}</Text> : null}
            <Text style={styles.ownBlockHint}>{t(language, 'guided.own.hint')}</Text>

            {/* "Vinha olisi ehdottanut" and its three drills are gone and stay
                gone: listing what the app would have picked is the app arguing
                with a choice it offered (#bugs 2026-08-26).

                What follows is the opposite claim — not the drills you skipped
                but the work you are about to do. It is the only thing that
                makes a self-run warm-up better rather than merely faster, and
                it never names a drill. */}
            {ownBlock.phase === 'warmup' && (warmupBrief.areas.length > 0 || warmupBrief.firstLift) ? (
              <View style={styles.ownBriefCard}>
                <Text style={styles.ownBriefLabel}>{t(language, 'guided.own.brief.label')}</Text>
                {warmupBrief.areas.length > 0 ? (
                  <View style={styles.ownBriefChips}>
                    {warmupBrief.areas.map((area) => (
                      <View key={area} style={styles.ownBriefChip}>
                        <Text style={styles.ownBriefChipText}>{area}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {warmupBrief.firstLift ? (
                  <View style={styles.ownBriefFirst}>
                    <Text style={styles.ownBriefLabel}>{t(language, 'guided.own.brief.firstLift')}</Text>
                    <Text style={styles.ownBriefFirstName} numberOfLines={1}>
                      {exerciseNameLabel(language, warmupBrief.firstLift.exerciseName)}
                    </Text>
                    <Text style={styles.ownBriefFirstScheme}>{warmupBrief.firstLift.scheme}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24, paddingBottom: 18, gap: 12 }}>
            {/* The way back into the drills, and the way out of the standing
                assumption at the same time: a reader who wants them today is a
                reader the app was wrong to skip them for.

                ABOVE the button, not below it. This sheet pads 18px off the
                bottom with no safe-area inset, and that strip is where Android
                draws its own controls — a link put there is one the reader has
                to fight the system bar for, which this app has shipped twice
                already (#bugs 2026-08-28). */}
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                setOwnBlock(null);
                if (alwaysOwnWarmup && ownBlock.phase === 'warmup') {
                  onSetAlwaysOwnWarmup?.(false);
                }
              }}
              style={{ alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={styles.startOverText}>
                {t(
                  language,
                  ownBlock.phase === 'warmup' ? 'guided.own.guided.warmup' : 'guided.own.guided.cooldown',
                )}
              </Text>
            </Pressable>
            <BigBtn
              icon="check"
              label={t(
                language,
                ownBlock.phase === 'warmup' ? 'guided.own.done.warmup' : 'guided.own.done.cooldown',
              )}
              onPress={() => finishOwnBlock(true)}
            />
          </View>
        </View>
      )}

      {/* Asked once, on the third session run this way, and never again:
          the reader has shown the app what they do, so the app can stop
          putting the fork in front of them. */}
      {alwaysOwnAsk ? (
        <ConfirmDialog
          visible
          language={language}
          title={t(language, 'guided.own.always.title')}
          message={t(language, 'guided.own.always.body')}
          confirmLabel={t(language, 'guided.own.always.confirm')}
          cancelLabel={t(language, 'guided.own.always.cancel')}
          onConfirm={() => {
            setAlwaysOwnAsk(false);
            onSetAlwaysOwnWarmup?.(true);
          }}
          onCancel={() => setAlwaysOwnAsk(false)}
        />
      ) : null}

      {/* Correcting the set that was just logged, on the screen that shows it. */}
      {restEditOpen && step.type === 'rest' ? (
        <LoggedSetEditor
          language={language}
          unitPreference={unitPreference}
          unloaded={isUnloadedTrackingMode(exerciseBySlot.get(step.slotId)?.trackingMode ?? 'load_and_reps')}
          reps={findSetByIndex(exerciseBySlot.get(step.slotId), step.setIndex)?.actualReps ?? 0}
          loadKg={findSetByIndex(exerciseBySlot.get(step.slotId), step.setIndex)?.actualLoadKg ?? 0}
          onCancel={() => setRestEditOpen(false)}
          onSave={(reps, loadKg) => {
            workout.editLoggedSet(step.slotId, step.setIndex, reps, loadKg);
            setRestEditOpen(false);
          }}
        />
      ) : null}

      {/* The lift's own sheet — photo and setup, the written steps with the
          what to watch for, and eight sessions of history.
          Opened from the card, which is the only door: the header's slot is
          the sound toggle's again. */}
      {setPanelsOpen && step.type === 'set' ? (
        <ExerciseSheet
          visible
          language={language}
          exerciseName={exerciseNameLabel(language, step.exerciseName)}
          imageUrl={setPanelSource?.imageUrl ?? null}
          initials={setPanelSource?.initials ?? ''}
          instructions={setPanelSource?.instructions ?? []}
          learn={sheetLearn}
          watchFor={sheetWatchFor}
          history={sheetHistory}
          onClose={() => setSetPanelsOpen(false)}
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
            {/* No "keep training" button.
                Closing the sheet already is keeping training — the grip, the
                scrim and the back button all do it — so the button repeated a
                gesture that was there, and made two real decisions look like
                three (user 2026-08-27). What is left is the two things that
                actually differ in what happens to your sets. The label still
                exists as the confirmation's cancel. */}
            {completedSetCount > 0 ? (
              // Leaving the gym after three of six lifts used to mean either
              // skipping through the rest to reach the finish step, or losing
              // the three. This is the same save the finish step runs — the
              // session ends where it is, and what was logged is kept.
              <BigBtn
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
          {/* No footnote. It existed to explain the difference between three
              buttons, which is a sign the buttons were not explaining
              themselves — and the one thing worth saying, that discarding
              throws the sets away, is now said where it matters: in the
              confirmation, at the moment you press it (#bugs 2026-08-26). */}
        </GPSheet>
      )}

      {/*
        The session, read out loud.

        Deliberately inert: nothing here jumps you anywhere. Being able to see
        the fourth lift while resting after the second is a different need from
        wanting to skip to it, and a list you can fall through with a thumb
        while your hands are chalked is how sets get skipped by accident.
      */}
      {runSheetOpen && (
        <GPSheet onClose={() => setRunSheetOpen(false)}>
          <Text style={styles.sheetTitle}>{t(language, 'guided.runSheet.title')}</Text>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {buildGuidedRunSheet(stepPlan, stepIndex).map((item) => (
              <View key={item.groupIndex} style={styles.runRow}>
                {/* Done / here / to come, as a mark rather than as a colour:
                    the dark theme flattens the accents into each other. */}
                <View
                  style={[
                    styles.runDot,
                    item.status === 'done' && { backgroundColor: theme.green, borderColor: theme.green },
                    item.status === 'current' && { backgroundColor: theme.purple, borderColor: theme.purple },
                  ]}
                >
                  {item.status === 'done' ? <GPIcon name="check" size={11} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.runName,
                      item.status === 'current' && { color: theme.purple },
                      item.status === 'done' && { color: theme.muted },
                    ]}
                    numberOfLines={2}
                  >
                    {exerciseNameLabel(language, item.name)}
                  </Text>
                  {item.status === 'current' ? (
                    <Text style={styles.runHere}>{t(language, 'guided.runSheet.here')}</Text>
                  ) : null}
                </View>
                {item.setCount ? (
                  <Text style={styles.runMeta}>
                    {t(language, 'guided.runSheet.sets', { count: item.setCount })}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
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
            {/* "One back" and "skip this" are gone. Two skips a thumb's width
                apart — one for the set, one for the exercise — is a pair you
                pick between by reading, on a sheet you opened mid-set; and
                stepping back is not something a reader asked for once
                (#bugs 2026-08-26). Skipping the exercise is the one that
                survives, in red and behind a confirmation. */}
            {/* Mid-block, the same escape: this sheet is already the "I need to
                do something else" surface. */}
            {skippablePhase ? (
              <GhostBtn
                icon="check"
                label={t(language, `guided.own.${skippablePhase}` as 'guided.own.warmup')}
                onPress={() => {
                  setPauseSheetOpen(false);
                  setPaused(false);
                  setOwnBlock({ phase: skippablePhase, startedAt: Date.now() });
                }}
              />
            ) : null}
            {/* No sound row. It lived here while the set screen's top-right
                slot held the exercise info; the info moved to the lift's card
                on 2026-09-04 and the speaker went back to the header, so this
                was the same switch in two places (user 2026-09-04). */}
            {actionExercise ? (
              <>
                {/* No name header: the exercise is already the biggest thing on
                    the screen behind this sheet, and repeating it here read as
                    a heading that had wandered in. And no "add set" — the set
                    row at the top of the workout has the + already, which is
                    where a set is added from (#bugs 2026-08-26). */}
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
                {/* Red, and it asks. This sat between two other outlined rows
                    and threw away a whole exercise on one tap. */}
                <GhostBtn
                  icon="x"
                  danger
                  label={t(language, 'guided.action.skipExercise')}
                  onPress={() => setConfirmingSkipExercise(true)}
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
      <ConfirmDialog
        visible={confirmingSkipExercise}
        language={language}
        destructive
        title={t(language, 'guided.skipExercise.title')}
        message={t(language, 'guided.skipExercise.body')}
        confirmLabel={t(language, 'guided.skipExercise.confirm')}
        cancelLabel={t(language, 'guided.exit.keep')}
        onCancel={() => setConfirmingSkipExercise(false)}
        onConfirm={() => {
          setConfirmingSkipExercise(false);
          handleSkipExercise();
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

      <RestAlertsSheet
        visible={restAsk.sheetOpen}
        language={language}
        onAllow={() => void restAsk.allow()}
        onLater={restAsk.later}
      />
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
/**
 * The two numbers of a logged set, and a way to change them.
 *
 * Deliberately not the set screen's dial cards: those are built for a set you
 * are about to do, with a progression badge and a target underneath. This is a
 * correction — two fields and a save — so it says nothing about what the app
 * would have picked.
 */
function LoggedSetEditor({
  language,
  unitPreference,
  unloaded,
  reps,
  loadKg,
  onCancel,
  onSave,
}: {
  language: AppLanguage;
  unitPreference: UnitPreference;
  unloaded: boolean;
  reps: number;
  loadKg: number;
  onCancel: () => void;
  onSave: (reps: number, loadKg: number | null) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [repsDraft, setRepsDraft] = useState(String(reps));
  const [loadDraft, setLoadDraft] = useState(removeTrailingZeros(loadKg));

  const nextReps = Math.round(parseNumberInput(repsDraft) ?? reps);
  const nextLoad = unloaded ? null : parseNumberInput(loadDraft) ?? loadKg;
  const valid = nextReps > 0 && (unloaded || (nextLoad !== null && nextLoad >= 0));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.editVeil}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} />
        <View style={[styles.editSheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.editTitle}>{t(language, 'guided.rest.editTitle')}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t(language, 'guided.reps')}</Text>
              <TextInput
                value={repsDraft}
                onChangeText={setRepsDraft}
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.editInput}
              />
            </View>
            {unloaded ? null : (
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t(language, 'guided.weight')}</Text>
                <TextInput
                  value={loadDraft}
                  onChangeText={setLoadDraft}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={styles.editInput}
                />
              </View>
            )}
          </View>
          {/* Two buttons of one size. BigBtn is 60 tall and GhostBtn 48, which
              is right where one leads and the other follows — here they are a
              pair, and a pair that does not match reads as a mistake (user
              2026-09-04). */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.editBtn, styles.editBtnGhost]}
            >
              <Text style={styles.editBtnGhostText}>{t(language, 'common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              onPress={() => {
                if (valid) {
                  onSave(nextReps, nextLoad);
                }
              }}
              style={[styles.editBtn, { backgroundColor: valid ? theme.accent : theme.faint }]}
            >
              <GPIcon name="check" size={17} color={theme.onHighlight} sw={2.6} />
              <Text style={[styles.editBtnText, { color: theme.onHighlight }]}>
                {t(language, 'guided.rest.editSave')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SetStepView({
  stepIndex,
  step,
  exercise,
  language,
  paused,
  resolveTarget,
  onPause,
  onOpenActions,
  onAddSet,
  onRemoveSet,
  panels,
  onOpenSheet,
  onConfirm,
}: {
  stepIndex: number;
  step: Extract<GuidedStep, { type: 'set' }>;
  exercise: WorkoutExerciseInstance | null;
  language: AppLanguage;
  paused: boolean;
  /** Opens the exercise sheet; the card is the only door to it. */
  onOpenSheet: () => void;
  resolveTarget: (slotId: string, setIndex: number) => GuidedSetTarget | null;
  onPause: () => void;
  onOpenActions: () => void;
  onAddSet: () => void;
  /** Absent when there is no set to take back. */
  onRemoveSet?: (() => void) | null;
  /** Resolved by the player; null falls back to the plain photo. */
  panels: {
    history: LastTimeView | null;
    instructions: string[];
    imageUrl: string | null;
    initials: string;
  } | null;
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
   * Signed, because the chip is: green says the app added weight, red would
   * say it took some off. Today the gate only ever raises, so the red branch
   * waits for a rule that lowers — but the rendering must not print "+-1,25"
   * the day one exists.
   */
  const autoDeltaKg = autoFromKg !== null ? kg - autoFromKg : null;
  /**
   * The reps counterpart, for exercises that progress by reps instead of load
   * (bodyweight). Same "only while the number is still the gate's" rule,
   * checked against the reps dial instead of the weight dial.
   */
  const repsUntouched = target != null && reps === target.reps;
  const autoFromReps =
    repsUntouched && target?.autoProgressedFromReps != null ? target.autoProgressedFromReps : null;
  /**
   * The load (or rep target) had earned a jump and the recovery read held it.
   *
   * The other badges explain a number that changed. This one explains a
   * number that did not — which is the harder thing to notice and the reason
   * it needs saying at all. A hold nobody sees is indistinguishable from the
   * feature not existing.
   */
  const heldForFatigue =
    (bodyweight ? repsUntouched : untouched)
    && !autoFromKg
    && !prefilledFrom
    && autoFromReps === null
    && target?.heldForFatigue === true;

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
        {/* The lift, always on screen and always the way in.
            The panels used to hang off the header's right-hand button, which
            put the answer to "how much did I lift last time" behind a control
            that looked like a camera — and cost the header the slot the sound
            toggle belongs in. The card says the name, shows the photo, and
            carries last time's numbers where they are read without a tap. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'guided.panelsToggle')}
          onPress={onOpenSheet}
          style={styles.setExerciseCard}
        >
          <View style={styles.setExerciseTop}>
            <View style={styles.setExerciseThumb}>
              {panels?.imageUrl ? (
                <Image source={{ uri: panels.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={styles.setExerciseInitials}>{panels?.initials ?? ''}</Text>
              )}
              <View style={styles.setExercisePlay}>
                <GPIcon name="play" size={11} color={theme.onHighlight} sw={2.6} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.setExerciseName} numberOfLines={2}>
                  {exerciseNameLabel(language, step.exerciseName)}
                </Text>
                <GPIcon name="info" size={16} color={theme.muted} sw={2.2} />
              </View>
              <Text style={styles.setExerciseHint} numberOfLines={1}>
                {t(language, 'guided.card.hint')}
              </Text>
            </View>
          </View>
          {panels?.history ? (
            <View style={styles.setExerciseLast}>
              <Text style={styles.setExerciseLastLabel}>{t(language, 'guided.card.lastTime')}</Text>
              <Text style={styles.setExerciseLastLoad}>
                {panels.history.sets[0] && panels.history.sets[0].loadKg > 0
                  ? `${removeTrailingZeros(Math.max(...panels.history.sets.map((set) => set.loadKg)))} kg`
                  : '—'}
              </Text>
              <View style={styles.setExerciseLastPills}>
                {panels.history.sets.map((set) => (
                  <View key={set.setIndex} style={styles.setExerciseLastPill}>
                    <Text style={styles.setExerciseLastPillText}>{set.reps}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.setExerciseFirstTime}>{t(language, 'guided.card.firstTime')}</Text>
          )}
        </Pressable>

        {/* The set counter, its dots and the add button — and nothing else.
            The session clock used to share this row, and the dots grow with
            every set added: at seven the clock was against the edge and the
            next one pushed it off the screen (#bugs 2026-08-26, "sarja ja
            kello ei voi olla vierekkäin"). It sits on the name row now, where
            nothing grows, and the dots absorb the squeeze here. */}
        <View style={styles.setMetaRow}>
          <View style={styles.setMetaLeft}>
            <Text style={styles.setCounter}>
              {t(language, 'guided.setOfCount', { index: step.setIndex + 1, count: step.setCount })}
            </Text>
            {/* Capped at nine. The reader can add sets without limit and the
                row cannot grow without limit — past nine the dots were thinner
                than the gaps between them and the +/− were against the edge
                (user 2026-09-04). Beyond the cap the counter above still says
                the true number. */}
            <View style={styles.setDots}>
              {Array.from({ length: Math.min(step.setCount, SET_DOT_CAP) }).map((_, index) => {
                const done = index < step.setIndex;
                const current = index === step.setIndex;
                return (
                  // Green filled for logged, an accent ring for the one you
                  // are on: the same two colours the rail under the screen
                  // uses, so "done" means one thing everywhere in the session.
                  <View
                    key={index}
                    style={[
                      styles.setDot,
                      { borderColor: done ? theme.green : current ? theme.highlight : theme.faint },
                      current && { borderWidth: 2.5 },
                      done && { backgroundColor: theme.green },
                    ]}
                  >
                    {done ? <GPIcon name="check" size={12} color={theme.surface} sw={3} /> : null}
                  </View>
                );
              })}
            </View>
            {/* One more set, decided where the sets are counted — the sheet
                kept this three taps away from the row that says 3/3. */}
            {/* One fewer, decided where the sets are counted — the + has been
                here since the sheet stopped owning it, and adding a set you
                cannot take back is half a control (#bugs 2026-08-26). Hidden
                rather than disabled when there is nothing to take: the last
                set, or a set already logged. */}
            {onRemoveSet ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'guided.action.removeSet')}
                hitSlop={8}
                onPress={onRemoveSet}
                style={[styles.setAddBtn, { flexShrink: 0, borderColor: theme.danger }]}
              >
                <GPIcon name="minus" size={13} color={theme.danger} sw={3} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'guided.action.addSet')}
              hitSlop={8}
              onPress={onAddSet}
              style={[styles.setAddBtn, { flexShrink: 0 }]}
            >
              <GPIcon name="plus" size={13} color={theme.green} sw={3} />
            </Pressable>
          </View>
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
                // 1.25 kg per step (user wish, #bugs 2026-08-26): the smallest
                // real plate pair. Bounded at both ends now — a held button
                // accelerates to a tick every 45 ms and the top end had nothing
                // stopping it. See lib/weightDial.
                onStep={(direction) => setKg((current) => stepDialWeight(current, direction))}
                onCommit={(text) => setKg((current) => commitDialWeight(text, current))}
                downLabel={t(language, 'guided.a11y.weightDown')}
                upLabel={t(language, 'guided.a11y.weightUp')}
                editHint={t(language, 'guided.a11y.tapToEdit')}
                wide={false}
                faint={kg <= 0}
              />
            ) : null}
          </View>

          {/* Badges about the numbers sit under the row, not inside the cards,
              so a badge does not make one card taller than the other. */}
          <View style={styles.setBadgeRow}>
              {/* Automated progression is Pro-gated upstream (resolveProgressionOptions),
                  so these badges only ever render for an unlocked account — and only
                  when a number moved, which is the one case the user did not choose
                  it themselves. Green adds, red would take away (the gate only
                  raises today), and the same pair covers reps on bodyweight work. */}
              {autoDeltaKg !== null && autoDeltaKg !== 0 ? (
                <View style={autoDeltaKg > 0 ? styles.setAutoBadgeUp : styles.setAutoBadgeDown}>
                  <View style={autoDeltaKg > 0 ? null : { transform: [{ rotate: '180deg' }] }}>
                    <GPIcon
                      name="arrowUp"
                      size={13}
                      color={autoDeltaKg > 0 ? theme.greenInk : theme.danger}
                      sw={2.8}
                    />
                  </View>
                  <Text style={autoDeltaKg > 0 ? styles.setAutoBadgeUpText : styles.setAutoBadgeDownText}>
                    {t(language, autoDeltaKg > 0 ? 'guided.autoLoad' : 'guided.autoLoadDown', {
                      kg: removeTrailingZeros(Math.abs(autoDeltaKg)),
                    })}
                  </Text>
                </View>
              ) : autoFromReps !== null && reps - autoFromReps !== 0 ? (
                <View style={reps > autoFromReps ? styles.setAutoBadgeUp : styles.setAutoBadgeDown}>
                  <View style={reps > autoFromReps ? null : { transform: [{ rotate: '180deg' }] }}>
                    <GPIcon
                      name="arrowUp"
                      size={13}
                      color={reps > autoFromReps ? theme.greenInk : theme.danger}
                      sw={2.8}
                    />
                  </View>
                  <Text style={reps > autoFromReps ? styles.setAutoBadgeUpText : styles.setAutoBadgeDownText}>
                    {t(language, reps > autoFromReps ? 'guided.autoReps' : 'guided.autoRepsDown', {
                      count: Math.abs(reps - autoFromReps),
                    })}
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
                  <GPIcon name="shield" size={13} color={theme.muted} sw={2.2} />
                  <Text style={styles.setHoldBadgeText}>{t(language, 'guided.heldForRecovery')}</Text>
                </View>
              ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          {/* Which set it logs, on the button that logs it. "Kirjaa sarja"
              was true of all four. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'guided.logSetIndex', { index: step.setIndex + 1 })}
            onPress={() => {
              setDial(null);
              onConfirm(step.slotId, step.setIndex, reps, bodyweight ? null : kg);
            }}
            style={({ pressed }) => [styles.setLogButton, pressed && { opacity: 0.9 }]}
          >
            <GPIcon name="check" size={18} color={theme.onHighlight} sw={2.8} />
            <Text style={styles.setLogButtonText}>
              {t(language, 'guided.logSetIndex', { index: step.setIndex + 1 })}
            </Text>
          </Pressable>
        </View>

        {/* Two buttons, no more (user 2026-08-23): pause, and the menu.
            Mute and swap moved behind the dots with the rest of the
            "something else" actions — a set screen's own controls are the
            ones you use mid-set.

            Labelled, though. A bare circle is a control the reader has to
            press to find out what it does, and one of these two ends up
            being pressed to find out. */}
        <View style={styles.setControls}>
          <View style={styles.setControl}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, paused ? 'guided.resume' : 'guided.pause')}
              onPress={onPause}
              style={styles.setRoundBtn}
            >
              <GPIcon name={paused ? 'play' : 'pause'} size={24} color={theme.ink} sw={2.2} />
            </Pressable>
            <Text style={styles.setControlLabel}>
              {t(language, paused ? 'guided.resume' : 'guided.pause')}
            </Text>
          </View>
          <View style={styles.setControl}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'guided.a11y.actions')}
              onPress={onOpenActions}
              style={styles.setRoundBtn}
            >
              <GPIcon name="dots" size={24} color={theme.ink} sw={2.2} />
            </Pressable>
            <Text style={styles.setControlLabel}>{t(language, 'guided.a11y.actions')}</Text>
          </View>
        </View>
        {/* No "Seuraava · …" line here: on a set it named the same lift's next
            set, which the dots above already say. The drills keep theirs — a
            next drill with its seconds is worth a line. */}
      </Pressable>
    </StepIn>
  );
}

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
  entryLastRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryLastLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: theme.faint },
  entryLastValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
    color: theme.ink,
    fontVariant: ['tabular-nums'],
  },
  entryProgressPill: {
    backgroundColor: theme.highlightSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  entryProgressPillText: { fontSize: 12.5, fontWeight: '800', color: theme.highlight },
  phaseCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    // Was a light-theme hex on both themes: an opaque lilac hairline drawn on
    // the dark page outlined every card in a colour the dark palette does not
    // contain.
    borderColor: theme.border,
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
    borderTopColor: theme.border,
    paddingVertical: 8,
    marginBottom: 6,
  },
  phaseRowGroup: {
    paddingLeft: 57,
    paddingRight: 4,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  // The step number's disc. Same size and place the play disc held, so the
  // header's rhythm is unchanged — only the thing inside it means something now.
  phaseStep: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.highlightSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseStepText: { fontSize: 17, fontWeight: '800', color: theme.highlight },
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
  startOverLink: {
    alignSelf: 'center',
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  startOverText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.muted,
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
    borderColor: theme.border,
  },
  topBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: GPD.line,
  },
  // Lit while the panel it opens is showing: the button is a toggle, and a
  // toggle you cannot see the state of is a button you press twice.
  topBtnActive: {
    backgroundColor: theme.purpleLight,
    borderColor: theme.purple,
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

  /* interval */
  intervalRound: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: theme.muted,
    marginBottom: 10,
  },
  // The one word you read at a glance while moving, so it carries the weight
  // the reps number carries on an ordinary set.
  intervalPhase: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  intervalNext: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.muted,
    marginTop: 12,
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
  /**
   * The block had no style at all, which is not the same as "no layout".
   *
   * An unstyled View takes the width of its widest child — here the "warm-up
   * done" row — and its other children stretch to that width and then sit at
   * its left edge, because only the big title carried textAlign: 'center'. So
   * the eyebrow and the meta line landed left of the title while the title was
   * centred, and the block read as crooked (user 2026-08-26, "tekstit ovat
   * ihan vinossa"). Centring the box centres every line in it, whatever the
   * line happens to be.
   */
  splashCopy: { alignItems: 'center', gap: 6 },

  // The phase intro that carries a fork: copy in the upper half, the two
  // buttons down where a thumb rests rather than floating mid-screen.
  splashChoiceRoot: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    // Lifted off the bottom edge (user 2026-08-26, "vähän ylemmäs nappeja"):
    // the pair sat against the system bar, which on a tall phone is below
    // where a thumb rests rather than at it.
    paddingBottom: 64,
    justifyContent: 'space-between',
  },
  splashChoiceCopy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },

  /* doing a block your own way */
  ownBlockSheet: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.bg },
  ownBlockEyebrow: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 2,
    color: theme.highlight,
    textAlign: 'center',
  },
  // 62pt was the size of a target. This clock is a record of what you have
  // spent, and the drill countdowns are the numbers worth being that big.
  ownBlockClock: {
    textAlign: 'center',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: theme.ink,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  ownBlockHint: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  ownBriefCard: {
    marginTop: 18,
    alignSelf: 'stretch',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  ownBriefLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: theme.faint },
  ownBriefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ownBriefChip: {
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  ownBriefChipText: { fontSize: 12.5, fontWeight: '700', color: theme.ink },
  ownBriefFirst: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 3 },
  ownBriefFirstName: { fontSize: 15.5, fontWeight: '800', color: theme.ink },
  ownBriefFirstScheme: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.highlight,
    fontVariant: ['tabular-nums'],
  },
  /* the warm-up / recovery gate */
  gateCard: {
    flexGrow: 0,
    // Stretched, because the copy block that holds it centres its children —
    // left to itself the card shrank to its content and the drill names came
    // out as "…" (device 2026-09-04).
    alignSelf: 'stretch',
    marginTop: 18,
    maxHeight: 260,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  gateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  gateRowIndex: {
    width: 18,
    fontSize: 13,
    fontWeight: '800',
    color: theme.faint,
    fontVariant: ['tabular-nums'],
  },
  gateRowName: { fontSize: 15, fontWeight: '700', color: theme.ink },
  gateRowWhy: { fontSize: 12.5, fontWeight: '600', color: theme.muted, marginTop: 1 },
  gateRowLength: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.muted,
    fontVariant: ['tabular-nums'],
  },
  gateOwnBtn: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  gateOwnLabel: { fontSize: 16, fontWeight: '800', color: theme.ink },
  gateOwnSub: { fontSize: 12.5, fontWeight: '600', color: theme.muted, textAlign: 'center' },
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
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
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
  setMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  setCounter: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: theme.purple, fontVariant: ['tabular-nums'] },
  // The dots are the one part of this row that grows without a bound — one
  // per set, and a reader can keep adding sets. They give way first, and the
  // counter beside them still says how many there are.
  setDots: { flexDirection: 'row', gap: 5, flexShrink: 1, overflow: 'hidden' },
  setDot: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* the lift's own card, at the top of the set screen */
  setExerciseCard: {
    marginHorizontal: 20,
    // Clear of the header. At 4 it sat against the ✕ and the speaker (user
    // 2026-09-04).
    marginTop: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  setExerciseTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setExerciseThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setExerciseInitials: { fontSize: 20, fontWeight: '800', color: theme.faint },
  setExercisePlay: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: theme.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    // The triangle's own mass sits left of centre in a 24-box.
    paddingLeft: 2,
  },
  setExerciseName: { flexShrink: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.5, color: theme.ink },
  // Bigger, and one claim rather than a list of three tab names the reader
  // has to have opened the sheet once to understand (user 2026-09-04).
  setExerciseHint: { marginTop: 4, fontSize: 14, fontWeight: '600', color: theme.muted },
  setExerciseLast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 9,
  },
  setExerciseLastLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.faint },
  setExerciseLastLoad: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
    fontVariant: ['tabular-nums'],
  },
  setExerciseLastPills: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  setExerciseLastPill: {
    minWidth: 23,
    alignItems: 'center',
    backgroundColor: theme.surfaceSoft,
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  setExerciseLastPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
    fontVariant: ['tabular-nums'],
  },
  setExerciseFirstTime: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 9,
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.muted,
  },
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
  setDialControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 42,
    alignSelf: 'stretch',
  },
  // 40px each plus a 44px floor under the number came to more than half a
  // 320dp screen: "1.25" was clipped to ".25" (user 2026-09-04). The buttons
  // give the number the room instead of taking it.
  setDialBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDialBtnText: { fontSize: 20, fontWeight: '800', color: theme.purple, lineHeight: 24 },
  // The value shrinks (flexShrink + adjustsFontSizeToFit on the number) rather
  // than pushing the buttons out of the card: "100 kg" is a real weight and
  // has to fit next to two 40dp buttons in half a screen.
  setDialValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
  },
  setDialNumber: {
    flexShrink: 1,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.3,
    color: theme.ink,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 0,
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
  // Green up, red down (user 2026-08-25): the progression chip states its
  // direction in colour, not just in sign. Purple stays on the badges that
  // explain provenance rather than a change (carried-from).
  setAutoBadgeUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 11,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.greenSoft,
  },
  setAutoBadgeUpText: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, color: theme.greenInk },
  setAutoBadgeDown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 11,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.dangerSoft,
  },
  setAutoBadgeDownText: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, color: theme.danger },
  // Quiet, not green: green now marks a raise, and a hold is the opposite
  // claim — the app deliberately NOT raising. Muted on the soft surface reads
  // as calm bookkeeping rather than either a success or an alarm.
  setHoldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 11,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
  },
  setHoldBadgeText: { fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, color: theme.muted },
  // 64 → 52 and a lighter shadow: the button had the height of the two dials
  // above it put together, and the shadow made it read taller still.
  setLogButton: {
    height: 52,
    borderRadius: 18,
    // `accent`, the app's "do the thing" colour — the same one the session's
    // own start button wears. It was `purple`, which in dark is the brand
    // colour and not the pressable one.
    backgroundColor: theme.accent,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  setLogButtonText: { fontSize: 17, fontWeight: '800', color: theme.onHighlight, letterSpacing: -0.17 },
  setControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 26, paddingTop: 14, paddingBottom: 10 },
  setControl: { alignItems: 'center', gap: 5 },
  setControlLabel: { fontSize: 11.5, fontWeight: '700', color: theme.muted },
  setAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.green,
    backgroundColor: theme.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    // Keeps the shimmer inside the button's corners.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.33,
    shadowRadius: 24,
    elevation: 6,
  },
  bigBtnTall: { height: 70, borderRadius: 22 },
  bigBtnText: { fontSize: 16.5, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  bigBtnTextTall: { fontSize: 19 },
  ghostBtn: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    // Was a light-theme hex on both themes: a pale lilac outline drawn on the
    // dark page, brighter than the text inside it.
    borderColor: theme.border,
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
  /* walking to the next machine */
  walkDoneCard: {
    backgroundColor: theme.greenSoft,
    borderRadius: 16,
    padding: 13,
    gap: 6,
  },
  walkDoneLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: theme.greenInk },
  walkDoneName: { fontSize: 16, fontWeight: '800', color: theme.ink },
  walkDonePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  walkDonePill: {
    minWidth: 26,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  walkDonePillUnit: {
    alignSelf: 'center',
    marginLeft: 2,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.greenInk,
    opacity: 0.8,
  },
  walkDonePillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.greenInk,
    fontVariant: ['tabular-nums'],
  },
  walkStat: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 13,
    gap: 3,
  },
  walkStatLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.faint },
  walkStatValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: theme.ink,
    fontVariant: ['tabular-nums'],
  },
  walkStatSub: { fontSize: 12, fontWeight: '600', color: theme.muted, fontVariant: ['tabular-nums'] },
  /* rest screen */
  restLoggedCard: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.greenSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  restLoggedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.greenInk },
  restLoggedValue: { marginTop: 2, fontSize: 14.5, fontWeight: '700', color: theme.ink },
  restLoggedEdit: { fontSize: 13.5, fontWeight: '800', color: theme.highlight },
  restOfLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: theme.muted,
    fontVariant: ['tabular-nums'],
  },
  restNextCard: {
    marginTop: 22,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  restNextLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: theme.faint },
  restNextTarget: { fontSize: 15, fontWeight: '700', color: theme.ink },
  editVeil: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },
  editTitle: { fontSize: 19, fontWeight: '800', color: theme.ink },
  editBtn: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnGhost: { borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surface },
  editBtnGhostText: { fontSize: 15.5, fontWeight: '800', color: theme.ink },
  editBtnText: { fontSize: 15.5, fontWeight: '800' },
  editField: { flex: 1, gap: 6 },
  editLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: theme.faint },
  editInput: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    color: theme.ink,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  restTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  restTargetWeight: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.ink,
    fontVariant: ['tabular-nums'],
  },
  restTargetDelta: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  restTargetDeltaText: { fontSize: 12.5, fontWeight: '800', color: theme.muted },
  restStartBtn: {
    height: 56,
    borderRadius: 17,
    backgroundColor: theme.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 6,
  },
  /*
   * An outline, not a filled button.
   *
   * Skipping a rest is a shortcut past a wait, and it was the biggest, most
   * saturated thing on the screen — while the button that actually starts the
   * next set, once the wait is over, is filled. Two buttons in one slot cannot
   * both be the loudest, and the loud one should be the one that goes forward.
   */
  skipRestBtn: {
    height: 56,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: theme.ink, marginBottom: 16 },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  // Hollow until reached, filled when it is where you are, ticked when done.
  runDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: theme.ink,
  },
  runHere: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.purple,
    marginTop: 2,
  },
  runMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.faint,
  },
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

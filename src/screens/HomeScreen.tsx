import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../components/ConfirmDialog';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CardioIcon } from '../components/CardioIcon';
import { CtaShimmer } from '../components/CtaShimmer';
import { HomeStatCardsSection } from '../components/HomeStatCardsSection';
import { CardioIconKind } from '../lib/cardio';
import { HomeStatCard } from '../lib/homeStatCards';
import { VinhaIcon } from '../components/VinhaIcon';
import { getHomeMiniCalendarDays, getHomeMonthCalendar, HomeDaySessionSummary } from '../lib/homeCalendar';
import { isScheduleKnown, TrainingSchedule, trainsOn, UNKNOWN_SCHEDULE, upcomingSessionDayStarts } from '../lib/trainingSchedule';
import { getDefaultCooldown, getDefaultWarmup, getSessionFocusTitle } from '../lib/homeSessionHero';
import { AnimatedGreeting } from '../components/AnimatedGreeting';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { buildSwapOptionsForSlot, TailoringPreferencesInput } from '../lib/tailoringFit';
import { buildSwapShortlist } from '../lib/swapShortlist';
import { localizeSessionFocus, localizeSessionName, localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { weekdayCodeForDate, weekdayLabel } from '../lib/planWeekdays';
import { t } from '../lib/i18n';
import { ProMomentContent } from '../lib/proInsights';
import { CutButton } from '../components/CutButton';
import { VinhaWordmark } from '../components/VinhaWordmark';
import { CutSurface } from '../components/CutSurface';
import { ProLockedCard } from '../components/ProLockedCard';
import { ProMomentSheet } from '../components/ProMomentSheet';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';
import { queryReduceMotion } from '../utils/reduceMotion';

// The Home Pro sheet is gone (design: Vinha Paywall Moments): contextual
// sheets belong to the moments, and the comparison table lives on the ONE full
// Pro page. The PRO pill went with the top bar redesign (e039b7b, design 1C:
// wordmark, rule, one line) — it advertised a subscription on every visit,
// including to the people already paying. Home still reaches the Pro page
// from the plateau moment; the Profile tab has the rest of the ways in.

// Entrance stagger (Home v4 "rise"): translateY 16 -> 0 + fade, 500ms,
// cubic-bezier(.22,1,.36,1). Indices name each animated section.
const RISE_DELAYS_MS = [40, 100, 160, 300, 360, 420, 460, 480, 520, 560, 600] as const;
const RISE_HEADER = 0;
const RISE_WEEK = 1;
const RISE_HERO = 2;
const RISE_SEC_BASE = 3; // the hero's exercise list
const RISE_BTNROW = 6;
const RISE_DIVIDER = 7;
const RISE_EMPTY_ROW = 10;

const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Warmup or recovery, as a row rather than a card.
 *
 * The boxed accordions this replaces put three walls around content that was
 * mostly a list of names; the row keeps the opening and drops the box. It
 * stays flush with the lift rows above and below it, so an unopened block
 * reads as one more line of the session rather than a section of its own.
 */
function BlockRow({
  title,
  meta,
  drills,
  open,
  onToggle,
  language,
}: {
  title: string;
  meta: string;
  drills: Array<{ name: string; schemeLabel: string }>;
  open: boolean;
  onToggle: () => void;
  language: AppLanguage;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (drills.length === 0) {
    return null;
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t(language, open ? 'home.a11y.collapseSection' : 'home.a11y.expandSection', { title })}
        onPress={onToggle}
        style={({ pressed }) => [styles.blockRow, pressed && styles.pressed]}
      >
        <Text style={styles.blockTitle}>{title}</Text>
        <Text style={styles.blockMeta}>{meta}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="m6 9 6 6 6-6"
              stroke={theme.faint}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Pressable>
      {open
        ? drills.map((drill, index) => (
            <View key={`${drill.name}-${index}`} style={styles.blockDrillRow}>
              <Text style={styles.blockDrillName} numberOfLines={1}>
                {drill.name}
              </Text>
              <Text style={styles.blockDrillScheme}>{drill.schemeLabel}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

export interface HomeHistoryItem {
  id: string;
  kind: 'strength' | 'cardio';
  title: string;
  meta: string;
  cardioIcon?: CardioIconKind;
}

export interface HomeRecentSessionItem {
  id: string;
  title: string;
  dateLabel: string;
  durationLabel: string;
  volumeLabel: string;
  detailLabel: string;
  exercisePreview: string;
  notePreview?: string | null;
}

interface HomePlanCard {
  programId: string;
  programType?: 'ready' | 'custom';
  eyebrow: string;
  goalLabel: string;
  title: string;
  subtitle: string;
  weekLabel: string;
  progressPercent: number;
  sessionsDone: number;
  sessionsTotal: number;
  currentWeek: number;
  planTotalWeeks: number;
  focusLabel: string;
  equipmentLabel: string | null;
  sessionsPerWeek: string;
  weeklyMinutes: string;
  sessions: HomeDaySessionSummary[];
  nextSession: HomeDaySessionSummary & {
    label: string;
  };

  /**
   * Present only when the plan's block is finished and unanswered. The card
   * stays until one of its answers is taken — completion must not be missable
   * by opening the app on the wrong day.
   */
  completion?: {
    planId: string;
    sessionsTotal: number;
    nextLevelTemplateId: string | null;
    /** Presentation title, resolved by App — Home has no catalog access. */
    nextLevelTitle: string | null;
    /** False when no plan record exists to reset (an unadopted recommendation). */
    canRestart: boolean;
  } | null;
}

export interface HomeOtherProgram {
  planId: string;
  title: string;
  /** e.g. "RUN · 3 pv / viikko" — enough to tell two programmes apart. */
  meta: string;
}

interface HomeScreenProps {
  activePlan?: HomePlanCard | null;
  /**
   * The programmes running alongside the one above.
   *
   * A season used to arrive by evicting whatever the reader had built their
   * week around. It adds now, so Home has to show more than one — these sit
   * under the lead programme rather than competing with it for the hero.
   */
  otherPrograms?: HomeOtherProgram[];
  onOpenOtherProgram?: (planId: string) => void;
  onRemoveOtherProgram?: (planId: string) => void;
  /** Adapt sheet: drop the programme Home is leading with. */
  onRemoveActivePlan?: () => void;
  /** Completion card: adopt the step-up programme and lead with it. */
  onCompletionStartNext?: (planId: string, templateId: string) => void;
  /** Completion card: run the same block again from 0. */
  onCompletionRestart?: (planId: string) => void;
  /** Completion card: put the card away without choosing. */
  onCompletionDismiss?: (planId: string) => void;
  /** Completion card: dismiss and go browse the catalog. */
  onCompletionBrowse?: (planId: string) => void;
  /** Adapt sheet: answer the onboarding questions again. */
  onRedoOnboarding?: () => void;
  /**
   * The reader saying "today is legs, not upper".
   *
   * The rotation is right nearly every day and cannot be right about this one:
   * what happened to the reader's day is not in the programme. Absent = the
   * title is not offered as a choice at all.
   */
  onPickTodaySession?: (sessionId: string) => void;
  /**
   * Renaming a session in place. Present only for a program of the reader's
   * own — the catalog's templates are immutable at runtime, and a pencil that
   * silently did nothing would be worse than no pencil.
   */
  onRenameSession?: (sessionId: string, name: string) => void;
  onStartActivePlanSession?: (sessionId: string) => void;
  /**
   * True while a workout is in progress. The hero button already resumes it
   * — App routes any start into the live session — but it read "Aloita
   * treeni" over a session the reader had left mid-warm-up, while the entry
   * screen one tap later said "Jatka treeniä". The button says so now too.
   */
  hasActiveSession?: boolean;
  onCreateWorkoutFromExercises: () => void;
  /**
   * What the hero button does when there is no programme: go and find one.
   * Without it the button falls back to an empty workout, which is what it
   * used to offer under a label that said "Start workout".
   */
  onFindProgram?: () => void;
  onOpenCardio?: () => void;
  /** Where every Pro touchpoint leads — the full Pro page. */
  onOpenPremium?: () => void;
  /** Where an existing subscriber goes from the header pill. */
  onOpenSubscription?: () => void;
  /** Paywall moment 2: a real stalled lift, or null when nothing is stalled. */
  plateau?: {
    headline: string;
    meta: string;
    locked: { teaser: string; body: string };
    moment: ProMomentContent;
  } | null;
  proUnlocked?: boolean;
  historyItems?: HomeHistoryItem[];
  onOpenHistory?: () => void;
  /** Opens the training-plan screen so the week can stop being unknown. */
  onSetTrainingDays?: () => void;
  /** Opens the running program's full plan — "Katso koko ohjelma". */
  onOpenActivePlan?: () => void;
  /**
   * Opens one session's own day view. The rows used to open the whole plan,
   * which answers a different question than the row the thumb was on
   * (user 2026-08-23: "sen pitäisi mennä siihen mitä klikkasin").
   */
  onOpenPlanSession?: (sessionId: string) => void;
  onSelectHistorySession?: (sessionId: string) => void;
  /** "Your cards": one computed card per catalog item, Add-sheet order. */
  statCatalogCards?: HomeStatCard[];
  suggestedStatCardKeys?: string[];
  onDismissStatCardSuggestion?: (key: string) => void;
  pinnedStatCardKeys?: string[];
  onChangePinnedStatCardKeys?: (next: string[]) => void;
  onOpenStatCard?: (key: string) => void;
  /**
   * Which days train. Unknown → the strip shows no training dots rather than
   * an invented rhythm.
   *
   * This used to be a list of weekdays. It is a schedule now because a rhythm
   * need not repeat every seven days: two on, one off is one, and no weekday
   * list can hold it.
   */
  trainingSchedule?: TrainingSchedule;
  /**
   * Session ids completed since Monday.
   *
   * The programme list used to carry two chips that argued with each other —
   * TÄNÄÄN on the weekday's row, SEURAAVAKSI on the row the rotation offered —
   * and on any day those differ the reader has to work out which one the
   * outline meant. What a week list is for is what happened, so that is what it
   * marks now. The hero above it already says what is next.
   */
  doneThisWeekSessionIds?: string[];
  language?: AppLanguage;
  /**
   * Equipment the reader actually has; null when setup never said. Keeps the
   * default warmup honest — no rower for a bodyweight-only user.
   */
  availableEquipment?: string[] | null;
  /**
   * The one-time home-screen widget offer. Null unless the device can actually
   * pin one and the user has not answered yet — an offer that cannot be
   * fulfilled is worse than no offer.
   */
  /**
   * The one-time sign-in offer for installs that predate the hand-off card
   * (decision 2026-08-22): shown to a signed-out reader with logged data,
   * dismissed permanently by either button. Null once answered, signed in,
   * or in builds without sign-in.
   */
  accountBackupPrompt?: {
    onSignIn: () => void;
    onDismiss: () => void;
  } | null;
  widgetPrompt?: {
    onAdd: () => void;
    onDismiss: () => void;
  } | null;
  /**
   * Today's swaps, slot id → chosen exercise name. Decided here while looking
   * at the plan; applied when the session starts, since there is no session to
   * write to yet.
   */
  sessionSwaps?: Record<string, string>;
  onSwapSessionExercise?: (slotId: string, exerciseName: string) => void;
  /**
   * Slots left out of today's session. Same scope as a swap — an answer about
   * today, not an edit to the programme, which is changed from its own page.
   * A dropped row stays visible, struck through, so leaving something out is
   * as easy to undo as it was to do.
   */
  sessionDrops?: string[];
  onDropSessionExercise?: (slotId: string) => void;
  onRestoreSessionExercise?: (slotId: string) => void;
  /**
   * Out of the programme for good, not just today. Keyed by the template's own
   * exercise id, because that is what the stored programme is edited against.
   *
   * It sits beside the temporary one because a reader asking "how do I get rid
   * of this" does not yet know which of the two they mean — offering only the
   * temporary one sent them looking for an editor they could not find.
   */
  onRemoveSessionExercise?: (exerciseId: string) => void;
  /** Ranks the swap list the same way the player does. */
  tailoringPreferences?: TailoringPreferencesInput | null;
  /**
   * Start today's session with its accessory sets trimmed. One gesture, not a
   * stored mode: "adapt" is a decision about right now, and an adaptation left
   * lying around for tomorrow would be a worse answer than none.
   */
  onStartTrimmedSession?: (sessionId: string) => void;
}

export function HomeScreen({
  activePlan = null,
  otherPrograms = [],
  onOpenOtherProgram,
  onRemoveOtherProgram,
  onRemoveActivePlan,
  onCompletionStartNext,
  onCompletionRestart,
  onCompletionDismiss,
  onCompletionBrowse,
  onRedoOnboarding,
  onPickTodaySession,
  onRenameSession,
  onStartActivePlanSession,
  hasActiveSession = false,
  onCreateWorkoutFromExercises,
  onFindProgram,
  onOpenCardio,
  onOpenPremium,
  onOpenSubscription,
  plateau = null,
  proUnlocked = false,
  historyItems = [],
  onOpenHistory,
  onSetTrainingDays,
  onOpenActivePlan,
  onOpenPlanSession,
  onSelectHistorySession,
  availableEquipment = null,
  statCatalogCards = [],
  suggestedStatCardKeys = [],
  onDismissStatCardSuggestion,
  pinnedStatCardKeys = [],
  onChangePinnedStatCardKeys,
  onOpenStatCard,
  trainingSchedule = UNKNOWN_SCHEDULE,
  doneThisWeekSessionIds = [],
  language = 'en',
  accountBackupPrompt = null,
  widgetPrompt = null,
  sessionSwaps = {},
  onSwapSessionExercise,
  sessionDrops = [],
  onDropSessionExercise,
  onRestoreSessionExercise,
  onRemoveSessionExercise,
  tailoringPreferences = null,
  onStartTrimmedSession,
}: HomeScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // No schedule = no dots. "Recovery" would be as invented as "training".
  const scheduleKnown = isScheduleKnown(trainingSchedule);
  const [plateauSheetVisible, setPlateauSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [confirmingRemovePlan, setConfirmingRemovePlan] = useState(false);
  const [adaptSheetVisible, setAdaptSheetVisible] = useState(false);
  const [todaySheetVisible, setTodaySheetVisible] = useState(false);
  // Which row is being renamed, and the text so far. Kept out of the row so a
  // rename in progress survives the list re-ordering underneath it.
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  /**
   * How much of the screen the keyboard is covering.
   *
   * A React Native Modal is its own window and Android's adjustResize does not
   * reach inside it, so the sheet stays where it is and the row being renamed
   * ends up underneath the keys. Measured rather than guessed: keyboard height
   * varies with the language, the suggestion strip and the handset.
   */
  const [keyboardInset, setKeyboardInset] = useState(0);
  /** Which row's swap sheet is open, by slot id. */
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  // Months away from today. Reset on close so reopening always lands on now.
  const [monthOffset, setMonthOffset] = useState(0);
  /**
   * Which of the two optional blocks is open.
   *
   * The three boxed accordions went on 2026-08-23 and the flat list that
   * replaced them is the look the reader wants kept — but warmup and recovery
   * had nowhere to live, and dropping them meant Home no longer said the
   * session had any. They are back as rows rather than cards: a line, a count
   * and a chevron, opening in place. Closed by default, because the lifts are
   * the decision and these two are the answer to a second question.
   */
  const [openBlock, setOpenBlock] = useState<'warmup' | 'cooldown' | null>(null);
  // Open by default, unlike warmup and cooldown: the lifts are what the screen
  // is for. The fold exists so a long day can be got out of the way, not so
  // the session starts hidden.
  const [workoutListOpen, setWorkoutListOpen] = useState(true);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const topCalendarDays = getHomeMiniCalendarDays(new Date(), language).slice(0, 6);
  // The calendar's answer to "which row is today", kept apart from the
  // rotation's answer to "which row is next". They are different questions and
  // the program rows used to ask only the second one.
  const todayDayStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  ).getTime();
  const monthCalendar = useMemo(
    () => getHomeMonthCalendar(new Date(), language, monthOffset),
    [language, monthOffset],
  );

  // --- Session hero data (Home v4) ---------------------------------------
  const nextPlanSession = activePlan?.nextSession ?? null;
  // Every session the programme holds, for the today-picker. One session
  // is not a choice, so the title only becomes a button past that.
  const planSessions = activePlan?.sessions ?? [];
  /**
   * Which calendar day each programme session lands on next — asked from the
   * schedule, the same source the strip above lights its dots from. The rows
   * used to read the plan's STORED weekday labels, which survive a switch to
   * a cycle untouched: the card said MON/THU while the calendar walked a
   * six-day rotation (user, 2026-08-25).
   */
  const planSessionDayStarts = useMemo(
    () => upcomingSessionDayStarts(trainingSchedule, planSessions.length),
    // The array identity changes per render; length + schedule are the inputs
    // the projection actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trainingSchedule, planSessions.length],
  );
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardInset(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const focusTitle = getSessionFocusTitle(nextPlanSession?.title, activePlan?.title);
  const sessionsDone = activePlan?.sessionsDone ?? 0;
  const sessionsTotal = activePlan?.sessionsTotal ?? 0;
  const sessionsProgressPercent = sessionsTotal > 0 ? Math.round((sessionsDone / sessionsTotal) * 100) : 0;
  const planDuration = nextPlanSession?.duration ?? '~45 min';
  // The number carried alongside the label, not parsed back out of it.
  const planDurationMinutes =
    nextPlanSession?.durationMinutes ?? (Number.parseInt(planDuration.replace(/\D/g, ''), 10) || 45);
  const totalExerciseCount = nextPlanSession?.exercises.length ?? 0;
  const totalSets = nextPlanSession?.totalSets ?? 0;
  // The greeting line and the rule above it are gone (user 2026-08-25): the
  // header is the wordmark, the PRO pill and the date. The greeting rotation
  // (lib/homeGreeting) went with its only caller.
  const todayStamp = useMemo(() => {
    const today = topCalendarDays.find((day) => day.isToday);
    const now = new Date();
    const stamp = `${`${now.getDate()}`.padStart(2, '0')}.${`${now.getMonth() + 1}`.padStart(2, '0')}`;
    return today ? `${today.weekdayLabel} ${stamp}` : stamp;
  }, [topCalendarDays]);

  // Classified in App.tsx from the full exercise list; the five rows Home
  // receives are not enough to work it out here.
  const focusKind = nextPlanSession?.focusKind ?? 'general';
  const warmup = getDefaultWarmup(focusKind, language, availableEquipment);
  const cooldown = getDefaultCooldown(focusKind, language, availableEquipment);
  // Computed where the whole session was still in hand (App.tsx): Home only
  // receives the first five exercises, so a preview built here would quote a
  // shorter session than the one that starts.
  const adaptTrim = nextPlanSession?.trim ?? null;

  // The row whose swap sheet is open, with its current lift resolved through
  // today's swaps — reopening the sheet after a swap must offer the pool for
  // what is there now, not what the template originally said.
  const swapRow = useMemo(() => {
    const exercise = nextPlanSession?.exercises.find((item) => item.slotId && item.slotId === swapSlotId);
    if (!exercise?.slotId) {
      return {
        currentName: '',
        exerciseId: null,
        shortlist: { variations: [], related: [], total: 0 } as ReturnType<typeof buildSwapShortlist>,
      };
    }
    const currentName = sessionSwaps[exercise.slotId] ?? exercise.name;
    return {
      currentName,
      exerciseId: exercise.exerciseId ?? null,
      // Split rather than listed: nine valid lifts interleaved by score put the
      // machine version fourth behind three glute bridges, and pushed the
      // actions off the bottom of the sheet (user 2026-08-26).
      shortlist: buildSwapShortlist(
        currentName,
        buildSwapOptionsForSlot(exercise.substitutionGroup ?? '', currentName, tailoringPreferences),
      ),
    };
  }, [nextPlanSession, swapSlotId, sessionSwaps, tailoringPreferences]);

  // --- Animations -----------------------------------------------------------

  const riseValues = useRef(RISE_DELAYS_MS.map(() => new Animated.Value(0))).current;
  const progressFillAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  /**
   * The play mark rides the light as it goes past — twice, then it settles.
   * A short overshoot rather than a swell: the mark is 28dp, and anything
   * slower than a quarter second on something that small reads as a wobble.
   */
  const playBounce = useRef(new Animated.Value(1)).current;
  const bouncePlay = () => {
    playBounce.setValue(1);
    Animated.sequence([
      Animated.timing(playBounce, {
        toValue: 1.18,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(playBounce, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.back(2.4)),
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    let mounted = true;
    queryReduceMotion()
      .then((enabled) => {
        if (mounted) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {
        if (mounted) {
          setReduceMotion(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    if (reduceMotion) {
      // Reduced motion: skip straight to the final visible state.
      riseValues.forEach((value) => value.setValue(1));
      progressFillAnim.setValue(sessionsProgressPercent);
      return;
    }
    Animated.parallel(
      riseValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 500,
          delay: RISE_DELAYS_MS[index],
          easing: RISE_EASING,
          useNativeDriver: true,
        }),
      ),
    ).start();
    Animated.timing(progressFillAnim, {
      toValue: sessionsProgressPercent,
      duration: 900,
      delay: RISE_DELAYS_MS[RISE_HERO],
      easing: RISE_EASING,
      useNativeDriver: false,
    }).start();
  }, [progressFillAnim, reduceMotion, riseValues, sessionsProgressPercent]);

  /**
   * Built once per mount, not per render.
   *
   * This used to call `.interpolate()` inside the function, so every render
   * minted a fresh native animated node and orphaned the previous one. Home
   * re-renders on every database change and every sheet open, and under Fabric
   * that eventually crashed with "disconnectAnimatedNodes: Animated node with
   * tag (parent) does not exist" — the same failure AnimatedGreeting had, from
   * the same cause. One interpolation per value, kept for the component's life.
   */
  const riseStyles = useRef(
    riseValues.map((value) => ({
      opacity: value,
      transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    })),
  ).current;

  const rise = (index: number) => riseStyles[index];

  // Same rule for the calendar chevron/body and the hero progress bar:
  // interpolate once, not per render.
  const calendarStyles = useRef({
    chevron: { transform: [{ rotate: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] },
    body: { opacity: calendarAnim, maxHeight: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }) },
  }).current;
  const progressFillWidth = useRef(
    progressFillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
  ).current;

  const toggleCalendar = () => {
    const next = !calendarExpanded;
    setCalendarExpanded(next);
    if (!next) {
      setMonthOffset(0);
    }
    if (reduceMotion) {
      calendarAnim.setValue(next ? 1 : 0);
      return;
    }
    Animated.timing(calendarAnim, {
      toValue: next ? 1 : 0,
      duration: 320,
      easing: RISE_EASING,
      useNativeDriver: false,
    }).start();
  };

  /**
   * The hero button offers a workout only when there is one to offer.
   *
   * With no programme it used to say "Start workout" and open an empty session —
   * the same thing the "empty workout" row below already does, under a label
   * that promised a session the app did not have. Deleting a programme is
   * exactly when the useful next step is finding another one.
   */
  const heroStartsSession = Boolean(nextPlanSession);

  const pressHeroAction = () => {
    if (nextPlanSession && onStartActivePlanSession) {
      onStartActivePlanSession(nextPlanSession.id);
      return;
    }
    if (!nextPlanSession && onFindProgram) {
      onFindProgram();
      return;
    }
    onCreateWorkoutFromExercises();
  };


  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/*
          1C: mark, rule, greeting, week — plus the PRO pill, which is back.
          It was removed for advertising a subscription to people who already
          paid, and that reason was right about the gold version only. The pill
          now reads the entitlement and says two different things: gold is an
          offer, grey is a status. A subscriber gets a way into their own
          membership from the screen they open most, which is the thing the
          removal took away along with the ad.
        */}
        <Animated.View style={rise(RISE_HEADER)}>
          <View style={styles.headerRow}>
            {/* The full lockup: the app is called Vinha Fitness, and Home is
                where the reader looks to see whose app this is. */}
            <VinhaWordmark size={30} fitness />
            <View style={styles.headerSpacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, proUnlocked ? 'home.proPill.manage' : 'home.proPill.get')}
              onPress={() => (proUnlocked ? onOpenSubscription?.() : onOpenPremium?.())}
              hitSlop={10}
              style={({ pressed }) => [
                styles.proPill,
                proUnlocked ? styles.proPillActive : styles.proPillOffer,
                pressed && styles.proPillPressed,
              ]}
            >
              <Text
                style={[
                  styles.proPillText,
                  proUnlocked ? styles.proPillTextActive : styles.proPillTextOffer,
                ]}
              >
                {t(language, 'home.proPill')}
              </Text>
            </Pressable>
          </View>

          {/* The rule and the greeting that sat here are gone (user
              2026-08-25) — the date stays, and it is the one place this
              screen states it. The programme counter moved up here from the
              hero row (user, same day): beside the title it took the width
              the title then truncated for, and this row had a free edge. */}
          <View style={styles.greetingRow}>
            <Text style={styles.greetingDate}>{todayStamp}</Text>
            {activePlan && nextPlanSession ? (
              <View style={styles.heroProg}>
                <Text style={styles.heroProgLabel}>
                  {t(language, 'home.hero.sessionsProgress', { done: sessionsDone, total: sessionsTotal })}
                </Text>
                <View style={styles.heroProgTrack}>
                  <Animated.View style={[styles.heroProgFill, { width: progressFillWidth }]} />
                </View>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View style={[styles.weekCard, rise(RISE_WEEK)]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, calendarExpanded ? 'home.a11y.collapseCalendar' : 'home.a11y.expandCalendar')}
            onPress={toggleCalendar}
            style={({ pressed }) => [styles.weekStripRow, pressed && styles.pressed]}
          >
            {topCalendarDays.map((day) => {
              const isTrainingDay = trainsOn(trainingSchedule, new Date(day.dayStart));
              // The date appears once on this screen, up on the greeting row.
              // Today's cell is told apart by its highlight, not by holding
              // different content from its neighbours.
              const dayLabel = day.weekdayLabel;

              return (
                <View key={day.dayStart} style={[styles.weekStripItem, day.isToday && styles.weekStripItemToday]}>
                  {/* Dots only when training days are actually known — with no
                      schedule, "recovery" would be as invented as "training". */}
                  {scheduleKnown ? (
                    <View style={[styles.weekStripDot, isTrainingDay ? styles.weekStripDotTraining : styles.weekStripDotRecovery]} />
                  ) : (
                    <View style={[styles.weekStripDot, styles.weekStripDotUnknown]} />
                  )}
                  <Text style={[styles.weekStripDayLabel, day.isToday && styles.weekStripDayLabelToday]}>{dayLabel}</Text>
                </View>
              );
            })}
            <Animated.View style={[styles.weekStripChevron, calendarStyles.chevron]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={theme.faint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </Pressable>

          <Animated.View style={[styles.monthPanel, calendarStyles.body]}>
            <View style={styles.monthTitleRow}>
              <Text style={styles.monthTitle}>{monthCalendar.monthLabel}</Text>
              <View style={styles.monthNavRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'home.calendar.previousMonth')}
                  onPress={() => setMonthOffset((current) => current - 1)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.monthNavButton, pressed && styles.pressed]}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M15 6l-6 6 6 6"
                      stroke={theme.ink}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'home.calendar.nextMonth')}
                  onPress={() => setMonthOffset((current) => current + 1)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.monthNavButton, pressed && styles.pressed]}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 6l6 6-6 6"
                      stroke={theme.ink}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              </View>
            </View>
            <View style={styles.monthWeekdayRow}>
              {monthCalendar.weekdayLabels.map((label) => (
                <Text key={label} style={styles.monthWeekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>
            {monthCalendar.weeks.map((week) => (
              <View key={week[0].dayStart} style={styles.monthWeekRow}>
                {week.map((day) => {
                  const isTrainingDay = day.inMonth && trainsOn(trainingSchedule, new Date(day.dayStart));

                  return (
                    <View key={day.dayStart} style={[styles.monthDayCell, day.isToday && styles.monthDayCellToday]}>
                      <Text
                        style={[
                          styles.monthDayNumber,
                          !day.inMonth && styles.monthDayNumberOutside,
                          day.isToday && styles.monthDayNumberToday,
                        ]}
                      >
                        {day.dayOfMonth}
                      </Text>
                      <View
                        style={[
                          styles.monthDayDot,
                          scheduleKnown
                            ? isTrainingDay
                              ? styles.monthDayDotTraining
                              : day.inMonth
                                ? styles.monthDayDotRecovery
                                : null
                            : null,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
            {scheduleKnown ? (
              <View style={styles.monthLegendRow}>
                <View style={styles.monthLegendItem}>
                  <View style={[styles.monthDayDot, styles.monthDayDotTraining]} />
                  <Text style={styles.monthLegendText}>{t(language, 'home.calendar.training')}</Text>
                </View>
                <View style={styles.monthLegendItem}>
                  <View style={[styles.monthDayDot, styles.monthDayDotRecovery]} />
                  <Text style={styles.monthLegendText}>{t(language, 'home.calendar.recovery')}</Text>
                </View>
              </View>
            ) : onSetTrainingDays ? (
              // Nobody is ever asked which weekdays they train unless they pick
              // "I choose my days" in onboarding — the ready-program path and
              // "let the app decide" both leave it empty. That left the
              // calendar, the week strip and the home widget permanently blank
              // with no way in. The blank now asks the question instead of
              // guessing an answer: inventing Mon/Wed/Fri from "3 a week" is
              // the exact invention the dots were built to avoid.
              <Pressable
                accessibilityRole="button"
                onPress={onSetTrainingDays}
                style={({ pressed }) => [styles.monthSetDaysRow, pressed && styles.pressed]}
              >
                <Text style={styles.monthSetDaysText}>{t(language, 'home.calendar.setDays')}</Text>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 6l6 6-6 6"
                    stroke={theme.purpleDark}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            ) : null}
          </Animated.View>
        </Animated.View>

        {/* Paywall moment 2: the plateau detection. The finding — real lift,
            real numbers, real dates — is free; the fix is the conclusion. Free
            users see it blurred (the REAL text), Pro users read it in place. */}
        {plateau ? (
          <View style={styles.plateauCard}>
            <View style={styles.plateauHead}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 3l9 16H3z" stroke={PW.amber} strokeWidth={2.3} strokeLinejoin="round" />
                <Path d="M12 10v4M12 17h.01" stroke={PW.amber} strokeWidth={2.3} strokeLinecap="round" />
              </Svg>
              <Text style={styles.plateauKicker}>{t(language, 'pro.plateau.eyebrow')}</Text>
            </View>
            <Text style={styles.plateauHeadline}>{plateau.headline}</Text>
            <Text style={styles.plateauMeta}>{plateau.meta}</Text>
            <View style={styles.plateauLock}>
              {proUnlocked ? (
                <View style={styles.plateauFix}>
                  <Text style={styles.plateauFixLine}>{plateau.locked.body}</Text>
                </View>
              ) : (
                <ProLockedCard
                  language={language}
                  compact
                  teaser={plateau.locked.teaser}
                  body={plateau.locked.body}
                  onPress={() => setPlateauSheetVisible(true)}
                />
              )}
            </View>
          </View>
        ) : null}

        {/* Completion card — above the hero, not instead of it. The rotation
            keeps offering sessions below, so ignoring the card breaks nothing;
            it simply waits for its answer. */}
        {activePlan?.completion ? (
          <CutSurface size="lg" fill={theme.proSheetTop} style={styles.completeCard}>
            <Text style={styles.completeEyebrow}>{t(language, 'home.complete.eyebrow')}</Text>
            <Text style={styles.completeTitle}>{activePlan.title}</Text>
            <Text style={styles.completeMeta}>
              {t(language, 'home.complete.sessions', { total: activePlan.completion.sessionsTotal })}
            </Text>
            {activePlan.completion.nextLevelTitle && activePlan.completion.nextLevelTemplateId ? (
              <View style={styles.completeNext}>
                <Text style={styles.completeNextLabel}>
                  {t(language, 'programs.affinity.nextLevel')}
                </Text>
                <Text style={styles.completeNextTitle}>{activePlan.completion.nextLevelTitle}</Text>
              </View>
            ) : null}
            <View style={styles.completeActions}>
              {activePlan.completion.nextLevelTemplateId ? (
                <CutButton
                  label={t(language, 'home.complete.startNext')}
                  onPress={() =>
                    onCompletionStartNext?.(
                      activePlan.completion!.planId,
                      activePlan.completion!.nextLevelTemplateId!,
                    )
                  }
                  variant="primary"
                  size="md"
                  stretch
                />
              ) : null}
              {activePlan.completion.canRestart ? (
                <CutButton
                  label={t(language, 'home.complete.restart')}
                  onPress={() => onCompletionRestart?.(activePlan.completion!.planId)}
                  variant="secondary"
                  size="md"
                  stretch
                />
              ) : null}
            </View>
            <View style={styles.completeQuietRow}>
              <Pressable
                hitSlop={8}
                onPress={() => onCompletionBrowse?.(activePlan.completion!.planId)}
              >
                <Text style={styles.completeQuiet}>{t(language, 'home.complete.browse')}</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() => onCompletionDismiss?.(activePlan.completion!.planId)}
              >
                <Text style={styles.completeQuiet}>{t(language, 'home.complete.hide')}</Text>
              </Pressable>
            </View>
          </CutSurface>
        ) : null}

        {/* Session hero (Home v4) — renders only with an active plan */}
        {activePlan && nextPlanSession ? (
          <>
            <Animated.View style={[styles.hero, rise(RISE_HERO)]}>
              <View style={styles.heroTop}>
                {/* 'line' mode: the anchor must stay on one line and shrink to
                    fit, which only works while it is a single Text node. */}
                {/* The title is the switch. A reader looking at the wrong
                    workout reaches for its name first, and there was nothing
                    under it — the only way to train something else was to walk
                    back out to the program. */}
                <View style={styles.heroLead}>
                <Pressable
                  accessibilityRole={onPickTodaySession ? 'button' : undefined}
                  accessibilityLabel={
                    onPickTodaySession ? t(language, 'home.a11y.pickTodaySession') : undefined
                  }
                  disabled={!onPickTodaySession || planSessions.length < 2}
                  onPress={() => setTodaySheetVisible(true)}
                  style={({ pressed }) => [styles.heroTitleRow, pressed && styles.pressed]}
                >
                  {/* Two lines as the last resort after the shrink: a name
                      too long for one line at 60 % used to ellipsize, and a
                      clipped hero was reported three times before its causes
                      (plural) were all found (user 2026-08-25). */}
                  <AnimatedGreeting
                    text={localizeWorkoutFocus(focusTitle, language)}
                    style={styles.heroTitle}
                    accentColor={theme.purpleBright}
                    mode="line"
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  />
                  {onPickTodaySession && planSessions.length > 1 ? (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 9l6 6 6-6"
                        stroke={theme.faint}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : null}
                </Pressable>
                </View>
                {/* The 0/16 counter sat here and cost the title its width —
                    it lives on the date row now (user 2026-08-25), so the
                    session name finally owns the whole line. */}
              </View>

            </Animated.View>
          </>
        ) : null}

        {/* Start and Adapt, ABOVE the session's contents. A tester tapped the
            first exercise to "check it off": the list rendered before any
            call to action, and the only start button sat below the fold
            (user report 2026-08-25). Deliberately NOT pinned over the bottom
            bar — Home is the tab root, so the floating bar cannot be hidden
            here, and a pinned CTA would stack a second floating layer on it. */}
        <Animated.View style={[styles.btnRow, rise(RISE_BTNROW)]}>
          {activePlan && nextPlanSession ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'home.a11y.adaptSession')}
              onPress={() => setAdaptSheetVisible(true)}
              style={({ pressed }) => [styles.adaptButton, pressed && styles.pressed]}
            >
              <Text style={styles.adaptButtonText}>{t(language, 'home.adapt')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              language,
              heroStartsSession
                ? hasActiveSession
                  ? 'home.a11y.resumeSession'
                  : 'home.a11y.startSession'
                : 'home.a11y.findProgram',
            )}
            onPress={pressHeroAction}
            style={({ pressed }) => [styles.startButtonWrap, pressed && styles.cutPressed]}
          >
            {/* A big filled play button (user 2026-08-25): the outline version
                below the list read as one row among many, and starting is the
                one thing this screen exists for. The play mark sits in a ring
                and a band of light sweeps the button as the screen arrives
                (design "Aloita treeni CTA", 2026-08-26). */}
            <CutSurface
              size="lg"
              fill={theme.accent}
              stroke={theme.accent}
              strokeWidth={1.5}
              style={styles.startButton}
            >
              <CtaShimmer
                tint="rgba(255,255,255,0.5)"
                onSweep={(index) => {
                  // Only the first couple of passes move the mark (user
                  // 2026-08-26): a button that jumps every time the light
                  // goes by is a button that never settles.
                  if (index < 2) {
                    bouncePlay();
                  }
                }}
              />
              <Animated.View style={[styles.startPlayRing, { transform: [{ scale: playBounce }] }]}>
                {/* Centred on the triangle's centroid, not its bounding box:
                    a play mark boxed by its extents sits visibly right of the
                    circle it is in (user 2026-08-26). Base at x=8.5, apex at
                    18.5 puts the centroid at 11.83 — the viewBox's middle. */}
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M8.5 5.5v13l10-6.5z" fill={theme.onHighlight} />
                </Svg>
              </Animated.View>
              <Text style={styles.startButtonText}>
                {t(
                  language,
                  heroStartsSession
                    ? hasActiveSession
                      ? 'home.resumeWorkout'
                      : 'home.startWorkout'
                    : 'home.findProgram',
                )}
              </Text>
            </CutSurface>
          </Pressable>
        </Animated.View>

        {activePlan && nextPlanSession ? (
          <>
            {/* Today's session, flat on the surface (user 2026-08-23): the
                three boxed accordions are gone. The lifts are the decision, so
                they stand open with no tap and no card; warmup and recovery
                are a second question, so they are rows that open in place. */}
            <Animated.View style={[styles.heroList, rise(RISE_SEC_BASE)]}>
              <BlockRow
                title={t(language, 'home.section.warmup')}
                meta={t(language, 'home.section.warmupMeta', {
                  count: warmup.drills.length,
                  min: warmup.minutes,
                })}
                drills={warmup.drills}
                open={openBlock === 'warmup'}
                onToggle={() => setOpenBlock((current) => (current === 'warmup' ? null : 'warmup'))}
                language={language}
              />
              {/* The lifts still stand open by default — they are the
                  decision. But a six-lift day pushed recovery off the screen,
                  so the meta line doubles as the fold, matching the two rows
                  around it instead of being the one section that cannot
                  close. */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: workoutListOpen }}
                accessibilityLabel={t(
                  language,
                  workoutListOpen ? 'home.a11y.collapseSection' : 'home.a11y.expandSection',
                  { title: t(language, 'home.section.workout') },
                )}
                onPress={() => setWorkoutListOpen((open) => !open)}
                style={({ pressed }) => [styles.heroListMetaRow, pressed && styles.pressed]}
              >
                {/* Named like its neighbours (user 2026-08-25): "Treeni"
                    between Lämmittely and Palautuminen, and laid out exactly
                    like them — title left, counts at the right edge before
                    the chevron, the same seat Lämmittely's own meta sits in.
                    (Two other seats were tried the same evening; this row
                    reads as family only when it IS the family layout.) */}
                <Text style={styles.heroListTitle}>{t(language, 'home.section.workout')}</Text>
                <Text style={styles.heroListMeta} numberOfLines={1}>
                  {t(language, 'home.section.workoutMeta', { count: totalExerciseCount, sets: totalSets })}
                </Text>
                <View style={{ transform: [{ rotate: workoutListOpen ? '180deg' : '0deg' }] }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="m6 9 6 6 6-6"
                      stroke={theme.faint}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </Pressable>
              {(workoutListOpen ? nextPlanSession.exercises : []).map((exercise, index) => {
                const swappedName = exercise.slotId ? sessionSwaps[exercise.slotId] : undefined;
                // A swap changes the lift, not the prescription — same sets,
                // same reps, same slot.
                const rowName = exerciseNameLabel(language, swappedName ?? exercise.name);
                const swapped = Boolean(swappedName);
                const dropped = Boolean(exercise.slotId && sessionDrops.includes(exercise.slotId));
                // The whole row opens the sheet, not the 15dp glyph at its
                // edge: the reader was tapping the name — the part that says
                // what the row is — and nothing happened (user 2026-08-26).
                // The glyph stays as the thing that says the row is tappable.
                const canAdapt = Boolean(exercise.slotId) && Boolean(onSwapSessionExercise || onDropSessionExercise);
                const row = (
                  <>
                    <View style={[styles.planExerciseNumberChip, swapped && styles.planExerciseNumberChipSwapped]}>
                      <Text style={[styles.planExerciseNumberText, swapped && styles.planExerciseNumberTextSwapped]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.planExerciseCopy}>
                      <Text style={[styles.planExerciseName, dropped && styles.planExerciseDropped]} numberOfLines={2}>
                        {rowName}
                      </Text>
                      <Text style={[styles.planExerciseScheme, dropped && styles.planExerciseDropped]}>
                        {dropped ? t(language, 'home.swapSheet.droppedToday') : exercise.schemeLabel ?? exercise.setsLabel}
                      </Text>
                    </View>
                    {canAdapt ? (
                      <View style={styles.planExerciseSwap}>
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7m10 0-3-3m3 3-3 3"
                            stroke={swapped ? theme.purple : theme.faint}
                            strokeWidth={2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    ) : null}
                  </>
                );
                if (!canAdapt) {
                  return (
                    <View key={`${exercise.name}-${index}`} style={styles.planExerciseRow}>
                      {row}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={`${exercise.name}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'home.a11y.swapExercise', { name: rowName })}
                    onPress={() => setSwapSlotId(exercise.slotId ?? null)}
                    style={({ pressed }) => [styles.planExerciseRow, pressed && styles.pressed]}
                  >
                    {row}
                  </Pressable>
                );
              })}
              <BlockRow
                title={t(language, 'home.section.cooldown')}
                meta={t(language, 'home.section.cooldownMeta', {
                  count: cooldown.drills.length,
                  min: cooldown.minutes,
                })}
                drills={cooldown.drills}
                open={openBlock === 'cooldown'}
                onToggle={() => setOpenBlock((current) => (current === 'cooldown' ? null : 'cooldown'))}
                language={language}
              />
            </Animated.View>
          </>
        ) : null}

        {/* The Start/Adapt row lived here, under the whole list — moved above
            it (user report 2026-08-25). */}

        {/* No promo carousel here any more (user 2026-08-23): Home is for
            running today's session, and the season/programme offers live on
            their own screens. */}

        {/* The active program.
            The block above is today; this is the block today belongs to. It
            used to lead the Programs tab, behind a 320px photo hero, which
            meant the reader had to leave the screen they were already on to
            find out what week they are in. Programs is for finding a program;
            Home is for running one. Only one screen owns this now. */}
        {activePlan && activePlan.sessions.length > 0 ? (
          <Animated.View style={rise(RISE_DIVIDER)}>
            <View style={styles.programHeadRow}>
              <Text style={styles.programEyebrow}>{t(language, 'programs.activeProgram')}</Text>
              <Text style={styles.programWeek}>{activePlan.weekLabel}</Text>
            </View>
            {/* Two lines: one was the third report of a clipped name on this
                screen (user 2026-08-25). */}
            <Text style={styles.programTitle} numberOfLines={2}>
              {activePlan.title}
            </Text>
            <View style={styles.programDays}>
              {activePlan.sessions.map((session, index) => {
                // The schedule's projected date for this session — the same
                // truth the calendar strip lights. Null when nothing is known,
                // and the row simply draws no badge.
                const dayStart = planSessionDayStarts[index] ?? null;
                const weekday = dayStart !== null ? weekdayCodeForDate(new Date(dayStart)) : null;
                // The outline still answers the plan — it is the row the hero
                // is offering, and it is quiet. The word on the row answers a
                // different question: was this one done this week.
                const isNext = activePlan.nextSession?.id === session.id;
                const isToday = dayStart !== null && dayStart === todayDayStart;
                const doneThisWeek = doneThisWeekSessionIds.includes(session.id);
                // The badge is the day, and only when the schedule really has
                // one. Without a schedule it repeated the session number that
                // the title already states, and cost the title the width it
                // then truncated for.
                const weekdayText = weekday ? weekdayLabel(weekday, language) : null;
                // The badge already says which day this is; the ordinal in the
                // name said it again and cost the focus the room to be read.
                const sessionTitle = localizeSessionFocus(session.title, language);
                return (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${weekdayText ? `${weekdayText}: ` : ''}${sessionTitle}${
                      doneThisWeek ? `, ${t(language, 'home.plan.doneThisWeek').toLowerCase()}` : ''
                    }${isNext ? `, ${t(language, 'plan.upNext').toLowerCase()}` : ''}`}
                    // The row opens its own day; the section title above still
                    // opens the whole plan (user 2026-08-23).
                    onPress={
                      onOpenPlanSession ? () => onOpenPlanSession(session.id) : onOpenActivePlan
                    }
                    // A3: the row slides right under the thumb rather than
                    // dimming — the speed line it carries points that way.
                    style={({ pressed }) => [pressed && styles.rowPressed]}
                  >
                    <CutSurface
                      size="lg"
                      fill={theme.surface}
                      stroke={isNext ? theme.purpleBright : undefined}
                      speedLine={{ color: theme.purpleBright }}
                      style={[styles.dayRow, styles.dayRowCut]}
                    >
                    {weekdayText ? (
                      // Nesting is allowed when the inner element is off the
                      // corner — the design names this badge as the example.
                      <CutSurface
                        size="chip"
                        fill={isToday ? theme.purple : theme.bg}
                        style={styles.dayBadge}
                      >
                        <Text style={[styles.dayBadgeText, isToday && styles.dayBadgeTextToday]}>{weekdayText}</Text>
                      </CutSurface>
                    ) : null}
                    {/* Two lines, not one. On one line the title, the TODAY
                        pill and the duration competed for the same width, and
                        the title is the one that lost — "Päivä 1: Työntö ja
                        kevyt juoksu" arrived as "Päivä 1: Työntö ja…". The
                        title now owns the first line and the two labels that
                        describe it sit under it. */}
                    <View style={styles.dayCopy}>
                      <Text style={styles.dayTitle} numberOfLines={2}>
                        {sessionTitle}
                      </Text>
                      <View style={styles.dayMetaRow}>
                        {/* One word, and only when it is a fact. Two chips that
                            predict — one from the calendar, one from the
                            rotation — landed on different rows on most days and
                            argued with each other. */}
                        {doneThisWeek ? (
                          <CutSurface size="chip" fill={theme.green} style={styles.todayPill}>
                            <Text style={[styles.todayPillText, styles.donePillText]}>
                              {t(language, 'home.plan.doneThisWeek')}
                            </Text>
                          </CutSurface>
                        ) : null}
                        <Text style={styles.dayDuration}>{session.duration}</Text>
                      </View>
                    </View>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="m9 6 6 6-6 6"
                        stroke={theme.faint}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    </CutSurface>
                  </Pressable>
                );
              })}
            </View>
            {/* A3: the cut corner arrives on the pair the design mocks. */}
            {/* Stacked, not side by side. Sharing a row, "Katso koko ohjelma"
                and "Muokkaa päiviä" each got half the width and both clipped —
                the Finnish labels are simply longer than the English ones the
                row was measured against, and a flex ratio cannot fix a label
                that needs the whole line. */}
            <View style={styles.programActions}>
              <CutButton
                size="lg"
                stretch
                label={t(language, 'programs.viewPlan')}
                onPress={onOpenActivePlan}
              />
              {onSetTrainingDays ? (
                <CutButton
                  size="lg"
                  stretch
                  variant="secondary"
                  label={t(language, 'programs.editDays')}
                  accessibilityLabel={t(language, 'programs.editDaysA11y')}
                  onPress={onSetTrainingDays}
                />
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {otherPrograms.length > 0 ? (
          <Animated.View style={[styles.otherProgramsBlock, rise(RISE_DIVIDER)]}>
            <Text style={styles.programEyebrow}>{t(language, 'home.otherPrograms')}</Text>
            {otherPrograms.map((program) => (
              <Pressable
                key={program.planId}
                accessibilityRole="button"
                accessibilityLabel={program.title}
                onPress={() => onOpenOtherProgram?.(program.planId)}
                style={({ pressed }) => [styles.otherProgramRow, pressed && styles.pressed]}
              >
                <View style={styles.otherProgramCopy}>
                  <Text style={styles.otherProgramTitle} numberOfLines={1}>
                    {program.title}
                  </Text>
                  <Text style={styles.otherProgramMeta} numberOfLines={1}>
                    {program.meta}
                  </Text>
                </View>
                {/* The way back out of the cap. Without it, two programmes is a
                    dead end and every later choice is a paywall the reader
                    cannot dismiss by changing their mind. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'home.removeProgram', { program: program.title })}
                  hitSlop={10}
                  onPress={() => onRemoveOtherProgram?.(program.planId)}
                  style={({ pressed }) => [styles.otherProgramRemove, pressed && styles.pressed]}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M6 6l12 12M18 6L6 18" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" />
                  </Svg>
                </Pressable>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.sectionDivider, rise(RISE_DIVIDER)]} />

        <Animated.View style={rise(RISE_EMPTY_ROW)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'home.a11y.startEmptyWorkout')}
            onPress={onCreateWorkoutFromExercises}
            style={({ pressed }) => [styles.emptyWorkoutRow, pressed && styles.pressed]}
          >
            <View style={styles.emptyWorkoutIcon}>
              <VinhaIcon name="plus" color={theme.highlight} size={20} />
            </View>
            <Text style={styles.emptyWorkoutTitle}>{t(language, 'home.emptyWorkout.title')}</Text>
            <Text style={styles.emptyWorkoutMeta}>{t(language, 'home.emptyWorkout.meta')}</Text>
          </Pressable>
          {onOpenCardio ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'home.a11y.openCardio')}
              onPress={onOpenCardio}
              style={({ pressed }) => [styles.emptyWorkoutRow, pressed && styles.pressed]}
            >
              <View style={styles.emptyWorkoutIcon}>
                <Svg width={20} height={20} viewBox="0 0 256 256">
                  <Path
                    d="M152 88a28 28 0 1 0-28-28 28 28 0 0 0 28 28Zm-56.4 68.7-20.6 41.1a12 12 0 0 0 21.5 10.7l20.5-41.1 26.4 19.8V232a12 12 0 0 0 24 0v-48a12 12 0 0 0-4.8-9.6l-25.5-19.1 14.3-35.8 8.5 12.8a12 12 0 0 0 8 5.1l40 8a12 12 0 1 0 4.7-23.6l-35-7-21.9-32.8a12 12 0 0 0-15.5-4l-48 24a12 12 0 0 0-5.4 5.3l-16 32a12 12 0 0 0 21.5 10.7l14.2-28.4 18.9-9.5-13.6 34Z"
                    fill={theme.highlight}
                  />
                </Svg>
              </View>
              <Text style={styles.emptyWorkoutTitle}>{t(language, 'home.cardio.title')}</Text>
              {/* One line always: at a large system font scale the list
                  wrapped and "kävely" fell off its row (#bugs 2026-08-26).
                  The label shrinks a hair instead of dropping a word. */}
              <Text style={styles.emptyWorkoutMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {t(language, 'home.cardio.meta')}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {widgetPrompt ? (
          <Animated.View style={[styles.widgetPromptCard, rise(RISE_EMPTY_ROW)]}>
            <Text style={styles.widgetPromptTitle}>{t(language, 'widget.prompt.title')}</Text>
            <Text style={styles.widgetPromptBody}>{t(language, 'widget.prompt.body')}</Text>
            <View style={styles.widgetPromptActions}>
              <Pressable
                accessibilityRole="button"
                onPress={widgetPrompt.onDismiss}
                hitSlop={8}
                style={({ pressed }) => [styles.widgetPromptGhost, pressed && styles.pressed]}
              >
                <Text style={styles.widgetPromptGhostText}>{t(language, 'widget.prompt.dismiss')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={widgetPrompt.onAdd}
                style={({ pressed }) => [styles.widgetPromptCta, pressed && styles.pressed]}
              >
                <Text style={styles.widgetPromptCtaText}>{t(language, 'widget.prompt.add')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {accountBackupPrompt ? (
          <Animated.View style={[styles.widgetPromptCard, rise(RISE_EMPTY_ROW)]}>
            <Text style={styles.widgetPromptTitle}>{t(language, 'account.prompt.title')}</Text>
            <Text style={styles.widgetPromptBody}>{t(language, 'account.prompt.body')}</Text>
            <View style={styles.widgetPromptActions}>
              <Pressable
                accessibilityRole="button"
                onPress={accountBackupPrompt.onDismiss}
                hitSlop={8}
                style={({ pressed }) => [styles.widgetPromptGhost, pressed && styles.pressed]}
              >
                <Text style={styles.widgetPromptGhostText}>{t(language, 'account.prompt.dismiss')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={accountBackupPrompt.onSignIn}
                style={({ pressed }) => [styles.widgetPromptCta, pressed && styles.pressed]}
              >
                <Text style={styles.widgetPromptCtaText}>{t(language, 'account.prompt.signIn')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {onChangePinnedStatCardKeys ? (
          <Animated.View style={[styles.statCardsSection, rise(RISE_EMPTY_ROW)]}>
            <HomeStatCardsSection
              catalogCards={statCatalogCards}
              suggestedKeys={suggestedStatCardKeys}
              onDismissSuggestion={onDismissStatCardSuggestion}
              pinnedKeys={pinnedStatCardKeys}
              onChangePinnedKeys={onChangePinnedStatCardKeys}
              onOpenCard={(key) => onOpenStatCard?.(key)}
              reduceMotion={reduceMotion === true}
              language={language}
            />
          </Animated.View>
        ) : null}

        {historyItems.length > 0 ? (
          <Animated.View style={rise(RISE_EMPTY_ROW)}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historySectionTitle}>{t(language, 'home.history.title')}</Text>
              {onOpenHistory ? (
                <Pressable onPress={onOpenHistory} hitSlop={8}>
                  <Text style={styles.historySeeAll}>{t(language, 'home.history.seeAll')}</Text>
                </Pressable>
              ) : null}
            </View>
            {/* Full-bleed rows — no card container around History. */}
            <View>
              {historyItems.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={
                    item.kind === 'strength' && onSelectHistorySession
                      ? () => onSelectHistorySession(item.id)
                      : undefined
                  }
                  style={({ pressed }) => [
                    styles.historyRow,
                    index > 0 && styles.historyRowDivider,
                    pressed && item.kind === 'strength' && styles.pressed,
                  ]}
                >
                  <View style={styles.historyIconTile}>
                    {item.kind === 'cardio' && item.cardioIcon ? (
                      <CardioIcon kind={item.cardioIcon} size={19} color={theme.purple} />
                    ) : (
                      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
                          stroke={theme.purple}
                          strokeWidth={2.1}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyRowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.historyRowMeta} numberOfLines={1}>
                      {item.meta}
                    </Text>
                  </View>
                  {item.kind === 'strength' ? (
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 6l6 6-6 6" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.bottomSafeFade} />
      </ScrollView>

      {/* Adapt = shorten today, and only that.
          This was four rows, all four of which closed the sheet and did
          nothing. Three of them were also in the wrong place: a taken rack and
          a body with no strength in it are both discovered in the gym, and the
          player answers both (swap the lift, dial the weight down set by set).
          Time is the one thing you know before you leave the house, so it is
          the one adaptation that belongs on Home — and it starts the session
          rather than storing a mode, because "how is today going" has no
          meaning tomorrow. */}
      <ConfirmDialog
        language={language}
        visible={confirmingRemovePlan}
        destructive
        title={t(language, 'home.adaptSheet.remove.confirmTitle')}
        message={t(language, 'home.adaptSheet.remove.confirmMessage')}
        confirmLabel={t(language, 'home.adaptSheet.remove.title')}
        cancelLabel={t(language, 'home.adaptSheet.cancel')}
        onCancel={() => setConfirmingRemovePlan(false)}
        onConfirm={() => {
          setConfirmingRemovePlan(false);
          onRemoveActivePlan?.();
        }}
      />

      {/* Today's workout — the program's own sessions, and which one today is.

          Dated rather than sticky: the pick answers for today and the rotation
          answers again tomorrow, so nothing has to remember to undo it. The
          rename lives here too because this is the list where a reader reads
          the names side by side and notices that one of them is wrong. */}
      <Modal
        visible={todaySheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setTodaySheetVisible(false)}
      >
        <View style={styles.adaptOverlay}>
          <Pressable style={styles.adaptScrim} onPress={() => setTodaySheetVisible(false)} />
          <View
            style={[
              styles.adaptSheet,
              { paddingBottom: (keyboardInset > 0 ? keyboardInset : insets.bottom) + 26 },
            ]}
          >
            <View style={styles.adaptGrip} />
            <Text style={styles.adaptTitle}>{t(language, 'home.today.title')}</Text>
            <Text style={styles.adaptSub}>{t(language, 'home.today.caption')}</Text>

            <ScrollView style={styles.todayList} keyboardShouldPersistTaps="handled">
              {planSessions.map((session) => {
                const isToday = session.id === nextPlanSession?.id;
                const renaming = renamingSessionId === session.id;

                if (renaming) {
                  return (
                    <View key={session.id} style={[styles.adaptOpt, styles.todayRowEditing]}>
                      <TextInput
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        autoFocus
                        selectTextOnFocus
                        placeholderTextColor={theme.faint}
                        style={styles.todayRenameInput}
                        onSubmitEditing={() => {
                          onRenameSession?.(session.id, renameDraft);
                          setRenamingSessionId(null);
                        }}
                      />
                      <Pressable
                        hitSlop={8}
                        onPress={() => setRenamingSessionId(null)}
                        style={({ pressed }) => [styles.todayRenameAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.todayRenameCancel}>
                          {t(language, 'home.today.renameCancel')}
                        </Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          onRenameSession?.(session.id, renameDraft);
                          setRenamingSessionId(null);
                        }}
                        style={({ pressed }) => [styles.todayRenameAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.todayRenameSave}>{t(language, 'home.today.renameSave')}</Text>
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isToday }}
                    onPress={() => {
                      onPickTodaySession?.(session.id);
                      setTodaySheetVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.adaptOpt,
                      isToday && styles.todayRowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.adaptOptCopy}>
                      <Text numberOfLines={1} style={styles.adaptOptionTitle}>
                        {localizeSessionName(session.title, language)}
                      </Text>
                      <Text style={styles.adaptOptionSub}>
                        {t(language, 'home.today.meta', {
                          exercises: session.exercises.length,
                          sets: session.totalSets ?? 0,
                        })}
                      </Text>
                    </View>
                    {isToday ? (
                      <Text style={styles.todayBadge}>{t(language, 'home.today.picked')}</Text>
                    ) : null}
                    {onRenameSession ? (
                      <Pressable
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t(language, 'home.today.rename')}
                        onPress={() => {
                          setRenameDraft(localizeSessionName(session.title, language));
                          setRenamingSessionId(session.id);
                        }}
                        style={({ pressed }) => [styles.todayRenameAction, pressed && styles.pressed]}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M4 20h4L20 8l-4-4L4 16v4z"
                            stroke={theme.faint}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={adaptSheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setAdaptSheetVisible(false)}
      >
        <View style={styles.adaptOverlay}>
          <Pressable style={styles.adaptScrim} onPress={() => setAdaptSheetVisible(false)} />
          <View style={[styles.adaptSheet, { paddingBottom: insets.bottom + 26 }]}>
            <View style={styles.adaptGrip} />
            <Text style={styles.adaptTitle}>{t(language, 'home.adaptSheet.title')}</Text>

            {/* Three things a reader might mean by "adapt", smallest commitment
                first: this session, this programme, the whole plan. Each states
                what it does NOT touch, because every one of them looks like it
                might cost you your log. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'home.adaptSheet.shorter.cta')}
              onPress={() => {
                setAdaptSheetVisible(false);
                if (nextPlanSession) {
                  onStartTrimmedSession?.(nextPlanSession.id);
                }
              }}
              style={({ pressed }) => [styles.adaptOption, pressed && styles.pressed]}
            >
              <Text style={styles.adaptOptionTitle}>{t(language, 'home.adaptSheet.shorter.cta')}</Text>
              <Text style={styles.adaptOptionSub}>
                {adaptTrim
                  ? t(language, 'home.adaptSheet.shorter.explain', {
                      sets: adaptTrim.droppedSets,
                      before: planDurationMinutes,
                      after: adaptTrim.minutes,
                    })
                  : t(language, 'home.adaptSheet.shorter.explainNoEstimate')}
              </Text>
            </Pressable>

            {onRemoveActivePlan ? (
              /* Red, and it asks. It sits between two harmless options, and a
                 thumb that misses by a row should not cost someone the plan
                 their week is built on. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'home.adaptSheet.remove.title')}
                onPress={() => {
                  setAdaptSheetVisible(false);
                  setConfirmingRemovePlan(true);
                }}
                style={({ pressed }) => [styles.adaptOption, styles.adaptOptionDanger, pressed && styles.pressed]}
              >
                <Text style={[styles.adaptOptionTitle, styles.adaptOptionTitleDanger]}>
                  {t(language, 'home.adaptSheet.remove.title')}
                </Text>
                <Text style={styles.adaptOptionSub}>{t(language, 'home.adaptSheet.remove.sub')}</Text>
              </Pressable>
            ) : null}

            {onRedoOnboarding ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'home.adaptSheet.redo.title')}
                onPress={() => {
                  setAdaptSheetVisible(false);
                  onRedoOnboarding();
                }}
                style={({ pressed }) => [styles.adaptOption, pressed && styles.pressed]}
              >
                <Text style={styles.adaptOptionTitle}>{t(language, 'home.adaptSheet.redo.title')}</Text>
                <Text style={styles.adaptOptionSub}>{t(language, 'home.adaptSheet.redo.sub')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdaptSheetVisible(false)}
              hitSlop={8}
              style={styles.adaptCancel}
            >
              <Text style={styles.adaptCancelText}>{t(language, 'home.adaptSheet.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Swap sheet for one row of today's plan — same pool and same ranking
          as the player's, so the two surfaces cannot offer different lists. */}
      <Modal
        visible={swapSlotId !== null}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setSwapSlotId(null)}
      >
        <View style={styles.adaptOverlay}>
          <Pressable style={styles.adaptScrim} onPress={() => setSwapSlotId(null)} />
          <View style={[styles.adaptSheet, { paddingBottom: insets.bottom + 26 }]}>
            <View style={styles.adaptGrip} />
            <Text style={styles.adaptTitle}>
              {t(language, 'home.swapSheet.title', {
                name: exerciseNameLabel(language, swapRow.currentName),
              })}
            </Text>
            {/* The list scrolls; the actions below it do not. With nine rows
                the sheet grew past the screen and "Poista ohjelmasta" could
                not be reached at all (user 2026-08-26). */}
            <ScrollView style={styles.adaptOptsScroll} showsVerticalScrollIndicator={false}>
              {([
                { key: 'home.swapSheet.variations' as const, rows: swapRow.shortlist.variations },
                { key: 'home.swapSheet.related' as const, rows: swapRow.shortlist.related },
              ]).map((section) =>
                section.rows.length === 0 ? null : (
                  <View key={section.key} style={styles.adaptOpts}>
                    {/* Named only when both halves are there — one heading over
                        the whole list labels nothing. */}
                    {swapRow.shortlist.variations.length > 0 && swapRow.shortlist.related.length > 0 ? (
                      <Text style={styles.adaptOptGroup}>{t(language, section.key)}</Text>
                    ) : null}
                    {section.rows.map((option) => (
                      <Pressable
                        key={option.exerciseName}
                        accessibilityRole="button"
                        accessibilityLabel={exerciseNameLabel(language, option.exerciseName)}
                        onPress={() => {
                          if (swapSlotId) {
                            onSwapSessionExercise?.(swapSlotId, option.exerciseName);
                          }
                          setSwapSlotId(null);
                        }}
                        style={({ pressed }) => [styles.adaptOpt, pressed && styles.pressed]}
                      >
                        <View style={styles.adaptOptCopy}>
                          <Text style={styles.adaptOptTitle}>
                            {exerciseNameLabel(language, option.exerciseName)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ),
              )}
            </ScrollView>
            {/* Getting rid of a lift, under the replacements rather than among
                them: the same question, but the answer you cannot undo by
                picking another row, so it does not sit where a mis-tap lands.
                Both readings are offered, because a reader who wants an
                exercise gone does not yet know which one they mean — and being
                shown only the temporary one sends them hunting for an editor
                (user 2026-08-26). Each says its own scope; neither is red,
                because a warning colour here would be about the list. */}
            {swapSlotId && (onDropSessionExercise || onRestoreSessionExercise) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (sessionDrops.includes(swapSlotId)) {
                    onRestoreSessionExercise?.(swapSlotId);
                  } else {
                    onDropSessionExercise?.(swapSlotId);
                  }
                  setSwapSlotId(null);
                }}
                style={({ pressed }) => [styles.adaptDrop, pressed && styles.pressed]}
              >
                <Text style={[styles.adaptDropText, styles.adaptDropTextToday]}>
                  {t(
                    language,
                    sessionDrops.includes(swapSlotId) ? 'home.swapSheet.restore' : 'home.swapSheet.drop',
                  )}
                </Text>
                <Text style={styles.adaptDropNote}>{t(language, 'home.swapSheet.dropNote')}</Text>
              </Pressable>
            ) : null}
            {/* Only when the row can be found in the stored programme — a
                button that cannot carry out what it says is worse than none. */}
            {swapRow.exerciseId && onRemoveSessionExercise ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onRemoveSessionExercise(swapRow.exerciseId as string);
                  setSwapSlotId(null);
                }}
                style={({ pressed }) => [styles.adaptDrop, pressed && styles.pressed]}
              >
                <Text style={[styles.adaptDropText, styles.adaptDropTextRemove]}>
                  {t(language, 'home.swapSheet.remove')}
                </Text>
                <Text style={styles.adaptDropNote}>{t(language, 'home.swapSheet.removeNote')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSwapSlotId(null)}
              hitSlop={8}
              style={styles.adaptCancel}
            >
              <Text style={styles.adaptCancelText}>{t(language, 'home.adaptSheet.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Paywall moment sheet: the plateau conclusion, on the user's own
          numbers. The comparison table lives on the full Pro page. */}
      {plateau ? (
        <ProMomentSheet
          visible={plateauSheetVisible}
          content={plateau.moment}
          language={language}
          onClose={() => setPlateauSheetVisible(false)}
          onSeePro={() => {
            setPlateauSheetVisible(false);
            onOpenPremium?.();
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 132,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  proPill: {
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  // Free: gold, because it is an offer and gold is the one "this is Pro"
  // highlight the paywall already uses.
  proPillOffer: {
    backgroundColor: theme.gold,
  },
  // Pro: grey, because it is a status. A subscriber who taps it lands on their
  // membership, not on a page selling them what they have.
  proPillActive: {
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
  },
  proPillPressed: {
    opacity: 0.85,
  },
  proPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  proPillTextOffer: {
    color: '#241743',
  },
  proPillTextActive: {
    color: theme.muted,
  },
  // The skew is allowed to overhang: the scroll content already carries 20px
  // of horizontal padding, so nothing clips.
  greetingRow: {
    flexDirection: 'row',
    // Centred, not baseline: the right side is a two-line stack (counter over
    // its track), and baseline would hang the date off its first line.
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 11,
  },
  // Back to ink (user 2026-08-25, same day it went orange — the accent is
  // busy enough on this screen, and the counter now shares the row).
  greetingDate: {
    fontFamily: 'JetBrainsMono-ExtraBold',
    fontSize: 11.5,
    letterSpacing: 1.05,
    color: theme.ink,
    flexShrink: 0,
  },
  // Two halves behind the label, clipped by the pill's own radius.
  weekCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weekStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekStripItem: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 7,
  },
  weekStripItemToday: {
    backgroundColor: theme.purpleSoft,
  },
  weekStripDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  // Training wears the accent, rest stays green (user 2026-08-25).
  weekStripDotTraining: {
    backgroundColor: theme.highlight,
  },
  weekStripDotUnknown: {
    backgroundColor: 'transparent',
  },
  weekStripDotRecovery: {
    backgroundColor: theme.green,
  },
  weekStripDayLabel: {
    color: theme.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  weekStripDayLabelToday: {
    color: theme.ink,
  },
  weekStripChevron: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPanel: {
    overflow: 'hidden',
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  monthTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purpleSoft,
  },
  monthWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  monthWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthDayCell: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  monthDayCellToday: {
    backgroundColor: theme.purpleSoft,
  },
  monthDayNumber: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  monthDayNumberOutside: {
    color: 'rgba(162,155,180,0.55)',
  },
  monthDayNumberToday: {
    color: theme.purple,
    fontWeight: '900',
  },
  monthDayDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  monthDayDotTraining: {
    backgroundColor: theme.highlight,
  },
  monthDayDotRecovery: {
    backgroundColor: theme.green,
  },
  monthLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  monthSetDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 4,
  },
  monthSetDaysText: {
    color: theme.purpleDark,
    fontSize: 12.5,
    fontWeight: '800',
  },
  monthLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLegendText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  // The completion card is a painted panel — the same fixed dark violet the
  // Pro sheet uses in both themes, so its text colours are fixed too, exactly
  // like white on the detail hero's gradient.
  completeCard: {
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  completeEyebrow: {
    color: '#C4B0FF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  completeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  completeMeta: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  completeNext: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    paddingTop: 12,
  },
  completeNextLabel: {
    color: '#C4B0FF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  completeNextTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    marginTop: 3,
  },
  completeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  completeQuietRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    marginTop: 13,
  },
  completeQuiet: {
    color: 'rgba(255, 255, 255, 0.66)',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  hero: {
    marginTop: 24,
    paddingHorizontal: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    // Shrink, not grow: the chevron sits after it and a growing title would
    // claim the whole row and push the chevron out the way the counter went.
    flexShrink: 1,
    color: theme.ink,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroProg: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  heroProgLabel: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  heroProgTrack: {
    width: 88,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.border,
    overflow: 'hidden',
    marginTop: 7,
  },
  heroProgFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.purple,
  },
  // The hero's lifts, flat on the surface — no card, no accordion.
  heroList: {
    marginTop: 18,
  },
  // The same anatomy as blockRow, so the three section rows read as one
  // family: title takes the line, meta sits at the right edge, chevron last.
  heroListMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  heroListTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroListMeta: {
    color: theme.faint,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  // A row, not a card: same hairline the lift rows use, no fill, no radius.
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  blockTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  blockMeta: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  blockDrillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingLeft: 2,
  },
  blockDrillName: {
    flex: 1,
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  blockDrillScheme: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'JetBrainsMono',
  },
  planExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  planExerciseNumberChip: {
    width: 25,
    height: 25,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purpleSoft,
  },
  // A swapped row wears a filled chip: the plan says one thing and today says
  // another, and the list should not hide that.
  planExerciseNumberChipSwapped: {
    backgroundColor: theme.purple,
  },
  planExerciseNumberText: {
    color: theme.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  planExerciseNumberTextSwapped: { color: '#FFFFFF' },
  planExerciseCopy: {
    flex: 1,
    gap: 1,
  },
  planExerciseName: {
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  planExerciseScheme: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: 'JetBrainsMono',
  },
  // Struck through rather than removed: a row that vanishes takes its own undo
  // with it, and the reader has to remember what was there to put it back.
  planExerciseDropped: {
    textDecorationLine: 'line-through',
    color: theme.faint,
  },
  planExerciseSwap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  adaptButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.purpleBright,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  adaptButtonText: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  startButtonWrap: {
    flex: 1.3,
  },
  cutPressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  // The play mark in a ring, as the design draws it: a mark with an edge
  // reads as a target, and the sweep needs something to pass behind.
  startPlayRing: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    height: 56,
    // The sweep is an absolutely-positioned child, and without this it would
    // run past the button's cut edges.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  // On the filled accent now — the outline version's accent-on-surface text
  // went with the outline (user 2026-08-25: "iso play nappi").
  startButtonText: {
    color: theme.onHighlight,
    fontSize: 17.5,
    lineHeight: 22,
    fontWeight: '800',
  },
  // ── Active program (moved here from the Programs tab) ────────────────
  programHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  programEyebrow: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  programWeek: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  programTitle: {
    color: theme.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  programDays: {
    marginTop: 11,
    gap: 8,
  },
  dayRow: {
    // Twice the old 54: a session title is a sentence in Finnish, and the row
    // has to hold it plus the two labels under it without either truncating.
    minHeight: 108,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 14,
  },
  dayCopy: {
    flex: 1,
    gap: 8,
  },
  dayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayRowToday: {
    borderColor: theme.purple,
    borderWidth: 1.5,
  },
  dayBadge: {
    width: 42,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dayBadgeTextToday: {
    color: '#FFFFFF',
  },
  dayTitle: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  todayPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  // The quieter of the two: the row it sits on already carries the outline.
  nextPillText: {
    color: theme.purple,
  },
  dayDuration: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  dayRowCut: {
    // The surface paints the background now, and the speed line needs room to
    // the left of the badge.
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingLeft: 26,
  },
  rowPressed: {
    transform: [{ translateX: 3 }],
  },
  programActions: {
    gap: 10,
    marginTop: 12,
  },
  programPrimary: {
    flex: 1.4,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  programSecondary: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programSecondaryText: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  otherProgramsBlock: {
    marginTop: 22,
    gap: 8,
  },
  otherProgramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  otherProgramCopy: {
    flex: 1,
    gap: 2,
  },
  otherProgramTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  otherProgramMeta: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  otherProgramRemove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginTop: 22,
  },
  emptyWorkoutRow: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  emptyWorkoutIcon: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWorkoutTitle: {
    flex: 1,
    flexShrink: 1,
    color: theme.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
  },
  emptyWorkoutMeta: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    // Text in a row does not shrink by default, so "Juoksu, pyöräily ja
    // kävely" ran past the card's edge and the card clipped it — the last word
    // went first, which is why "kävely" kept vanishing on narrow widths.
    flexShrink: 1,
    textAlign: 'right',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  statCardsSection: {
    marginTop: 26,
  },
  widgetPromptCard: {
    marginTop: 26,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  widgetPromptTitle: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  widgetPromptBody: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 5,
  },
  widgetPromptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  widgetPromptGhost: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  widgetPromptGhostText: {
    color: theme.muted,
    fontSize: 13.5,
    fontWeight: '800',
  },
  widgetPromptCta: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.purple,
  },
  widgetPromptCtaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  historySectionTitle: {
    color: theme.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  historySeeAll: {
    color: theme.highlight,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  historyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  historyIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRowTitle: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  historyRowMeta: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  bottomSafeFade: {
    height: 16,
  },
  adaptOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12, 7, 26, 0.5)',
  },
  adaptScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  donePillText: {
    color: '#FFFFFF',
  },
  // The kicker and the title stack; that stack shares the row with the session
  // counter. Put in the row directly, the kicker became a third column and
  // squeezed the title down to one shrunken letter.
  heroLead: {
    flex: 1,
  },
  heroTitleRow: {
    // No flex here any more. This sits in a COLUMN now, where flex:1 stretches
    // vertically and flattens nothing — but claims height it does not need.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayList: {
    marginTop: 18,
    // Capped so a six-session program cannot push the list off the sheet and
    // take the last row with it.
    maxHeight: 380,
  },
  todayRowActive: {
    borderColor: theme.purpleBright,
    backgroundColor: theme.purpleLight,
  },
  todayRowEditing: {
    gap: 8,
  },
  todayRenameInput: {
    flex: 1,
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  todayRenameAction: {
    paddingHorizontal: 4,
  },
  todayRenameSave: {
    color: theme.purpleDark,
    fontSize: 13,
    fontWeight: '800',
  },
  todayRenameCancel: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  todayBadge: {
    color: theme.purpleDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  adaptOption: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginTop: 10,
    gap: 3,
  },
  // Was a fixed pink on a fixed cream — a white card sitting in a dark sheet.
  // The same class as the button that drew white on white: a colour copied in
  // rather than taken from the theme is only ever right for one of them.
  adaptOptionDanger: {
    borderColor: theme.dangerBorder,
    backgroundColor: theme.dangerSoft,
  },
  adaptOptionTitleDanger: {
    color: theme.danger,
  },
  adaptOptionTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  adaptOptionSub: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  adaptSheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: theme.surface,
    paddingHorizontal: 22,
    paddingTop: 12,
    // paddingBottom is applied at the call site from the safe-area inset:
    // a fixed 26 put Cancel under the phone's own navigation buttons.
  },
  adaptGrip: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
    marginBottom: 18,
  },
  adaptTitle: {
    color: theme.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  adaptSub: {
    marginTop: 6,
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
  },
  adaptOpts: {
    marginTop: 18,
    gap: 9,
  },
  adaptOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  adaptOptCopy: {
    flex: 1,
    minWidth: 0,
  },
  adaptOptTitle: {
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  adaptPrimary: {
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  adaptPrimaryText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: '#FFFFFF' },
  // The list scrolls under a ceiling so the actions below it always land on
  // screen. Nine rows used to push "Poista ohjelmasta" past the bottom edge.
  adaptOptsScroll: {
    maxHeight: 300,
  },
  adaptOptGroup: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  // Separated from the replacement rows by a rule. The two answers are then
  // told apart by colour, because they differ in how far they reach: orange is
  // the app's "you can press this", red is the one that does not come back.
  adaptDrop: {
    marginTop: 10,
    paddingTop: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 2,
  },
  adaptDropText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  adaptDropTextToday: { color: theme.highlight },
  adaptDropTextRemove: { color: theme.danger },
  adaptDropNote: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  adaptCancel: {
    alignSelf: 'center',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  adaptCancelText: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  plateauCard: {
    marginTop: 16,
    backgroundColor: PW.amberSoft,
    borderWidth: 1,
    borderColor: PW.amberBorder,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 17,
  },
  plateauHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plateauKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: PW.amber,
  },
  plateauHeadline: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.ink,
    lineHeight: 25,
    marginTop: 11,
  },
  plateauMeta: {
    fontSize: 12.5,
    fontWeight: '600',
    color: PW.amberInk,
    lineHeight: 18,
    marginTop: 7,
  },
  plateauLock: {
    marginTop: 14,
  },
  plateauFix: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  plateauFixLine: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.ink,
    lineHeight: 20,
  },
});

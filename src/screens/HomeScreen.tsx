import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CardioIcon } from '../components/CardioIcon';
import { HomeStatCardsSection } from '../components/HomeStatCardsSection';
import { CardioIconKind } from '../lib/cardio';
import { HomeStatCard } from '../lib/homeStatCards';
import { VinhaIcon } from '../components/VinhaIcon';
import { getHomeMiniCalendarDays, getHomeMonthCalendar, HomeDaySessionSummary } from '../lib/homeCalendar';
import {
  getAdaptTrimEstimate,
  getDefaultCooldown,
  getDefaultWarmup,
  getSessionFocusTitle,
} from '../lib/homeSessionHero';
import { getGreetingRotation, selectHomeGreeting } from '../lib/homeGreeting';
import { AnimatedGreeting } from '../components/AnimatedGreeting';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { buildSwapOptionsForSlot, TailoringPreferencesInput } from '../lib/tailoringFit';
import { localizeWorkoutFocus } from '../lib/sessionNameLabel';
import { t } from '../lib/i18n';
import { ProMomentContent } from '../lib/proInsights';
import { ProLockedCard } from '../components/ProLockedCard';
import { ProMomentSheet } from '../components/ProMomentSheet';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

// The Home Pro sheet is gone (design: Vinha Paywall Moments): contextual
// sheets belong to the moments, and the comparison table lives on the ONE full
// Pro page. The PRO pill now opens that page directly.

// PRO pill: half "what you have" ink, half "what Pro adds" orange.
const PRO_BADGE_INK = '#1C1830';
const PRO_BADGE_ORANGE = '#F97316';

// Entrance stagger (Home v4 "rise"): translateY 16 -> 0 + fade, 500ms,
// cubic-bezier(.22,1,.36,1). Indices name each animated section.
const RISE_DELAYS_MS = [40, 100, 160, 300, 360, 420, 460, 480, 520, 560, 600] as const;
const RISE_HEADER = 0;
const RISE_WEEK = 1;
const RISE_HERO = 2;
const RISE_SEC_BASE = 3; // warmup 3, workout 4, cooldown 5
const RISE_BTNROW = 6;
const RISE_DIVIDER = 7;
const RISE_EMPTY_ROW = 10;

const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SECTION_EASING = Easing.bezier(0.4, 0, 0.2, 1);

type SectionKey = 'warmup' | 'workout' | 'cooldown';

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
}

interface HomeScreenProps {
  activePlan?: HomePlanCard | null;
  onStartActivePlanSession?: (sessionId: string) => void;
  onCreateWorkoutFromExercises: () => void;
  onOpenCardio?: () => void;
  /** Where every Pro touchpoint leads — the full Pro page. */
  onOpenPremium?: () => void;
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
  onSelectHistorySession?: (sessionId: string) => void;
  /** "Your cards": one computed card per catalog item, Add-sheet order. */
  statCatalogCards?: HomeStatCard[];
  pinnedStatCardKeys?: string[];
  onChangePinnedStatCardKeys?: (next: string[]) => void;
  onOpenStatCard?: (key: string) => void;
  /**
   * Monday-first weekday indexes (0 = Mon … 6 = Sun) of the user's training
   * days, from setupAvailableDays. Empty = unknown → the strip shows no
   * training dots rather than an invented rhythm.
   */
  trainingDayIndexes?: number[];
  language?: AppLanguage;
  /**
   * Equipment chips the user actually has; null when the setup never said.
   * Keeps the default warmup honest — no rower for a bodyweight-only user.
   */
  availableEquipment?: string[] | null;
  /**
   * What the log actually says, for the greeting. Defaults describe a fresh
   * account, so an unwired caller gets the first-run line rather than a
   * "welcome back" nobody earned.
   */
  greetingState?: {
    totalSessions: number;
    trainedToday: boolean;
    weekStreak: number;
  };
  /**
   * The one-time home-screen widget offer. Null unless the device can actually
   * pin one and the user has not answered yet — an offer that cannot be
   * fulfilled is worse than no offer.
   */
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
  onStartActivePlanSession,
  onCreateWorkoutFromExercises,
  onOpenCardio,
  onOpenPremium,
  plateau = null,
  proUnlocked = false,
  historyItems = [],
  onOpenHistory,
  onSetTrainingDays,
  onSelectHistorySession,
  statCatalogCards = [],
  pinnedStatCardKeys = [],
  onChangePinnedStatCardKeys,
  onOpenStatCard,
  trainingDayIndexes = [],
  language = 'en',
  availableEquipment = null,
  greetingState = { totalSessions: 0, trainedToday: false, weekStreak: 0 },
  widgetPrompt = null,
  sessionSwaps = {},
  onSwapSessionExercise,
  tailoringPreferences = null,
  onStartTrimmedSession,
}: HomeScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [plateauSheetVisible, setPlateauSheetVisible] = useState(false);
  const [adaptSheetVisible, setAdaptSheetVisible] = useState(false);
  /** Which row's swap sheet is open, by slot id. */
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  // Months away from today. Reset on close so reopening always lands on now.
  const [monthOffset, setMonthOffset] = useState(0);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    warmup: false,
    workout: false,
    cooldown: false,
  });
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const topCalendarDays = getHomeMiniCalendarDays(new Date(), language).slice(0, 6);
  const monthCalendar = useMemo(
    () => getHomeMonthCalendar(new Date(), language, monthOffset),
    [language, monthOffset],
  );

  // --- Session hero data (Home v4) ---------------------------------------
  const nextPlanSession = activePlan?.nextSession ?? null;
  const focusTitle = getSessionFocusTitle(nextPlanSession?.title, activePlan?.title);
  const sessionsDone = activePlan?.sessionsDone ?? 0;
  const sessionsTotal = activePlan?.sessionsTotal ?? 0;
  const sessionsProgressPercent = sessionsTotal > 0 ? Math.round((sessionsDone / sessionsTotal) * 100) : 0;
  const planDuration = nextPlanSession?.duration ?? '~45 min';
  const planDurationMinutes = Number.parseInt(planDuration.replace(/\D/g, ''), 10) || 45;
  const totalExerciseCount = (nextPlanSession?.exercises.length ?? 0) + (nextPlanSession?.hiddenExerciseCount ?? 0);
  const totalSets = nextPlanSession?.totalSets ?? 0;
  // Rotates once per day, so the line is stable while the screen is open.
  const greeting = useMemo(
    () =>
      selectHomeGreeting({
        totalSessions: greetingState.totalSessions,
        trainedToday: greetingState.trainedToday,
        weekStreak: greetingState.weekStreak,
        rotation: getGreetingRotation(),
      }),
    [greetingState.totalSessions, greetingState.trainedToday, greetingState.weekStreak],
  );
  const warmup = getDefaultWarmup(focusTitle, language, availableEquipment);
  const cooldown = getDefaultCooldown(focusTitle, language, availableEquipment);
  const adaptTrim = getAdaptTrimEstimate(totalSets, planDurationMinutes);

  // The row whose swap sheet is open, with its current lift resolved through
  // today's swaps — reopening the sheet after a swap must offer the pool for
  // what is there now, not what the template originally said.
  const swapRow = useMemo(() => {
    const exercise = nextPlanSession?.exercises.find((item) => item.slotId && item.slotId === swapSlotId);
    if (!exercise?.slotId) {
      return { currentName: '', options: [] as ReturnType<typeof buildSwapOptionsForSlot> };
    }
    const currentName = sessionSwaps[exercise.slotId] ?? exercise.name;
    return {
      currentName,
      options: buildSwapOptionsForSlot(exercise.substitutionGroup ?? '', currentName, tailoringPreferences),
    };
  }, [nextPlanSession, swapSlotId, sessionSwaps, tailoringPreferences]);

  // --- Animations -----------------------------------------------------------

  const riseValues = useRef(RISE_DELAYS_MS.map(() => new Animated.Value(0))).current;
  const progressFillAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef<Record<SectionKey, Animated.Value>>({
    warmup: new Animated.Value(0),
    workout: new Animated.Value(0),
    cooldown: new Animated.Value(0),
  }).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
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

  // Same rule for the accordion chevrons/bodies, the calendar, and the hero
  // progress bar: interpolate once, not per render.
  const sectionStyles = useRef({
    warmup: {
      chevron: { transform: [{ rotate: sectionAnims.warmup.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] },
      body: { opacity: sectionAnims.warmup, maxHeight: sectionAnims.warmup.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) },
    },
    workout: {
      chevron: { transform: [{ rotate: sectionAnims.workout.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] },
      body: { opacity: sectionAnims.workout, maxHeight: sectionAnims.workout.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) },
    },
    cooldown: {
      chevron: { transform: [{ rotate: sectionAnims.cooldown.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] },
      body: { opacity: sectionAnims.cooldown, maxHeight: sectionAnims.cooldown.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) },
    },
  }).current;
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

  const toggleSection = (key: SectionKey) => {
    const next = !openSections[key];
    setOpenSections((current) => ({ ...current, [key]: next }));
    if (reduceMotion) {
      sectionAnims[key].setValue(next ? 1 : 0);
      return;
    }
    Animated.timing(sectionAnims[key], {
      toValue: next ? 1 : 0,
      duration: 380,
      easing: SECTION_EASING,
      useNativeDriver: false,
    }).start();
  };

  const startTodaysSession = () => {
    if (nextPlanSession && onStartActivePlanSession) {
      onStartActivePlanSession(nextPlanSession.id);
      return;
    }
    onCreateWorkoutFromExercises();
  };


  const renderSection = (
    key: SectionKey,
    title: string,
    countLabel: string,
    rows: Array<{ name: string; schemeLabel: string; slotId?: string; swapped?: boolean }>,
    extraCount = 0,
  ) => (
    <Animated.View
      key={key}
      style={[styles.secCard, rise(RISE_SEC_BASE + (key === 'warmup' ? 0 : key === 'workout' ? 1 : 2))]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(language, openSections[key] ? 'home.a11y.collapseSection' : 'home.a11y.expandSection', { title })}
        onPress={() => toggleSection(key)}
        style={styles.secBtn}
      >
        <Text style={styles.secTitle}>{title}</Text>
        <Text style={styles.secCount}>{countLabel}</Text>
        <Animated.View style={sectionStyles[key].chevron}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="m6 9 6 6 6-6" stroke="#8B84A0" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.secBody, sectionStyles[key].body]}>
        <View style={styles.secInner}>
          {rows.map((row, index) => (
            <View key={`${row.name}-${index}`} style={styles.planExerciseRow}>
              <View style={[styles.planExerciseNumberChip, row.swapped && styles.planExerciseNumberChipSwapped]}>
                <Text style={[styles.planExerciseNumberText, row.swapped && styles.planExerciseNumberTextSwapped]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.planExerciseName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.planExerciseScheme}>{row.schemeLabel}</Text>
              {/* Changing a lift belongs next to the lift, not behind a menu
                  that says "swap any exercise" while showing you none. Only on
                  rows whose slot can be identified — a button that cannot
                  apply its own result is worse than no button. */}
              {row.slotId && onSwapSessionExercise ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'home.a11y.swapExercise', { name: row.name })}
                  hitSlop={8}
                  onPress={() => setSwapSlotId(row.slotId ?? null)}
                  style={({ pressed }) => [styles.planExerciseSwap, pressed && styles.pressed]}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7m10 0-3-3m3 3-3 3"
                      stroke={row.swapped ? theme.purple : theme.faint}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              ) : null}
            </View>
          ))}
          {extraCount > 0 ? (
            <View style={styles.planExerciseRow}>
              <Text style={styles.planListFooterText}>{t(language, 'home.section.more', { count: extraCount })}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.screenBackground}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.headerRow, rise(RISE_HEADER)]}>
          <View style={styles.headerCopy}>
            <AnimatedGreeting
              text={t(language, greeting.titleKey, greeting.titleVars)}
              style={styles.greetingTitle}
              accentColor={theme.purpleBright}
            />
            <AnimatedGreeting
              text={t(language, greeting.subtitleKey)}
              style={styles.greetingSubtitle}
              accentColor={theme.purpleBright}
              staggerMs={28}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'home.a11y.openPro')}
            onPress={() => onOpenPremium?.()}
            hitSlop={8}
            style={({ pressed }) => [styles.proBadge, pressed && styles.pressed]}
          >
            {/* Split down the middle: the dark half is what the user has, the
                orange half is what Pro adds. The pill shows the trade rather
                than just shouting a brand colour. */}
            <View style={styles.proBadgeHalves} pointerEvents="none">
              <View style={[styles.proBadgeHalf, styles.proBadgeHalfFree]} />
              <View style={[styles.proBadgeHalf, styles.proBadgeHalfPro]} />
            </View>
            <Text style={styles.proBadgeText}>PRO</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.weekCard, rise(RISE_WEEK)]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, calendarExpanded ? 'home.a11y.collapseCalendar' : 'home.a11y.expandCalendar')}
            onPress={toggleCalendar}
            style={({ pressed }) => [styles.weekStripRow, pressed && styles.pressed]}
          >
            {topCalendarDays.map((day) => {
              const isTrainingDay = trainingDayIndexes.includes(day.weekdayIndex);
              const dayLabel = day.isToday ? day.dateLabel : day.weekdayLabel;

              return (
                <View key={day.dayStart} style={[styles.weekStripItem, day.isToday && styles.weekStripItemToday]}>
                  {/* Dots only when training days are actually known — with no
                      schedule, "recovery" would be as invented as "training". */}
                  {trainingDayIndexes.length > 0 ? (
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
                  const isTrainingDay = day.inMonth && trainingDayIndexes.includes(day.weekdayIndex);

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
                          trainingDayIndexes.length > 0
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
            {trainingDayIndexes.length > 0 ? (
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

        {/* Session hero (Home v4) — renders only with an active plan */}
        {activePlan && nextPlanSession ? (
          <>
            <Animated.View style={[styles.hero, rise(RISE_HERO)]}>
              <View style={styles.heroTop}>
                {/* 'line' mode: the anchor must stay on one line and shrink to
                    fit, which only works while it is a single Text node. */}
                <AnimatedGreeting
                  text={localizeWorkoutFocus(focusTitle, language)}
                  style={styles.heroTitle}
                  accentColor={theme.purpleBright}
                  mode="line"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                />
                <View style={styles.heroProg}>
                  <Text style={styles.heroProgLabel}>
                    {t(language, 'home.hero.sessionsProgress', { done: sessionsDone, total: sessionsTotal })}
                  </Text>
                  <View style={styles.heroProgTrack}>
                    <Animated.View style={[styles.heroProgFill, { width: progressFillWidth }]} />
                  </View>
                </View>
              </View>

            </Animated.View>

            <View style={styles.secs}>
              {renderSection(
                'warmup',
                t(language, 'home.section.warmup'),
                t(language, 'home.section.warmupMeta', { count: warmup.drills.length, min: warmup.minutes }),
                warmup.drills,
              )}
              {renderSection(
                'workout',
                t(language, 'home.section.workout'),
                t(language, 'home.section.workoutMeta', { count: totalExerciseCount, sets: totalSets }),
                nextPlanSession.exercises.map((exercise) => {
                  const swappedName = exercise.slotId ? sessionSwaps[exercise.slotId] : undefined;
                  return {
                    name: exerciseNameLabel(language, swappedName ?? exercise.name),
                    // A swap changes the lift, not the prescription — same
                    // sets, same reps, same slot.
                    schemeLabel: exercise.schemeLabel ?? exercise.setsLabel,
                    slotId: exercise.slotId,
                    swapped: Boolean(swappedName),
                  };
                }),
                nextPlanSession.hiddenExerciseCount,
              )}
              {renderSection(
                'cooldown',
                t(language, 'home.section.cooldown'),
                t(language, 'home.section.cooldownMeta', { count: cooldown.drills.length, min: cooldown.minutes }),
                cooldown.drills,
              )}
            </View>
          </>
        ) : null}

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
            accessibilityLabel={t(language, 'home.a11y.startSession')}
            onPress={startTodaysSession}
            style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          >
            <Text style={styles.startButtonText}>{t(language, 'home.startWorkout')}</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke={theme.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </Animated.View>

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
              <Text style={styles.emptyWorkoutMeta}>{t(language, 'home.cardio.meta')}</Text>
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

        {onChangePinnedStatCardKeys ? (
          <Animated.View style={[styles.statCardsSection, rise(RISE_EMPTY_ROW)]}>
            <HomeStatCardsSection
              catalogCards={statCatalogCards}
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
      <Modal
        visible={adaptSheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setAdaptSheetVisible(false)}
      >
        <View style={styles.adaptOverlay}>
          <Pressable style={styles.adaptScrim} onPress={() => setAdaptSheetVisible(false)} />
          <View style={styles.adaptSheet}>
            <View style={styles.adaptGrip} />
            <Text style={styles.adaptTitle}>{t(language, 'home.adaptSheet.shorter.title')}</Text>
            <Text style={styles.adaptSub}>
              {t(language, 'home.adaptSheet.shorter.explain', {
                sets: adaptTrim.droppedSets,
                before: totalSets,
                after: Math.max(0, totalSets - adaptTrim.droppedSets),
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'home.adaptSheet.shorter.cta')}
              onPress={() => {
                setAdaptSheetVisible(false);
                if (nextPlanSession) {
                  onStartTrimmedSession?.(nextPlanSession.id);
                }
              }}
              style={({ pressed }) => [styles.adaptPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.adaptPrimaryText}>{t(language, 'home.adaptSheet.shorter.cta')}</Text>
            </Pressable>
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
          <View style={styles.adaptSheet}>
            <View style={styles.adaptGrip} />
            <Text style={styles.adaptTitle}>
              {t(language, 'home.swapSheet.title', {
                name: exerciseNameLabel(language, swapRow.currentName),
              })}
            </Text>
            <View style={styles.adaptOpts}>
              {swapRow.options.map((option) => (
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
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  greetingTitle: {
    color: theme.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  proBadge: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: PRO_BADGE_INK,
  },
  // Two halves behind the label, clipped by the pill's own radius.
  proBadgeHalves: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  proBadgeHalf: {
    flex: 1,
  },
  proBadgeHalfFree: {
    backgroundColor: PRO_BADGE_INK,
  },
  proBadgeHalfPro: {
    backgroundColor: PRO_BADGE_ORANGE,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
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
  weekStripDotTraining: {
    backgroundColor: theme.purpleBright,
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
    backgroundColor: theme.purpleBright,
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
    flex: 1,
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
  secs: {
    marginTop: 20,
    gap: 10,
  },
  secCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
    shadowColor: theme.purpleBright,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  secBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  secTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secCount: {
    color: theme.faint,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  secBody: {
    overflow: 'hidden',
  },
  secInner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  planExerciseName: {
    flex: 1,
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
  planExerciseSwap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  planListFooterText: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
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
  startButton: {
    flex: 1.3,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.accent,
    backgroundColor: theme.surface,
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
  startButtonText: {
    color: theme.accent,
    fontSize: 17.5,
    lineHeight: 22,
    fontWeight: '800',
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
  adaptSheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: theme.surface,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 26,
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
  adaptOptIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  adaptOptSub: {
    marginTop: 2,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
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

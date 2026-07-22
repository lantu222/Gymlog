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
import { GymlogIcon } from '../components/GymlogIcon';
import { getHomeMiniCalendarDays, getHomeMonthCalendar, HomeDaySessionSummary } from '../lib/homeCalendar';
import {
  getAdaptTrimEstimate,
  getDefaultCooldown,
  getDefaultWarmup,
  getSessionFocusTitle,
} from '../lib/homeSessionHero';
import { HG3 } from '../lightTheme';

// Dark Pro-sheet-only shades (GAINER Home v3 mock). The sheet lives on the
// HG3.proSheetTop -> proSheetBottom gradient, so these do not belong in the
// shared light palette.
const PRO_SHEET_INK = '#F5F2FC';
const PRO_SHEET_MUTED = '#A79FC4';
const PRO_SHEET_FAINT = '#7C739E';
const PRO_SHEET_CARD = 'rgba(255,255,255,0.06)';
const PRO_SHEET_BORDER = 'rgba(255,255,255,0.12)';

// Mock marketing copy + prices. Real prices must come from RevenueCat
// (see "GAINER Premium - build notes.md"); these are placeholders until the
// purchase flow is wired up.
const PRO_STATS: Array<{ value: string; suffix: string; label: string }> = [
  { value: '2.3', suffix: '×', label: 'more consistent training' },
  { value: '+34', suffix: '%', label: 'avg. strength in 12 wks' },
  { value: '∞', suffix: '', label: 'AI coach questions' },
];

const PRO_COMPARISON: Array<{ label: string; free: boolean }> = [
  { label: 'Log workouts & plans', free: true },
  { label: 'AI Coach conversations', free: false },
  { label: 'Advanced progress analytics', free: false },
  { label: 'Unlimited plans & templates', free: false },
  { label: 'Early access to new features', free: false },
];

const PRO_PRICING = {
  annual: {
    title: 'Annual',
    price: '€4.99',
    per: '/mo',
    note: '€59.99 billed yearly',
    badge: 'SAVE 40%',
    finePrint: '7 days free, then €59.99/year. Cancel anytime.',
  },
  monthly: {
    title: 'Monthly',
    price: '€8.99',
    per: '/mo',
    note: 'billed monthly',
    badge: null,
    finePrint: '7 days free, then €8.99/month. Cancel anytime.',
  },
} as const;

type ProPlanKey = keyof typeof PRO_PRICING;

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
  historyItems?: HomeHistoryItem[];
  onOpenHistory?: () => void;
  onSelectHistorySession?: (sessionId: string) => void;
  /** "Your cards": one computed card per catalog item, Add-sheet order. */
  statCatalogCards?: HomeStatCard[];
  pinnedStatCardKeys?: string[];
  onChangePinnedStatCardKeys?: (next: string[]) => void;
  onOpenStatCard?: (key: string) => void;
}

export function HomeScreen({
  activePlan = null,
  onStartActivePlanSession,
  onCreateWorkoutFromExercises,
  onOpenCardio,
  historyItems = [],
  onOpenHistory,
  onSelectHistorySession,
  statCatalogCards = [],
  pinnedStatCardKeys = [],
  onChangePinnedStatCardKeys,
  onOpenStatCard,
}: HomeScreenProps) {
  const [proSheetVisible, setProSheetVisible] = useState(false);
  const [proPlan, setProPlan] = useState<ProPlanKey>('annual');
  const [adaptSheetVisible, setAdaptSheetVisible] = useState(false);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    warmup: false,
    workout: false,
    cooldown: false,
  });
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const topCalendarDays = getHomeMiniCalendarDays().slice(0, 6);
  const monthCalendar = useMemo(() => getHomeMonthCalendar(), []);
  const trainingDayIndexes = activePlan
    ? [0, 3].slice(0, Math.min(Number.parseInt(activePlan.sessionsPerWeek, 10) || 2, 2))
    : [0, 3];

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
  const warmup = getDefaultWarmup(focusTitle);
  const cooldown = getDefaultCooldown(focusTitle);
  const adaptTrim = getAdaptTrimEstimate(totalSets, planDurationMinutes);

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

  const rise = (index: number) => ({
    opacity: riseValues[index],
    transform: [
      {
        translateY: riseValues[index].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
      },
    ],
  });

  const toggleCalendar = () => {
    const next = !calendarExpanded;
    setCalendarExpanded(next);
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

  const activePricing = PRO_PRICING[proPlan];

  const renderSection = (
    key: SectionKey,
    title: string,
    countLabel: string,
    rows: Array<{ name: string; schemeLabel: string }>,
    extraCount = 0,
  ) => (
    <Animated.View
      key={key}
      style={[styles.secCard, rise(RISE_SEC_BASE + (key === 'warmup' ? 0 : key === 'workout' ? 1 : 2))]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${openSections[key] ? 'Collapse' : 'Expand'} ${title}`}
        onPress={() => toggleSection(key)}
        style={styles.secBtn}
      >
        <Text style={styles.secTitle}>{title}</Text>
        <Text style={styles.secCount}>{countLabel}</Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: sectionAnims[key].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
              },
            ],
          }}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="m6 9 6 6 6-6" stroke="#8B84A0" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
      <Animated.View
        style={[
          styles.secBody,
          {
            opacity: sectionAnims[key],
            maxHeight: sectionAnims[key].interpolate({ inputRange: [0, 1], outputRange: [0, 420] }),
          },
        ]}
      >
        <View style={styles.secInner}>
          {rows.map((row, index) => (
            <View key={`${row.name}-${index}`} style={styles.planExerciseRow}>
              <View style={styles.planExerciseNumberChip}>
                <Text style={styles.planExerciseNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.planExerciseName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.planExerciseScheme}>{row.schemeLabel}</Text>
            </View>
          ))}
          {extraCount > 0 ? (
            <View style={styles.planExerciseRow}>
              <Text style={styles.planListFooterText}>+ {extraCount} more</Text>
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
            <Text style={styles.greetingTitle}>Welcome back</Text>
            <Text style={styles.greetingSubtitle}>Let's get after it today.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open GAINER Pro"
            onPress={() => setProSheetVisible(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.proBadge, pressed && styles.pressed]}
          >
            <Text style={styles.proBadgeText}>PRO</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.weekCard, rise(RISE_WEEK)]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={calendarExpanded ? 'Collapse month calendar' : 'Expand month calendar'}
            onPress={toggleCalendar}
            style={({ pressed }) => [styles.weekStripRow, pressed && styles.pressed]}
          >
            {topCalendarDays.map((day) => {
              const isTrainingDay = trainingDayIndexes.includes(day.weekdayIndex);
              const dayLabel = day.isToday ? day.dateLabel : day.weekdayLabel;

              return (
                <View key={day.dayStart} style={[styles.weekStripItem, day.isToday && styles.weekStripItemToday]}>
                  <View style={[styles.weekStripDot, isTrainingDay ? styles.weekStripDotTraining : styles.weekStripDotRecovery]} />
                  <Text style={[styles.weekStripDayLabel, day.isToday && styles.weekStripDayLabelToday]}>{dayLabel}</Text>
                </View>
              );
            })}
            <Animated.View
              style={[
                styles.weekStripChevron,
                {
                  transform: [
                    {
                      rotate: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
                    },
                  ],
                },
              ]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke={HG3.faint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </Pressable>

          <Animated.View
            style={[
              styles.monthPanel,
              {
                opacity: calendarAnim,
                maxHeight: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }),
              },
            ]}
          >
            <Text style={styles.monthTitle}>{monthCalendar.monthLabel}</Text>
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
                          isTrainingDay ? styles.monthDayDotTraining : day.inMonth ? styles.monthDayDotRecovery : null,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
            <View style={styles.monthLegendRow}>
              <View style={styles.monthLegendItem}>
                <View style={[styles.monthDayDot, styles.monthDayDotTraining]} />
                <Text style={styles.monthLegendText}>Training</Text>
              </View>
              <View style={styles.monthLegendItem}>
                <View style={[styles.monthDayDot, styles.monthDayDotRecovery]} />
                <Text style={styles.monthLegendText}>Recovery</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Session hero (Home v4) — renders only with an active plan */}
        {activePlan && nextPlanSession ? (
          <>
            <Animated.View style={[styles.hero, rise(RISE_HERO)]}>
              <View style={styles.heroTop}>
                <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {focusTitle}
                </Text>
                <View style={styles.heroProg}>
                  <Text style={styles.heroProgLabel}>
                    {sessionsDone} of {sessionsTotal} sessions
                  </Text>
                  <View style={styles.heroProgTrack}>
                    <Animated.View
                      style={[
                        styles.heroProgFill,
                        {
                          width: progressFillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

            </Animated.View>

            <View style={styles.secs}>
              {renderSection(
                'warmup',
                'Warmup',
                `${warmup.drills.length} drills · ${warmup.minutes} min`,
                warmup.drills,
              )}
              {renderSection(
                'workout',
                'Workout',
                `${totalExerciseCount} exercises · ${totalSets} sets`,
                nextPlanSession.exercises.map((exercise) => ({
                  name: exercise.name,
                  schemeLabel: exercise.schemeLabel ?? exercise.setsLabel,
                })),
                nextPlanSession.hiddenExerciseCount,
              )}
              {renderSection(
                'cooldown',
                'Cooldown',
                `${cooldown.drills.length} stretches · ${cooldown.minutes} min`,
                cooldown.drills,
              )}
            </View>
          </>
        ) : null}

        <Animated.View style={[styles.btnRow, rise(RISE_BTNROW)]}>
          {activePlan && nextPlanSession ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adapt today's session"
              onPress={() => setAdaptSheetVisible(true)}
              style={({ pressed }) => [styles.adaptButton, pressed && styles.pressed]}
            >
              <Text style={styles.adaptButtonText}>Adapt</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start today's workout"
            onPress={startTodaysSession}
            style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          >
            <Text style={styles.startButtonText}>Start workout</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke={HG3.green} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.sectionDivider, rise(RISE_DIVIDER)]} />

        <Animated.View style={rise(RISE_EMPTY_ROW)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start empty workout"
            onPress={onCreateWorkoutFromExercises}
            style={({ pressed }) => [styles.emptyWorkoutRow, pressed && styles.pressed]}
          >
            <View style={styles.emptyWorkoutIcon}>
              <GymlogIcon name="plus" color={HG3.purple} size={20} />
            </View>
            <Text style={styles.emptyWorkoutTitle}>Empty workout</Text>
            <Text style={styles.emptyWorkoutMeta}>Log freestyle</Text>
          </Pressable>
          {onOpenCardio ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open cardio workouts"
              onPress={onOpenCardio}
              style={({ pressed }) => [styles.emptyWorkoutRow, pressed && styles.pressed]}
            >
              <View style={styles.emptyWorkoutIcon}>
                <Svg width={20} height={20} viewBox="0 0 256 256">
                  <Path
                    d="M152 88a28 28 0 1 0-28-28 28 28 0 0 0 28 28Zm-56.4 68.7-20.6 41.1a12 12 0 0 0 21.5 10.7l20.5-41.1 26.4 19.8V232a12 12 0 0 0 24 0v-48a12 12 0 0 0-4.8-9.6l-25.5-19.1 14.3-35.8 8.5 12.8a12 12 0 0 0 8 5.1l40 8a12 12 0 1 0 4.7-23.6l-35-7-21.9-32.8a12 12 0 0 0-15.5-4l-48 24a12 12 0 0 0-5.4 5.3l-16 32a12 12 0 0 0 21.5 10.7l14.2-28.4 18.9-9.5-13.6 34Z"
                    fill={HG3.purple}
                  />
                </Svg>
              </View>
              <Text style={styles.emptyWorkoutTitle}>Cardio</Text>
              <Text style={styles.emptyWorkoutMeta}>Runs, cycles & walks</Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {onChangePinnedStatCardKeys ? (
          <Animated.View style={[styles.statCardsSection, rise(RISE_EMPTY_ROW)]}>
            <HomeStatCardsSection
              catalogCards={statCatalogCards}
              pinnedKeys={pinnedStatCardKeys}
              onChangePinnedKeys={onChangePinnedStatCardKeys}
              onOpenCard={(key) => onOpenStatCard?.(key)}
              reduceMotion={reduceMotion === true}
            />
          </Animated.View>
        ) : null}

        {historyItems.length > 0 ? (
          <Animated.View style={rise(RISE_EMPTY_ROW)}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historySectionTitle}>History</Text>
              {onOpenHistory ? (
                <Pressable onPress={onOpenHistory} hitSlop={8}>
                  <Text style={styles.historySeeAll}>See all</Text>
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
                      <CardioIcon kind={item.cardioIcon} size={19} color={HG3.purple} />
                    ) : (
                      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
                          stroke={HG3.purple}
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
                      <Path d="M9 6l6 6-6 6" stroke={HG3.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.bottomSafeFade} />
      </ScrollView>

      {/* Adapt session sheet (Home v4) — options are presentational for now */}
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
            <Text style={styles.adaptTitle}>Adapt session</Text>
            <Text style={styles.adaptSub}>Tweak today's session — your plan stays on track.</Text>
            <View style={styles.adaptOpts}>
              {[
                {
                  key: 'shorter',
                  title: 'Shorter session',
                  sub: `Trim to ~${adaptTrim.trimmedMinutes} min · drops ${adaptTrim.droppedSets} sets`,
                  icon: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9 2h6',
                },
                {
                  key: 'equipment',
                  title: 'Change equipment',
                  sub: 'Rack taken? Swap to dumbbells',
                  icon: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
                },
                {
                  key: 'swap',
                  title: 'Swap an exercise',
                  sub: 'Replace any lift with an alternative',
                  icon: 'M7 8h10M7 8l3-3M7 8l3 3M17 16H7m10 0-3-3m3 3-3 3',
                },
                {
                  key: 'energy',
                  title: 'Feeling low energy',
                  sub: 'Lighter loads, same movements',
                  icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
                },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={option.title}
                  onPress={() => setAdaptSheetVisible(false)}
                  style={({ pressed }) => [styles.adaptOpt, pressed && styles.pressed]}
                >
                  <View style={styles.adaptOptIcon}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d={option.icon} stroke={HG3.purple} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.adaptOptCopy}>
                    <Text style={styles.adaptOptTitle}>{option.title}</Text>
                    <Text style={styles.adaptOptSub}>{option.sub}</Text>
                  </View>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="m9 6 6 6-6 6" stroke={HG3.faint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdaptSheetVisible(false)}
              hitSlop={8}
              style={styles.adaptCancel}
            >
              <Text style={styles.adaptCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={proSheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setProSheetVisible(false)}
      >
        <View style={styles.proSheetOverlay}>
          <Pressable style={styles.proSheetScrim} onPress={() => setProSheetVisible(false)} />
          <View style={styles.proSheet}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="proSheetGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={HG3.proSheetTop} />
                  <Stop offset="1" stopColor={HG3.proSheetBottom} />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#proSheetGradient)" />
            </Svg>
            <ScrollView contentContainerStyle={styles.proSheetContent} showsVerticalScrollIndicator={false}>
              <View style={styles.proSheetGrip} />
              <View style={styles.proSheetBadge}>
                <Text style={styles.proSheetBadgeText}>✦ GAINER PRO</Text>
              </View>
              <Text style={styles.proSheetHeadline}>Train like it's personal.</Text>
              <Text style={styles.proSheetSubline}>
                Your plan adapts every session — with a coach that actually knows your numbers.
              </Text>

              <View style={styles.proStatRow}>
                {PRO_STATS.map((stat) => (
                  <View key={stat.label} style={styles.proStatCard}>
                    <Text style={styles.proStatValue}>
                      {stat.value}
                      {stat.suffix ? <Text style={styles.proStatSuffix}>{stat.suffix}</Text> : null}
                    </Text>
                    <Text style={styles.proStatLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.proTable}>
                <View style={styles.proTableHeaderRow}>
                  <Text style={styles.proTableHeaderLabel}>What you get</Text>
                  <Text style={styles.proTableHeaderFree}>FREE</Text>
                  <Text style={styles.proTableHeaderPro}>PRO</Text>
                </View>
                {PRO_COMPARISON.map((row) => (
                  <View key={row.label} style={styles.proTableRow}>
                    <Text style={styles.proTableRowLabel}>{row.label}</Text>
                    <View style={styles.proTableCell}>
                      {row.free ? (
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M5 12l5 5L19 7" stroke={HG3.gold} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      ) : (
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Path d="M6 6l12 12M18 6L6 18" stroke={PRO_SHEET_FAINT} strokeWidth={2.4} strokeLinecap="round" />
                        </Svg>
                      )}
                    </View>
                    <View style={styles.proTableCell}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M5 12l5 5L19 7" stroke={HG3.gold} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.proPricingRow}>
                {(Object.keys(PRO_PRICING) as ProPlanKey[]).map((key) => {
                  const pricing = PRO_PRICING[key];
                  const selected = proPlan === key;

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${pricing.title} plan`}
                      onPress={() => setProPlan(key)}
                      style={({ pressed }) => [styles.proPricingCard, selected && styles.proPricingCardSelected, pressed && styles.pressed]}
                    >
                      {pricing.badge ? (
                        <View style={styles.proPricingBadge}>
                          <Text style={styles.proPricingBadgeText}>{pricing.badge}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.proPricingTitle}>{pricing.title}</Text>
                      <Text style={styles.proPricingPrice}>
                        {pricing.price}
                        <Text style={styles.proPricingPer}>{pricing.per}</Text>
                      </Text>
                      <Text style={styles.proPricingNote}>{pricing.note}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start 7-day free trial"
                onPress={() => setProSheetVisible(false)}
                style={({ pressed }) => [styles.proCta, pressed && styles.pressed]}
              >
                <Text style={styles.proCtaText}>Start 7-day free trial</Text>
              </Pressable>
              <Text style={styles.proFinePrint}>{activePricing.finePrint}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setProSheetVisible(false)}
                hitSlop={8}
                style={styles.proDismiss}
              >
                <Text style={styles.proDismissText}>Not now</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: HG3.bg,
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
    color: HG3.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    color: HG3.muted,
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
    backgroundColor: HG3.green,
  },
  proBadgeText: {
    color: HG3.surface,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  weekCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
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
    backgroundColor: HG3.purpleSoft,
  },
  weekStripDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  weekStripDotTraining: {
    backgroundColor: HG3.purpleBright,
  },
  weekStripDotRecovery: {
    backgroundColor: HG3.green,
  },
  weekStripDayLabel: {
    color: HG3.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  weekStripDayLabelToday: {
    color: HG3.ink,
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
  monthTitle: {
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  monthWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  monthWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: HG3.faint,
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
    backgroundColor: HG3.purpleSoft,
  },
  monthDayNumber: {
    color: HG3.ink,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  monthDayNumberOutside: {
    color: 'rgba(162,155,180,0.55)',
  },
  monthDayNumberToday: {
    color: HG3.purple,
    fontWeight: '900',
  },
  monthDayDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  monthDayDotTraining: {
    backgroundColor: HG3.purpleBright,
  },
  monthDayDotRecovery: {
    backgroundColor: HG3.green,
  },
  monthLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  monthLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLegendText: {
    color: HG3.muted,
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
    color: HG3.ink,
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
    color: HG3.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  heroProgTrack: {
    width: 88,
    height: 6,
    borderRadius: 999,
    backgroundColor: HG3.border,
    overflow: 'hidden',
    marginTop: 7,
  },
  heroProgFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: HG3.purple,
  },
  secs: {
    marginTop: 20,
    gap: 10,
  },
  secCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    overflow: 'hidden',
    shadowColor: HG3.purpleBright,
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
    color: HG3.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secCount: {
    color: HG3.faint,
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
    borderTopColor: HG3.border,
  },
  planExerciseNumberChip: {
    width: 25,
    height: 25,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG3.purpleSoft,
  },
  planExerciseNumberText: {
    color: HG3.purple,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },
  planExerciseName: {
    flex: 1,
    color: HG3.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  planExerciseScheme: {
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: 'JetBrainsMono',
  },
  planListFooterText: {
    color: HG3.faint,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  adaptButtonText: {
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  startButton: {
    flex: 1.3,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: HG3.green,
    backgroundColor: HG3.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: HG3.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  startButtonText: {
    color: HG3.green,
    fontSize: 17.5,
    lineHeight: 22,
    fontWeight: '800',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: HG3.border,
    marginTop: 22,
  },
  emptyWorkoutRow: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
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
    color: HG3.ink,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '800',
  },
  emptyWorkoutMeta: {
    color: HG3.muted,
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
  historySectionTitle: {
    color: HG3.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  historySeeAll: {
    color: HG3.purple,
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
    borderTopColor: HG3.border,
  },
  historyIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRowTitle: {
    color: HG3.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  historyRowMeta: {
    color: HG3.muted,
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
    backgroundColor: HG3.surface,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 26,
  },
  adaptGrip: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: HG3.border,
    marginBottom: 18,
  },
  adaptTitle: {
    color: HG3.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  adaptSub: {
    marginTop: 6,
    color: HG3.muted,
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
    borderColor: HG3.border,
    backgroundColor: HG3.bg,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  adaptOptIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adaptOptCopy: {
    flex: 1,
    minWidth: 0,
  },
  adaptOptTitle: {
    color: HG3.ink,
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  adaptOptSub: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 15,
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
    color: HG3.muted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  proSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 10, 32, 0.5)',
  },
  proSheetScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  proSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: HG3.proSheetBottom,
  },
  proSheetContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 26,
  },
  proSheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 18,
  },
  proSheetBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HG3.gold,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  proSheetBadgeText: {
    color: HG3.gold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  proSheetHeadline: {
    marginTop: 14,
    color: PRO_SHEET_INK,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  proSheetSubline: {
    marginTop: 8,
    color: PRO_SHEET_MUTED,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
  },
  proStatRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  proStatCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PRO_SHEET_BORDER,
    backgroundColor: PRO_SHEET_CARD,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
  },
  proStatValue: {
    color: PRO_SHEET_INK,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  proStatSuffix: {
    color: HG3.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  proStatLabel: {
    color: PRO_SHEET_MUTED,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  proTable: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PRO_SHEET_BORDER,
    backgroundColor: PRO_SHEET_CARD,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  proTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  proTableHeaderLabel: {
    flex: 1,
    color: PRO_SHEET_INK,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  proTableHeaderFree: {
    width: 48,
    textAlign: 'center',
    color: PRO_SHEET_FAINT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  proTableHeaderPro: {
    width: 48,
    textAlign: 'center',
    color: HG3.gold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  proTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  proTableRowLabel: {
    flex: 1,
    color: PRO_SHEET_MUTED,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  proTableCell: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proPricingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  proPricingCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PRO_SHEET_BORDER,
    backgroundColor: PRO_SHEET_CARD,
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 2,
  },
  proPricingCardSelected: {
    borderColor: HG3.gold,
    backgroundColor: 'rgba(228,177,76,0.08)',
  },
  proPricingBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    borderRadius: 999,
    backgroundColor: HG3.gold,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  proPricingBadgeText: {
    color: HG3.proSheetBottom,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  proPricingTitle: {
    color: PRO_SHEET_MUTED,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  proPricingPrice: {
    color: PRO_SHEET_INK,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  proPricingPer: {
    color: PRO_SHEET_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  proPricingNote: {
    color: PRO_SHEET_FAINT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  proCta: {
    marginTop: 18,
    height: 54,
    borderRadius: 15,
    backgroundColor: HG3.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proCtaText: {
    color: HG3.proSheetBottom,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  proFinePrint: {
    marginTop: 10,
    textAlign: 'center',
    color: PRO_SHEET_FAINT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  proDismiss: {
    alignSelf: 'center',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 6,
  },
  proDismissText: {
    color: PRO_SHEET_MUTED,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});

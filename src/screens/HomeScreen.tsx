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

import { GymlogIcon } from '../components/GymlogIcon';
import { getHomeMiniCalendarDays, getHomeMonthCalendar, HomeDaySessionSummary } from '../lib/homeCalendar';
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

// Entrance stagger (Home v3 "rise"): translateY 16 -> 0 + fade, 500ms,
// cubic-bezier(.22,1,.36,1). Indices name each animated section.
const RISE_DELAYS_MS = [40, 100, 160, 200, 240, 280, 340, 400, 460, 520, 580, 620, 720] as const;
const RISE_HEADER = 0;
const RISE_WEEK = 1;
const RISE_PLAN_EYEBROW = 2;
const RISE_PLAN_TITLE = 3;
const RISE_PLAN_SUB = 4;
const RISE_PLAN_PROGRESS = 5;
const RISE_PLAN_ROW_BASE = 6; // rows use 6, 7, 8
const RISE_PLAN_FOOTER = 9;
const RISE_START = 10;
const RISE_DIVIDER = 11;
const RISE_ROUTINES = 12;

const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

// Shown only when no active plan exists (Start falls back to an empty workout).
const FALLBACK_AGENDA_EXERCISES: Array<{ name: string; setsLabel: string; schemeLabel: string }> = [
  { name: 'Squat', setsLabel: '3 sets', schemeLabel: '3 × 8' },
  { name: 'Push-Up', setsLabel: '3 sets', schemeLabel: '3 × 10' },
  { name: 'Row', setsLabel: '3 sets', schemeLabel: '3 × 8' },
];

interface HomeTemplateItem {
  id: string;
  name: string;
  sessionCount: number;
  exerciseCount: number;
  updatedAt: string;
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
  weekProgressLabel: string;
  weekProgressPercent: number;
  sessionsPerWeek: string;
  weeklyMinutes: string;
  sessions: HomeDaySessionSummary[];
  nextSession: HomeDaySessionSummary & {
    label: string;
  };
}

interface HomeScreenProps {
  activePlan?: HomePlanCard | null;
  customTemplates?: HomeTemplateItem[];
  readyTemplateCount?: number;
  onStartActivePlanSession?: (sessionId: string) => void;
  onOpenTemplatesHub: () => void;
  onCreateWorkoutFromExercises: () => void;
  onBrowseReadyPlans: () => void;
}

export function HomeScreen({
  activePlan = null,
  customTemplates = [],
  readyTemplateCount = 0,
  onStartActivePlanSession,
  onOpenTemplatesHub,
  onCreateWorkoutFromExercises,
  onBrowseReadyPlans,
}: HomeScreenProps) {
  const [proSheetVisible, setProSheetVisible] = useState(false);
  const [proPlan, setProPlan] = useState<ProPlanKey>('annual');
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const savedRoutineCount = customTemplates.length;
  const topCalendarDays = getHomeMiniCalendarDays().slice(0, 6);
  const monthCalendar = useMemo(() => getHomeMonthCalendar(), []);
  const trainingDayIndexes = activePlan
    ? [0, 3].slice(0, Math.min(Number.parseInt(activePlan.sessionsPerWeek, 10) || 2, 2))
    : [0, 3];

  const nextPlanSession = activePlan?.nextSession ?? null;
  const planSessions = activePlan?.sessions ?? [];
  const nextSessionIndex = nextPlanSession
    ? Math.max(0, planSessions.findIndex((session) => session.id === nextPlanSession.id))
    : 0;
  const planDayCount = planSessions.length || Number.parseInt(activePlan?.sessionsPerWeek ?? '', 10) || 3;
  const planEyebrow = `CONTINUE PLAN · DAY ${nextSessionIndex + 1} OF ${planDayCount}`;
  const planTitle = nextPlanSession?.title ?? 'Day 1 - Full Body';
  const planSubtitle = activePlan?.title ?? 'Workout plan';
  const weekProgressLabel = activePlan?.weekProgressLabel ?? 'Week 1 · 0 of 3 done';
  const weekProgressPercent = activePlan?.weekProgressPercent ?? 0;
  const agendaSource = nextPlanSession?.exercises ?? FALLBACK_AGENDA_EXERCISES;
  const agendaExercises = agendaSource.slice(0, 3);
  const totalExerciseCount = (nextPlanSession?.exercises.length ?? agendaSource.length) + (nextPlanSession?.hiddenExerciseCount ?? 0);
  const agendaExtraCount = Math.max(0, totalExerciseCount - agendaExercises.length);
  const planDuration = nextPlanSession?.duration ?? '~45 min';
  const agendaFooterLabel =
    agendaExtraCount > 0 ? `+ ${agendaExtraCount} more · ${planDuration} total` : `${planDuration} total`;

  // --- Animations -----------------------------------------------------------

  const riseValues = useRef(RISE_DELAYS_MS.map(() => new Animated.Value(0))).current;
  const progressFillAnim = useRef(new Animated.Value(0)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;

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
      progressFillAnim.setValue(weekProgressPercent);
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
      toValue: weekProgressPercent,
      duration: 700,
      delay: RISE_DELAYS_MS[RISE_PLAN_PROGRESS],
      easing: RISE_EASING,
      useNativeDriver: false,
    }).start();
  }, [progressFillAnim, reduceMotion, riseValues, weekProgressPercent]);

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

  const startTodaysSession = () => {
    if (nextPlanSession && onStartActivePlanSession) {
      onStartActivePlanSession(nextPlanSession.id);
      return;
    }
    onCreateWorkoutFromExercises();
  };

  const activePricing = PRO_PRICING[proPlan];

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

        {/* Continue plan — boxless agenda (Home v3) */}
        <Animated.View style={rise(RISE_PLAN_EYEBROW)}>
          <Text style={styles.planEyebrow}>{planEyebrow}</Text>
        </Animated.View>
        <Animated.View style={rise(RISE_PLAN_TITLE)}>
          <Text style={styles.planTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {planTitle}
          </Text>
        </Animated.View>
        <Animated.View style={rise(RISE_PLAN_SUB)}>
          <Text style={styles.planSubtitle} numberOfLines={1}>
            {planSubtitle}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.planProgressRow, rise(RISE_PLAN_PROGRESS)]}>
          <View style={styles.planProgressTrack}>
            <Animated.View
              style={[
                styles.planProgressFill,
                {
                  width: progressFillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
          <Text style={styles.planProgressLabel}>{weekProgressLabel}</Text>
        </Animated.View>

        <View style={styles.planExerciseList}>
          {agendaExercises.map((exercise, index) => (
            <Animated.View key={`${exercise.name}-${index}`} style={[styles.planExerciseRow, rise(RISE_PLAN_ROW_BASE + index)]}>
              <View style={styles.planExerciseNumberChip}>
                <Text style={styles.planExerciseNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.planExerciseName} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text style={styles.planExerciseScheme}>{exercise.schemeLabel ?? exercise.setsLabel ?? ''}</Text>
            </Animated.View>
          ))}
          <Animated.View style={[styles.planListFooterRow, rise(RISE_PLAN_FOOTER)]}>
            <Text style={styles.planListFooterText}>{agendaFooterLabel}</Text>
          </Animated.View>
        </View>

        <Animated.View style={rise(RISE_START)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start today's workout"
            onPress={startTodaysSession}
            style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
          >
            <Text style={styles.startButtonText}>Start workout</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke={HG3.purple} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.sectionDivider, rise(RISE_DIVIDER)]} />

        <Animated.View style={rise(RISE_ROUTINES)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Routines</Text>
            <Pressable onPress={onOpenTemplatesHub} hitSlop={8}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>

          <View style={styles.routineShortcutRow}>
            <Pressable onPress={onOpenTemplatesHub} style={({ pressed }) => [styles.routineShortcutCard, pressed && styles.pressed]}>
              <View style={styles.routineShortcutIcon}>
                <GymlogIcon name="file" color={HG3.purple} size={21} />
              </View>
              <View style={styles.routineShortcutCopy}>
                <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                  Templates
                </Text>
                <Text style={styles.routineShortcutSubtitle}>{savedRoutineCount} saved</Text>
              </View>
            </Pressable>

            <Pressable onPress={onBrowseReadyPlans} style={({ pressed }) => [styles.routineShortcutCard, pressed && styles.pressed]}>
              <View style={styles.routineShortcutIcon}>
                <GymlogIcon name="progress" color={HG3.purple} size={21} />
              </View>
              <View style={styles.routineShortcutCopy}>
                <Text style={styles.routineShortcutTitle} numberOfLines={1} adjustsFontSizeToFit>
                  Explore
                </Text>
                <Text style={styles.routineShortcutSubtitle}>
                  {readyTemplateCount > 0 ? `${readyTemplateCount} plans` : 'Find new plans'}
                </Text>
              </View>
            </Pressable>
          </View>

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
        </Animated.View>

        <View style={styles.bottomSafeFade} />
      </ScrollView>

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
  planEyebrow: {
    marginTop: 24,
    color: HG3.purple,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.76,
  },
  planTitle: {
    marginTop: 6,
    color: HG3.ink,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  planSubtitle: {
    marginTop: 3,
    color: HG3.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  planProgressRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: HG3.border,
    overflow: 'hidden',
  },
  planProgressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: HG3.purple,
  },
  planProgressLabel: {
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  planExerciseList: {
    marginTop: 14,
  },
  planExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
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
    fontSize: 12,
    lineHeight: 15,
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
  planListFooterRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: HG3.border,
  },
  planListFooterText: {
    color: HG3.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  startButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: HG3.purple,
    backgroundColor: HG3.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 6,
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  startButtonText: {
    color: HG3.purple,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: HG3.border,
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 15,
  },
  sectionTitle: {
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  seeAllText: {
    color: HG3.purple,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  routineShortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  routineShortcutCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  routineShortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG3.purpleSoft,
  },
  routineShortcutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  routineShortcutTitle: {
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  routineShortcutSubtitle: {
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  emptyWorkoutRow: {
    minHeight: 46,
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  emptyWorkoutMeta: {
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  bottomSafeFade: {
    height: 16,
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

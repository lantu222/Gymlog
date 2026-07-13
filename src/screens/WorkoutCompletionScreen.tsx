import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Gradient is drawn at a fixed size and clipped by the hero (overflow hidden),
// which is more reliable than a percentage-height Svg against a dynamic parent.
const HERO_GRADIENT_WIDTH = Dimensions.get('window').width;
const HERO_GRADIENT_HEIGHT = 360;

import { formatTime, removeTrailingZeros } from '../lib/format';
import { MuscleFocusRow } from '../lib/workoutCompleteView';
import { WorkoutCompletionExerciseCard, WorkoutCompletionPrCard } from '../lib/workoutCompletionSummary';
import { HG3 } from '../lightTheme';

// Workout Complete palette extensions (design_handoff_workout_complete).
const GOLD = '#B7791F';
const GOLD_SOFT = '#FBF1DA';
const GREEN_SOFT = '#E8F7EE';
const HAIRLINE = '#EEEAF7';
const HERO_STOPS = ['#8B5CF6', '#7C3AED', '#6D28D9'] as const;
const BAR_RAMP = ['#7C3AED', '#9061F9', '#B79AFB'] as const;

const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
// Rise slots: hero title, hero subtitle, PR/quiet, stats, muscle, exercises, actions.
const RISE_DELAYS_MS = [300, 380, 440, 520, 600, 680, 760] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WorkoutCompletionScreenProps {
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  volumeDeltaKg: number | null;
  muscles: MuscleFocusRow[];
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  onDone: () => void;
}

function formatWhenLabel(performedAt: string) {
  const performed = new Date(performedAt);
  const now = new Date();
  const sameDay =
    performed.getFullYear() === now.getFullYear() &&
    performed.getMonth() === now.getMonth() &&
    performed.getDate() === now.getDate();
  const day = sameDay
    ? 'Today'
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(performed);
  return `${day} · ${formatTime(performedAt)}`;
}

function formatPrTitle(pr: WorkoutCompletionPrCard) {
  return `${pr.exerciseName} · ${removeTrailingZeros(pr.performedWeightKg)} kg × ${pr.performedReps}`;
}

function formatPrNote(pr: WorkoutCompletionPrCard) {
  if (pr.previousBestOneRepMaxKg === null) {
    return 'Your first logged best for this lift.';
  }
  const delta = pr.estimatedOneRepMaxKg - pr.previousBestOneRepMaxKg;
  return `Est. 1RM +${removeTrailingZeros(Number(delta.toFixed(1)))} kg over your previous best`;
}

export function WorkoutCompletionScreen({
  workoutName,
  performedAt,
  durationMinutes,
  setsCompleted,
  totalVolume,
  exercisesLogged,
  volumeDeltaKg,
  muscles,
  exerciseCards,
  prCards,
  onDone,
}: WorkoutCompletionScreenProps) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const pr = prCards[0] ?? null;
  const maxMuscleVolume = Math.max(1, ...muscles.map((muscle) => muscle.volumeKg));

  const riseValues = useRef(RISE_DELAYS_MS.map(() => new Animated.Value(0))).current;
  const badgePop = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const checkDraw = useRef(new Animated.Value(40)).current;
  const barAnims = useRef(muscles.map(() => new Animated.Value(0))).current;

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
      riseValues.forEach((value) => value.setValue(1));
      badgePop.setValue(1);
      ringAnim.setValue(0);
      checkDraw.setValue(0);
      barAnims.forEach((value) => value.setValue(1));
      return;
    }
    Animated.parallel([
      ...riseValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 460,
          delay: RISE_DELAYS_MS[index],
          easing: RISE_EASING,
          useNativeDriver: true,
        }),
      ),
      Animated.timing(badgePop, {
        toValue: 1,
        duration: 520,
        easing: Easing.bezier(0.22, 1.2, 0.36, 1),
        useNativeDriver: true,
      }),
      // A few celebratory pulses instead of an infinite loop.
      Animated.loop(
        Animated.sequence([
          Animated.delay(240),
          Animated.timing(ringAnim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
        { iterations: 3 },
      ),
      Animated.timing(checkDraw, {
        toValue: 0,
        duration: 460,
        delay: 360,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
      ...barAnims.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 620,
          delay: RISE_DELAYS_MS[4] + 120 + index * 90,
          easing: RISE_EASING,
          useNativeDriver: false,
        }),
      ),
    ]).start();
  }, [badgePop, barAnims, checkDraw, reduceMotion, ringAnim, riseValues]);

  const rise = (index: number) => ({
    opacity: riseValues[index],
    transform: [
      {
        translateY: riseValues[index].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
      },
    ],
  });

  return (
    <View style={styles.screenBackground}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Svg
            style={StyleSheet.absoluteFill}
            width={HERO_GRADIENT_WIDTH}
            height={HERO_GRADIENT_HEIGHT}
            viewBox={`0 0 ${HERO_GRADIENT_WIDTH} ${HERO_GRADIENT_HEIGHT}`}
          >
            <Defs>
              <SvgLinearGradient id="completeHeroGradient" x1="0" y1="0" x2="0.55" y2="1">
                <Stop offset="0" stopColor={HERO_STOPS[0]} />
                <Stop offset="0.46" stopColor={HERO_STOPS[1]} />
                <Stop offset="1" stopColor={HERO_STOPS[2]} />
              </SvgLinearGradient>
            </Defs>
            <Rect width={HERO_GRADIENT_WIDTH} height={HERO_GRADIENT_HEIGHT} fill="url(#completeHeroGradient)" />
            <Circle cx={HERO_GRADIENT_WIDTH * 0.88} cy={-24} r={110} fill="#FFFFFF" opacity={0.12} />
          </Svg>

          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.badgeRing,
                {
                  opacity: ringAnim.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.55, 0] }),
                  transform: [
                    { scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.badge,
                {
                  opacity: badgePop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                  transform: [
                    { scale: badgePop.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.4, 1.12, 1] }) },
                  ],
                },
              ]}
            >
              <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
                <AnimatedPath
                  d="M5 12.5l4.5 4.5L19 7"
                  stroke={HG3.purpleBright}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={40}
                  strokeDashoffset={checkDraw}
                />
              </Svg>
            </Animated.View>
          </View>

          <Animated.Text style={[styles.heroTitle, rise(0)]}>Workout complete</Animated.Text>
          <Animated.View style={[styles.heroSubRow, rise(1)]}>
            <Text style={styles.heroSubName}>{workoutName}</Text>
            <View style={styles.heroSubDot} />
            <Text style={styles.heroSubWhen}>{formatWhenLabel(performedAt)}</Text>
          </Animated.View>
        </View>

        <View style={styles.body}>
          {pr ? (
            <Animated.View style={[styles.noteCard, rise(2)]}>
              <View style={[styles.noteIconTile, styles.noteIconTileGold]}>
                <Svg width={24} height={24} viewBox="0 0 24 24">
                  <Path d="M12 2l2.5 5 5.5.8-4 3.9.95 5.5L12 20.5 7.05 17.2 8 11.7l-4-3.9L9.5 7z" fill={GOLD} />
                </Svg>
              </View>
              <View style={styles.noteCopy}>
                <Text style={styles.prEyebrow}>NEW PERSONAL RECORD</Text>
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {formatPrTitle(pr)}
                </Text>
                <Text style={styles.noteSub} numberOfLines={2}>
                  {formatPrNote(pr)}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.noteCard, rise(2)]}>
              <View style={[styles.noteIconTile, styles.noteIconTilePurple]}>
                <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 13l4 4L19 7" stroke={HG3.purpleBright} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.noteCopy}>
                <Text style={styles.noteTitle}>Solid session logged</Text>
                <Text style={styles.noteSub}>Nothing stood out this time — and that's fine. Consistency is the win.</Text>
              </View>
            </Animated.View>
          )}

          <Animated.View style={[styles.statsCard, rise(3)]}>
            <View style={styles.statCell}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {durationMinutes}
                <Text style={styles.statUnit}> min</Text>
              </Text>
              <Text style={styles.statLabel}>DURATION</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {Math.round(totalVolume).toLocaleString('en-US')}
                <Text style={styles.statUnit}> kg</Text>
              </Text>
              <Text style={styles.statLabel}>VOLUME</Text>
              {volumeDeltaKg !== null && volumeDeltaKg !== 0 ? (
                <Text style={[styles.statDelta, volumeDeltaKg > 0 ? styles.statDeltaUp : styles.statDeltaDown]}>
                  {volumeDeltaKg > 0 ? '▲' : '▼'} {Math.abs(volumeDeltaKg).toLocaleString('en-US')} kg
                </Text>
              ) : null}
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{setsCompleted}</Text>
              <Text style={styles.statLabel}>SETS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{exercisesLogged}</Text>
              <Text style={styles.statLabel}>EXERCISES</Text>
            </View>
          </Animated.View>

          {muscles.length > 0 ? (
            <Animated.View style={rise(4)}>
              <Text style={styles.sectionLabel}>MUSCLE FOCUS</Text>
              <View style={styles.sectionCard}>
                {muscles.map((muscle, index) => (
                  <View key={muscle.name} style={[styles.muscleRow, index > 0 && styles.muscleRowSpaced]}>
                    <View style={styles.muscleTopRow}>
                      <Text style={styles.muscleName}>{muscle.name}</Text>
                      <Text style={styles.muscleMeta}>
                        {muscle.sets} sets · {muscle.volumeKg.toLocaleString('en-US')} kg
                      </Text>
                    </View>
                    <View style={styles.muscleTrack}>
                      <Animated.View
                        style={[
                          styles.muscleFill,
                          {
                            backgroundColor: BAR_RAMP[Math.min(index, BAR_RAMP.length - 1)],
                            width: barAnims[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', `${Math.max(6, Math.round((muscle.volumeKg / maxMuscleVolume) * 100))}%`],
                            }),
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View style={rise(5)}>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            <View style={[styles.sectionCard, styles.exercisesCard]}>
              {exerciseCards.map((exercise, index) => (
                <View key={exercise.id} style={[styles.exerciseRow, index > 0 && styles.exerciseRowDivided]}>
                  <View style={styles.exerciseCheckTile}>
                    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 12.5l4.5 4.5L19 7" stroke={HG3.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={styles.exerciseCopy}>
                    <View style={styles.exerciseNameRow}>
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {exercise.name}
                      </Text>
                      {exercise.isPr ? (
                        <View style={styles.prBadge}>
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.exerciseSets}>{exercise.completedSets} sets</Text>
                  </View>
                  {exercise.topSetLabel ? (
                    <View style={styles.exerciseTopSet}>
                      <Text style={styles.exerciseTopSetValue}>{exercise.topSetLabel}</Text>
                      <Text style={styles.exerciseTopSetLabel}>TOP SET</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={rise(6)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish"
              onPress={onDone}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Finish</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
    backgroundColor: HG3.bg,
  },
  content: {
    paddingBottom: 26,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  hero: {
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 30,
    paddingHorizontal: 22,
  },
  badgeWrap: {
    width: 76,
    height: 76,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E106E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 8,
  },
  heroTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  heroSubName: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  heroSubDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroSubWhen: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: HG3.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 15,
    paddingHorizontal: 16,
    shadowColor: '#281C5A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 3,
  },
  noteIconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteIconTileGold: {
    backgroundColor: GOLD_SOFT,
  },
  noteIconTilePurple: {
    backgroundColor: HG3.purpleSoft,
  },
  noteCopy: {
    flex: 1,
    minWidth: 0,
  },
  prEyebrow: {
    color: GOLD,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noteTitle: {
    marginTop: 2,
    color: HG3.ink,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  noteSub: {
    marginTop: 2,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: HG3.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 17,
    paddingHorizontal: 6,
    marginTop: 20,
    shadowColor: '#281C5A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: HG3.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    color: HG3.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 5,
    color: HG3.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  statDelta: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statDeltaUp: {
    color: HG3.green,
  },
  statDeltaDown: {
    color: '#D64545',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginTop: 1,
    backgroundColor: HAIRLINE,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 9,
    marginHorizontal: 4,
    color: HG3.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: HG3.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#281C5A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  exercisesCard: {
    paddingVertical: 6,
  },
  muscleRow: {},
  muscleRowSpaced: {
    marginTop: 13,
  },
  muscleTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  muscleName: {
    color: HG3.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  muscleMeta: {
    color: HG3.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  muscleTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: HG3.purpleSoft,
    overflow: 'hidden',
  },
  muscleFill: {
    height: 9,
    borderRadius: 999,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  exerciseRowDivided: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  exerciseCheckTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  exerciseName: {
    color: HG3.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  prBadge: {
    borderRadius: 999,
    backgroundColor: GOLD_SOFT,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  prBadgeText: {
    color: GOLD,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  exerciseSets: {
    marginTop: 2,
    color: HG3.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  exerciseTopSet: {
    alignItems: 'flex-end',
  },
  exerciseTopSetValue: {
    color: HG3.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exerciseTopSetLabel: {
    color: HG3.faint,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: HG3.purpleBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: HG3.purpleBright,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
  },
});

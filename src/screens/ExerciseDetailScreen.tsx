import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SimpleLineChart } from '../components/SimpleLineChart';
import { convertWeightFromKg, formatShortDate, removeTrailingZeros } from '../lib/format';
import { ExerciseProgressSummary } from '../lib/progression';
import { HG } from '../lightTheme';
import { ExerciseLibraryItem, UnitPreference } from '../types/models';

interface ExerciseDetailScreenProps {
  item: ExerciseLibraryItem;
  history?: ExerciseProgressSummary | null;
  tracked?: boolean;
  unitPreference?: UnitPreference;
  onBack: () => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  onAddToWorkout?: (item: ExerciseLibraryItem) => void;
}

function toLabel(value?: string | null) {
  if (!value) {
    return '';
  }

  return value
    .split(/[_\s/()-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatLastDone(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  if (days < 14) {
    return 'Last week';
  }
  return formatShortDate(iso);
}

function ChevronLeftIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill={active ? HG.gold : 'none'}>
      <Path
        d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"
        stroke={active ? HG.gold : HG.muted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon({ color = HG.faint, size = 30 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ActionIcon({ added }: { added: boolean }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      {added ? (
        <Path d="M5 13l4 4L19 7" stroke={HG.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

function HeroImage({ uri }: { uri?: string | null }) {
  const [state, setState] = useState<'loading' | 'ok' | 'err'>(uri ? 'loading' : 'err');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setState(uri ? 'loading' : 'err');
    opacity.setValue(0);
  }, [uri, opacity]);

  return (
    <View style={styles.hero}>
      {state !== 'ok' ? (
        <View style={styles.heroSkeleton}>
          {state === 'err' ? <DumbbellIcon /> : null}
        </View>
      ) : null}
      {uri ? (
        <Animated.Image
          source={{ uri }}
          resizeMode="cover"
          style={[styles.heroImage, { opacity }]}
          onLoad={() => {
            setState('ok');
            Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
          }}
          onError={() => setState('err')}
        />
      ) : null}
    </View>
  );
}

function Chip({ label, filled }: { label: string; filled?: boolean }) {
  return (
    <View style={[styles.chip, filled ? styles.chipFilled : styles.chipSoft]}>
      <Text style={[styles.chipText, filled ? styles.chipTextFilled : styles.chipTextSoft]}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

function StatCard({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      {meta ? (
        <Text numberOfLines={1} style={styles.statMeta}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

export function ExerciseDetailScreen({
  item,
  history = null,
  tracked = false,
  unitPreference = 'kg',
  onBack,
  onToggleTracked,
  onAddToWorkout,
}: ExerciseDetailScreenProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const flash = (message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  };

  const handleToggleTracked = () => {
    if (!onToggleTracked) {
      return;
    }
    flash(tracked ? 'Removed from tracked lifts' : 'Added to tracked lifts');
    onToggleTracked(item);
  };

  const bodyPartLabel = toLabel(item.bodyPart) || 'Full body';
  const equipmentLabel = toLabel(item.sourceEquipment ?? item.equipment) || 'Bodyweight';
  const mechanicLabel = toLabel(item.sourceMechanic ?? item.category) || 'Compound';
  const levelLabel = toLabel(item.sourceLevel ?? 'beginner') || 'Beginner';

  const primaryMuscles = (item.primaryMuscles ?? []).filter(Boolean);
  const secondaryMuscles = (item.secondaryMuscles ?? []).filter(Boolean);
  const primaryChips = primaryMuscles.length ? primaryMuscles.map(toLabel) : [bodyPartLabel];

  const instructions = (item.instructions ?? []).filter(Boolean);

  const logs = history?.logs ?? [];
  const hasHistory = logs.length > 0;

  const chartPoints = useMemo(
    () =>
      [...logs].reverse().map((log) => ({
        label: formatShortDate(log.performedAt),
        value: convertWeightFromKg(log.weight, unitPreference),
      })),
    [logs, unitPreference],
  );

  const trendDelta = useMemo(() => {
    if (chartPoints.length < 2) {
      return null;
    }
    return chartPoints[chartPoints.length - 1].value - chartPoints[0].value;
  }, [chartPoints]);

  const personalBest =
    history?.bestWeight != null
      ? `${removeTrailingZeros(convertWeightFromKg(history.bestWeight, unitPreference))} ${unitPreference}`
      : '—';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}>
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>EXERCISE</Text>
        <Pressable
          onPress={handleToggleTracked}
          disabled={!onToggleTracked}
          hitSlop={8}
          style={styles.iconButton}
        >
          <StarIcon active={tracked} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroImage uri={item.imageUrls?.[0] ?? null} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{item.name}</Text>
          <View style={styles.chipRow}>
            <Chip label={bodyPartLabel} filled />
            <Chip label={equipmentLabel} />
            <Chip label={mechanicLabel} />
            <Chip label={levelLabel} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>YOUR HISTORY</SectionLabel>
          {hasHistory ? (
            <>
              <View style={styles.statGrid}>
                <StatCard label="PERSONAL BEST" value={personalBest} meta="top working set" />
                <StatCard
                  label="LAST DONE"
                  value={history?.latestLog ? formatLastDone(history.latestLog.performedAt) : '—'}
                  meta={history?.latestLog?.workoutNameSnapshot ?? undefined}
                />
                <StatCard label="SESSIONS" value={`${logs.length}`} meta="logged" />
              </View>
              <View style={styles.workingWeightHeader}>
                <Text style={styles.workingWeightLabel}>Working weight</Text>
                {trendDelta != null ? (
                  <Text style={[styles.workingWeightDelta, trendDelta < 0 && styles.workingWeightDeltaDown]}>
                    {trendDelta >= 0 ? '+' : ''}
                    {removeTrailingZeros(trendDelta)} {unitPreference} since start
                  </Text>
                ) : null}
              </View>
              <SimpleLineChart points={chartPoints} accent={HG.purple} unitLabel={unitPreference} />
            </>
          ) : (
            <View style={styles.emptyHistoryCard}>
              <DumbbellIcon color={HG.faint} size={28} />
              <Text style={styles.emptyHistoryTitle}>No history yet</Text>
              <Text style={styles.emptyHistoryBody}>
                Log this lift and your working-weight trend will appear here.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>TARGET MUSCLES</SectionLabel>
          <View style={styles.musclesCard}>
            <Text style={styles.musclesGroupLabel}>PRIMARY</Text>
            <View style={styles.chipRow}>
              {primaryChips.map((muscle) => (
                <Chip key={`p-${muscle}`} label={muscle} filled />
              ))}
            </View>
            {secondaryMuscles.length ? (
              <>
                <Text style={[styles.musclesGroupLabel, styles.musclesGroupLabelSpaced]}>SECONDARY</Text>
                <View style={styles.chipRow}>
                  {secondaryMuscles.map((muscle) => (
                    <Chip key={`s-${muscle}`} label={toLabel(muscle)} />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>HOW TO PERFORM</SectionLabel>
          <View style={styles.howToCard}>
            {instructions.length ? (
              instructions.map((step, index) => (
                <View
                  key={`step-${index}`}
                  style={[styles.howToStep, index === instructions.length - 1 && styles.howToStepLast]}
                >
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.howToStep, styles.howToStepLast]}>
                <Text style={styles.stepTextMuted}>
                  Step-by-step cues aren&apos;t in the library for this exercise yet.
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.footnote}>Form cues are general guidance — adjust to how your body moves.</Text>
      </ScrollView>

      {toast ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View style={styles.ctaBar}>
        <Pressable
          onPress={onAddToWorkout ? () => onAddToWorkout(item) : undefined}
          disabled={!onAddToWorkout}
          style={styles.ctaButton}
        >
          <ActionIcon added={false} />
          <Text style={styles.ctaText}>Add to workout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.faint,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 24,
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: HG.surfaceSoft,
  },
  heroSkeleton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.surfaceSoft,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    marginTop: 15,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipFilled: {
    backgroundColor: HG.purple,
  },
  chipSoft: {
    backgroundColor: HG.purpleLight,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextFilled: {
    color: '#FFFFFF',
  },
  chipTextSoft: {
    color: HG.purpleDark,
  },
  section: {
    marginTop: 24,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 11,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: HG.faint,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: HG.faint,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: HG.ink,
    letterSpacing: -0.3,
    marginTop: 5,
  },
  statMeta: {
    fontSize: 10.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 2,
  },
  workingWeightHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  workingWeightLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: HG.ink,
  },
  workingWeightDelta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: HG.greenInk,
  },
  workingWeightDeltaDown: {
    color: HG.muted,
  },
  emptyHistoryCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: HG.ink,
  },
  emptyHistoryBody: {
    fontSize: 13,
    fontWeight: '600',
    color: HG.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  musclesCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 16,
    padding: 16,
  },
  musclesGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: HG.faint,
  },
  musclesGroupLabelSpaced: {
    marginTop: 15,
  },
  howToCard: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  howToStep: {
    flexDirection: 'row',
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  howToStepLast: {
    borderBottomWidth: 0,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: HG.purpleDark,
  },
  stepText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: HG.ink,
    lineHeight: 21,
  },
  stepTextMuted: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: HG.muted,
    lineHeight: 21,
  },
  footnote: {
    fontSize: 11.5,
    fontWeight: '600',
    color: HG.faint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92,
    alignItems: 'center',
  },
  toastText: {
    backgroundColor: 'rgba(20,12,38,0.94)',
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ctaBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: HG.surface,
    borderTopWidth: 1,
    borderTopColor: HG.border,
  },
  ctaButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: HG.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

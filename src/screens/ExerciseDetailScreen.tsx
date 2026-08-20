import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SimpleLineChart } from '../components/SimpleLineChart';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { getExerciseInstructions } from '../lib/exerciseInstructions';
import { convertWeightFromKg, formatShortDate, removeTrailingZeros } from '../lib/format';
import { I18nKey, t } from '../lib/i18n';
import { libraryLabel } from '../lib/libraryLabel';
import { ExerciseProgressSummary } from '../lib/progression';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage, ExerciseLibraryItem, UnitPreference } from '../types/models';

// Muscle and facet names are stored English and used for matching, so only
// the label translates. Anything unmapped falls through to title case.
const DETAIL_LABEL_KEYS: Record<string, I18nKey> = {
  chest: 'facet.chest',
  back: 'facet.back',
  shoulders: 'facet.shoulders',
  legs: 'facet.legs',
  biceps: 'facet.biceps',
  triceps: 'facet.triceps',
  core: 'facet.core',
  glutes: 'facet.glutes',
  'full body': 'facet.fullBody',
  barbell: 'facet.barbell',
  dumbbell: 'facet.dumbbell',
  machine: 'facet.machine',
  cable: 'facet.cable',
  bodyweight: 'facet.bodyweight',
  compound: 'facet.compound',
  isolation: 'facet.isolation',
  cardio: 'facet.cardio',
};

interface ExerciseDetailScreenProps {
  item: ExerciseLibraryItem;
  history?: ExerciseProgressSummary | null;
  tracked?: boolean;
  unitPreference?: UnitPreference;
  language?: AppLanguage;
  onBack: () => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  onAddToWorkout?: (item: ExerciseLibraryItem) => void;
}

function toLabel(value: string | null | undefined, language: AppLanguage) {
  if (!value) {
    return '';
  }

  const key = DETAIL_LABEL_KEYS[value.trim().toLowerCase()];
  if (key) {
    return t(language, key);
  }

  // Muscles, the raw source equipment ("kettlebells", "body only") and the
  // middle source level are not in this screen's own facet map; the shared
  // library map knows them. Anything neither knows still capitalises itself.
  return libraryLabel(value, language);
}

function formatLastDone(iso: string, language: AppLanguage) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) {
    return t(language, 'common.today');
  }
  if (days === 1) {
    return t(language, 'common.yesterday');
  }
  if (days < 7) {
    return t(language, 'common.daysAgo', { count: days });
  }
  if (days < 14) {
    return t(language, 'exDetail.lastWeek');
  }
  return formatShortDate(iso, language);
}

function ChevronLeftIcon() {
  const theme = useTheme();

  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ active }: { active: boolean }) {
  const theme = useTheme();

  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill={active ? theme.gold : 'none'}>
      <Path
        d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"
        stroke={active ? theme.gold : theme.muted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon({ color: colorProp, size = 30 }: { color?: string; size?: number }) {
  const theme = useTheme();
  const color = colorProp ?? theme.faint;

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
  const theme = useTheme();

  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      {added ? (
        <Path d="M5 13l4 4L19 7" stroke={theme.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

function HeroImage({ uri }: { uri?: string | null }) {
  const styles = useThemedStyles(makeStyles);

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
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.chip, filled ? styles.chipFilled : styles.chipSoft]}>
      <Text style={[styles.chipText, filled ? styles.chipTextFilled : styles.chipTextSoft]}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

function StatCard({ label, value, meta }: { label: string; value: string; meta?: string }) {
  const styles = useThemedStyles(makeStyles);

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
  language = 'en',
  onBack,
  onToggleTracked,
  onAddToWorkout,
}: ExerciseDetailScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
    flash(t(language, tracked ? 'exDetail.untracked' : 'exDetail.tracked'));
    onToggleTracked(item);
  };

  const bodyPartLabel = toLabel(item.bodyPart, language) || t(language, 'facet.fullBody');
  const equipmentLabel =
    toLabel(item.sourceEquipment ?? item.equipment, language) || t(language, 'facet.bodyweight');
  const mechanicLabel = toLabel(item.sourceMechanic ?? item.category, language) || t(language, 'facet.compound');
  const levelLabel = toLabel(item.sourceLevel ?? 'beginner', language) || t(language, 'myData.level.beginner');

  const primaryMuscles = (item.primaryMuscles ?? []).filter(Boolean);
  const secondaryMuscles = (item.secondaryMuscles ?? []).filter(Boolean);
  const primaryChips = primaryMuscles.length
    ? primaryMuscles.map((muscle) => toLabel(muscle, language))
    : [bodyPartLabel];

  const instructions = getExerciseInstructions(item.name, item.instructions, language);

  const logs = history?.logs ?? [];
  const hasHistory = logs.length > 0;

  const chartPoints = useMemo(
    () =>
      [...logs].reverse().map((log) => ({
        label: formatShortDate(log.performedAt, language),
        value: convertWeightFromKg(log.weight, unitPreference),
      })),
    [language, logs, unitPreference],
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
        <Text style={styles.topBarTitle}>{t(language, 'exDetail.title')}</Text>
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
          <Text style={styles.title}>{exerciseNameLabel(language, item.name)}</Text>
          <View style={styles.chipRow}>
            <Chip label={bodyPartLabel} filled />
            <Chip label={equipmentLabel} />
            <Chip label={mechanicLabel} />
            <Chip label={levelLabel} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>{t(language, 'exDetail.yourHistory')}</SectionLabel>
          {hasHistory ? (
            <>
              <View style={styles.statGrid}>
                <StatCard
                  label={t(language, 'exDetail.personalBest')}
                  value={personalBest}
                  meta={t(language, 'exDetail.topSet')}
                />
                <StatCard
                  label={t(language, 'exDetail.lastDone')}
                  value={history?.latestLog ? formatLastDone(history.latestLog.performedAt, language) : '—'}
                  meta={history?.latestLog?.workoutNameSnapshot ?? undefined}
                />
                <StatCard
                  label={t(language, 'detail.sessions').toUpperCase()}
                  value={`${logs.length}`}
                  meta={t(language, 'exDetail.logged')}
                />
              </View>
              <View style={styles.workingWeightHeader}>
                <Text style={styles.workingWeightLabel}>{t(language, 'progress.workingWeight')}</Text>
                {trendDelta != null ? (
                  <Text style={[styles.workingWeightDelta, trendDelta < 0 && styles.workingWeightDeltaDown]}>
                    {trendDelta >= 0 ? '+' : ''}
                    {removeTrailingZeros(trendDelta)} {unitPreference} {t(language, 'exDetail.sinceStart')}
                  </Text>
                ) : null}
              </View>
              <SimpleLineChart
                points={chartPoints}
                accent={theme.purple}
                unitLabel={unitPreference}
                emptyLabel={t(language, 'progress.noEntries')}
              />
            </>
          ) : (
            <View style={styles.emptyHistoryCard}>
              <DumbbellIcon color={theme.faint} size={28} />
              <Text style={styles.emptyHistoryTitle}>{t(language, 'exDetail.noHistory')}</Text>
              <Text style={styles.emptyHistoryBody}>{t(language, 'exDetail.noHistoryBody')}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionLabel>{t(language, 'exDetail.targetMuscles')}</SectionLabel>
          <View style={styles.musclesCard}>
            <Text style={styles.musclesGroupLabel}>{t(language, 'exDetail.primary')}</Text>
            <View style={styles.chipRow}>
              {primaryChips.map((muscle) => (
                <Chip key={`p-${muscle}`} label={muscle} filled />
              ))}
            </View>
            {secondaryMuscles.length ? (
              <>
                <Text style={[styles.musclesGroupLabel, styles.musclesGroupLabelSpaced]}>
                  {t(language, 'exDetail.secondary')}
                </Text>
                <View style={styles.chipRow}>
                  {secondaryMuscles.map((muscle) => (
                    <Chip key={`s-${muscle}`} label={toLabel(muscle, language)} />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>{t(language, 'exDetail.howTo')}</SectionLabel>
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
                <Text style={styles.stepTextMuted}>{t(language, 'exDetail.noSteps')}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.footnote}>{t(language, 'exDetail.footnote')}</Text>
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
          <Text style={styles.ctaText}>{t(language, 'exDetail.addToWorkout')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.faint,
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
    backgroundColor: theme.surfaceSoft,
  },
  heroSkeleton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceSoft,
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
    color: theme.ink,
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
    backgroundColor: theme.purple,
  },
  chipSoft: {
    backgroundColor: theme.purpleLight,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextFilled: {
    color: '#FFFFFF',
  },
  chipTextSoft: {
    color: theme.purpleDark,
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
    color: theme.faint,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: theme.faint,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.3,
    marginTop: 5,
  },
  statMeta: {
    fontSize: 10.5,
    fontWeight: '600',
    color: theme.muted,
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
    color: theme.ink,
  },
  workingWeightDelta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.greenInk,
  },
  workingWeightDeltaDown: {
    color: theme.muted,
  },
  emptyHistoryCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.ink,
  },
  emptyHistoryBody: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  musclesCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 16,
  },
  musclesGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.faint,
  },
  musclesGroupLabelSpaced: {
    marginTop: 15,
  },
  howToCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  howToStep: {
    flexDirection: 'row',
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  howToStepLast: {
    borderBottomWidth: 0,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.purpleDark,
  },
  stepText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.ink,
    lineHeight: 21,
  },
  stepTextMuted: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.muted,
    lineHeight: 21,
  },
  footnote: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.faint,
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
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  ctaButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.green,
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

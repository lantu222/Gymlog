import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { GymlogIcon, GymlogIconName } from '../components/GymlogIcon';
import { layout, spacing } from '../theme';
import { ExerciseBodyPart, ExerciseLibraryItem } from '../types/models';

const GREEN = '#B8FF6A';
const BACKGROUND = '#000000';
const SURFACE = '#151515';
const SURFACE_ELEVATED = '#1D1D1D';
const BORDER = 'rgba(255,255,255,0.12)';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.66)';
const FAINT = 'rgba(255,255,255,0.42)';

interface ExerciseDetailScreenProps {
  item: ExerciseLibraryItem;
  alternatives?: ExerciseLibraryItem[];
  tracked?: boolean;
  onBack: () => void;
  onToggleTracked?: (item: ExerciseLibraryItem) => void;
  onAddToWorkout?: (item: ExerciseLibraryItem) => void;
  onOpenAlternative?: (item: ExerciseLibraryItem) => void;
}

interface Cue {
  title: string;
  body: string;
  icon: 'setup' | 'pull' | 'top' | 'avoid';
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

function getBodyPartIcon(bodyPart: ExerciseBodyPart): GymlogIconName {
  switch (bodyPart) {
    case 'chest':
      return 'chest';
    case 'back':
      return 'back';
    case 'shoulders':
      return 'shoulders';
    case 'legs':
      return 'legs';
    case 'biceps':
    case 'triceps':
      return 'arms';
    case 'core':
      return 'core';
    case 'glutes':
      return 'glutes';
    default:
      return 'strength';
  }
}

function BackIcon({ color = TEXT, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ active, color = TEXT, size = 18 }: { active?: boolean; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : 'none'}>
      <Path
        d="m12 3.7 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3.7Z"
        stroke={color}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DotsIcon({ color = TEXT, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="6.5" cy="12" r="1.7" fill={color} />
      <Circle cx="12" cy="12" r="1.7" fill={color} />
      <Circle cx="17.5" cy="12" r="1.7" fill={color} />
    </Svg>
  );
}

function PlayIcon({ color = TEXT, size = 34 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 7.3v9.4L16.5 12 9 7.3Z" fill={color} />
    </Svg>
  );
}

function PlusIcon({ color = '#06080B', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon({ color = TEXT, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="6.5" width="14" height="13" rx="2.4" stroke={color} strokeWidth="1.8" />
      <Path d="M8 4.5v4M16 4.5v4M5.5 10.4h13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M9.2 14h2.1M13.8 14h1.2M9.2 16.6h2.1M13.8 16.6h1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function CueIcon({ type, color = GREEN, size = 24 }: { type: Cue['icon']; color?: string; size?: number }) {
  switch (type) {
    case 'pull':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v13M7 10l5-5 5 5" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'top':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 19V6M7 14l5 5 5-5" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'avoid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="7.2" stroke={color} strokeWidth="2.1" />
          <Path d="M7.2 16.8 16.8 7.2" stroke={color} strokeWidth="2.1" strokeLinecap="round" />
        </Svg>
      );
    default:
      return <GymlogIcon name="mobility" color={color} size={size} />;
  }
}

function InfoPill({ icon, label, dot }: { icon?: GymlogIconName; label: string; dot?: boolean }) {
  return (
    <View style={styles.infoPill}>
      {dot ? <View style={styles.levelDot} /> : icon ? <GymlogIcon name={icon} color="rgba(255,255,255,0.82)" size={11} /> : null}
      <Text numberOfLines={1} style={styles.infoPillText}>
        {label}
      </Text>
    </View>
  );
}

function buildCues(item: ExerciseLibraryItem): Cue[] {
  const isPullUp = item.name.toLowerCase().includes('pull');

  if (isPullUp) {
    return [
      { title: 'Setup', body: 'Secure the band and brace.', icon: 'setup' },
      { title: 'Pull', body: 'Drive elbows down.', icon: 'top' },
      { title: 'Top', body: 'Chin over the bar.', icon: 'pull' },
      { title: 'Lower', body: 'Lower with control.', icon: 'top' },
    ];
  }

  return [
    { title: 'Setup', body: 'Brace and set position.', icon: 'setup' },
    { title: 'Move', body: 'Control the rep.', icon: 'top' },
    { title: 'Range', body: 'Use full clean range.', icon: 'pull' },
    { title: 'Reset', body: 'Reset before next rep.', icon: 'setup' },
  ];
}

function buildMistakes(item: ExerciseLibraryItem) {
  const isPullUp = item.name.toLowerCase().includes('pull');

  if (isPullUp) {
    return ['Swinging or using momentum', 'Partial range of motion', 'Shrugging at the top'];
  }

  return ['Rushing the movement', 'Losing your setup', 'Stopping short of full range'];
}

function ExerciseImage({ uri, compact = false }: { uri?: string | null; compact?: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[compact ? styles.alternativeImageFallback : styles.heroFallback]}>
        <GymlogIcon name="strength" color="rgba(255,255,255,0.38)" size={compact ? 24 : 54} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={compact ? styles.alternativeImage : styles.heroImage}
      onError={() => setFailed(true)}
    />
  );
}

function formatMuscleList(muscles: string[], fallback: string) {
  if (!muscles.length) {
    return fallback;
  }

  return muscles.slice(0, 3).map(toLabel).join(', ');
}

function AlternativeCard({
  item,
  onPress,
}: {
  item: ExerciseLibraryItem;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.alternativeCard}>
      <ExerciseImage uri={item.imageUrls?.[0] ?? null} compact />
      <View style={styles.alternativeCopy}>
        <Text numberOfLines={2} style={styles.alternativeTitle}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.alternativeMeta}>
          {toLabel(item.equipment)}
        </Text>
      </View>
      <View style={styles.alternativeAdd}>
        <PlusIcon color={GREEN} size={18} />
      </View>
    </Pressable>
  );
}

export function ExerciseDetailScreen({
  item,
  alternatives = [],
  tracked = false,
  onBack,
  onToggleTracked,
  onAddToWorkout,
  onOpenAlternative,
}: ExerciseDetailScreenProps) {
  const primaryMuscles = item.primaryMuscles?.filter(Boolean) ?? [];
  const secondaryMuscles = item.secondaryMuscles?.filter(Boolean) ?? [];
  const cues = useMemo(() => buildCues(item), [item]);
  const mistakes = useMemo(() => buildMistakes(item), [item]);
  const heroImage = item.imageUrls?.[0] ?? null;
  const bodyPartLabel = toLabel(item.bodyPart);
  const equipmentLabel = toLabel(item.sourceEquipment ?? item.equipment);
  const mechanicLabel = toLabel(item.sourceMechanic ?? item.category);
  const levelLabel = toLabel(item.sourceLevel ?? 'beginner');
  const primaryLabel = formatMuscleList(primaryMuscles, bodyPartLabel || 'Main muscle');
  const secondaryLabel = formatMuscleList(secondaryMuscles, 'Supporting muscles');

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerActions}>
          <Pressable onPress={onBack} style={styles.roundButton} hitSlop={8}>
            <BackIcon />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              onPress={onToggleTracked ? () => onToggleTracked(item) : undefined}
              disabled={!onToggleTracked}
              style={[styles.roundButton, tracked && styles.roundButtonActive]}
              hitSlop={8}
            >
              <StarIcon active={tracked} color={tracked ? GREEN : TEXT} />
            </Pressable>
            <View style={styles.roundButton}>
              <DotsIcon />
            </View>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text numberOfLines={2} adjustsFontSizeToFit style={styles.title}>
            {item.name}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            <InfoPill icon={getBodyPartIcon(item.bodyPart)} label={bodyPartLabel || 'Full body'} />
            <InfoPill icon="strength" label={toLabel(item.category) || 'Compound'} />
            <InfoPill icon="file" label={equipmentLabel || 'Bodyweight'} />
            <InfoPill label={levelLabel || 'Beginner'} dot />
          </ScrollView>
        </View>

        <View style={styles.heroCard}>
          <ExerciseImage uri={heroImage} />
          <View style={styles.heroShade} />
          <View style={styles.playButton}>
            <PlayIcon />
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardHalf]}>
            <Text style={styles.sectionTitle}>Muscle emphasis</Text>
            <View style={styles.muscleCompactList}>
              <View style={styles.muscleCompactRow}>
                <Text style={styles.legendDot}>●</Text>
                <View style={styles.muscleCompactCopy}>
                  <Text style={styles.legendLabel}>Primary muscle</Text>
                  <Text numberOfLines={1} style={styles.legendValue}>{primaryLabel}</Text>
                </View>
              </View>
              <View style={styles.muscleCompactRow}>
                <Text style={styles.softLegendDot}>●</Text>
                <View style={styles.muscleCompactCopy}>
                  <Text style={styles.legendLabel}>Secondary muscles</Text>
                  <Text numberOfLines={3} style={styles.legendValue}>{secondaryLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardHalf]}>
            <Text style={styles.sectionTitle}>Need and avoid</Text>
            <View style={styles.compactDetailRow}>
              <GymlogIcon name="strength" color="rgba(255,255,255,0.78)" size={15} />
              <Text numberOfLines={1} style={styles.compactDetailLabel}>Equipment</Text>
              <Text numberOfLines={1} style={styles.compactDetailValue}>{equipmentLabel || 'Bodyweight'}</Text>
            </View>
            <View style={styles.compactDetailRow}>
              <GymlogIcon name="progress" color="rgba(255,255,255,0.78)" size={15} />
              <Text numberOfLines={1} style={styles.compactDetailLabel}>Type</Text>
              <Text numberOfLines={1} style={styles.compactDetailValue}>{mechanicLabel || 'Compound'}</Text>
            </View>
            <View style={styles.compactDivider} />
            {mistakes.map((mistake) => (
              <View key={mistake} style={styles.mistakeRow}>
                <Text style={styles.mistakeIcon}>x</Text>
                <Text numberOfLines={1} style={styles.mistakeText}>{mistake}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.howToCard}>
          <Text style={styles.sectionTitle}>How to perform</Text>
          <View style={styles.howToGrid}>
            {cues.map((cue, index) => (
              <View key={`${cue.title}_${index}`} style={styles.howToStep}>
                <View style={styles.howToStepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.howToTitle}>{cue.title}</Text>
                </View>
                <View style={styles.howToIconShell}>
                  <CueIcon type={cue.icon} size={22} />
                </View>
                <Text numberOfLines={2} style={styles.howToText}>
                  {cue.body}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.tipRow}>
            <GymlogIcon name="lightning" color={GREEN} size={14} />
            <Text numberOfLines={1} style={styles.tipText}>Control the movement and avoid rushing.</Text>
          </View>
        </View>

        {alternatives.length ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alternatives</Text>
            <View style={styles.alternativesScrollHint}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alternativesRail}>
                {alternatives.slice(0, 6).map((alternative) => (
                <AlternativeCard
                  key={alternative.id}
                  item={alternative}
                  onPress={onOpenAlternative ? () => onOpenAlternative(alternative) : undefined}
                />
                ))}
              </ScrollView>
              <View pointerEvents="none" style={styles.alternativesFade} />
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your history</Text>
            <Text style={styles.viewAll}>View all history</Text>
          </View>
          <View style={styles.historyCard}>
            <View style={styles.historyColumn}>
              <Text style={styles.historyLabel}>Last performed</Text>
              <Text style={styles.historyValue}>Not logged yet</Text>
              <Text style={styles.historySub}>Start tracking this movement</Text>
            </View>
            <View style={styles.historyDivider} />
            <View style={styles.historyColumn}>
              <Text style={styles.historyLabel}>Best set</Text>
              <Text style={styles.historyValue}>-</Text>
              <Text style={styles.historySub}>Build history over time</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={onAddToWorkout ? () => onAddToWorkout(item) : undefined}
            style={styles.addWorkoutButton}
          >
            <PlusIcon />
            <Text style={styles.addWorkoutText}>Add to workout</Text>
          </Pressable>
          <View style={styles.calendarButton}>
            <CalendarIcon />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: layout.bottomTabBarReserve - 28,
    gap: 10,
    backgroundColor: BACKGROUND,
  },
  headerActions: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: {
    borderColor: 'rgba(184,255,106,0.58)',
    backgroundColor: 'rgba(184,255,106,0.1)',
  },
  titleBlock: {
    gap: 7,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  pillRow: {
    gap: 7,
    paddingRight: 15,
  },
  infoPill: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoPillText: {
    color: TEXT,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  levelDot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  heroCard: {
    height: 186,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    flex: 1,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 58,
    height: 58,
    marginLeft: -29,
    marginTop: -29,
    borderRadius: 999,
    borderWidth: 1.6,
    borderColor: TEXT,
    backgroundColor: 'rgba(0,0,0,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAll: {
    color: GREEN,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryCard: {
    minHeight: 140,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 10,
    gap: 8,
  },
  summaryCardHalf: {
    width: '48.8%',
    flexGrow: 0,
    flexShrink: 0,
  },
  muscleCompactList: {
    flex: 1,
    gap: 9,
    justifyContent: 'center',
  },
  muscleCompactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  muscleCompactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  legendLabel: {
    color: GREEN,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  legendDot: {
    color: GREEN,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  softLegendDot: {
    color: 'rgba(184,255,106,0.62)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  legendValue: {
    color: TEXT,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  compactDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  compactDetailLabel: {
    flex: 1,
    minWidth: 0,
    color: FAINT,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  compactDetailValue: {
    flex: 1,
    minWidth: 0,
    color: TEXT,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  compactDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mistakeIcon: {
    color: '#FF5A5F',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
  },
  mistakeText: {
    flex: 1,
    color: MUTED,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
  },
  howToCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 10,
    gap: 10,
  },
  howToGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  howToStep: {
    width: '48.7%',
    minHeight: 86,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 8,
    gap: 5,
  },
  howToStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepNumber: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#06080B',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
  howToTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  howToIconShell: {
    minHeight: 21,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  howToText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  tipRow: {
    minHeight: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
  },
  tipText: {
    flex: 1,
    color: MUTED,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
  },
  alternativesScrollHint: {
    position: 'relative',
    overflow: 'hidden',
  },
  alternativesRail: {
    gap: spacing.sm,
    paddingRight: 34,
  },
  alternativesFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 34,
    backgroundColor: 'rgba(21,21,21,0.72)',
  },
  alternativeCard: {
    width: 168,
    minHeight: 152,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_ELEVATED,
  },
  alternativeImage: {
    width: '100%',
    height: 78,
  },
  alternativeImageFallback: {
    width: '100%',
    height: 78,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alternativeCopy: {
    padding: spacing.sm,
    paddingRight: 38,
    gap: 2,
  },
  alternativeTitle: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
  },
  alternativeMeta: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  alternativeAdd: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(0,0,0,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    minHeight: 82,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  historyColumn: {
    flex: 1,
    gap: 3,
  },
  historyDivider: {
    width: 1,
    height: '72%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.md,
  },
  historyLabel: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  historyValue: {
    color: TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  historySub: {
    color: FAINT,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  addWorkoutButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  addWorkoutText: {
    color: '#06080B',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  calendarButton: {
    width: 58,
    height: 58,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

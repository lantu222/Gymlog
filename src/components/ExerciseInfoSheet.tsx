import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { WorkoutExerciseInstance, WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';
import { buildExerciseInfoSnapshot, ExerciseInfoTheme } from '../lib/exerciseInfo';
import { ExerciseLibraryItem, UnitPreference } from '../types/models';
import { colors, radii, spacing } from '../theme';

interface ExerciseInfoSheetProps {
  exercise: WorkoutExerciseInstance;
  previousEntries?: WorkoutSlotHistoryEntry[];
  libraryItem?: ExerciseLibraryItem | null;
  unitPreference: UnitPreference;
  activeSetIndex: number;
  onClose: () => void;
}

function getThemeColors(theme: ExerciseInfoTheme) {
  if (theme === 'press') {
    return {
      accent: '#F2A25F',
      soft: 'rgba(242, 162, 95, 0.16)',
      border: 'rgba(242, 162, 95, 0.28)',
      glow: 'rgba(242, 162, 95, 0.20)',
    };
  }

  if (theme === 'pull') {
    return {
      accent: '#7CB6F0',
      soft: 'rgba(124, 182, 240, 0.16)',
      border: 'rgba(124, 182, 240, 0.28)',
      glow: 'rgba(124, 182, 240, 0.20)',
    };
  }

  if (theme === 'legs') {
    return {
      accent: '#F39AB2',
      soft: 'rgba(243, 154, 178, 0.16)',
      border: 'rgba(243, 154, 178, 0.28)',
      glow: 'rgba(243, 154, 178, 0.18)',
    };
  }

  if (theme === 'hinge') {
    return {
      accent: '#FFAF92',
      soft: 'rgba(255, 175, 146, 0.16)',
      border: 'rgba(255, 175, 146, 0.28)',
      glow: 'rgba(255, 175, 146, 0.18)',
    };
  }

  if (theme === 'arms') {
    return {
      accent: '#C6B1FF',
      soft: 'rgba(198, 177, 255, 0.16)',
      border: 'rgba(198, 177, 255, 0.28)',
      glow: 'rgba(198, 177, 255, 0.18)',
    };
  }

  if (theme === 'core') {
    return {
      accent: '#8FE0D4',
      soft: 'rgba(143, 224, 212, 0.16)',
      border: 'rgba(143, 224, 212, 0.28)',
      glow: 'rgba(143, 224, 212, 0.18)',
    };
  }

  if (theme === 'run') {
    return {
      accent: '#9ACCFF',
      soft: 'rgba(154, 204, 255, 0.16)',
      border: 'rgba(154, 204, 255, 0.28)',
      glow: 'rgba(154, 204, 255, 0.20)',
    };
  }

  return {
    accent: '#BFC9D3',
    soft: 'rgba(191, 201, 211, 0.14)',
    border: 'rgba(191, 201, 211, 0.20)',
    glow: 'rgba(191, 201, 211, 0.18)',
  };
}

function buildSparkCoordinates(values: number[], width: number, height: number) {
  if (!values.length) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function VideoThumbnail({
  accent,
  glow,
  label,
  movement,
}: {
  accent: string;
  glow: string;
  label: string;
  movement: string;
}) {
  return (
    <View style={styles.thumbnail}>
      <View style={[styles.thumbnailGlowLarge, { backgroundColor: glow }]} />
      <View style={[styles.thumbnailGlowSmall, { backgroundColor: glow }]} />
      <Svg width={116} height={116} viewBox="0 0 116 116">
        <Circle cx="58" cy="26" r="10" fill="rgba(255,255,255,0.10)" />
        <Rect x="45" y="38" width="26" height="30" rx="10" fill="rgba(255,255,255,0.10)" />
        <Line x1="27" y1="48" x2="45" y2="58" stroke={accent} strokeWidth="8" strokeLinecap="round" />
        <Line x1="71" y1="58" x2="89" y2="48" stroke={accent} strokeWidth="8" strokeLinecap="round" />
        <Line x1="50" y1="70" x2="40" y2="96" stroke="rgba(255,255,255,0.22)" strokeWidth="8" strokeLinecap="round" />
        <Line x1="66" y1="70" x2="76" y2="96" stroke="rgba(255,255,255,0.22)" strokeWidth="8" strokeLinecap="round" />
        <Circle cx="90" cy="30" r="18" fill="rgba(11,15,20,0.72)" />
        <Path d="M84 20 L102 30 L84 40 Z" fill={accent} />
      </Svg>
      <View style={styles.thumbnailCaption}>
        <Text style={styles.thumbnailCaptionKicker}>{movement}</Text>
        <Text style={styles.thumbnailCaptionText}>{label}</Text>
      </View>
    </View>
  );
}

function MuscleGlyph({ accent }: { accent: string }) {
  return (
    <Svg width={96} height={72} viewBox="0 0 96 72">
      <Circle cx="26" cy="14" r="8" fill="rgba(255,255,255,0.10)" />
      <Rect x="16" y="24" width="20" height="22" rx="8" fill="rgba(255,255,255,0.10)" />
      <Rect x="10" y="28" width="10" height="16" rx="5" fill={accent} />
      <Rect x="32" y="28" width="10" height="16" rx="5" fill={accent} />
      <Rect x="18" y="46" width="6" height="18" rx="3" fill="rgba(255,255,255,0.14)" />
      <Rect x="28" y="46" width="6" height="18" rx="3" fill="rgba(255,255,255,0.14)" />
      <Circle cx="70" cy="14" r="8" fill="rgba(255,255,255,0.10)" />
      <Rect x="60" y="24" width="20" height="22" rx="8" fill="rgba(255,255,255,0.10)" />
      <Rect x="54" y="28" width="10" height="16" rx="5" fill={accent} />
      <Rect x="76" y="28" width="10" height="16" rx="5" fill={accent} />
      <Rect x="62" y="46" width="6" height="18" rx="3" fill="rgba(255,255,255,0.14)" />
      <Rect x="72" y="46" width="6" height="18" rx="3" fill="rgba(255,255,255,0.14)" />
    </Svg>
  );
}

function JointGlyph({ accent }: { accent: string }) {
  return (
    <Svg width={96} height={72} viewBox="0 0 96 72">
      <Line x1="18" y1="44" x2="48" y2="20" stroke="rgba(255,255,255,0.18)" strokeWidth="6" strokeLinecap="round" />
      <Line x1="48" y1="20" x2="78" y2="52" stroke="rgba(255,255,255,0.18)" strokeWidth="6" strokeLinecap="round" />
      <Circle cx="18" cy="44" r="10" fill={accent} />
      <Circle cx="48" cy="20" r="10" fill={accent} />
      <Circle cx="78" cy="52" r="10" fill={accent} />
    </Svg>
  );
}

function MovementGlyph({ accent }: { accent: string }) {
  return (
    <Svg width={96} height={72} viewBox="0 0 96 72">
      <Rect x="18" y="12" width="60" height="48" rx="18" fill="rgba(255,255,255,0.08)" />
      <Polyline
        points="26,48 42,34 54,38 70,20"
        fill="none"
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M66 16 L78 20 L70 30" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrendChart({
  values,
  accent,
}: {
  values: number[];
  accent: string;
}) {
  const width = 220;
  const height = 76;
  const polyline = buildSparkCoordinates(values, width, height);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const spread = Math.max(max - min, 1);

  return (
    <Svg width={width} height={height}>
      <Line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <Line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <Polyline
        points={polyline}
        fill="none"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / spread) * height;
        return <Circle key={`${value}-${index}`} cx={x} cy={y} r="4" fill={accent} />;
      })}
    </Svg>
  );
}

function ImpactCard({
  title,
  body,
  children,
}: {
  title: string;
  body: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.impactCard}>
      <Text style={styles.impactTitle}>{title}</Text>
      {children}
      {body}
    </View>
  );
}

export function ExerciseInfoSheet({
  exercise,
  previousEntries = [],
  libraryItem = null,
  unitPreference,
  activeSetIndex,
  onClose,
}: ExerciseInfoSheetProps) {
  const snapshot = useMemo(
    () =>
      buildExerciseInfoSnapshot({
        exercise,
        previousEntries,
        libraryItem,
        unitPreference,
        activeSetIndex,
      }),
    [activeSetIndex, exercise, libraryItem, previousEntries, unitPreference],
  );
  const themeColors = getThemeColors(snapshot.theme);
  const trendValues = snapshot.trend.points.map((point) => point.value);

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetGlowBlue} />
        <View style={[styles.sheetGlowAccent, { backgroundColor: themeColors.glow }]} />

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Exercise info</Text>
            <Text style={styles.title}>{exercise.exerciseName}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <View style={styles.heroChipRow}>
                <View style={[styles.heroChip, { borderColor: themeColors.border, backgroundColor: themeColors.soft }]}>
                  <Text style={[styles.heroChipText, { color: themeColors.accent }]}>{snapshot.movementLabel}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{snapshot.bodyPartLabel}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{snapshot.equipmentLabel}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>Today</Text>
              <Text style={styles.heroBody}>Keep the next set clean. The essentials stay visible here.</Text>
              {snapshot.noteLabel ? (
                <View style={styles.notePill}>
                  <Text style={styles.notePillText}>{snapshot.noteLabel}</Text>
                </View>
              ) : null}
            </View>

            <VideoThumbnail
              accent={themeColors.accent}
              glow={themeColors.glow}
              label={snapshot.thumbnailLabel}
              movement={snapshot.movementLabel}
            />
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCardWide}>
              <Text style={styles.statLabel}>Target</Text>
              <Text style={styles.statValue} numberOfLines={2}>
                {snapshot.targetLabel}
              </Text>
              <Text style={styles.statMeta}>{snapshot.targetMeta}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Rest</Text>
              <Text style={styles.statValue}>{snapshot.restLabel}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Best</Text>
              <Text style={styles.statValue}>{snapshot.bestLabel}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exercise impact</Text>
            <View style={styles.impactGrid}>
              <ImpactCard
                title="Muscles"
                body={
                  <View style={styles.chipWrap}>
                    {snapshot.muscles.map((item) => (
                      <View key={item} style={styles.smallChip}>
                        <Text style={styles.smallChipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                }
              >
                <MuscleGlyph accent={themeColors.accent} />
              </ImpactCard>

              <ImpactCard
                title="Joints"
                body={
                  <View style={styles.chipWrap}>
                    {snapshot.joints.map((item) => (
                      <View key={item} style={styles.smallChip}>
                        <Text style={styles.smallChipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                }
              >
                <JointGlyph accent={themeColors.accent} />
              </ImpactCard>

              <ImpactCard
                title="Pattern"
                body={
                  <View style={styles.patternCopy}>
                    <Text style={styles.patternTitle}>{snapshot.movementLabel}</Text>
                    <Text style={styles.patternBody}>{snapshot.thumbnailLabel}</Text>
                  </View>
                }
              >
                <MovementGlyph accent={themeColors.accent} />
              </ImpactCard>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cues</Text>
            <View style={styles.cueList}>
              {snapshot.cues.map((cue, index) => (
                <View key={`${cue.label}-${index}`} style={styles.cueCard}>
                  <View style={[styles.cueBadge, { borderColor: themeColors.border, backgroundColor: themeColors.soft }]}>
                    <Text style={[styles.cueBadgeText, { color: themeColors.accent }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.cueCopy}>
                    <Text style={styles.cueTitle}>{cue.label}</Text>
                    <Text style={styles.cueBody}>{cue.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent trend</Text>
            <View style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <View style={styles.trendCopy}>
                  <Text style={styles.trendTitle}>{snapshot.trend.metricLabel}</Text>
                  <Text style={styles.trendBody}>{snapshot.trend.summaryLabel}</Text>
                </View>
                <View style={styles.trendMetricColumn}>
                  <View style={styles.trendMetricPill}>
                    <Text style={styles.trendMetricLabel}>Latest</Text>
                    <Text style={styles.trendMetricValue}>{snapshot.trend.latestLabel}</Text>
                  </View>
                  <View style={styles.trendMetricPill}>
                    <Text style={styles.trendMetricLabel}>Best</Text>
                    <Text style={styles.trendMetricValue}>{snapshot.trend.bestLabel}</Text>
                  </View>
                </View>
              </View>

              {snapshot.trend.empty ? (
                <View style={styles.emptyTrendState}>
                  <Text style={styles.emptyTrendText}>No trend yet. Finish a few clean sets and this will start to move.</Text>
                </View>
              ) : (
                <View style={styles.trendChartWrap}>
                  <TrendChart values={trendValues} accent={themeColors.accent} />
                  <View style={styles.trendFooter}>
                    <Text style={styles.trendFooterText}>{snapshot.trend.points[0]?.label ?? ''}</Text>
                    <Text style={styles.trendFooterText}>
                      {snapshot.trend.points[snapshot.trend.points.length - 1]?.label ?? ''}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Back to set</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    overflow: 'hidden',
    maxHeight: '92%',
    margin: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.20)',
    backgroundColor: 'rgba(14, 20, 28, 0.96)',
  },
  sheetGlowBlue: {
    position: 'absolute',
    top: -52,
    left: -36,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
  },
  sheetGlowAccent: {
    position: 'absolute',
    top: 24,
    right: -42,
    width: 164,
    height: 164,
    borderRadius: 164,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  closeButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  closeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroChip: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChipText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metaChip: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  notePill: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(191, 74, 105, 0.22)',
    backgroundColor: 'rgba(191, 74, 105, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  notePillText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  thumbnail: {
    width: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.54)',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  thumbnailGlowLarge: {
    position: 'absolute',
    top: -18,
    right: -12,
    width: 80,
    height: 80,
    borderRadius: 80,
  },
  thumbnailGlowSmall: {
    position: 'absolute',
    bottom: -14,
    left: -10,
    width: 56,
    height: 56,
    borderRadius: 56,
  },
  thumbnailCaption: {
    width: '100%',
    gap: 2,
  },
  thumbnailCaptionKicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  thumbnailCaptionText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCardWide: {
    flex: 1.3,
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 24, 33, 0.74)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  statCard: {
    flex: 0.85,
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 24, 33, 0.74)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  impactGrid: {
    gap: spacing.sm,
  },
  impactCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 24, 33, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  impactTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  smallChip: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  patternCopy: {
    gap: 2,
  },
  patternTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  patternBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  cueList: {
    gap: spacing.sm,
  },
  cueCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 24, 33, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cueBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  cueCopy: {
    flex: 1,
    gap: 2,
  },
  cueTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  cueBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  trendCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17, 24, 33, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  trendCopy: {
    flex: 1,
    gap: 3,
  },
  trendTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  trendBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  trendMetricColumn: {
    gap: spacing.xs,
  },
  trendMetricPill: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.44)',
    justifyContent: 'center',
  },
  trendMetricLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  trendMetricValue: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyTrendState: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyTrendText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  trendChartWrap: {
    gap: spacing.xs,
  },
  trendFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendFooterText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  footerButton: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
  },
  footerButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

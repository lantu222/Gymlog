import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgePill, SurfaceCard } from './MainScreenPrimitives';
import { WorkoutSceneGraphic } from './WorkoutSceneGraphic';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { pluralize } from '../lib/format';
import { radii, spacing } from '../theme';

interface HomePathSectionProps {
  readyProgramCount: number;
  readyProgramBadgeLabel: string;
  readyProgramTitle: string;
  readyProgramSubtitle: string;
  readyProgramMeta: string;
  readyProgramCtaLabel: string;
  customProgramCount: number;
  customProgramBadgeLabel: string;
  customProgramTitle: string;
  customProgramSubtitle: string;
  customProgramMeta: string;
  customProgramCtaLabel: string;
  onOpenReadyPrograms: () => void;
  onOpenCustomPrograms: () => void;
}

export function HomePathSection({
  readyProgramCount,
  readyProgramBadgeLabel,
  readyProgramTitle,
  readyProgramSubtitle,
  readyProgramMeta,
  readyProgramCtaLabel,
  customProgramCount,
  customProgramBadgeLabel,
  customProgramTitle,
  customProgramSubtitle,
  customProgramMeta,
  customProgramCtaLabel,
  onOpenReadyPrograms,
  onOpenCustomPrograms,
}: HomePathSectionProps) {
  return (
    <View style={styles.section}>
      <SurfaceCard accent="blue" emphasis="standard" style={styles.card} onPress={onOpenReadyPrograms}>
        <View style={styles.topRow}>
          <View style={styles.badgeCluster}>
            <BadgePill label={readyProgramBadgeLabel} accent="blue" />
            <BadgePill label={pluralize(readyProgramCount, 'plan')} accent="blue" />
          </View>
        </View>

        <WorkoutSceneGraphic variant="browse" accent="blue" style={styles.visual} />

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{formatWorkoutDisplayLabel(readyProgramTitle, 'Ready program')}</Text>
          <Text style={styles.meta}>{readyProgramMeta}</Text>
          <Text style={styles.body}>{readyProgramSubtitle}</Text>
        </View>

        <Pressable onPress={onOpenReadyPrograms} style={[styles.ctaPill, styles.ctaPillBlue]}>
          <Text style={styles.ctaText}>{readyProgramCtaLabel}</Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard accent="rose" emphasis="standard" style={styles.card} onPress={onOpenCustomPrograms}>
        <View style={styles.topRow}>
          <View style={styles.badgeCluster}>
            <BadgePill label={customProgramBadgeLabel} accent="rose" />
            <BadgePill label={pluralize(customProgramCount, 'workout')} accent="rose" />
          </View>
        </View>

        <WorkoutSceneGraphic variant="build" accent="rose" style={styles.visual} />

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{formatWorkoutDisplayLabel(customProgramTitle)}</Text>
          <Text style={styles.meta}>{customProgramMeta}</Text>
          <Text style={styles.body}>{customProgramSubtitle}</Text>
        </View>

        <Pressable onPress={onOpenCustomPrograms} style={[styles.ctaPill, styles.ctaPillRose]}>
          <Text style={styles.ctaText}>{customProgramCtaLabel}</Text>
        </Pressable>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badgeCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  copyBlock: {
    gap: 4,
  },
  visual: {
    height: 104,
  },
  title: {
    color: '#FBFDFF',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  meta: {
    color: '#A9DBFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  body: {
    color: '#F0F8FF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  ctaPill: {
    minHeight: 42,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  ctaPillBlue: {
    backgroundColor: 'rgba(150, 216, 255, 0.26)',
    borderColor: 'rgba(150, 216, 255, 0.42)',
  },
  ctaPillRose: {
    backgroundColor: 'rgba(216, 106, 134, 0.22)',
    borderColor: 'rgba(216, 106, 134, 0.34)',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WorkoutSceneGraphic } from './WorkoutSceneGraphic';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { colors, radii, spacing } from '../theme';

export interface ResumeWorkoutCardData {
  mode: 'resume' | 'start' | 'empty';
  eyebrow: string;
  title: string;
  subtitle: string;
  reason?: string;
  meta?: string;
  actionLabel: string;
}

interface ResumeWorkoutCardProps {
  card: ResumeWorkoutCardData;
  onPress: () => void;
}

export function ResumeWorkoutCard({ card, onPress }: ResumeWorkoutCardProps) {
  const liveMode = card.mode === 'resume';
  const metaParts = (card.meta ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <Pressable onPress={onPress} style={[styles.card, liveMode ? styles.cardResume : styles.cardStart]}>
      <View style={styles.topAccent} />
      <View style={styles.cardInnerHighlight} />
      <View style={styles.cardSheen} />
      <View style={styles.graphicWrap}>
        <WorkoutSceneGraphic variant={liveMode ? 'today' : 'plan'} accent="blue" />
      </View>

      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{card.eyebrow}</Text>
        <View style={[styles.modeChip, liveMode ? styles.modeChipLive : styles.modeChipReady]}>
          <View style={[styles.modeDot, liveMode ? styles.modeDotLive : styles.modeDotReady]} />
          <Text style={styles.modeChipText}>{liveMode ? 'Live' : 'Ready'}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{formatWorkoutDisplayLabel(card.title, 'Workout')}</Text>
        <Text style={styles.subtitle}>{card.subtitle}</Text>
        {card.reason ? <Text style={styles.reason}>{card.reason}</Text> : null}
      </View>

      {metaParts.length ? (
        <View style={styles.metaRow}>
          {metaParts.map((part) => (
            <View key={part} style={styles.metaChip}>
              <Text style={styles.metaChipText}>{part}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.button}>
        <Text style={styles.buttonText}>{card.actionLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    minHeight: 180,
    backgroundColor: 'rgba(31, 44, 60, 0.86)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
    elevation: 11,
  },
  cardResume: {
    borderColor: 'rgba(150, 216, 255, 0.62)',
  },
  cardStart: {
    borderColor: 'rgba(150, 216, 255, 0.54)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#96D8FF',
  },
  cardInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.032)',
  },
  cardSheen: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  graphicWrap: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 128,
    opacity: 0.96,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    color: '#A9DBFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modeChip: {
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
  },
  modeChipLive: {
    backgroundColor: 'rgba(216, 106, 134, 0.18)',
    borderColor: 'rgba(216, 106, 134, 0.40)',
  },
  modeChipReady: {
    backgroundColor: 'rgba(150, 216, 255, 0.22)',
    borderColor: 'rgba(150, 216, 255, 0.44)',
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  modeDotLive: {
    backgroundColor: colors.feature,
  },
  modeDotReady: {
    backgroundColor: '#96D8FF',
  },
  modeChipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  copy: {
    gap: spacing.xs,
    paddingRight: 112,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#D3E6F5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  reason: {
    color: '#9ACCFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    minHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.26)',
    backgroundColor: 'rgba(11, 15, 20, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaChipText: {
    color: '#E3F1FB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  button: {
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#96D8FF',
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.70)',
    shadowColor: '#96D8FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 20,
    elevation: 9,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

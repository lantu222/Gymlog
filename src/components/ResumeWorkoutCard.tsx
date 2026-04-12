import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeHeroVisual } from '../lib/homeVisuals';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { radii, spacing } from '../theme';

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
  heroVisual?: HomeHeroVisual;
  onPress: () => void;
}

export function ResumeWorkoutCard({ card, heroVisual, onPress }: ResumeWorkoutCardProps) {
  const metaParts = (card.meta ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  const chips = heroVisual?.chips.length ? heroVisual.chips.slice(0, 2) : [card.eyebrow, ...metaParts.slice(0, 1)];
  const durationLabel = heroVisual?.durationLabel ?? metaParts[1];
  const title = heroVisual?.title ?? formatWorkoutDisplayLabel(card.title, 'Workout');
  const subtitle = heroVisual?.detail ?? card.subtitle;
  const planLabel =
    heroVisual?.planLabel && heroVisual.planLabel !== title ? heroVisual.planLabel : undefined;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.hero}>
        {chips.length ? (
          <View style={styles.heroTop}>
            <View style={styles.tokenRow}>
              {chips.map((chip, index) => (
                <View key={`${chip}:${index}`} style={[styles.token, index > 0 && styles.tokenMuted]}>
                  <Text style={[styles.tokenText, index > 0 && styles.tokenTextMuted]}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.heroBody}>
          <View style={styles.copy}>
            {planLabel ? <Text style={styles.planLabel}>{planLabel}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {durationLabel ? <Text style={styles.duration}>{durationLabel}</Text> : null}
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#101010',
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 10,
  },
  heroTop: {
    gap: spacing.sm,
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  token: {
    minHeight: 28,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tokenMuted: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tokenText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tokenTextMuted: {
    color: '#FFFFFF',
  },
  heroBody: {
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  planLabel: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -1,
    maxWidth: '94%',
  },
  duration: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    maxWidth: '90%',
  },
});

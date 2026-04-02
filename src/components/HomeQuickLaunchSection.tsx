import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeQuickLaunchWorkoutData } from '../lib/homeQuickLaunch';
import { colors, radii, spacing } from '../theme';

interface HomeQuickLaunchSectionProps {
  workouts: HomeQuickLaunchWorkoutData[];
  onStartSession: (launchKey: string) => void;
}

export function HomeQuickLaunchSection({ workouts, onStartSession }: HomeQuickLaunchSectionProps) {
  if (!workouts.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Quick launch</Text>
        <Text style={styles.title}>Pick a lane and go</Text>
        <Text style={styles.subtitle}>Tap straight into the exact session you want instead of bouncing through setup screens.</Text>
      </View>

      <View style={styles.list}>
        {workouts.map((workout, index) => {
          const featured = index === 0;

          return (
            <View key={workout.workoutId} style={[styles.card, featured && styles.cardFeatured]}>
              {featured ? <View style={styles.cardAccentLine} /> : null}
              {featured ? <View style={styles.cardGlow} /> : null}

              <View style={styles.cardTopRow}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{workout.title}</Text>
                  <Text style={styles.cardSubtitle}>{workout.subtitle}</Text>
                </View>
                <View style={[styles.cardTag, featured ? styles.cardTagFeatured : styles.cardTagStandard]}>
                  <Text style={styles.cardTagText}>{featured ? 'Featured' : 'Quick'}</Text>
                </View>
              </View>

              <View style={styles.sessionWrap}>
                {workout.sessions.map((session) => (
                  <Pressable
                    key={session.launchKey}
                    onPress={() => onStartSession(session.launchKey)}
                    style={[styles.sessionButton, featured && styles.sessionButtonFeatured, workout.sessions.length === 1 && styles.sessionButtonSingle]}
                  >
                    <Text style={styles.sessionLabel}>{session.label}</Text>
                    <Text style={styles.sessionMeta}>{session.meta}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    gap: 2,
  },
  kicker: {
    color: colors.feature,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  list: {
    gap: spacing.md,
  },
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardFeatured: {
    borderColor: 'rgba(85, 138, 189, 0.26)',
    backgroundColor: colors.cardElevated,
  },
  cardAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.accent,
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -28,
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: 'rgba(85, 138, 189, 0.18)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  cardTag: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTagFeatured: {
    backgroundColor: colors.featureSoft,
    borderColor: 'rgba(191, 74, 105, 0.22)',
  },
  cardTagStandard: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(85, 138, 189, 0.18)',
  },
  cardTagText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sessionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sessionButton: {
    minWidth: 96,
    flexGrow: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.2)',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 3,
  },
  sessionButtonFeatured: {
    backgroundColor: 'rgba(85, 138, 189, 0.14)',
    borderColor: 'rgba(85, 138, 189, 0.28)',
  },
  sessionButtonSingle: {
    minWidth: 0,
  },
  sessionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});

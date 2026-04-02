import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BadgePill, SurfaceCard } from './MainScreenPrimitives';
import { PremiumFeatureVisual } from './PremiumFeatureVisual';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { colors, radii, spacing } from '../theme';

interface AICoachCardProps {
  suggestions?: string[];
  activeWorkoutTitle?: string | null;
  onSubmit: (prompt: string) => void;
  variant?: 'hero' | 'compact';
}

export function AICoachCard({ suggestions, activeWorkoutTitle, onSubmit, variant = 'hero' }: AICoachCardProps) {
  const [draft, setDraft] = useState('');
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const compact = variant === 'compact';
  const workoutTitle = useMemo(
    () => formatWorkoutDisplayLabel(activeWorkoutTitle, 'Workout'),
    [activeWorkoutTitle],
  );
  const helperText = useMemo(
    () =>
      activeWorkoutTitle
        ? `Need help with ${workoutTitle}?`
        : 'Goal, lift, or split?',
    [activeWorkoutTitle, workoutTitle],
  );

  const trimmed = draft.trim();

  function submitPrompt(prompt: string) {
    const next = prompt.trim();
    if (!next) {
      return;
    }

    onSubmit(next);
  }

  return (
    <SurfaceCard
      accent="orange"
      emphasis={compact ? 'standard' : 'hero'}
      style={[styles.card, compact && styles.cardCompact]}
    >
      <View style={styles.identityRow}>
        <View style={[styles.badge, compact && styles.badgeCompact]}>
          <Text style={[styles.badgeText, compact && styles.badgeTextCompact]}>V</Text>
        </View>

        <View style={styles.identityCopy}>
          <View style={styles.identityTopLine}>
            <Text style={styles.eyebrow}>Vallu</Text>
            <BadgePill label="Beta" accent="orange" />
          </View>
          <Text style={[styles.identityMeta, compact && styles.identityMetaCompact]}>AI coach</Text>
        </View>

        {activeWorkoutTitle ? <BadgePill label="Live" accent="orange" /> : null}
      </View>

      <View style={styles.heroVisualRow}>
        <View style={styles.header}>
          <Text style={[styles.title, compact && styles.titleCompact]}>What do you need?</Text>
          <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{helperText}</Text>
        </View>
        <PremiumFeatureVisual variant="coach" accent="orange" compact={compact} style={styles.visual} />
      </View>

      <View style={styles.signalRow}>
        <View style={styles.signalCard}>
          <Text style={styles.signalLabel}>Lift</Text>
          <Text style={styles.signalValue}>Bench stuck?</Text>
        </View>
        <View style={styles.signalCard}>
          <Text style={styles.signalLabel}>Plan</Text>
          <Text style={styles.signalValue}>Make it 2 days</Text>
        </View>
        {!compact ? (
          <View style={styles.signalCard}>
            <Text style={styles.signalLabel}>Today</Text>
            <Text style={styles.signalValue}>Swap this session</Text>
          </View>
        ) : null}
      </View>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Bench stuck?"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.warning}
        multiline
        textAlignVertical="top"
        style={[styles.input, compact && styles.inputCompact]}
      />

      <View style={styles.suggestionRow}>
        {safeSuggestions.slice(0, compact ? 2 : 4).map((suggestion) => (
          <Pressable key={suggestion} onPress={() => setDraft(suggestion)} style={styles.suggestionChip}>
            <Text numberOfLines={1} style={styles.suggestionChipText}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => submitPrompt(trimmed)} style={[styles.button, !trimmed && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>Ask Vallu</Text>
      </Pressable>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 320,
    gap: spacing.md,
  },
  cardCompact: {
    minHeight: 0,
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 106, 57, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.34)',
  },
  badgeCompact: {
    width: 40,
    height: 40,
  },
  badgeText: {
    color: '#FFF6F0',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badgeTextCompact: {
    fontSize: 18,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    color: '#FFB389',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  identityMeta: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  identityMetaCompact: {
    fontSize: 15,
  },
  header: {
    flex: 1,
    gap: spacing.xs,
  },
  heroVisualRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  visual: {
    width: 110,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 26,
  },
  subtitle: {
    color: '#E2CEC4',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  signalCard: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.18)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  signalLabel: {
    color: '#FFB389',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  input: {
    minHeight: 94,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.18)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  inputCompact: {
    minHeight: 72,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionChip: {
    minHeight: 32,
    maxWidth: '100%',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.20)',
    backgroundColor: 'rgba(240, 106, 57, 0.10)',
  },
  suggestionChipText: {
    color: '#FFF0E7',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F06A39',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 170, 0.28)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

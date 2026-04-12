import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BadgePill, SurfaceCard } from './MainScreenPrimitives';
import { WorkoutSceneGraphic } from './WorkoutSceneGraphic';
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
  const helperText = activeWorkoutTitle ? `Live help for ${workoutTitle}` : 'Get help instantly';
  const trimmed = draft.trim();
  const compactPrompt = safeSuggestions[0] ?? 'Help with my training';

  function submitPrompt(prompt: string) {
    const next = prompt.trim();
    if (!next) {
      return;
    }

    onSubmit(next);
  }

  if (compact) {
    return (
      <SurfaceCard accent="neutral" emphasis="flat" style={styles.compactShell}>
        <View style={styles.compactRow}>
          <View style={styles.compactCopy}>
            <Text style={styles.compactKicker}>Ask Gymlog AI</Text>
            <Text style={styles.compactTitle}>{helperText}</Text>
          </View>
          <WorkoutSceneGraphic variant="search" accent="neutral" compact style={styles.compactVisual} />
        </View>

        <Pressable onPress={() => onSubmit(compactPrompt)} style={styles.compactButton}>
          <Text style={styles.compactButtonText}>Open AI</Text>
        </Pressable>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard accent="neutral" emphasis="hero" style={styles.card}>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.eyebrow}>Ask Gymlog AI</Text>
            {activeWorkoutTitle ? <BadgePill accent="neutral" label="Live help" /> : null}
          </View>

          <Text style={styles.title}>Get help instantly</Text>
          <Text style={styles.subtitle}>{helperText}</Text>
        </View>

        <WorkoutSceneGraphic variant="search" accent="neutral" style={styles.heroVisual} />
      </View>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Ask one short question"
        placeholderTextColor={colors.textMuted}
        selectionColor="#FFFFFF"
        multiline
        textAlignVertical="top"
        style={styles.input}
      />

      <View style={styles.suggestionRow}>
        {safeSuggestions.slice(0, 4).map((suggestion) => (
          <Pressable key={suggestion} onPress={() => setDraft(suggestion)} style={styles.suggestionChip}>
            <Text numberOfLines={1} style={styles.suggestionChipText}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => submitPrompt(trimmed)} style={[styles.button, !trimmed && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>Get answer</Text>
      </Pressable>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  compactShell: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: '#050505',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  compactCopy: {
    flex: 1,
    gap: 4,
  },
  compactKicker: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  compactTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  compactVisual: {
    width: 132,
  },
  compactButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  compactButtonText: {
    color: '#0B0F14',
    fontSize: 14,
    fontWeight: '900',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroVisual: {
    width: 150,
  },
  input: {
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 10, 14, 0.42)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  suggestionChipText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    minHeight: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#0B0F14',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

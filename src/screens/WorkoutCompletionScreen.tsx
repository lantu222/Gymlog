import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { formatDurationMinutes, formatSessionDate, formatVolume, formatWeight, pluralize } from '../lib/format';
import { WorkoutCompletionExerciseCard, WorkoutCompletionPrCard } from '../lib/workoutCompletionSummary';
import { radii, spacing } from '../theme';
import { UnitPreference } from '../types/models';

interface WorkoutCompletionScreenProps {
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  unitPreference: UnitPreference;
  isSaving?: boolean;
  onSaveSummary: (input: { sessionName: string; notes: string }) => Promise<void> | void;
  onDone: () => void;
  onViewProgress: () => void;
}

function formatPrDelta(currentKg: number, previousKg: number | null, unitPreference: UnitPreference) {
  if (previousKg === null) {
    return 'First tracked PR';
  }

  const deltaKg = currentKg - previousKg;
  return `+${formatWeight(deltaKg, unitPreference)}`;
}

export function WorkoutCompletionScreen({
  workoutName,
  performedAt,
  durationMinutes,
  setsCompleted,
  totalVolume,
  exercisesLogged,
  exerciseCards,
  prCards,
  unitPreference,
  isSaving = false,
  onSaveSummary,
  onDone,
  onViewProgress,
}: WorkoutCompletionScreenProps) {
  const [sessionName, setSessionName] = useState(workoutName);
  const [notes, setNotes] = useState('');

  const detailRows = useMemo(
    () => [
      { label: 'When', value: formatSessionDate(performedAt) },
      { label: 'Duration', value: formatDurationMinutes(durationMinutes) },
      { label: 'Exercises', value: pluralize(exercisesLogged, 'exercise') },
      { label: 'Sets', value: pluralize(setsCompleted, 'set') },
      { label: 'Volume', value: formatVolume(totalVolume, unitPreference) },
    ],
    [performedAt, durationMinutes, exercisesLogged, setsCompleted, totalVolume, unitPreference],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Finish workout" onBack={onDone} backLabel="Close" tone="dark" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {prCards.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New PRs</Text>
            <View style={styles.sectionStack}>
              {prCards.map((card) => (
                <View key={card.id} style={styles.prCard}>
                  <View style={styles.prLead}>
                    <View style={styles.prThumb}>
                      {card.imageUrl ? (
                        <Image source={{ uri: card.imageUrl }} style={styles.prThumbImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.prThumbFallback}>{card.exerciseName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>

                    <View style={styles.prCopy}>
                      <Text style={styles.prName}>{card.exerciseName}</Text>
                      <Text style={styles.prValue}>
                        Estimated 1RM - {formatWeight(card.estimatedOneRepMaxKg, unitPreference)}
                      </Text>
                      <Text style={styles.prMeta}>
                        {card.performedReps} reps at {formatWeight(card.performedWeightKg, unitPreference)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.prBadgeWrap}>
                    <View style={styles.prBadge}>
                      <Text style={styles.prBadgeText}>New PR</Text>
                    </View>
                    <Text style={styles.prDelta}>{formatPrDelta(card.estimatedOneRepMaxKg, card.previousBestOneRepMaxKg, unitPreference)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session</Text>
          <TextInput
            value={sessionName}
            onChangeText={setSessionName}
            placeholder="Session name"
            placeholderTextColor="#9CA3AF"
            selectionColor="#111111"
            style={styles.input}
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add Notes"
            placeholderTextColor="#9CA3AF"
            selectionColor="#111111"
            multiline
            style={styles.notesInput}
          />
          <Pressable style={styles.photoCard}>
            <Text style={styles.photoIcon}>+</Text>
            <View style={styles.photoCopy}>
              <Text style={styles.photoTitle}>Add photo</Text>
              <Text style={styles.photoBody}>Photos are next. Keep this slot ready.</Text>
            </View>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>Soon</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailStack}>
            {detailRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <View style={styles.exerciseStack}>
            {exerciseCards.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseLead}>
                  <View style={styles.exerciseThumb}>
                    {exercise.imageUrl ? (
                      <Image source={{ uri: exercise.imageUrl }} style={styles.exerciseThumbImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.exerciseThumbFallback}>{exercise.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.completedSets}/{exercise.totalSets} Done
                    </Text>
                    {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
                  </View>
                </View>
                <Text style={styles.exerciseVolume}>{formatVolume(exercise.totalVolumeKg, unitPreference)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            void onSaveSummary({
              sessionName,
              notes,
            });
          }}
          style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}
          disabled={isSaving}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
        <Pressable onPress={onViewProgress} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>View progress</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 120,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionStack: {
    gap: spacing.sm,
  },
  prCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.30)',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  prLead: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  prThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  prThumbImage: {
    width: '100%',
    height: '100%',
  },
  prThumbFallback: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 52,
  },
  prCopy: {
    flex: 1,
    gap: 2,
  },
  prName: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  prValue: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  prMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  prBadgeWrap: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  prBadge: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: '#FB923C',
  },
  prBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  prDelta: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 128,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: '#111111',
    fontSize: 15,
    fontWeight: '500',
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  photoCard: {
    minHeight: 126,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: spacing.lg,
  },
  photoIcon: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '300',
  },
  photoCopy: {
    alignItems: 'center',
    gap: 2,
  },
  photoTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  photoBody: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  soonBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: '#E8F7EE',
    justifyContent: 'center',
  },
  soonBadgeText: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  detailStack: {
    gap: spacing.sm,
  },
  detailRow: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  detailValue: {
    flexShrink: 1,
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  exerciseStack: {
    gap: spacing.sm,
  },
  exerciseCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  exerciseLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  exerciseThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  exerciseThumbImage: {
    width: '100%',
    height: '100%',
  },
  exerciseThumbFallback: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
  },
  exerciseCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  exerciseName: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseNotes: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseVolume: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },
});

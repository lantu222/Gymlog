import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { GymlogIcon } from '../components/GymlogIcon';
import { formatDurationMinutes, formatSessionDate, formatVolume, formatWeight, pluralize } from '../lib/format';
import { PostSessionInsight } from '../lib/postSessionInsight';
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
  insight?: PostSessionInsight | null;
  unitPreference: UnitPreference;
  isSaving?: boolean;
  onSaveSummary: (input: { sessionName: string; notes: string }) => Promise<void> | void;
  onDone: () => void;
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
  insight = null,
  unitPreference,
  isSaving = false,
  onSaveSummary,
  onDone,
}: WorkoutCompletionScreenProps) {
  const [sessionName, setSessionName] = useState(workoutName);

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

        {insight ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coach note</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightMessage}>{insight.message}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sessionTitleRow}>
            <Text style={styles.sectionTitle}>Session</Text>
            <View style={styles.renameHintPill}>
              <GymlogIcon name="file" color="#16A34A" size={13} />
              <Text style={styles.renameHintText}>Tap to rename</Text>
            </View>
          </View>
          <TextInput
            value={sessionName}
            onChangeText={setSessionName}
            placeholder="Session name"
            placeholderTextColor="#9CA3AF"
            selectionColor="#111111"
            style={styles.input}
          />
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
                <View style={styles.exerciseCardHeader}>
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
                    </View>
                  </View>
                  <Text style={styles.exerciseVolume}>{formatVolume(exercise.totalVolumeKg, unitPreference)}</Text>
                </View>
                {exercise.notes ? (
                  <View style={styles.exerciseNoteRow}>
                    <GymlogIcon name="file" color="#16A34A" size={15} />
                    <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                  </View>
                ) : null}
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
              notes: '',
            });
          }}
          style={[styles.primaryButton, isSaving ? styles.primaryButtonDisabled : null]}
          disabled={isSaving}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F3FF',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 120,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  renameHintPill: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  renameHintText: {
    color: '#14532D',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  sectionStack: {
    gap: spacing.sm,
  },
  prCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E4D8FF',
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
    backgroundColor: '#EFE7FF',
  },
  prThumbImage: {
    width: '100%',
    height: '100%',
  },
  prThumbFallback: {
    color: '#7C3AED',
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
    color: '#101828',
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
    backgroundColor: '#7C3AED',
  },
  prBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  prDelta: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
  },
  insightCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
  },
  insightMessage: {
    color: '#14532D',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  input: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#101828',
    fontSize: 16,
    fontWeight: '700',
    shadowColor: '#D8C7FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 2,
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
    borderColor: '#E4D8FF',
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
    color: '#101828',
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
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseCardHeader: {
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
    backgroundColor: '#EFE7FF',
  },
  exerciseThumbImage: {
    width: '100%',
    height: '100%',
  },
  exerciseThumbFallback: {
    color: '#7C3AED',
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
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseNoteRow: {
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exerciseNotes: {
    flex: 1,
    color: '#14532D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  exerciseVolume: {
    color: '#7C3AED',
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
    backgroundColor: '#F7F3FF',
    borderTopWidth: 1,
    borderTopColor: '#E4D8FF',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: '#7C3AED',
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
    borderColor: '#E4D8FF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '800',
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { InlineTip } from '../components/InlineTip';
import { ScreenHeader } from '../components/ScreenHeader';
import { parseNumberInput } from '../lib/format';
import { createId } from '../lib/ids';
import {
  buildEditorExercisePatchFromLibraryItem,
  buildEditorTableRows,
  EditorExerciseHistoryLookup,
  formatDraftRepRange,
  parseDraftRepRangeInput,
} from '../lib/workoutEditorTable';
import { buildPersistedSessionNames } from '../lib/workoutEditorNaming';
import { colors, radii, spacing } from '../theme';
import { SurfaceAccent } from '../components/MainScreenPrimitives';
import { ExerciseLibraryItem, UnitPreference, WorkoutTemplateDraft } from '../types/models';

interface EditorExerciseState {
  localKey: string;
  id?: string;
  name: string;
  targetSets: string;
  repRangeText: string;
  restSeconds: string;
  trackedDefault: boolean;
  libraryItemId?: string | null;
}

interface EditorSessionState {
  localKey: string;
  id?: string;
  exercises: EditorExerciseState[];
}

interface ExerciseSheetTarget {
  rowKey?: string | null;
  mode: 'append' | 'fill-row';
}

interface WorkoutEditorScreenProps {
  initialDraft: WorkoutTemplateDraft;
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  unitPreference: UnitPreference;
  exerciseHistoryLookup: EditorExerciseHistoryLookup;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft) => Promise<void> | void;
  inlineTip?: {
    title: string;
    body: string;
    accent?: SurfaceAccent;
    onDismiss: () => void;
  } | null;
}

function createExerciseState(defaultRestSeconds: number, item?: ExerciseLibraryItem): EditorExerciseState {
  if (item) {
    return {
      localKey: createId('draft'),
      ...buildEditorExercisePatchFromLibraryItem(item, defaultRestSeconds),
    };
  }

  return {
    localKey: createId('draft'),
    name: '',
    targetSets: '3',
    repRangeText: '6-8',
    restSeconds: `${defaultRestSeconds}`,
    trackedDefault: true,
    libraryItemId: null,
  };
}

function mapDraftToState(draft: WorkoutTemplateDraft): EditorSessionState {
  const draftSessions = Array.isArray(draft.sessions) && draft.sessions.length > 0
    ? draft.sessions
    : [
        {
          id: undefined,
          name: '',
          exercises: Array.isArray(draft.exercises) ? draft.exercises : [],
        },
      ];

  const mergedExercises = draftSessions.flatMap((session) => session.exercises);

  return {
    localKey: draftSessions[0]?.id ?? createId('draft_session'),
    id: draftSessions[0]?.id,
    exercises: mergedExercises.map((exercise) => ({
      localKey: exercise.id ?? createId('draft'),
      id: exercise.id,
      name: exercise.name,
      targetSets: `${exercise.targetSets}`,
      repRangeText: formatDraftRepRange(`${exercise.repMin}`, `${exercise.repMax}`),
      restSeconds: exercise.restSeconds ? `${exercise.restSeconds}` : '',
      trackedDefault: exercise.trackedDefault,
      libraryItemId: exercise.libraryItemId ?? null,
    })),
  };
}

function MetricInputField({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.metricField}>
      <Text style={styles.metricLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        keyboardType="numbers-and-punctuation"
        style={styles.metricInput}
      />
    </View>
  );
}

function MetricReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricField}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.readonlyMetricBody}>
        <Text style={styles.readonlyMetricValue}>{value}</Text>
      </View>
    </View>
  );
}

export function WorkoutEditorScreen({
  initialDraft,
  exerciseLibrary,
  recentExerciseLibraryItems,
  defaultRestSeconds,
  unitPreference,
  exerciseHistoryLookup,
  onBack,
  onSave,
  inlineTip,
}: WorkoutEditorScreenProps) {
  const [name, setName] = useState(initialDraft.name);
  const [session, setSession] = useState<EditorSessionState>(() => mapDraftToState(initialDraft));
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<ExerciseSheetTarget | null>(null);

  const hasNamedExercises = session.exercises.some((exercise) => exercise.name.trim().length > 0);
  const canSave = name.trim().length > 0 && hasNamedExercises;

  useEffect(() => {
    setName(initialDraft.name);
    setSession(mapDraftToState(initialDraft));
    setShowAddExercise(false);
    setSheetTarget(null);
  }, [initialDraft]);

  const rows = useMemo(
    () => buildEditorTableRows(session.exercises, exerciseHistoryLookup),
    [exerciseHistoryLookup, session.exercises],
  );

  const sessionLibraryIds = useMemo(
    () =>
      session.exercises
        .map((exercise) => exercise.libraryItemId)
        .filter((value): value is string => Boolean(value)),
    [session.exercises],
  );

  function updateExercise(localKey: string, patch: Partial<EditorExerciseState>) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.localKey === localKey ? { ...exercise, ...patch } : exercise,
      ),
    }));
  }

  function appendExerciseRow(item?: ExerciseLibraryItem) {
    const nextExercise = createExerciseState(defaultRestSeconds, item);
    setSession((current) => ({
      ...current,
      exercises: [...current.exercises, nextExercise],
    }));
  }

  function fillExerciseFromLibrary(rowKey: string, item: ExerciseLibraryItem) {
    updateExercise(rowKey, buildEditorExercisePatchFromLibraryItem(item, defaultRestSeconds));
  }

  function removeExercise(localKey: string) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.localKey !== localKey),
    }));
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    const exercisesToSave = session.exercises.filter((exercise) => exercise.name.trim().length > 0);
    const persistedSessionName = buildPersistedSessionNames(
      [
        {
          exerciseNames: exercisesToSave.map((exercise) => exercise.name),
        },
      ],
      name.trim(),
    )[0];

    await onSave({
      id: initialDraft.id,
      name: name.trim(),
      sessions: [
        {
          id: session.id,
          name: persistedSessionName,
          exercises: exercisesToSave.map((exercise) => {
            const { repMin, repMax } = parseDraftRepRangeInput(exercise.repRangeText);
            const parsedRepMin = Math.max(1, Math.round(parseNumberInput(repMin) ?? 6));
            const parsedRepMax = Math.max(parsedRepMin, Math.round(parseNumberInput(repMax) ?? 8));

            return {
              id: exercise.id,
              name: exercise.name.trim(),
              targetSets: Math.max(1, Math.round(parseNumberInput(exercise.targetSets) ?? 3)),
              repMin: parsedRepMin,
              repMax: parsedRepMax,
              restSeconds: parseNumberInput(exercise.restSeconds)
                ? Math.round(parseNumberInput(exercise.restSeconds) ?? 0)
                : null,
              trackedDefault: exercise.trackedDefault,
              libraryItemId: exercise.libraryItemId ?? null,
            };
          }),
        },
      ],
    });
  }

  const sheetTitle = sheetTarget?.mode === 'fill-row' ? 'Pick exercise' : 'Add exercise';
  const sheetSubtitle =
    sheetTarget?.mode === 'fill-row'
      ? 'Use the library to fill the selected row quickly.'
      : 'Add a new row to this workout.';
  const sheetActionLabel = sheetTarget?.mode === 'fill-row' ? 'Use' : 'Add row';

  return (
    <>
      <ScreenHeader
        title={initialDraft.id ? 'Edit workout' : 'New workout'}
        subtitle="One workout, one table. Add the main lift first, then fill the rest below it."
        onBack={onBack}
        rightActionLabel="Save"
        onRightActionPress={handleSave}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {inlineTip ? (
          <InlineTip
            title={inlineTip.title}
            body={inlineTip.body}
            accent={inlineTip.accent}
            onDismiss={inlineTip.onDismiss}
          />
        ) : null}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Workout name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
            selectionColor={colors.accent}
          />
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeaderCopy}>
            <Text style={styles.tableTitle}>Exercise table</Text>
            <Text style={styles.tableSubtitle}>
              Put the exercise name first. Sets, reps, rest, and history stay grouped below each row.
            </Text>
          </View>

          <View style={styles.tableActionRow}>
            <Pressable onPress={() => appendExerciseRow()} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Row</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSheetTarget({ mode: 'append' });
                setShowAddExercise(true);
              }}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>From library</Text>
            </Pressable>
          </View>

          {rows.length ? (
            <View style={styles.rowsList}>
              {rows.map((row, rowIndex) => {
                const exercise = session.exercises[rowIndex];
                return (
                  <View key={row.key} style={styles.exerciseRowCard}>
                    <View style={styles.exerciseTopRow}>
                      <View style={styles.exerciseNameCell}>
                        <Text style={styles.metricLabel}>Liike</Text>
                        <TextInput
                          value={exercise.name}
                          onChangeText={(value) =>
                            updateExercise(exercise.localKey, {
                              name: value,
                              libraryItemId: null,
                            })
                          }
                          placeholder="Write exercise"
                          placeholderTextColor={colors.textMuted}
                          selectionColor={colors.accent}
                          style={styles.exerciseInput}
                        />
                      </View>

                      <Pressable
                        onPress={() => {
                          setSheetTarget({ rowKey: exercise.localKey, mode: 'fill-row' });
                          setShowAddExercise(true);
                        }}
                        style={styles.inlineLibraryButton}
                      >
                        <Text style={styles.inlineLibraryButtonText}>{row.source === 'library-backed' ? 'Swap' : 'Lib'}</Text>
                      </Pressable>

                      <Pressable onPress={() => removeExercise(exercise.localKey)} style={styles.removeRowButton}>
                        <Text style={styles.removeRowButtonText}>x</Text>
                      </Pressable>
                    </View>

                    <View style={styles.metricsGrid}>
                      <MetricInputField
                        label="Sarjat"
                        value={exercise.targetSets}
                        placeholder="3"
                        onChangeText={(value) => updateExercise(exercise.localKey, { targetSets: value })}
                      />
                      <MetricInputField
                        label="Toistot"
                        value={exercise.repRangeText}
                        placeholder="6-8"
                        onChangeText={(value) => updateExercise(exercise.localKey, { repRangeText: value })}
                      />
                      <MetricInputField
                        label="Palautus"
                        value={exercise.restSeconds}
                        placeholder="120"
                        onChangeText={(value) => updateExercise(exercise.localKey, { restSeconds: value })}
                      />
                      <MetricReadonlyField label={`Viime ${unitPreference}`} value={row.history.lastWeight} />
                      <MetricReadonlyField label="Viime toistot" value={row.history.lastReps} />

                      <View style={styles.metricField}>
                        <Text style={styles.metricLabel}>Tracked</Text>
                        <Pressable
                          onPress={() =>
                            updateExercise(exercise.localKey, {
                              trackedDefault: !exercise.trackedDefault,
                            })
                          }
                          style={[
                            styles.trackedPill,
                            exercise.trackedDefault ? styles.trackedPillActive : styles.trackedPillInactive,
                          ]}
                        >
                          <Text style={[styles.trackedPillText, exercise.trackedDefault && styles.trackedPillTextActive]}>
                            {exercise.trackedDefault ? 'Tracked' : 'Track'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTableState}>
              <Text style={styles.emptyTableTitle}>No rows yet</Text>
              <Text style={styles.emptyTableText}>Use + Row for a blank line or From library to pull in a movement with defaults.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleSave} style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonText}>{initialDraft.id ? 'Save workout' : 'Create workout'}</Text>
        </Pressable>
      </View>

      <AddExerciseSheet
        visible={showAddExercise}
        items={exerciseLibrary}
        recentItems={recentExerciseLibraryItems}
        currentItemIds={sessionLibraryIds}
        selectedIds={[]}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        actionLabel={sheetActionLabel}
        autoFocusSearch
        onClose={() => {
          setShowAddExercise(false);
          setSheetTarget(null);
        }}
        onSelectItem={(item) => {
          if (!sheetTarget) {
            setShowAddExercise(false);
            return;
          }

          if (sheetTarget.mode === 'fill-row' && sheetTarget.rowKey) {
            fillExerciseFromLibrary(sheetTarget.rowKey, item);
          } else {
            appendExerciseRow(item);
          }

          setShowAddExercise(false);
          setSheetTarget(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 112,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nameInput: {
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  tableCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  tableHeaderCopy: {
    gap: 4,
  },
  tableTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  tableSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  tableActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  addButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  rowsList: {
    gap: spacing.sm,
  },
  exerciseRowCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  exerciseNameCell: {
    flex: 1,
    minHeight: 76,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  exerciseInput: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },
  inlineLibraryButton: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.22)',
    backgroundColor: colors.input,
  },
  inlineLibraryButtonText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  removeRowButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.18)',
  },
  removeRowButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metricField: {
    width: '31.5%',
    minHeight: 76,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
  },
  readonlyMetricBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyMetricValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  trackedPill: {
    flex: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 40,
  },
  trackedPillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(110, 168, 254, 0.24)',
  },
  trackedPillInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  trackedPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  trackedPillTextActive: {
    color: colors.textPrimary,
  },
  emptyTableState: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTableTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyTableText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + spacing.xs,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(11, 13, 16, 0.94)',
  },
  saveButton: {
    minHeight: 58,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
});

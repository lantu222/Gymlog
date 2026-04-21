import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { InlineTip } from '../components/InlineTip';
import { ScreenHeader } from '../components/ScreenHeader';
import { SurfaceAccent } from '../components/MainScreenPrimitives';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { parseNumberInput } from '../lib/format';
import { createId } from '../lib/ids';
import {
  ExercisePrLookup,
  resolvePreviousExercisePr,
  WorkoutCompletionExerciseCard,
  WorkoutCompletionPrCard,
  estimateOneRepMaxKg,
} from '../lib/workoutCompletionSummary';
import { buildPersistedSessionNames } from '../lib/workoutEditorNaming';
import {
  buildEditorExercisePatchFromLibraryItem,
  EditorExerciseHistoryLookup,
  formatDraftRepRange,
  parseDraftRepRangeInput,
} from '../lib/workoutEditorTable';
import { radii, spacing } from '../theme';
import { ExerciseLibraryItem, ExerciseLogDraft, UnitPreference, WorkoutTemplateDraft } from '../types/models';

interface EditorSetState {
  localKey: string;
  kg: string;
  reps: string;
  done: boolean;
}

interface EditorExerciseState {
  localKey: string;
  id?: string;
  name: string;
  targetSets: string;
  repRangeText: string;
  restSeconds: string;
  trackedDefault: boolean;
  libraryItemId?: string | null;
  notes: string;
  setEntries: EditorSetState[];
}

interface EditorSessionState {
  localKey: string;
  id?: string;
  exercises: EditorExerciseState[];
}

export interface WorkoutEditorFinishSummary {
  workoutName: string;
  startedAt: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  logs: ExerciseLogDraft[];
}

function isWorkoutCompletionPrCard(
  card: WorkoutCompletionPrCard | null,
): card is WorkoutCompletionPrCard {
  return card !== null;
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
  exercisePrLookup: ExercisePrLookup;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft, summary: WorkoutEditorFinishSummary) => Promise<void> | void;
  onUseTemplate?: () => void;
  inlineTip?: {
    title: string;
    body: string;
    accent?: SurfaceAccent;
    onDismiss: () => void;
  } | null;
}

function createSetEntry(): EditorSetState {
  return {
    localKey: createId('set'),
    kg: '',
    reps: '',
    done: false,
  };
}

function buildInitialSetEntries(count: number) {
  return Array.from({ length: Math.max(1, Math.round(count)) }, () => createSetEntry());
}

function buildExerciseLogDraftsFromEditorState(exercises: EditorExerciseState[]): ExerciseLogDraft[] {
  return exercises
    .filter((exercise) => exercise.name.trim().length > 0)
    .map((exercise, orderIndex) => {
      const sets = exercise.setEntries.map((entry, setIndex) => ({
        orderIndex: setIndex,
        weight: parseNumberInput(entry.kg) ?? 0,
        reps: parseNumberInput(entry.reps) ?? 0,
        kind: 'working' as const,
        outcome: entry.done ? ('completed' as const) : null,
        status: entry.done ? ('completed' as const) : ('pending' as const),
        effort: null,
        completedAt: entry.done ? new Date().toISOString() : null,
        skippedReason: null,
      }));

      return {
        exerciseTemplateId: null,
        exerciseNameSnapshot: exercise.name.trim(),
        sets,
        tracked: exercise.trackedDefault,
        orderIndex,
        skipped: false,
        sessionInserted: true,
        status: sets.some((set) => set.status === 'completed') ? ('completed' as const) : ('active' as const),
        slotId: exercise.localKey,
        templateSlotId: null,
        templateExerciseId: null,
        notes: exercise.notes?.trim() ? exercise.notes.trim() : null,
        swappedFrom: null,
      };
    });
}

function createExerciseState(defaultRestSeconds: number, item?: ExerciseLibraryItem): EditorExerciseState {
  const targetSets = '3';

  if (item) {
    return {
      localKey: createId('draft'),
      ...buildEditorExercisePatchFromLibraryItem(item, defaultRestSeconds),
      targetSets,
      notes: '',
      setEntries: buildInitialSetEntries(parseNumberInput(targetSets) ?? 3),
    };
  }

  return {
    localKey: createId('draft'),
    name: '',
    targetSets,
    repRangeText: '6-8',
    restSeconds: `${defaultRestSeconds}`,
    trackedDefault: true,
    libraryItemId: null,
    notes: '',
    setEntries: buildInitialSetEntries(parseNumberInput(targetSets) ?? 3),
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
      notes: '',
      setEntries: buildInitialSetEntries(exercise.targetSets),
    })),
  };
}

function shortenExerciseName(value: string) {
  const label = formatLiftDisplayLabel(value, 'Exercise');
  return label.length > 34 ? `${label.slice(0, 31).trimEnd()}...` : label;
}

function formatElapsedTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  }

  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

export function WorkoutEditorScreen({
  initialDraft,
  exerciseLibrary,
  recentExerciseLibraryItems,
  defaultRestSeconds,
  onBack,
  onSave,
  inlineTip,
  exercisePrLookup,
}: WorkoutEditorScreenProps) {
  const [session, setSession] = useState<EditorSessionState>(() => mapDraftToState(initialDraft));
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<ExerciseSheetTarget | null>(null);
  const [activeRowMenuKey, setActiveRowMenuKey] = useState<string | null>(null);
  const [instructionItemId, setInstructionItemId] = useState<string | null>(null);
  const [notesExerciseKey, setNotesExerciseKey] = useState<string | null>(null);
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const hasExercises = session.exercises.length > 0;
  const hasNamedExercises = session.exercises.some((exercise) => exercise.name.trim().length > 0);
  const canSave = hasNamedExercises;

  useEffect(() => {
    const nextState = mapDraftToState(initialDraft);
    setSession(nextState);
    setShowAddExercise(false);
    setSheetTarget(null);
    setActiveRowMenuKey(null);
    setInstructionItemId(null);
    setNotesExerciseKey(null);
    setExpandedExerciseKey(nextState.exercises[0]?.localKey ?? null);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
  }, [initialDraft]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const sessionLibraryIds = useMemo(
    () =>
      session.exercises
        .map((exercise) => exercise.libraryItemId)
        .filter((value): value is string => Boolean(value)),
    [session.exercises],
  );

  const exerciseLibraryMap = useMemo(
    () => new Map(exerciseLibrary.map((item) => [item.id, item])),
    [exerciseLibrary],
  );

  const instructionItem = useMemo(
    () => exerciseLibrary.find((item) => item.id === instructionItemId) ?? null,
    [exerciseLibrary, instructionItemId],
  );

  const notesExercise = useMemo(
    () => session.exercises.find((exercise) => exercise.localKey === notesExerciseKey) ?? null,
    [notesExerciseKey, session.exercises],
  );

  function updateExercise(localKey: string, patch: Partial<EditorExerciseState>) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.localKey === localKey ? { ...exercise, ...patch } : exercise,
      ),
    }));
  }

  function updateSetEntry(exerciseKey: string, setKey: string, patch: Partial<EditorSetState>) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.localKey === exerciseKey
          ? {
              ...exercise,
              setEntries: exercise.setEntries.map((entry) =>
                entry.localKey === setKey ? { ...entry, ...patch } : entry,
              ),
            }
          : exercise,
      ),
    }));
  }

  function addSetEntry(exerciseKey: string) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.localKey === exerciseKey
          ? {
              ...exercise,
              targetSets: `${exercise.setEntries.length + 1}`,
              setEntries: [...exercise.setEntries, createSetEntry()],
            }
          : exercise,
      ),
    }));
  }

  function openLibraryForAppend() {
    setSheetTarget({ mode: 'append' });
    setShowAddExercise(true);
  }

  function appendExercises(items: ExerciseLibraryItem[]) {
    if (!items.length) {
      return;
    }

    const nextExercises = items.map((item) => createExerciseState(defaultRestSeconds, item));
    setSession((current) => ({
      ...current,
      exercises: [...current.exercises, ...nextExercises],
    }));
    setExpandedExerciseKey(nextExercises[0]?.localKey ?? null);
  }

  function fillExerciseFromLibrary(rowKey: string, item: ExerciseLibraryItem) {
    updateExercise(rowKey, buildEditorExercisePatchFromLibraryItem(item, defaultRestSeconds));
    setExpandedExerciseKey(rowKey);
  }

  function removeExercise(localKey: string) {
    setSession((current) => {
      const nextExercises = current.exercises.filter((exercise) => exercise.localKey !== localKey);
      return {
        ...current,
        exercises: nextExercises,
      };
    });
    setExpandedExerciseKey((current) =>
      current === localKey ? session.exercises.find((exercise) => exercise.localKey !== localKey)?.localKey ?? null : current,
    );
  }

  function openReplaceExercise(localKey: string) {
    setActiveRowMenuKey(null);
    setSheetTarget({ rowKey: localKey, mode: 'fill-row' });
    setShowAddExercise(true);
  }

  function openInstructions(libraryItemId?: string | null) {
    setActiveRowMenuKey(null);
    if (!libraryItemId) {
      setInstructionItemId('missing');
      return;
    }
    setInstructionItemId(libraryItemId);
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    const exercisesToSave = session.exercises.filter((exercise) => exercise.name.trim().length > 0);
    const workoutName = initialDraft.name?.trim() || 'Empty workout';
    const performedAt = new Date().toISOString();
    const setsCompleted = exercisesToSave.reduce(
      (total, exercise) => total + exercise.setEntries.filter((entry) => entry.done).length,
      0,
    );
    const totalVolume = exercisesToSave.reduce(
      (total, exercise) =>
        total +
        exercise.setEntries.reduce((exerciseTotal, entry) => {
          if (!entry.done) {
            return exerciseTotal;
          }
          const kg = parseNumberInput(entry.kg) ?? 0;
          const reps = parseNumberInput(entry.reps) ?? 0;
          return exerciseTotal + kg * reps;
        }, 0),
      0,
    );
    const exerciseCards: WorkoutCompletionExerciseCard[] = exercisesToSave.map((exercise) => {
      const libraryItem = exercise.libraryItemId ? exerciseLibraryMap.get(exercise.libraryItemId) ?? null : null;
      const completedSets = exercise.setEntries.filter((entry) => entry.done).length;
      const exerciseVolume = exercise.setEntries.reduce((exerciseTotal, entry) => {
        if (!entry.done) {
          return exerciseTotal;
        }
        const kg = parseNumberInput(entry.kg) ?? 0;
        const reps = parseNumberInput(entry.reps) ?? 0;
        return exerciseTotal + kg * reps;
      }, 0);

      return {
        id: exercise.localKey,
        name: exercise.name.trim(),
        imageUrl: libraryItem?.imageUrls?.[0] ?? null,
        completedSets,
        totalSets: Math.max(1, exercise.setEntries.length),
        totalVolumeKg: exerciseVolume,
        notes: exercise.notes?.trim() ? exercise.notes.trim() : null,
      };
    });

    const prCards: WorkoutCompletionPrCard[] = exercisesToSave
      .map((exercise): WorkoutCompletionPrCard | null => {
        const libraryItem = exercise.libraryItemId ? exerciseLibraryMap.get(exercise.libraryItemId) ?? null : null;
        const bestSet = exercise.setEntries.reduce<{
          estimatedOneRepMaxKg: number;
          performedWeightKg: number;
          performedReps: number;
        } | null>((best, entry) => {
          if (!entry.done) {
            return best;
          }

          const weightKg = parseNumberInput(entry.kg);
          const reps = parseNumberInput(entry.reps);
          if (weightKg === null || reps === null) {
            return best;
          }

          const estimate = estimateOneRepMaxKg(weightKg, reps);
          if (estimate === null) {
            return best;
          }

          if (!best || estimate > best.estimatedOneRepMaxKg) {
            return {
              estimatedOneRepMaxKg: estimate,
              performedWeightKg: weightKg,
              performedReps: reps,
            };
          }

          return best;
        }, null);

        if (!bestSet) {
          return null;
        }

        const previousBestOneRepMaxKg = resolvePreviousExercisePr({
          libraryItemId: exercise.libraryItemId ?? null,
          exerciseName: exercise.name,
          lookup: exercisePrLookup,
        });

        if (
          previousBestOneRepMaxKg !== null &&
          bestSet.estimatedOneRepMaxKg <= previousBestOneRepMaxKg + 0.05
        ) {
          return null;
        }

        return {
          id: `pr:${exercise.localKey}`,
          exerciseName: exercise.name.trim(),
          imageUrl: libraryItem?.imageUrls?.[0] ?? null,
          estimatedOneRepMaxKg: bestSet.estimatedOneRepMaxKg,
          previousBestOneRepMaxKg,
          performedWeightKg: bestSet.performedWeightKg,
          performedReps: bestSet.performedReps,
        };
      })
      .filter(isWorkoutCompletionPrCard)
      .slice(0, 3);
    const persistedSessionName = buildPersistedSessionNames(
      [
        {
          exerciseNames: exercisesToSave.map((exercise) => exercise.name),
        },
      ],
      workoutName,
    )[0];

    await onSave(
      {
        id: initialDraft.id,
        name: workoutName,
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
                targetSets: Math.max(1, exercise.setEntries.length),
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
      },
      {
        workoutName,
        startedAt: new Date(startedAt).toISOString(),
        performedAt,
        durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
        setsCompleted,
        totalVolume,
        exercisesLogged: exercisesToSave.length,
        exerciseCards,
        prCards,
        logs: buildExerciseLogDraftsFromEditorState(exercisesToSave),
      },
    );
  }

  const sheetTitle = sheetTarget?.mode === 'fill-row' ? 'Pick exercise' : 'Add exercise';
  const sheetSubtitle =
    sheetTarget?.mode === 'fill-row'
      ? 'Use the library to replace the selected lift.'
      : 'Add the next lift to this workout.';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title=""
        subtitle={hasExercises ? undefined : 'Start simple. Add the first lift, then build the rest as you go.'}
        onBack={onBack}
        rightActionLabel={hasExercises ? 'Finish' : undefined}
        onRightActionPress={handleSave}
        tone="dark"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!hasExercises && inlineTip ? (
          <InlineTip
            title={inlineTip.title}
            body={inlineTip.body}
            accent={inlineTip.accent}
            onDismiss={inlineTip.onDismiss}
          />
        ) : null}

        {!hasExercises ? (
          <View style={styles.startCard}>
            <Text style={styles.startKicker}>Quick start</Text>
            <Text style={styles.startTitle}>Add your first exercise</Text>
            <Text style={styles.startBody}>
              Pick one or more lifts. The full workout builder opens after you add them.
            </Text>

            <Pressable onPress={openLibraryForAppend} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Add exercise</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sessionStatsCard}>
              <Text style={styles.sessionStatLabel}>Duration</Text>
              <Text style={styles.sessionStatValue}>{formatElapsedTime(elapsedSeconds)}</Text>
            </View>

            <View style={styles.exerciseList}>
              {session.exercises.map((exercise) => {
                const libraryItem = exercise.libraryItemId ? exerciseLibraryMap.get(exercise.libraryItemId) ?? null : null;
                const previewImage = libraryItem?.imageUrls?.[0] ?? null;
                const doneCount = exercise.setEntries.filter((entry) => entry.done).length;
                const doneLabel = `${doneCount}/${Math.max(1, exercise.setEntries.length)} Done`;
                const isExpanded = expandedExerciseKey === exercise.localKey;

                return (
                  <View key={exercise.localKey} style={styles.exerciseRowCard}>
                    <Pressable
                      onPress={() =>
                        setExpandedExerciseKey((current) =>
                          current === exercise.localKey ? null : exercise.localKey,
                        )
                      }
                      style={styles.exerciseTopRow}
                    >
                      <View style={styles.exerciseLeadRow}>
                        <View style={styles.exerciseThumb}>
                          {previewImage ? (
                            <Image source={{ uri: previewImage }} style={styles.exerciseThumbImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.exerciseThumbFallback}>
                              <Text style={styles.exerciseThumbFallbackText}>
                                {exercise.name.trim().charAt(0).toUpperCase() || 'E'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.exerciseNameCell}>
                          {exercise.libraryItemId ? (
                            <Text style={styles.exerciseNameText}>{shortenExerciseName(exercise.name)}</Text>
                          ) : (
                            <TextInput
                              value={exercise.name}
                              onChangeText={(value) =>
                                updateExercise(exercise.localKey, {
                                  name: value,
                                  libraryItemId: null,
                                })
                              }
                              placeholder="Write exercise"
                              placeholderTextColor="#9CA3AF"
                              selectionColor="#111111"
                              style={styles.exerciseInput}
                            />
                          )}
                          <Text style={styles.exerciseMetaText}>{doneLabel}</Text>
                        </View>
                      </View>

                      <View style={styles.rowMenuWrap}>
                        <Pressable
                          onPress={() =>
                            setActiveRowMenuKey((current) =>
                              current === exercise.localKey ? null : exercise.localKey,
                            )
                          }
                          style={styles.rowMenuButton}
                        >
                          <Text style={styles.rowMenuButtonText}>...</Text>
                        </Pressable>

                        {activeRowMenuKey === exercise.localKey ? (
                          <View style={styles.rowMenu}>
                            <Pressable onPress={() => openReplaceExercise(exercise.localKey)} style={styles.rowMenuItem}>
                              <Text style={styles.rowMenuItemText}>Replace exercise</Text>
                            </Pressable>
                            <Pressable onPress={() => openInstructions(exercise.libraryItemId)} style={styles.rowMenuItem}>
                              <Text style={styles.rowMenuItemText}>Instructions</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setActiveRowMenuKey(null);
                                setNotesExerciseKey(exercise.localKey);
                              }}
                              style={styles.rowMenuItem}
                            >
                              <Text style={styles.rowMenuItemText}>Notes</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setActiveRowMenuKey(null);
                                removeExercise(exercise.localKey);
                              }}
                              style={styles.rowMenuItem}
                            >
                              <Text style={styles.rowMenuItemDanger}>Delete exercise</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.expandedExercise}>
                        <View style={styles.restRow}>
                          <Text style={styles.restLabel}>Rest timer</Text>
                          <TextInput
                            value={exercise.restSeconds}
                            onChangeText={(value) => updateExercise(exercise.localKey, { restSeconds: value })}
                            placeholder={`${defaultRestSeconds}`}
                            placeholderTextColor="#9CA3AF"
                            selectionColor="#111111"
                            keyboardType="number-pad"
                            style={styles.restInput}
                          />
                          <Text style={styles.restSuffix}>sec</Text>
                        </View>

                        <View style={styles.setHeaderRow}>
                          <Text style={styles.setHeaderCell}>Set</Text>
                          <Text style={styles.setHeaderCell}>Kg</Text>
                          <Text style={styles.setHeaderCell}>Reps</Text>
                          <Text style={styles.setHeaderCell}>Check</Text>
                        </View>

                        {exercise.setEntries.map((entry, setIndex) => (
                          <View key={entry.localKey} style={styles.setRow}>
                            <Text style={styles.setIndex}>{setIndex + 1}</Text>
                            <TextInput
                              value={entry.kg}
                              onChangeText={(value) => updateSetEntry(exercise.localKey, entry.localKey, { kg: value })}
                              placeholder="-"
                              placeholderTextColor="#9CA3AF"
                              selectionColor="#111111"
                              keyboardType="numbers-and-punctuation"
                              style={styles.setInput}
                            />
                            <TextInput
                              value={entry.reps}
                              onChangeText={(value) => updateSetEntry(exercise.localKey, entry.localKey, { reps: value })}
                              placeholder="-"
                              placeholderTextColor="#9CA3AF"
                              selectionColor="#111111"
                              keyboardType="numbers-and-punctuation"
                              style={styles.setInput}
                            />
                            <Pressable
                              onPress={() => updateSetEntry(exercise.localKey, entry.localKey, { done: !entry.done })}
                              style={[styles.setCheck, entry.done && styles.setCheckDone]}
                            >
                              <Text style={[styles.setCheckText, entry.done && styles.setCheckTextDone]}>✓</Text>
                            </Pressable>
                          </View>
                        ))}

                        <Pressable onPress={() => addSetEntry(exercise.localKey)} style={styles.addSetButton}>
                          <Text style={styles.addSetButtonText}>+ Add set</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Pressable onPress={openLibraryForAppend} style={styles.addExercisesButton}>
              <Text style={styles.addExercisesButtonText}>Add exercises</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <AddExerciseSheet
        visible={showAddExercise}
        items={exerciseLibrary}
        recentItems={recentExerciseLibraryItems}
        currentItemIds={sessionLibraryIds}
        selectedIds={[]}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        actionLabel="Add"
        autoFocusSearch
        multiSelect={sheetTarget?.mode === 'append'}
        onClose={() => {
          setShowAddExercise(false);
          setSheetTarget(null);
        }}
        onConfirmSelection={(items) => {
          appendExercises(items);
          setShowAddExercise(false);
          setSheetTarget(null);
          setActiveRowMenuKey(null);
        }}
        onSelectItem={(item) => {
          if (!sheetTarget?.rowKey) {
            return;
          }
          fillExerciseFromLibrary(sheetTarget.rowKey, item);
          setShowAddExercise(false);
          setSheetTarget(null);
          setActiveRowMenuKey(null);
        }}
      />

      <Modal
        visible={instructionItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInstructionItemId(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInstructionItemId(null)} />
          <View style={styles.instructionsModal}>
            <View style={styles.instructionsHeader}>
              <View style={styles.instructionsHeaderCopy}>
                <Text style={styles.instructionsTitle}>{instructionItem?.name ?? 'Instructions'}</Text>
                <Text style={styles.instructionsSubtitle}>How to perform the lift.</Text>
              </View>
              <Pressable onPress={() => setInstructionItemId(null)} style={styles.instructionsCloseButton}>
                <Text style={styles.instructionsCloseButtonText}>X</Text>
              </Pressable>
            </View>

            {instructionItem?.instructions?.length ? (
              <View style={styles.instructionsList}>
                {instructionItem.instructions.map((step, index) => (
                  <View key={`${instructionItem.id}-step-${index}`} style={styles.instructionsStep}>
                    <View style={styles.instructionsStepDot} />
                    <Text style={styles.instructionsStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.instructionsEmptyText}>No instructions available yet for this exercise.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={notesExerciseKey !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesExerciseKey(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNotesExerciseKey(null)} />
          <View style={styles.notesModal}>
            <View style={styles.instructionsHeader}>
              <View style={styles.instructionsHeaderCopy}>
                <Text style={styles.instructionsTitle}>{notesExercise?.name ?? 'Notes'}</Text>
                <Text style={styles.instructionsSubtitle}>Keep a short note for this exercise.</Text>
              </View>
              <Pressable onPress={() => setNotesExerciseKey(null)} style={styles.instructionsCloseButton}>
                <Text style={styles.instructionsCloseButtonText}>X</Text>
              </Pressable>
            </View>

            <TextInput
              value={notesExercise?.notes ?? ''}
              onChangeText={(value) => {
                if (notesExercise) {
                  updateExercise(notesExercise.localKey, { notes: value });
                }
              }}
              placeholder="Notes..."
              placeholderTextColor="#9CA3AF"
              selectionColor="#111111"
              multiline
              style={styles.notesModalInput}
            />
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.xxl + 48,
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  startCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  startKicker: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  startTitle: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  startBody: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  primaryAction: {
    minHeight: 58,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    marginTop: spacing.xs,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sessionStatsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionStatLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sessionStatValue: {
    color: '#2563EB',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  exerciseList: {
    gap: spacing.md,
  },
  exerciseRowCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.md,
  },
  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  exerciseLeadRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  exerciseThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exerciseThumbImage: {
    width: '100%',
    height: '100%',
  },
  exerciseThumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  exerciseThumbFallbackText: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  exerciseNameCell: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  exerciseNameText: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  exerciseInput: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
    paddingVertical: 0,
  },
  exerciseMetaText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  rowMenuWrap: {
    position: 'relative',
    zIndex: 3,
  },
  rowMenuButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMenuButtonText: {
    color: '#16A34A',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
  },
  rowMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    width: 188,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  rowMenuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowMenuItemText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  rowMenuItemDanger: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  expandedExercise: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  restLabel: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  restInput: {
    minWidth: 64,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  restSuffix: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setHeaderCell: {
    flex: 1,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setIndex: {
    width: 44,
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
  },
  setInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  setCheck: {
    width: 42,
    height: 42,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCheckDone: {
    backgroundColor: '#E8F7EE',
    borderColor: '#22C55E',
  },
  setCheckText: {
    color: '#D1D5DB',
    fontSize: 18,
    fontWeight: '900',
  },
  setCheckTextDone: {
    color: '#16A34A',
  },
  addSetButton: {
    minHeight: 46,
    borderRadius: radii.pill,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetButtonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
  },
  addExercisesButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExercisesButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.24)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  instructionsModal: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  instructionsHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  instructionsTitle: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  instructionsSubtitle: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  instructionsCloseButtonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  instructionsList: {
    gap: spacing.md,
  },
  instructionsStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  instructionsStepDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    marginTop: 8,
  },
  instructionsStepText: {
    flex: 1,
    color: '#111111',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  instructionsEmptyText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  notesModal: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  notesModalInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radii.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    color: '#111111',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});

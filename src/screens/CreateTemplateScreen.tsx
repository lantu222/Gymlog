import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { getExerciseTemplateDefaults } from '../lib/exerciseSuggestions';
import { createId } from '../lib/ids';
import { layout, radii, spacing } from '../theme';
import { ExerciseLibraryItem, ExerciseTemplateDraft, WorkoutTemplateDraft } from '../types/models';

type TemplateDayCount = 1 | 2 | 3 | 4 | 5;

interface TemplateExerciseState extends ExerciseTemplateDraft {
  localKey: string;
}

interface TemplateSessionState {
  localKey: string;
  id?: string;
  name: string;
  exercises: TemplateExerciseState[];
}

interface SplitPreset {
  id: string;
  label: string;
  description: string;
  names: string[];
  previewKeywords: string[];
}

interface CreateTemplateScreenProps {
  initialDraft: WorkoutTemplateDraft;
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

const DAY_OPTIONS: TemplateDayCount[] = [1, 2, 3, 4, 5];

const SPLIT_PRESETS: Record<TemplateDayCount, SplitPreset[]> = {
  1: [
    {
      id: 'single_full_body',
      label: 'Full body',
      description: 'One reusable full-body day.',
      names: ['Full Body'],
      previewKeywords: ['squat', 'bench', 'row'],
    },
    {
      id: 'single_upper',
      label: 'Upper focus',
      description: 'One upper-body day.',
      names: ['Upper Focus'],
      previewKeywords: ['bench', 'pulldown', 'row'],
    },
  ],
  2: [
    {
      id: 'upper_lower',
      label: 'Upper / Lower',
      description: 'Classic two-day split.',
      names: ['Upper', 'Lower'],
      previewKeywords: ['bench', 'squat'],
    },
    {
      id: 'push_pull',
      label: 'Push / Pull',
      description: 'Push and pull rotation.',
      names: ['Push', 'Pull'],
      previewKeywords: ['press', 'row', 'pulldown'],
    },
  ],
  3: [
    {
      id: 'push_pull_legs',
      label: 'Push / Pull / Legs',
      description: 'Three-day balanced split.',
      names: ['Push', 'Pull', 'Legs'],
      previewKeywords: ['bench', 'row', 'leg'],
    },
    {
      id: 'full_body_abc',
      label: 'Full body A/B/C',
      description: 'Three full-body sessions.',
      names: ['Full Body A', 'Full Body B', 'Full Body C'],
      previewKeywords: ['squat', 'bench', 'deadlift'],
    },
  ],
  4: [
    {
      id: 'upper_lower_heavy_pump',
      label: 'Upper / Lower x2',
      description: 'Heavy and pump rotation.',
      names: ['Upper Heavy', 'Lower Heavy', 'Upper Pump', 'Lower Pump'],
      previewKeywords: ['bench', 'squat', 'curl', 'lunge'],
    },
    {
      id: 'body_part_4',
      label: 'Body-part split',
      description: 'Four focused muscle days.',
      names: ['Chest / Triceps', 'Back / Biceps', 'Legs / Glutes', 'Shoulders / Arms'],
      previewKeywords: ['chest', 'back', 'leg', 'shoulder'],
    },
  ],
  5: [
    {
      id: 'body_part_5',
      label: 'Body-part split',
      description: 'Five focused sessions.',
      names: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
      previewKeywords: ['chest', 'back', 'leg', 'shoulder', 'curl'],
    },
    {
      id: 'strength_5',
      label: 'Strength mix',
      description: 'Upper / lower plus volume days.',
      names: ['Upper Strength', 'Lower Strength', 'Push Volume', 'Pull Volume', 'Legs Volume'],
      previewKeywords: ['bench', 'squat', 'press', 'row'],
    },
  ],
};

function clampDayCount(value: number): TemplateDayCount {
  if (value <= 1) {
    return 1;
  }
  if (value >= 5) {
    return 5;
  }
  return value as TemplateDayCount;
}

function createBlankSession(index: number): TemplateSessionState {
  return {
    localKey: createId('template_session'),
    name: `Day ${index + 1}`,
    exercises: [],
  };
}

function createExerciseFromLibraryItem(
  item: ExerciseLibraryItem,
  defaultRestSeconds: number,
): TemplateExerciseState {
  const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);

  return {
    localKey: createId('template_exercise'),
    name: item.name,
    targetSets: defaults.targetSets,
    repMin: defaults.repMin,
    repMax: defaults.repMax,
    restSeconds: defaults.restSeconds,
    trackedDefault: defaults.trackedDefault,
    libraryItemId: item.id,
  };
}

function mapDraftToSessions(draft: WorkoutTemplateDraft): TemplateSessionState[] {
  if (Array.isArray(draft.sessions) && draft.sessions.length > 0) {
    return draft.sessions.map((session, index) => ({
      localKey: session.id ?? createId('template_session'),
      id: session.id,
      name: session.name.trim() || `Day ${index + 1}`,
      exercises: (session.exercises ?? []).map((exercise) => ({
        localKey: exercise.id ?? createId('template_exercise'),
        ...exercise,
      })),
    }));
  }

  return [createBlankSession(0)];
}

function buildTemplateDraft(
  name: string,
  sessions: TemplateSessionState[],
  initialDraft: WorkoutTemplateDraft,
): WorkoutTemplateDraft {
  return {
    id: initialDraft.id,
    name: name.trim() || 'New template',
    sessions: sessions.map((session, index) => ({
      id: session.id,
      name: session.name.trim() || `Day ${index + 1}`,
      exercises: session.exercises.map(({ localKey: _localKey, ...exercise }) => exercise),
    })),
  };
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function resolvePresetPreviewImage(preset: SplitPreset, exerciseLibrary: ExerciseLibraryItem[]) {
  const normalizedKeywords = preset.previewKeywords.map((keyword) => keyword.toLowerCase());

  for (const item of exerciseLibrary) {
    const imageUrl = item.imageUrls?.[0];
    if (!imageUrl) {
      continue;
    }

    const haystack = `${item.name} ${item.bodyPart} ${item.equipment} ${item.category}`.toLowerCase();
    if (normalizedKeywords.some((keyword) => haystack.includes(keyword))) {
      return imageUrl;
    }
  }

  return exerciseLibrary.find((item) => item.imageUrls?.[0])?.imageUrls?.[0] ?? null;
}

export function CreateTemplateScreen({
  initialDraft,
  exerciseLibrary,
  recentExerciseLibraryItems,
  defaultRestSeconds,
  onBack,
  onSave,
}: CreateTemplateScreenProps) {
  const [templateName, setTemplateName] = useState(initialDraft.name);
  const [sessions, setSessions] = useState<TemplateSessionState[]>(() => mapDraftToSessions(initialDraft));
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);

  const sessionCount = clampDayCount(sessions.length);
  const presets = SPLIT_PRESETS[sessionCount];
  const libraryById = useMemo(() => new Map(exerciseLibrary.map((item) => [item.id, item] as const)), [exerciseLibrary]);
  const presetPreviewImages = useMemo(
    () =>
      Object.fromEntries(
        presets.map((preset) => [preset.id, resolvePresetPreviewImage(preset, exerciseLibrary)]),
      ) as Record<string, string | null>,
    [exerciseLibrary, presets],
  );

  const totalExercises = useMemo(
    () => sessions.reduce((sum, session) => sum + session.exercises.length, 0),
    [sessions],
  );

  const canSave = sessions.length > 0;
  const activeSession = sessions.find((session) => session.localKey === activeSessionKey) ?? null;
  const activeSessionLibraryIds = useMemo(
    () =>
      activeSession?.exercises
        .map((exercise) => exercise.libraryItemId)
        .filter((value): value is string => Boolean(value)) ?? [],
    [activeSession],
  );

  function setSessionCount(nextCount: TemplateDayCount) {
    setSessions((current) => {
      if (nextCount === current.length) {
        return current;
      }

      if (nextCount > current.length) {
        return [
          ...current,
          ...Array.from({ length: nextCount - current.length }, (_, index) => createBlankSession(current.length + index)),
        ];
      }

      return current.slice(0, nextCount);
    });
  }

  function applyPreset(names: string[]) {
    setSessions((current) =>
      names.map((name, index) => {
        const existing = current[index];
        if (existing) {
          return {
            ...existing,
            name,
          };
        }

        return {
          ...createBlankSession(index),
          name,
        };
      }),
    );
  }

  function updateSessionName(sessionKey: string, nextName: string) {
    setSessions((current) =>
      current.map((session) =>
        session.localKey === sessionKey
          ? {
              ...session,
              name: nextName,
            }
          : session,
      ),
    );
  }

  function removeSession(sessionKey: string) {
    setSessions((current) => current.filter((session) => session.localKey !== sessionKey));
    setActiveSessionKey((current) => (current === sessionKey ? null : current));
  }

  function openAddExercise(sessionKey: string) {
    setActiveSessionKey(sessionKey);
  }

  function appendExercisesToSession(items: ExerciseLibraryItem[]) {
    if (!activeSessionKey || items.length === 0) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.localKey === activeSessionKey
          ? {
              ...session,
              exercises: [...session.exercises, ...items.map((item) => createExerciseFromLibraryItem(item, defaultRestSeconds))],
            }
          : session,
      ),
    );
    setActiveSessionKey(null);
  }

  function removeExercise(sessionKey: string, exerciseKey: string) {
    setSessions((current) =>
      current.map((session) =>
        session.localKey === sessionKey
          ? {
              ...session,
              exercises: session.exercises.filter((exercise) => exercise.localKey !== exerciseKey),
            }
          : session,
      ),
    );
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    await onSave(buildTemplateDraft(templateName, sessions, initialDraft));
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={initialDraft.id ? 'Edit template' : 'Create template'}
        subtitle="Build a reusable weekly split. Add exercises now or keep the structure editable for later."
        onBack={onBack}
        rightActionLabel="Save"
        onRightActionPress={() => {
          void handleSave();
        }}
        tone="dark"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, styles.topCompactCard]}>
          <Text style={styles.cardKicker}>Template name</Text>
          <TextInput
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="Weekly split"
            placeholderTextColor="#9CA3AF"
            selectionColor="#111111"
            style={styles.nameInput}
          />
          <Text style={styles.supportingTextCompact}>
            {sessions.length} {sessions.length === 1 ? 'day' : 'days'} · {totalExercises} exercises
          </Text>
        </View>

        <View style={[styles.card, styles.topCompactCard, styles.daysCompactCard]}>
          <Text style={styles.cardKicker}>Days per week</Text>
          <View style={styles.dayRow}>
            {DAY_OPTIONS.map((option) => {
              const active = option === sessions.length;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSessionCount(option)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.quickLayoutsCard]}>
          <Text style={styles.cardKicker}>Quick layouts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {presets.map((preset) => {
              const previewImage = presetPreviewImages[preset.id];

              return (
                <Pressable key={preset.id} onPress={() => applyPreset(preset.names)} style={styles.presetCard}>
                  <View style={styles.presetMedia}>
                    {previewImage ? (
                      <Image source={{ uri: previewImage }} style={styles.presetMediaImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.presetMediaFallback}>
                        <Text style={styles.presetMediaFallbackText}>{preset.label.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.presetMediaOverlay} />
                    <View style={styles.presetBadge}>
                      <Text style={styles.presetBadgeText}>{preset.names.length} days</Text>
                    </View>
                  </View>

                  <View style={styles.presetCopy}>
                    <Text style={styles.presetTitle}>{preset.label}</Text>
                    <Text style={styles.presetBody}>{preset.description}</Text>
                    <Text numberOfLines={1} style={styles.presetMeta}>
                      {preset.names.join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sessionList}>
          {sessions.map((session, index) => (
            <View key={session.localKey} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionHeaderCopy}>
                  <Text style={styles.cardKicker}>Day {index + 1}</Text>
                  <Text style={styles.sessionCountText}>
                    {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>

                {sessions.length > 1 ? (
                  <Pressable onPress={() => removeSession(session.localKey)} style={styles.sessionRemoveButton}>
                    <Text style={styles.sessionRemoveButtonText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <TextInput
                value={session.name}
                onChangeText={(value) => updateSessionName(session.localKey, value)}
                placeholder={`Day ${index + 1}`}
                placeholderTextColor="#9CA3AF"
                selectionColor="#111111"
                style={styles.sessionNameInput}
              />

              {session.exercises.length ? (
                <View style={styles.exerciseList}>
                  {session.exercises.map((exercise) => {
                    const libraryItem = exercise.libraryItemId ? libraryById.get(exercise.libraryItemId) ?? null : null;
                    const previewImage = libraryItem?.imageUrls?.[0] ?? null;

                    return (
                      <View key={exercise.localKey} style={styles.exerciseRow}>
                        <View style={styles.exerciseLead}>
                          <View style={styles.exerciseThumb}>
                            {previewImage ? (
                              <Image source={{ uri: previewImage }} style={styles.exerciseThumbImage} resizeMode="cover" />
                            ) : (
                              <View style={styles.exerciseThumbFallback}>
                                <Text style={styles.exerciseThumbFallbackText}>
                                  {(exercise.name.trim().charAt(0) || 'E').toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.exerciseCopy}>
                            <Text numberOfLines={2} style={styles.exerciseName}>
                              {exercise.name}
                            </Text>
                            <Text numberOfLines={1} style={styles.exerciseMeta}>
                              {libraryItem
                                ? `${toTitleCase(libraryItem.bodyPart)} · ${toTitleCase(libraryItem.equipment)}`
                                : `${exercise.targetSets} sets · ${exercise.repMin}-${exercise.repMax} reps`}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => removeExercise(session.localKey, exercise.localKey)}
                          style={styles.exerciseRemoveButton}
                        >
                          <Text style={styles.exerciseRemoveButtonText}>X</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No exercises yet</Text>
                  <Text style={styles.emptyStateBody}>Build the split first, then add the lifts you want this day to run.</Text>
                </View>
              )}

              <Pressable onPress={() => openAddExercise(session.localKey)} style={styles.addExerciseButton}>
                <Text style={styles.addExerciseButtonText}>Add exercises</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            void handleSave();
          }}
          disabled={!canSave}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        >
          <Text style={styles.saveButtonText}>Save template</Text>
        </Pressable>
      </ScrollView>

      <AddExerciseSheet
        visible={activeSession !== null}
        items={exerciseLibrary}
        recentItems={recentExerciseLibraryItems}
        currentItemIds={activeSessionLibraryIds}
        selectedIds={[]}
        title="Add exercises"
        subtitle="Pick one or more lifts for this day."
        multiSelect
        autoFocusSearch
        onClose={() => setActiveSessionKey(null)}
        onSelectItem={() => {}}
        onConfirmSelection={appendExercisesToSession}
      />
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
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  topCompactCard: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  daysCompactCard: {
    paddingBottom: spacing.md - 2,
  },
  cardKicker: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nameInput: {
    minHeight: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm + 2,
    color: '#111111',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  supportingText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  supportingTextCompact: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  dayChipText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  quickLayoutsCard: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  presetRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  presetCard: {
    width: 228,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  presetMedia: {
    height: 126,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  presetMediaImage: {
    width: '100%',
    height: '100%',
  },
  presetMediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  presetMediaFallbackText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  presetMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 17, 17, 0.22)',
  },
  presetBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    minHeight: 28,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  presetBadgeText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetCopy: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 6,
  },
  presetTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  presetBody: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  presetMeta: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  sessionList: {
    gap: spacing.md,
  },
  sessionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sessionHeaderCopy: {
    gap: 4,
  },
  sessionCountText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  sessionRemoveButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  sessionRemoveButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionNameInput: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
  },
  exerciseLead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  exerciseThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
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
  exerciseCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  exerciseName: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  exerciseMeta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
  },
  exerciseRemoveButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyState: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    gap: 4,
  },
  emptyStateTitle: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  addExerciseButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

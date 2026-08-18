import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CutButton } from '../components/CutButton';
import { CutSurface } from '../components/CutSurface';
import { Theme, useTheme, useThemedStyles } from '../theming';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { getExerciseTemplateDefaults } from '../lib/exerciseSuggestions';
import { I18nKey, t } from '../lib/i18n';
import { layout, radii, spacing } from '../theme';
import {
  AppLanguage,
  ExerciseLibraryItem,
  ExerciseTemplateDraft,
  WorkoutTemplateDraft,
} from '../types/models';
import { createId } from '../lib/ids';
import { resolveQuickLayoutExercises } from '../lib/quickLayoutExercises';
import { localizeWorkoutFocus } from '../lib/sessionNameLabel';

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

// `names` become stored session names, so they stay English like the rest of
// the persisted plan data. Only the card's label and description translate.
interface SplitPreset {
  id: string;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  names: string[];
  previewKeywords: string[];
}

interface CreateTemplateScreenProps {
  initialDraft: WorkoutTemplateDraft;
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  language?: AppLanguage;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

const DAY_OPTIONS: TemplateDayCount[] = [1, 2, 3, 4, 5];

// Stored as the template's name when the user leaves the field blank, so it is
// data rather than UI copy and stays in one language.
const DEFAULT_TEMPLATE_NAME = 'New template';

const SPLIT_PRESETS: Record<TemplateDayCount, SplitPreset[]> = {
  1: [
    {
      id: 'single_full_body',
      labelKey: 'tpl.fullBody',
      descriptionKey: 'tpl.fullBodyDesc',
      names: ['Full Body'],
      previewKeywords: ['squat', 'bench', 'row'],
    },
    {
      id: 'single_upper',
      labelKey: 'tpl.upperFocus',
      descriptionKey: 'tpl.upperFocusDesc',
      names: ['Upper Focus'],
      previewKeywords: ['bench', 'pulldown', 'row'],
    },
  ],
  2: [
    {
      id: 'upper_lower',
      labelKey: 'tpl.upperLower',
      descriptionKey: 'tpl.upperLowerDesc',
      names: ['Upper', 'Lower'],
      previewKeywords: ['bench', 'squat'],
    },
    {
      id: 'push_pull',
      labelKey: 'tpl.pushPull',
      descriptionKey: 'tpl.pushPullDesc',
      names: ['Push', 'Pull'],
      previewKeywords: ['press', 'row', 'pulldown'],
    },
  ],
  3: [
    {
      id: 'push_pull_legs',
      labelKey: 'tpl.ppl',
      descriptionKey: 'tpl.pplDesc',
      names: ['Push', 'Pull', 'Legs'],
      previewKeywords: ['bench', 'row', 'leg'],
    },
    {
      id: 'full_body_abc',
      labelKey: 'tpl.fullBodyAbc',
      descriptionKey: 'tpl.fullBodyAbcDesc',
      names: ['Full Body A', 'Full Body B', 'Full Body C'],
      previewKeywords: ['squat', 'bench', 'deadlift'],
    },
  ],
  4: [
    {
      id: 'upper_lower_heavy_pump',
      labelKey: 'tpl.upperLowerX2',
      descriptionKey: 'tpl.upperLowerX2Desc',
      names: ['Upper Heavy', 'Lower Heavy', 'Upper Pump', 'Lower Pump'],
      previewKeywords: ['bench', 'squat', 'curl', 'lunge'],
    },
    {
      id: 'body_part_4',
      labelKey: 'tpl.bodyPartSplit',
      descriptionKey: 'tpl.bodyPartSplitFour',
      names: ['Chest / Triceps', 'Back / Biceps', 'Legs / Glutes', 'Shoulders / Arms'],
      previewKeywords: ['chest', 'back', 'leg', 'shoulder'],
    },
  ],
  5: [
    {
      id: 'body_part_5',
      labelKey: 'tpl.bodyPartSplit',
      descriptionKey: 'tpl.bodyPartSplitFive',
      names: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
      previewKeywords: ['chest', 'back', 'leg', 'shoulder', 'curl'],
    },
    {
      id: 'strength_5',
      labelKey: 'tpl.strengthMix',
      descriptionKey: 'tpl.strengthMixDesc',
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

/**
 * Session names are stored, not derived — whatever is written here ends up in
 * the user's database and on every screen that shows it. They are written in
 * the user's language for that reason: a Finnish user's own program should not
 * be called "Day 3" forever because of the moment it was created.
 *
 * Names already stored in English still read correctly everywhere, because
 * `localizeSessionName` translates them on the way out.
 */
function createBlankSession(index: number, language: AppLanguage): TemplateSessionState {
  return {
    localKey: createId('template_session'),
    name: `${t(language, 'tpl.dayWord')} ${index + 1}`,
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

function mapDraftToSessions(draft: WorkoutTemplateDraft, language: AppLanguage): TemplateSessionState[] {
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

  return [createBlankSession(0, language)];
}

function buildTemplateDraft(
  name: string,
  sessions: TemplateSessionState[],
  initialDraft: WorkoutTemplateDraft,
): WorkoutTemplateDraft {
  return {
    id: initialDraft.id,
    name: name.trim() || DEFAULT_TEMPLATE_NAME,
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
  language = 'en',
  onBack,
  onSave,
}: CreateTemplateScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [templateName, setTemplateName] = useState(initialDraft.name);
  const [sessions, setSessions] = useState<TemplateSessionState[]>(() => mapDraftToSessions(initialDraft, language));
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

  // A programme with an empty day is not a programme; the button waits until
  // every day has at least one lift. It used to accept three named, empty
  // days, which then showed up on Home as a session with nothing in it.
  const emptyDayCount = sessions.filter((session) => session.exercises.length === 0).length;
  const canSave = sessions.length > 0 && emptyDayCount === 0;
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
          ...Array.from({ length: nextCount - current.length }, (_, index) => createBlankSession(current.length + index, language)),
        ];
      }

      return current.slice(0, nextCount);
    });
  }

  /**
   * A layout is days *with lifts in them*. It used to set three names on three
   * empty days and call that "Push / Pull / Legs" — a layout in name only,
   * with every exercise still to be found. Each day the layout names now opens
   * with the two to four lifts a programme for that focus starts from. A day
   * the reader has already filled keeps what they put there; only empty days
   * are filled, so re-applying a layout never overwrites work.
   */
  function applyPreset(englishNames: string[]) {
    setSessions((current) =>
      englishNames.map((englishName, index) => {
        const name = localizeWorkoutFocus(englishName, language);
        const existing = current[index];
        const base = existing ? { ...existing, name } : { ...createBlankSession(index, language), name };
        if (base.exercises.length > 0) {
          return base;
        }
        return {
          ...base,
          exercises: resolveQuickLayoutExercises(englishName, exerciseLibrary).map(({ name: liftName, item }) => ({
            ...createExerciseFromLibraryItem(item, defaultRestSeconds),
            // The catalog's name, not the library variant's: "Back Squat"
            // translates and matches history the way the ready programmes do.
            name: liftName,
          })),
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
        language={language}
        title={t(language, initialDraft.id ? 'tpl.editTitle' : 'tpl.createTitle')}
        subtitle={t(language, 'tpl.subtitle')}
        onBack={onBack}
        // Same gate as the button at the bottom: while a day is empty there is
        // no save action, so the header shows none rather than a word that
        // does nothing when tapped.
        rightActionLabel={canSave ? t(language, 'common.save') : undefined}
        onRightActionPress={canSave ? () => void handleSave() : undefined}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CutSurface
          size="lg"
          fill={theme.surface}
          stroke={theme.border}
          strokeWidth={1}
          style={[styles.card, styles.topCompactCard]}
        >
          <Text style={styles.cardKicker}>{t(language, 'tpl.name')}</Text>
          <TextInput
            value={templateName}
            onChangeText={setTemplateName}
            placeholder={t(language, 'tpl.namePlaceholder')}
            placeholderTextColor={theme.faint}
            selectionColor={theme.purple}
            style={styles.nameInput}
          />
          <Text style={styles.supportingTextCompact}>
            {t(language, sessions.length === 1 ? 'tpl.summaryOne' : 'tpl.summaryMany', {
              days: sessions.length,
              exercises: totalExercises,
            })}
          </Text>
        </CutSurface>

        <CutSurface
          size="lg"
          fill={theme.surface}
          stroke={theme.border}
          strokeWidth={1}
          style={[styles.card, styles.topCompactCard, styles.daysCompactCard]}
        >
          <Text style={styles.cardKicker}>{t(language, 'tpl.daysPerWeek')}</Text>
          <View style={styles.dayRow}>
            {DAY_OPTIONS.map((option) => {
              const active = option === sessions.length;
              return (
                <Pressable key={option} onPress={() => setSessionCount(option)}>
                  <CutSurface
                    size="chip"
                    fill={active ? theme.purpleBright : theme.surface}
                    stroke={active ? undefined : theme.border}
                    strokeWidth={1}
                    style={styles.dayChip}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{option}</Text>
                  </CutSurface>
                </Pressable>
              );
            })}
          </View>
        </CutSurface>

        <View style={[styles.card, styles.quickLayoutsCard]}>
          <Text style={styles.cardKicker}>{t(language, 'tpl.quickLayouts')}</Text>
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
                        <Text style={styles.presetMediaFallbackText}>
                          {t(language, preset.labelKey).slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.presetMediaOverlay} />
                    <View style={styles.presetBadge}>
                      <Text style={styles.presetBadgeText}>
                        {t(language, 'tpl.dayCount', { count: preset.names.length })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.presetCopy}>
                    <Text style={styles.presetTitle}>{t(language, preset.labelKey)}</Text>
                    <Text style={styles.presetBody}>{t(language, preset.descriptionKey)}</Text>
                    <Text numberOfLines={1} style={styles.presetMeta}>
                      {/* The days as the reader will see them, not the
                          English tokens they are stored as. */}
                      {preset.names.map((name) => localizeWorkoutFocus(name, language)).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sessionList}>
          {sessions.map((session, index) => (
            <CutSurface
              key={session.localKey}
              size="lg"
              fill={theme.surface}
              stroke={theme.border}
              strokeWidth={1}
              style={styles.sessionCard}
            >
              <View style={styles.sessionHeader}>
                <View style={styles.sessionHeaderCopy}>
                  <Text style={styles.cardKicker}>{t(language, 'tpl.day', { index: index + 1 })}</Text>
                  <Text style={styles.sessionCountText}>
                    {t(
                      language,
                      session.exercises.length === 1 ? 'tpl.exerciseOne' : 'tpl.exerciseMany',
                      { count: session.exercises.length },
                    )}
                  </Text>
                </View>

                {sessions.length > 1 ? (
                  <Pressable onPress={() => removeSession(session.localKey)} style={styles.sessionRemoveButton}>
                    <Text style={styles.sessionRemoveButtonText}>{t(language, 'tpl.remove')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <TextInput
                value={session.name}
                onChangeText={(value) => updateSessionName(session.localKey, value)}
                placeholder={t(language, 'tpl.day', { index: index + 1 })}
                placeholderTextColor={theme.faint}
                selectionColor={theme.purple}
                style={styles.sessionNameInput}
              />

              {session.exercises.length ? (
                <View style={styles.exerciseList}>
                  {session.exercises.map((exercise) => {
                    const libraryItem = exercise.libraryItemId ? libraryById.get(exercise.libraryItemId) ?? null : null;
                    const previewImage = libraryItem?.imageUrls?.[0] ?? null;

                    return (
                      <CutSurface
                        key={exercise.localKey}
                        size="md"
                        fill={theme.surfaceSoft}
                        style={styles.exerciseRow}
                      >
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
                              {exerciseNameLabel(language, exercise.name)}
                            </Text>
                            <Text numberOfLines={1} style={styles.exerciseMeta}>
                              {libraryItem
                                ? `${toTitleCase(libraryItem.bodyPart)} · ${toTitleCase(libraryItem.equipment)}`
                                : t(language, 'tpl.setsReps', {
                                    sets: exercise.targetSets,
                                    repMin: exercise.repMin,
                                    repMax: exercise.repMax,
                                  })}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => removeExercise(session.localKey, exercise.localKey)}
                          style={styles.exerciseRemoveButton}
                        >
                          <Text style={styles.exerciseRemoveButtonText}>X</Text>
                        </Pressable>
                      </CutSurface>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>{t(language, 'tpl.noExercises')}</Text>
                  <Text style={styles.emptyStateBody}>{t(language, 'tpl.noExercisesBody')}</Text>
                </View>
              )}

              {/* Outline, not filled. Adding an exercise is what you do
                  repeatedly inside a day; saving the template is what ends the
                  screen. As a solid black bar per day this was the loudest
                  thing on the page, repeated once per day card, and Tallenna
                  was quieter than all of them. */}
              <CutButton
                label={t(language, 'editor.addExercises')}
                onPress={() => openAddExercise(session.localKey)}
                variant="outline"
                size="lg"
                stretch
              />
            </CutSurface>
          ))}
        </View>

        <CutButton
          label={t(language, 'tpl.save')}
          onPress={canSave ? () => void handleSave() : undefined}
          variant={canSave ? 'primary' : 'disabled'}
          size="lg"
          stretch
        />
      </ScrollView>

      <AddExerciseSheet
        visible={activeSession !== null}
        items={exerciseLibrary}
        recentItems={recentExerciseLibraryItems}
        currentItemIds={activeSessionLibraryIds}
        selectedIds={[]}
        language={language}
        title={t(language, 'editor.addExercises')}
        subtitle={t(language, 'tpl.pickForDay')}
        multiSelect
        autoFocusSearch
        onClose={() => setActiveSessionKey(null)}
        onSelectItem={() => {}}
        onConfirmSelection={appendExercisesToSession}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    // The page was `surface` — the same white the cards are. Every card was a
    // hairline drawn on its own background, which is why the screen read as a
    // list of outlines rather than as a stack of cards.
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: layout.bottomTabBarReserve,
      gap: spacing.lg,
    },
    card: {
      padding: spacing.md,
      gap: spacing.xs,
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
      color: theme.muted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    nameInput: {
      minHeight: 36,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
      paddingHorizontal: spacing.sm + 2,
      color: theme.ink,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    supportingTextCompact: {
      color: theme.muted,
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
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipText: {
      color: theme.ink,
      fontSize: 13,
      fontWeight: '800',
    },
    dayChipTextActive: {
      color: '#FFFFFF',
    },
    // The one card that is not a CutSurface: it holds a horizontal scroller
    // that runs to the screen edge, and a cut corner on a container whose
    // content deliberately overflows it is a shape fighting its own content.
    quickLayoutsCard: {
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    presetRow: {
      gap: spacing.sm,
      paddingRight: spacing.lg,
    },
    presetCard: {
      width: 228,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    presetMedia: {
      height: 126,
      backgroundColor: theme.purpleDark,
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
      backgroundColor: theme.purpleDark,
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
      // Sits on the media, which is painted violet in both themes.
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    presetBadgeText: {
      color: '#17131F',
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
      color: theme.ink,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    presetBody: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    presetMeta: {
      color: theme.ink,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
    },
    sessionList: {
      gap: spacing.md,
    },
    sessionCard: {
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
      color: theme.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    sessionRemoveButton: {
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
    },
    sessionRemoveButtonText: {
      color: theme.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    sessionNameInput: {
      minHeight: 50,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
      paddingHorizontal: spacing.md,
      color: theme.ink,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    exerciseList: {
      gap: spacing.sm,
    },
    // Filled rather than outlined: inside a card, a row that repeats five times
    // reads better as a tinted band than as five more hairlines.
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
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
      backgroundColor: theme.surface,
    },
    exerciseThumbImage: {
      width: '100%',
      height: '100%',
    },
    exerciseThumbFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    exerciseThumbFallbackText: {
      color: theme.ink,
      fontSize: 18,
      fontWeight: '800',
    },
    exerciseCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    exerciseName: {
      color: theme.ink,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
    },
    exerciseMeta: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    exerciseRemoveButton: {
      width: 32,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.dangerSoft,
    },
    exerciseRemoveButtonText: {
      color: theme.danger,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyState: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      padding: spacing.md,
      gap: 4,
    },
    emptyStateTitle: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyStateBody: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
  });

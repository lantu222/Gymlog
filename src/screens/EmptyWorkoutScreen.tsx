import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PlatePop } from '../components/PlatePop';
import { RestBar } from '../components/RestBar';
import { formatLiftDisplayLabel } from '../lib/displayLabel';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { buildExerciseSearchHaystack, exerciseMatchesQuery } from '../lib/exerciseSearch';
import { parseNumberInput, removeTrailingZeros } from '../lib/format';
import {
  EMPTY_WORKOUT_MUSCLE_FILTERS,
  EmptyWorkoutMuscleFilter,
  FreestyleExerciseDraft,
  FreestyleFinishSummary,
  buildFreestyleFinish,
  exerciseInitials,
  freestyleDoneSetCount,
  freestyleHasSetAfter,
  freestyleNextSetTarget,
  freestyleVolumeKg,
  matchesMuscleFilter,
} from '../lib/emptyWorkoutSession';
import { getExerciseTemplateDefaults, getPopularExerciseLibraryItems } from '../lib/exerciseSuggestions';
import { bodyPartLabel, I18nKey, t } from '../lib/i18n';
import { createId } from '../lib/ids';
import { ExercisePrLookup } from '../lib/workoutCompletionSummary';
import { Theme, useTheme, useThemedStyles, aw3ForTheme, useAW3 } from '../theming';
import { AppLanguage, ExerciseLibraryItem, WorkoutTemplateDraft } from '../types/models';
import { subscribeRestActions, useRestEndAlert } from '../hooks/useRestEndAlert';
import { RestAlertsSheet } from '../components/RestAlertsSheet';
import { describeRest } from '../lib/restSchedule';
import {
  RestAlertPermission,
  getRestAlertPermission,
  requestRestAlertPermission,
} from '../utils/sessionNotifications';
import { haptics } from '../utils/haptics';
import { useKeepScreenAwake } from '../utils/keepAwake';
import { sound } from '../utils/sound';

/**
 * Freestyle logging in the Vinha (HG) language — replaces the old generic
 * Empty Workout presentation. Empty state → Add-exercise sheet → set table
 * with plate readout and the shared floating rest bar. Design source:
 * empty-workout.jsx + aw3-shared.jsx in the design archive.
 */

interface FreestyleExerciseState extends FreestyleExerciseDraft {
  displayName: string;
  initials: string;
  metaLabel: string;
  isBarbell: boolean;
}

interface EmptyWorkoutScreenProps {
  exerciseLibrary: ExerciseLibraryItem[];
  recentExerciseLibraryItems: ExerciseLibraryItem[];
  defaultRestSeconds: number;
  keepScreenAwake?: boolean;
  exercisePrLookup: ExercisePrLookup;
  language?: AppLanguage;
  onBack: () => void;
  onSave: (draft: WorkoutTemplateDraft, summary: FreestyleFinishSummary) => Promise<void> | void;
  /** Rest & alerts settings (design: Background Timer). */
  restAlerts?: { alerts: boolean; warning: boolean; ongoing: boolean; asked: boolean };
  /** The in-app permission sheet was answered; remember so it is never shown twice. */
  onRestAlertsAsked?: () => void;
  /** The denied banner's "Turn on" — opens system settings. */
  onOpenSystemSettings?: () => void;
}

const TAG_KEYS: Record<string, I18nKey> = {
  compound: 'exerciseTag.compound',
  isolation: 'exerciseTag.isolation',
  cardio: 'exerciseTag.cardio',
  core: 'exerciseTag.core',
};

function buildMetaLabel(item: ExerciseLibraryItem, language: AppLanguage) {
  const muscle = bodyPartLabel(language, item.bodyPart);
  const tagKey = item.equipment === 'bodyweight' ? 'exerciseTag.bodyweight' : TAG_KEYS[item.category];
  const tag = tagKey ? t(language, tagKey) : item.category;
  // Core exercises would otherwise read "Core · Core".
  return tag.toLowerCase() === muscle.toLowerCase() ? muscle : `${muscle} · ${tag}`;
}

function createSet() {
  return { localKey: createId('set'), kg: '', reps: '', done: false };
}

function buildExerciseState(
  item: ExerciseLibraryItem,
  defaultRestSeconds: number,
  language: AppLanguage,
): FreestyleExerciseState {
  const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);
  const displayName = exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise'));

  return {
    localKey: createId('draft'),
    name: item.name,
    libraryItemId: item.id,
    imageUrl: item.imageUrls?.[0] ?? null,
    repMin: defaults.repMin,
    repMax: defaults.repMax,
    restSeconds: defaults.restSeconds,
    trackedDefault: defaults.trackedDefault,
    sets: [createSet()],
    displayName,
    initials: exerciseInitials(displayName),
    metaLabel: buildMetaLabel(item, language),
    isBarbell: item.equipment === 'barbell',
  };
}

/** Session clock in the design's m:ss form (minutes unbounded). */
function formatSessionClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${`${safe % 60}`.padStart(2, '0')}`;
}

function formatVolumeLabel(volumeKg: number) {
  return removeTrailingZeros(volumeKg);
}

// ── small shared pieces ──────────────────────────────────────────────────

function PlusIcon({ size, color, strokeWidth = 2.8 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size, color, strokeWidth = 3 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M5 12l5 5L19 7" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Letter tile — the purpleLight / purpleDark idiom shared with the guided player. */
function Tile({ initials, size = 46, radius = 12, fontSize }: { initials: string; size?: number; radius?: number; fontSize?: number }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.tileText, { fontSize: fontSize ?? Math.round(size * 0.36) }]}>{initials}</Text>
    </View>
  );
}

/** Mount fade+rise, mirroring the mock's aw3Fade keyframe. */
function FadeInView({ style, children }: { style?: object; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  // Interpolated once — a per-render interpolate leaks native animated nodes
  // (disconnectAnimatedNodes crash), and this screen re-renders on the timer.
  const translateY = useRef(progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [progress]);

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** Check button with the aw3Pop squash when a set flips to done. */
function SetCheckButton({ done, label, onPress }: { done: boolean; label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const AW3 = useAW3();

  const scale = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.9, duration: 140, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
    wasDone.current = done;
  }, [done, scale]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Animated.View style={[styles.setCheck, done && styles.setCheckDone, { transform: [{ scale }] }]}>
        <CheckIcon size={18} color={done ? '#FFFFFF' : AW3.ghost} />
      </Animated.View>
    </Pressable>
  );
}

// ── Add-exercise sheet ───────────────────────────────────────────────────

interface AddSheetProps {
  visible: boolean;
  items: ExerciseLibraryItem[];
  language: AppLanguage;
  onClose: () => void;
  onAdd: (items: ExerciseLibraryItem[]) => void;
}

const FILTER_LABEL_KEYS: Record<EmptyWorkoutMuscleFilter, I18nKey> = {
  All: 'emptyWorkout.filter.all',
  Chest: 'bodyPart.chest',
  Back: 'bodyPart.back',
  Shoulders: 'bodyPart.shoulders',
  Legs: 'bodyPart.legs',
  Arms: 'emptyWorkout.filter.arms',
  Core: 'bodyPart.core',
};

function SelectTogglePill({ selected }: { selected: boolean }) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.selectPill, selected && styles.selectPillOn]}>
      {selected ? <CheckIcon size={16} color="#FFFFFF" strokeWidth={2.8} /> : <PlusIcon size={16} color={theme.purple} />}
    </View>
  );
}

function AddExerciseSheetHG({ visible, items, language, onClose, onAdd }: AddSheetProps) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);
  const AW3 = useAW3();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<EmptyWorkoutMuscleFilter>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      setFilter('All');
      setQuery('');
    }
  }, [visible]);

  const toggle = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesMuscleFilter(item.bodyPart, filter) &&
          (!normalizedQuery || exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), normalizedQuery)),
      ),
    [filter, items, language, normalizedQuery],
  );

  const popularItems = useMemo(() => {
    const matchIds = new Set(matches.map((item) => item.id));
    return getPopularExerciseLibraryItems(items, 8)
      .filter((item) => matchIds.has(item.id))
      .slice(0, 4);
  }, [items, matches]);

  const popularIds = useMemo(() => new Set(popularItems.map((item) => item.id)), [popularItems]);
  const listItems = useMemo(
    () =>
      matches
        .filter((item) => !popularIds.has(item.id))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [matches, popularIds],
  );

  const confirm = () => {
    if (!selectedIds.length) {
      return;
    }
    onAdd(items.filter((item) => selectedIds.includes(item.id)));
  };

  const listHeader = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetChipRow}>
        {EMPTY_WORKOUT_MUSCLE_FILTERS.map((option) => {
          const active = option === filter;
          return (
            <Pressable key={option} onPress={() => setFilter(option)} style={[styles.sheetChip, active && styles.sheetChipActive]}>
              <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                {t(language, FILTER_LABEL_KEYS[option])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {popularItems.length > 0 ? (
        <>
          <View style={styles.sheetSectionHeader}>
            <Text style={styles.sheetSectionTitle}>{t(language, 'emptyWorkout.sheet.popularTitle')}</Text>
            <Text style={styles.sheetSectionSubtitle}>{t(language, 'emptyWorkout.sheet.popularSub')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
            {popularItems.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={[styles.popularCard, selected && styles.popularCardSelected]}
                >
                  <View>
                    <View style={styles.popularTile}>
                      <Text style={styles.popularTileText}>{exerciseInitials(exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise')))}</Text>
                    </View>
                    <View style={styles.popularToggle}>
                      <SelectTogglePill selected={selected} />
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.popularName}>
                    {exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise'))}
                  </Text>
                  <Text numberOfLines={1} style={styles.popularMeta}>
                    {buildMetaLabel(item, language)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.sheetSectionHeaderAll}>
        <Text style={styles.sheetSectionTitle}>{t(language, 'emptyWorkout.sheet.allTitle')}</Text>
        <Text style={styles.sheetSectionSubtitle}>{t(language, 'emptyWorkout.sheet.available', { count: listItems.length })}</Text>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetGripRow}>
            <View style={styles.sheetGrip} />
          </View>
          <View style={styles.sheetHead}>
            <View style={styles.sheetHeadRow}>
              <View style={styles.sheetHeadCopy}>
                <Text style={styles.sheetTitle}>{t(language, 'emptyWorkout.addExercise')}</Text>
                <Text style={styles.sheetSubtitle}>{t(language, 'emptyWorkout.sheet.subtitle')}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'emptyWorkout.sheet.close')} onPress={onClose} hitSlop={8}>
                <Text style={styles.sheetClose}>{t(language, 'emptyWorkout.sheet.close')}</Text>
              </Pressable>
            </View>
            <View style={styles.searchField}>
              <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Circle cx={11} cy={11} r={7} stroke={theme.faint} strokeWidth={2} fill="none" />
                <Path d="M20 20l-3.5-3.5" stroke={theme.faint} strokeWidth={2} fill="none" strokeLinecap="round" />
              </Svg>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t(language, 'emptyWorkout.sheet.search')}
                placeholderTextColor={AW3.ghost}
                selectionColor={theme.purple}
                style={styles.searchInput}
              />
            </View>
          </View>

          <FlatList
            data={listItems}
            keyExtractor={(item) => item.id}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={8}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetListContent}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              popularItems.length === 0 ? (
                <Text style={styles.sheetEmptyText}>{t(language, 'emptyWorkout.sheet.noMatch', { query })}</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id);
              return (
                <Pressable onPress={() => toggle(item.id)} style={[styles.sheetRow, selected && styles.sheetRowSelected]}>
                  <Tile initials={exerciseInitials(exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise')))} size={46} />
                  <View style={styles.sheetRowCopy}>
                    <Text numberOfLines={1} style={styles.sheetRowName}>
                      {exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise'))}
                    </Text>
                    <Text numberOfLines={1} style={styles.sheetRowMeta}>
                      {buildMetaLabel(item, language)}
                    </Text>
                  </View>
                  <SelectTogglePill selected={selected} />
                </Pressable>
              );
            }}
          />

          <View style={styles.sheetFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'emptyWorkout.a11y.addSelected')}
              onPress={confirm}
              disabled={selectedIds.length === 0}
              style={[styles.sheetConfirm, selectedIds.length === 0 && styles.sheetConfirmDisabled]}
            >
              <Text style={[styles.sheetConfirmText, selectedIds.length === 0 && styles.sheetConfirmTextDisabled]}>
                {selectedIds.length === 0
                  ? t(language, 'emptyWorkout.sheet.selectPrompt')
                  : selectedIds.length === 1
                    ? t(language, 'emptyWorkout.sheet.addOne')
                    : t(language, 'emptyWorkout.sheet.addMany', { count: selectedIds.length })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

export function EmptyWorkoutScreen({
  exerciseLibrary,
  recentExerciseLibraryItems,
  defaultRestSeconds,
  keepScreenAwake = false,
  exercisePrLookup,
  language = 'en',
  onBack,
  onSave,
  restAlerts = { alerts: true, warning: true, ongoing: true, asked: false },
  onRestAlertsAsked,
  onOpenSystemSettings,
}: EmptyWorkoutScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const AW3 = useAW3();
  const [exercises, setExercises] = useState<FreestyleExerciseState[]>([]);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rest, setRest] = useState<{ totalSeconds: number; endsAtMs: number } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasExercises = exercises.length > 0;
  const canFinish = hasExercises && !isSaving;

  useKeepScreenAwake(keepScreenAwake, 'empty-workout');

  useEffect(() => {
    if (!hasExercises) {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasExercises]);

  const elapsedSeconds = startedAtMs === null ? 0 : Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  // Rule 01: derived from the clock, never accumulated. A rest that ended while
  // the phone was in a pocket comes back as DONE with its overrun — not as a
  // frozen countdown, and not silently gone.
  const restStatus = rest ? describeRest(rest.endsAtMs, nowMs) : null;
  const restRemaining = restStatus ? restStatus.remainingSeconds : null;
  const restDoneCuedRef = useRef(false);

  useEffect(() => {
    // The countdown ran out — cue "back to work" once, but KEEP the bar: it
    // flips to the done state and counts how long ago, until the set is
    // logged or the bar is dismissed (design: "coming back").
    if (restStatus?.phase === 'done' && !restDoneCuedRef.current) {
      restDoneCuedRef.current = true;
      void haptics.impactMedium();
      sound.rest();
    }
    if (!rest) {
      restDoneCuedRef.current = false;
    }
  }, [rest, restStatus?.phase]);

  const doneSetCount = freestyleDoneSetCount(exercises);
  const volumeKg = freestyleVolumeKg(exercises);
  const totalSetCount = exercises.reduce((sum, entry) => sum + entry.sets.length, 0);

  // The done bar names the set you came back to log, not a slogan.
  const nextSetLabel = useMemo(() => {
    const target = freestyleNextSetTarget(exercises);
    if (!target) {
      return null;
    }
    return target.kg && target.reps
      ? t(language, 'rest.bar.doneSet', { n: target.setNumber, kg: target.kg, reps: target.reps })
      : t(language, 'rest.bar.doneSetPlain', { n: target.setNumber });
  }, [exercises, language]);

  // What the lock-screen card says between rests: the session and where it is.
  const sessionCard = useMemo(() => {
    if (!hasExercises || startedAtMs === null) {
      return null;
    }
    const started = new Date(startedAtMs);
    const time = `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`;
    const current = exercises.find((entry) => entry.sets.some((item) => !item.done)) ?? exercises[exercises.length - 1];
    return {
      title: t(language, 'rest.notify.sessionTitle', {
        session: t(language, 'emptyWorkout.title'),
        exercise: current?.name ?? '',
      }),
      body: t(language, 'rest.notify.sessionBody', { done: doneSetCount, total: totalSetCount, time }),
    };
  }, [doneSetCount, exercises, hasExercises, language, startedAtMs, totalSetCount]);

  // The in-app cue cannot play while Android has our JS suspended, so the
  // deadline also goes to the OS as the alert ladder, and the ongoing card
  // says what is happening. Clearing the bar — skip, log, leaving — retires it.
  const syncRestAlert = useRestEndAlert(language, {
    warning: restAlerts.warning,
    ongoing: restAlerts.ongoing,
    session: sessionCard,
  });
  // Only a RUNNING rest is mirrored; once done, the alert has fired and the
  // card should say the session again.
  const restEndsAtMs = rest && restStatus?.phase === 'running' && restAlerts.alerts ? rest.endsAtMs : null;
  useEffect(() => {
    void syncRestAlert(restEndsAtMs);
  }, [restEndsAtMs, syncRestAlert]);

  // The permission moment (rule 05): at the first rest, in context, once.
  const [alertPermission, setAlertPermission] = useState<RestAlertPermission>('undetermined');
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [deniedBannerShown, setDeniedBannerShown] = useState(false);
  useEffect(() => {
    void getRestAlertPermission().then(setAlertPermission);
  }, []);
  useEffect(() => {
    if (!rest || restStatus?.phase !== 'running') {
      return;
    }
    if (alertPermission === 'undetermined' && !restAlerts.asked) {
      setPermissionSheetOpen(true);
    } else if (alertPermission === 'denied' && restAlerts.alerts) {
      setDeniedBannerShown(true);
    }
    // Once per rest start, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.endsAtMs]);

  const allowAlerts = async () => {
    setPermissionSheetOpen(false);
    onRestAlertsAsked?.();
    const next = await requestRestAlertPermission();
    setAlertPermission(next);
    // The rest that prompted this is still running: hand it to the OS now.
    if (next === 'granted' && rest && describeRest(rest.endsAtMs, Date.now()).phase === 'running') {
      void syncRestAlert(rest.endsAtMs);
    }
  };
  const laterAlerts = () => {
    setPermissionSheetOpen(false);
    onRestAlertsAsked?.();
  };

  // Lock-screen actions land in App and come here over the bus.
  useEffect(
    () =>
      subscribeRestActions((action) => {
        if (action.kind === 'extend') {
          adjustRest(action.seconds);
        } else if (action.kind === 'skip') {
          setRest(null);
        }
        // 'logSet' and 'finish' just open the app to this screen; the next
        // tap is the reader's.
      }),
    // adjustRest is recreated each render but closes over nothing stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const quickItems = useMemo(() => {
    const source = recentExerciseLibraryItems.length > 0 ? recentExerciseLibraryItems : getPopularExerciseLibraryItems(exerciseLibrary, 8);
    return source.slice(0, 4);
  }, [exerciseLibrary, recentExerciseLibraryItems]);
  const quickListTitle = t(language, recentExerciseLibraryItems.length > 0 ? 'emptyWorkout.recent' : 'emptyWorkout.popular');

  const addExercises = (items: ExerciseLibraryItem[]) => {
    if (!items.length) {
      return;
    }
    setExercises((current) => [...current, ...items.map((item) => buildExerciseState(item, defaultRestSeconds, language))]);
    setStartedAtMs((current) => current ?? Date.now());
    setNowMs(Date.now());
    setSheetVisible(false);
  };

  const removeExercise = (exerciseKey: string) =>
    setExercises((current) => current.filter((exercise) => exercise.localKey !== exerciseKey));

  const patchSet = (exerciseKey: string, setKey: string, patch: Partial<{ kg: string; reps: string }>) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.localKey === exerciseKey
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.localKey === setKey ? { ...set, ...patch } : set)),
            }
          : exercise,
      ),
    );

  const addSet = (exerciseKey: string) =>
    setExercises((current) =>
      current.map((exercise) =>
        exercise.localKey === exerciseKey ? { ...exercise, sets: [...exercise.sets, createSet()] } : exercise,
      ),
    );

  const toggleSetDone = (exerciseKey: string, setKey: string) => {
    const exercise = exercises.find((entry) => entry.localKey === exerciseKey);
    const set = exercise?.sets.find((entry) => entry.localKey === setKey);
    if (!exercise || !set) {
      return;
    }

    if (!set.done) {
      void haptics.success();
      sound.done();
      // No next set, no rest. The bar used to open on the last tick of the
      // session, count down to nothing, and cover "Lopeta treeni" while it did.
      if (freestyleHasSetAfter(exercises, exerciseKey, setKey)) {
        const duration = exercise.restSeconds > 0 ? Math.round(exercise.restSeconds) : defaultRestSeconds;
        const now = Date.now();
        setNowMs(now);
        setRest({ totalSeconds: duration, endsAtMs: now + duration * 1000 });
      }
    }

    setExercises((current) =>
      current.map((entry) =>
        entry.localKey === exerciseKey
          ? {
              ...entry,
              sets: entry.sets.map((item) => (item.localKey === setKey ? { ...item, done: !item.done } : item)),
            }
          : entry,
      ),
    );
  };

  const adjustRest = (deltaSeconds: number) =>
    setRest((current) => {
      if (!current) {
        return current;
      }
      const now = Date.now();
      const remaining = Math.max(1, Math.ceil((current.endsAtMs - now) / 1000) + deltaSeconds);
      return {
        totalSeconds: Math.max(1, current.totalSeconds + deltaSeconds),
        endsAtMs: now + remaining * 1000,
      };
    });

  const handleFinish = async () => {
    if (!canFinish) {
      return;
    }

    setIsSaving(true);
    try {
      const { draft, summary } = buildFreestyleFinish({
        exercises,
        workoutName: t(language, 'emptyWorkout.title'),
        startedAtIso: new Date(startedAtMs ?? Date.now()).toISOString(),
        performedAtIso: new Date().toISOString(),
        elapsedSeconds,
        exercisePrLookup,
      });
      await onSave(draft, summary);
    } catch {
      // Save failed — the logged sets stay on screen so nothing is lost;
      // App.tsx surfaces the error toast. Never show success early.
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'emptyWorkout.a11y.back')} onPress={onBack} hitSlop={10} style={styles.headerBack}>
          <Svg viewBox="0 0 24 24" width={24} height={24}>
            <Path d="M15 6l-6 6 6 6" stroke={theme.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t(language, 'emptyWorkout.title')}</Text>
          <Text style={styles.headerClock}>{formatSessionClock(elapsedSeconds)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'emptyWorkout.finishWorkout')}
          onPress={handleFinish}
          disabled={!canFinish}
          hitSlop={10}
          style={styles.headerFinish}
        >
          <Text style={[styles.headerFinishText, !canFinish && styles.headerFinishTextDisabled]}>
            {t(language, 'emptyWorkout.finish')}
          </Text>
        </Pressable>
      </View>

      {/* stat strip */}
      <View style={styles.statStrip}>
        <Text style={[styles.statText, !hasExercises && styles.statTextFaint]}>
          {t(language, doneSetCount === 1 ? 'emptyWorkout.stat.setsOne' : 'emptyWorkout.stat.setsMany', { count: doneSetCount })}
        </Text>
        <View style={styles.statDot} />
        <Text style={[styles.statText, !hasExercises && styles.statTextFaint]}>
          {t(language, 'emptyWorkout.stat.volume', { volume: formatVolumeLabel(volumeKg) })}
        </Text>
        <Text style={styles.statTag}>{t(language, 'emptyWorkout.stat.tag')}</Text>
      </View>

      {!hasExercises ? (
        /* ── empty state ── */
        <ScrollView style={styles.body} contentContainerStyle={styles.emptyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyHero}>
            <View style={styles.emptyIconTile}>
              <Svg viewBox="0 0 24 24" width={42} height={42}>
                <Path
                  d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
                  stroke={theme.purple}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>{t(language, 'emptyWorkout.empty.title')}</Text>
            <Text style={styles.emptySubtitle}>{t(language, 'emptyWorkout.empty.sub')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'emptyWorkout.addExercise')}
              onPress={() => setSheetVisible(true)}
              style={styles.emptyCta}
            >
              <PlusIcon size={20} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>{t(language, 'emptyWorkout.addExercise')}</Text>
            </Pressable>
          </View>

          {quickItems.length > 0 ? (
            <View style={styles.quickSection}>
              <View style={styles.quickHeader}>
                <Text style={styles.quickTitle}>{quickListTitle}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t(language, 'emptyWorkout.seeAll')} onPress={() => setSheetVisible(true)} hitSlop={8}>
                  <Text style={styles.quickSeeAll}>{t(language, 'emptyWorkout.seeAll')}</Text>
                </Pressable>
              </View>
              <View style={styles.quickList}>
                {quickItems.map((item) => (
                  <Pressable key={item.id} onPress={() => addExercises([item])} style={styles.quickRow}>
                    <Tile initials={exerciseInitials(exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise')))} size={44} />
                    <View style={styles.quickRowCopy}>
                      <Text numberOfLines={1} style={styles.quickRowName}>
                        {exerciseNameLabel(language, formatLiftDisplayLabel(item.name, 'Exercise'))}
                      </Text>
                      <Text numberOfLines={1} style={styles.quickRowMeta}>
                        {bodyPartLabel(language, item.bodyPart)}
                      </Text>
                    </View>
                    <View style={styles.quickRowPlus}>
                      <PlusIcon size={16} color={theme.purpleDark} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        /* ── freestyle logging ── */
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.loggingContent, { paddingBottom: rest ? 118 : 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Denied: say plainly what breaks, at the moment it matters — the
              start of a rest — with a route to fix it. Once per session. */}
          {deniedBannerShown && alertPermission === 'denied' ? (
            <View style={styles.deniedBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deniedTitle}>{t(language, 'rest.denied.title')}</Text>
                <Text style={styles.deniedBody}>{t(language, 'rest.denied.body')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDeniedBannerShown(false);
                  onOpenSystemSettings?.();
                }}
                hitSlop={8}
              >
                <Text style={styles.deniedAction}>{t(language, 'rest.denied.action')}</Text>
              </Pressable>
            </View>
          ) : null}
          {exercises.map((exercise, exerciseIndex) => {
            const activeIndex = exercise.sets.findIndex((set) => !set.done);
            return (
              <View key={exercise.localKey} style={[styles.exerciseBlock, exerciseIndex > 0 && styles.exerciseBlockDivided]}>
                <View style={styles.exerciseHead}>
                  <Tile initials={exercise.initials} size={40} radius={11} />
                  <View style={styles.exerciseHeadCopy}>
                    <Text numberOfLines={1} style={styles.exerciseName}>
                      {exerciseNameLabel(language, exercise.displayName)}
                    </Text>
                    <Text numberOfLines={1} style={styles.exerciseMeta}>
                      {exercise.metaLabel}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'emptyWorkout.a11y.remove', { name: exercise.displayName })}
                    onPress={() => removeExercise(exercise.localKey)}
                    style={styles.exerciseRemove}
                  >
                    <Svg viewBox="0 0 24 24" width={18} height={18}>
                      <Path d="M6 6l12 12M18 6L6 18" stroke={theme.faint} strokeWidth={2.2} fill="none" strokeLinecap="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.setGridHeader}>
                  <Text style={[styles.setGridHeaderText, styles.setColIndex]}>#</Text>
                  <Text style={[styles.setGridHeaderText, styles.setColField, styles.setGridHeaderCenter]}>KG</Text>
                  <Text style={[styles.setGridHeaderText, styles.setColField, styles.setGridHeaderCenter]}>
                    {t(language, 'emptyWorkout.col.reps')}
                  </Text>
                  <View style={styles.setColCheck} />
                </View>

                <View style={styles.setList}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.localKey}>
                      <View style={[styles.setRow, set.done && styles.setRowDone]}>
                        <Text style={[styles.setIndex, styles.setColIndex, setIndex === activeIndex && styles.setIndexActive]}>
                          {setIndex + 1}
                        </Text>
                        <TextInput
                          value={set.kg}
                          onChangeText={(value) => patchSet(exercise.localKey, set.localKey, { kg: value })}
                          placeholder="0"
                          placeholderTextColor={AW3.ghost}
                          selectionColor={theme.purple}
                          keyboardType="decimal-pad"
                          style={[styles.setInput, styles.setColField]}
                        />
                        <TextInput
                          value={set.reps}
                          onChangeText={(value) => patchSet(exercise.localKey, set.localKey, { reps: value })}
                          placeholder="0"
                          placeholderTextColor={AW3.ghost}
                          selectionColor={theme.purple}
                          keyboardType="number-pad"
                          style={[styles.setInput, styles.setColField]}
                        />
                        <View style={[styles.setColCheck, styles.setCheckCell]}>
                          <SetCheckButton
                            done={set.done}
                            label={t(language, set.done ? 'emptyWorkout.a11y.setNotDone' : 'emptyWorkout.a11y.setDone')}
                            onPress={() => toggleSetDone(exercise.localKey, set.localKey)}
                          />
                        </View>
                      </View>
                      {/* The strip only exists once there is a weight to break
                          into plates — an empty panel taught nobody anything. */}
                      {exercise.isBarbell && setIndex === activeIndex && parseNumberInput(set.kg) ? (
                        <FadeInView style={styles.plateStrip}>
                          <PlatePop kg={set.kg} language={language} />
                        </FadeInView>
                      ) : null}
                    </View>
                  ))}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'emptyWorkout.a11y.addSetTo', { name: exercise.displayName })}
                  onPress={() => addSet(exercise.localKey)}
                  style={styles.addSetButton}
                >
                  <PlusIcon size={15} color={theme.purpleDark} strokeWidth={2.6} />
                  <Text style={styles.addSetText}>{t(language, 'emptyWorkout.addSet')}</Text>
                </Pressable>
              </View>
            );
          })}

          <View style={styles.loggingFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'emptyWorkout.addExercise')}
              onPress={() => setSheetVisible(true)}
              style={styles.addExerciseDashed}
            >
              <PlusIcon size={17} color={theme.purpleDark} strokeWidth={2.6} />
              <Text style={styles.addExerciseDashedText}>{t(language, 'emptyWorkout.addExercise')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'emptyWorkout.finishWorkout')}
              onPress={handleFinish}
              disabled={!canFinish}
              style={[styles.finishButton, isSaving && styles.finishButtonSaving]}
            >
              <CheckIcon size={19} color="#FFFFFF" />
              <Text style={styles.finishButtonText}>
                {isSaving ? t(language, 'emptyWorkout.saving') : t(language, 'emptyWorkout.finishWorkout')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {rest && restRemaining !== null && !sheetVisible ? (
        <RestBar
          totalSeconds={rest.totalSeconds}
          remainingSeconds={restRemaining}
          endsAtMs={rest.endsAtMs}
          overrunSeconds={restStatus?.phase === 'done' ? restStatus.overrunSeconds : null}
          onAdjust={adjustRest}
          onSkip={() => setRest(null)}
          onLogSet={() => setRest(null)}
          doneLabel={nextSetLabel}
          language={language}
        />
      ) : null}


      <RestAlertsSheet
        visible={permissionSheetOpen}
        language={language}
        onAllow={() => void allowAlerts()}
        onLater={laterAlerts}
      />

      <AddExerciseSheetHG
        visible={sheetVisible}
        items={exerciseLibrary}
        language={language}
        onClose={() => setSheetVisible(false)}
        onAdd={addExercises}
      />
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────

const makeStyles = (theme: Theme) => {
  const AW3 = aw3ForTheme(theme);
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerBack: {
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.15,
  },
  headerClock: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  headerFinish: {
    flexShrink: 0,
  },
  headerFinishText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.purple,
  },
  headerFinishTextDisabled: {
    color: '#C9C2DA',
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AW3.hair,
  },
  statText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.ink,
  },
  statTextFaint: {
    color: theme.faint,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: AW3.ghost,
  },
  statTag: {
    marginLeft: 'auto',
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
  },
  body: {
    flex: 1,
  },

  // empty state
  emptyContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emptyHero: {
    marginTop: 34,
    alignItems: 'center',
  },
  emptyIconTile: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.2,
    marginTop: 18,
  },
  emptySubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 7,
    lineHeight: 20,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyCta: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 22,
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  emptyCtaText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickSection: {
    marginTop: 34,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
  },
  quickSeeAll: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.highlight,
  },
  quickList: {
    gap: 9,
    marginTop: 12,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  quickRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.ink,
  },
  quickRowMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.faint,
    marginTop: 2,
  },
  quickRowPlus: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // logging state
  loggingContent: {},
  // Amber, not red: nothing is broken, one thing is off.
  deniedBanner: {
    marginTop: 14,
    marginHorizontal: 14,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#FEF3E2',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deniedTitle: { fontSize: 13.5, fontWeight: '800', color: '#D97706' },
  deniedBody: { fontSize: 12.5, fontWeight: '700', color: '#3B3550', marginTop: 3, lineHeight: 17 },
  deniedAction: { fontSize: 13, fontWeight: '800', color: '#D97706' },
  exerciseBlock: {
    paddingTop: 15,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  exerciseBlockDivided: {
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  exerciseHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 16.5,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.16,
  },
  exerciseMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.faint,
    marginTop: 1,
  },
  exerciseRemove: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  setGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 13,
  },
  setGridHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: theme.faint,
  },
  setGridHeaderCenter: {
    textAlign: 'center',
  },
  setColIndex: {
    width: 22,
  },
  setColField: {
    flex: 1,
  },
  setColCheck: {
    width: 44,
  },
  setList: {
    gap: 6,
    marginTop: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
  },
  setRowDone: {
    backgroundColor: AW3.field,
  },
  setIndex: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.ink,
  },
  setIndexActive: {
    color: theme.purple,
  },
  setInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    backgroundColor: AW3.field,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: theme.ink,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  setCheckCell: {
    alignItems: 'center',
  },
  setCheck: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEBF9',
  },
  setCheckDone: {
    backgroundColor: theme.green,
  },
  plateStrip: {
    marginTop: 7,
    marginBottom: 2,
    marginHorizontal: -8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.purpleLight,
  },
  addSetButton: {
    height: 36,
    borderRadius: 999,
    backgroundColor: theme.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 11,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.purpleDark,
  },
  loggingFooter: {
    marginTop: 6,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
    gap: 12,
  },
  addExerciseDashed: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addExerciseDashedText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.purpleDark,
  },
  finishButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 10,
  },
  finishButtonSaving: {
    opacity: 0.7,
  },
  finishButtonText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // shared tile
  tile: {
    flexShrink: 0,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontWeight: '800',
    color: theme.purpleDark,
    letterSpacing: 0.3,
  },

  // add-exercise sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,12,40,0.42)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: theme.bg,
    overflow: 'hidden',
  },
  sheetGripRow: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 4,
  },
  sheetGrip: {
    width: 38,
    height: 4.5,
    borderRadius: 999,
    backgroundColor: '#D8CFEC',
  },
  sheetHead: {
    paddingTop: 6,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.22,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 3,
  },
  sheetClose: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.purple,
    paddingTop: 4,
  },
  searchField: {
    marginTop: 14,
    height: 46,
    borderRadius: 13,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.ink,
    paddingVertical: 0,
  },
  sheetChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
  },
  sheetChipActive: {
    backgroundColor: theme.purple,
    borderColor: theme.purple,
  },
  sheetChipText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: theme.ink,
  },
  sheetChipTextActive: {
    color: '#FFFFFF',
  },
  sheetSectionHeader: {
    paddingHorizontal: 20,
  },
  sheetSectionHeaderAll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: theme.ink,
  },
  sheetSectionSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 2,
  },
  popularRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 4,
  },
  popularCard: {
    width: 148,
    flexShrink: 0,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    padding: 12,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  popularCardSelected: {
    borderColor: theme.purple,
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 5,
  },
  popularTile: {
    height: 78,
    borderRadius: 12,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularTileText: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.purpleDark,
  },
  popularToggle: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  popularName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.ink,
    marginTop: 10,
    lineHeight: 17,
  },
  popularMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.faint,
    marginTop: 4,
  },
  selectPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    shadowColor: '#28185A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    flexShrink: 0,
  },
  selectPillOn: {
    backgroundColor: theme.green,
    borderColor: theme.green,
  },
  sheetListContent: {
    paddingBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 14,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: AW3.fieldBorder,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sheetRowSelected: {
    borderColor: theme.purple,
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetRowName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.ink,
  },
  sheetRowMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.faint,
    marginTop: 2,
  },
  sheetEmptyText: {
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
    fontWeight: '700',
    color: theme.faint,
  },
  sheetFooter: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: AW3.hair,
    backgroundColor: theme.bg,
  },
  sheetConfirm: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.purple,
    shadowColor: theme.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  sheetConfirmDisabled: {
    backgroundColor: '#E7E1F2',
    shadowOpacity: 0,
    elevation: 0,
  },
  sheetConfirmText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetConfirmTextDisabled: {
    color: theme.faint,
  },
  });
};

import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildDraftFromCsvPreview, CsvLibraryEntry, parseCsvProgram } from '../lib/csvProgramImport';
import { countKnownNames } from '../lib/exerciseNameBook';
import { HevyImportPreview, isHevyHistoryCsv, parseHevyCsv } from '../lib/hevyImport';
import { I18nKey, t } from '../lib/i18n';
import { ProLockIcon, ProPill } from './ProLockMarks';
import type { AppLanguage, ExerciseNameBookEntry, WorkoutTemplateDraft } from '../types/models';
import { Theme, useTheme, useThemedStyles } from '../theming';

// Program accent (design_handoff_programs_redesign, hue 150). The handoff
// specifies oklch values; RN has no oklch support, so these are the closest hex.
// Matches the Programs tab, which no longer carries its own green accent.
const ACCENT = '#7C3AED';
const ACCENT_SOFT = '#EAF7EF';
const ACCENT_LINE = '#8AD4AC';

const SAMPLE_CSV = [
  'Day,Exercise,Sets,Reps',
  'Day 1,Bench Press,4,6-10',
  'Day 1,Incline Dumbbell Press,3,8-12',
  'Day 1,Cable Fly,3,12-15',
  'Day 2,Barbell Row,4,6-10',
  'Day 2,Lat Pulldown,3,10-12',
  'Day 3,Back Squat,4,5-8',
  'Day 3,Romanian Deadlift,3,8-10',
].join('\n');

interface NewProgramSheetProps {
  visible: boolean;
  language?: AppLanguage;
  exerciseLibrary: CsvLibraryEntry[];
  /**
   * Where the sheet opens. Settings' "Import plan (CSV)" row means exactly one
   * thing, so it skips the menu — and the back arrow with it, since there is no
   * menu behind it to go back to.
   */
  initialView?: 'menu' | 'csv';
  onClose: () => void;
  onAiAssisted: () => void;
  onBuildYourself: () => void;
  /**
   * The fourth way in. The 57 ready programmes had no door on this sheet at
   * all — only the goal discs on the tab behind it, which are a taxonomy and
   * cannot be narrowed. Optional so a caller without a catalog simply does not
   * offer the row, rather than offering one that goes nowhere.
   */
  onBrowseCatalog?: () => void;
  /** How many ready programmes the catalog row is promising. */
  catalogCount?: number;
  /**
   * Whether the reader has Pro.
   *
   * Composing a programme is the paid part, and the row says so with the PRO
   * pill and the padlock. It still opens the coach: the gate lives on the act
   * of composing, in AICoachChatScreen, and everything before that act is
   * free. Defaults to unlocked so a caller that forgets cannot mark a paying
   * reader's row as something they have not bought.
   */
  proUnlocked?: boolean;
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
  /**
   * A pasted Hevy export is HISTORY, not a programme — workouts already
   * performed. When the paste is recognised as one, this runs instead of
   * the programme importer. Optional: a caller without it still gets the
   * detection banner, so the paste is never mis-parsed as a programme.
   */
  onImportHistory?: (preview: HevyImportPreview) => Promise<void> | void;
  /**
   * The reader's own names for lifts, learned from earlier corrections. Rows
   * the library cannot match are matched against this first.
   */
  nameBook?: readonly ExerciseNameBookEntry[];
  /**
   * Reads a programme out of a photo the reader picks. Returns the CSV text
   * the paste box would have held, or null when nothing usable came back —
   * the sheet does not care which of the several ways it can fail happened,
   * because the reader is left in the same place by all of them.
   */
  onPickImage?: () => Promise<string | null>;
  /**
   * Called when the reader says what one of their own names means. Persisting
   * it is the caller's job; this sheet only re-parses once it comes back.
   */
  onTeachName?: (wrote: string, exercise: CsvLibraryEntry) => Promise<void> | void;
}

function OptionIcon({ name }: { name: 'spark' | 'build' | 'table' | 'layers' }) {
  const theme = useTheme();

  const stroke = name === 'spark' ? '#FFFFFF' : theme.purple;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'spark' ? (
        <Path
          d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
          stroke={stroke}
          strokeWidth={1.9}
          strokeLinejoin="round"
        />
      ) : null}
      {name === 'build' ? (
        <Path d="M4 6h16M4 12h16M4 18h10" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      ) : null}
      {name === 'table' ? (
        <Path d="M4 5h16v14H4V5zm0 5h16M4 14h16M10 5v14" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
      ) : null}
      {name === 'layers' ? (
        <Path
          d="M12 3l9 5-9 5-9-5 9-5zm9 9l-9 5-9-5m18 4l-9 5-9-5"
          stroke={stroke}
          strokeWidth={1.9}
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

function Chevron() {
  const theme = useTheme();

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="m9 6 6 6-6 6" stroke={theme.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function NewProgramSheet({
  visible,
  language = 'en',
  exerciseLibrary,
  initialView = 'menu',
  onClose,
  onAiAssisted,
  onBuildYourself,
  onBrowseCatalog,
  catalogCount = 0,
  proUnlocked = true,
  onImportProgram,
  onImportHistory,
  nameBook = [],
  onTeachName,
  onPickImage,
}: NewProgramSheetProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The sheet sits on the system navigation bar. Its own 28dp used to be the
  // whole bottom padding, so on a phone with three-button navigation the last
  // option ("Tuo CSV") sat under the buttons.
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'menu' | 'csv'>(initialView);
  /*
   * The padlock is a LABEL, not a wall, and the difference is a free feature.
   *
   * Sending a locked reader to the paywall instead of the coach was measured
   * to cut off something the chat gives away on purpose: any brief naming a
   * days-per-week runs shouldOfferCatalogInstead first, and a matching ready
   * programme comes back free — AICoachChatScreen checks it BEFORE its own Pro
   * gate, and says so in a comment. So the row opens the coach either way, and
   * the paywall stays where composing actually happens.
   */
  const aiLocked = !proUnlocked;
  const [csvText, setCsvText] = useState('');
  const defaultProgramName = t(language, 'csv.defaultName');
  const [programName, setProgramName] = useState(defaultProgramName);
  const [importing, setImporting] = useState(false);
  /**
   * Which unmatched name the reader is currently explaining, and what they
   * have typed to find it. Null = nobody is being asked anything.
   */
  const [teaching, setTeaching] = useState<string | null>(null);
  const [teachQuery, setTeachQuery] = useState('');
  const [readingImage, setReadingImage] = useState(false);
  const [imageNote, setImageNote] = useState<string | null>(null);

  async function handlePickImage() {
    if (!onPickImage || readingImage) {
      return;
    }
    setImageNote(null);
    setReadingImage(true);
    try {
      const csv = await onPickImage();
      if (csv) {
        setCsvText(csv);
      } else {
        // One sentence for every way this ends badly. The reader is in the
        // same place whether the network failed, the photo was not a
        // programme, or permission was refused: nothing to import, try the
        // paste box. Naming the branch would not change what they do next.
        setImageNote(t(language, 'csv.photo.failed'));
      }
    } finally {
      setReadingImage(false);
    }
  }

  // Detected BEFORE the programme parser runs: a Hevy export is set rows,
  // and reading them as Day/Exercise/Sets/Reps would produce garbage.
  const hevyPreview = useMemo(
    () => (csvText.trim() && isHevyHistoryCsv(csvText) ? parseHevyCsv(csvText) : null),
    [csvText],
  );
  const preview = useMemo(
    () => (csvText.trim() && !hevyPreview ? parseCsvProgram(csvText, exerciseLibrary, nameBook) : null),
    [csvText, exerciseLibrary, hevyPreview, nameBook],
  );
  /**
   * How many of the reader's own names this sheet recognised — the visible
   * proof that teaching it was worth doing. Distinct spellings, because a
   * name used on six days was taught once and rescued one name, not six.
   */
  const recognisedOwnNames = useMemo(
    () =>
      preview
        ? countKnownNames(nameBook, preview.rows.filter((row) => row.viaNameBook).map((row) => row.exerciseName))
        : 0,
    [nameBook, preview],
  );
  /** The library, filtered by what the reader typed while explaining a name. */
  const teachResults = useMemo(() => {
    if (teaching === null) {
      return [];
    }
    const query = teachQuery.trim().toLowerCase();
    const pool = query
      ? exerciseLibrary.filter((entry) => entry.name.toLowerCase().includes(query))
      : exerciseLibrary;
    // Capped: 873 rows inside a sheet is a scroll, not a choice.
    return pool.slice(0, 20);
  }, [exerciseLibrary, teachQuery, teaching]);

  async function handleTeach(exercise: CsvLibraryEntry) {
    if (teaching === null || !onTeachName) {
      return;
    }
    const wrote = teaching;
    setTeaching(null);
    setTeachQuery('');
    // The preview re-parses on its own once the book comes back through props
    // — this sheet does not keep a second copy of what was learned.
    await onTeachName(wrote, exercise);
  }

  function reset() {
    setView(initialView);
    setCsvText('');
    setProgramName(defaultProgramName);
    setImporting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImportHistory() {
    if (!hevyPreview || hevyPreview.workouts.length === 0 || !onImportHistory || importing) {
      return;
    }
    setImporting(true);
    try {
      await onImportHistory(hevyPreview);
      handleClose();
    } finally {
      setImporting(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.matchedCount === 0 || importing) {
      return;
    }
    setImporting(true);
    try {
      await onImportProgram(buildDraftFromCsvPreview(preview, programName.trim() || defaultProgramName));
      handleClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.scrim} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.panelWrap} pointerEvents="box-none">
        <View style={[styles.panel, view === 'csv' && styles.panelTall, { paddingBottom: 28 + insets.bottom }]}>
          <View style={styles.grabHandle} />
          <View style={styles.headerRow}>
            {view !== initialView ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'common.back')}
                onPress={() => setView('menu')}
                hitSlop={8}
                style={styles.roundButton}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 6l-6 6 6 6" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            ) : (
              <View style={styles.roundButtonSpacer} />
            )}
            <Text style={styles.headerTitle}>{t(language, view === 'csv' ? 'csv.title' : 'csv.newProgram')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'common.close')}
              onPress={handleClose}
              hitSlop={8}
              style={styles.roundButton}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M6 6l12 12M18 6L6 18" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          {view === 'menu' ? (
            <View style={styles.menu}>
              <Text style={styles.subtitle}>{t(language, 'csv.pickHow')}</Text>
              {/* The catalog first. The brief drew it fourth and said so in its
                  own notes — "probably the most-used door and it is currently
                  last" — and the call on 2026-08-31 was to try it high. It
                  only appears when a caller can actually open it. */}
              {onBrowseCatalog ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'csv.catalogA11y')}
                  onPress={() => {
                    handleClose();
                    onBrowseCatalog();
                  }}
                  style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
                >
                  <View style={styles.optionIconTile}>
                    <OptionIcon name="layers" />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{t(language, 'csv.catalog')}</Text>
                    <Text style={styles.optionBody}>
                      {t(language, 'csv.catalogBody', { count: catalogCount })}
                    </Text>
                  </View>
                  <Chevron />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, aiLocked ? 'csv.aiLockedA11y' : 'csv.aiA11y')}
                onPress={() => {
                  handleClose();
                  onAiAssisted();
                }}
                style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
              >
                <View style={[styles.optionIconTile, styles.optionIconTileAccent]}>
                  <OptionIcon name="spark" />
                </View>
                <View style={styles.optionCopy}>
                  <View style={styles.optionTitleLine}>
                    <Text style={styles.optionTitle}>{t(language, 'csv.ai')}</Text>
                    {aiLocked ? <ProPill /> : null}
                  </View>
                  <Text style={styles.optionBody}>{t(language, 'csv.aiBody')}</Text>
                </View>
                {aiLocked ? <ProLockIcon color={theme.purple} size={18} /> : <Chevron />}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'csv.buildA11y')}
                onPress={() => {
                  handleClose();
                  onBuildYourself();
                }}
                style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
              >
                <View style={styles.optionIconTile}>
                  <OptionIcon name="build" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{t(language, 'csv.build')}</Text>
                  <Text style={styles.optionBody}>{t(language, 'csv.buildBody')}</Text>
                </View>
                <Chevron />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'csv.importA11y')}
                onPress={() => setView('csv')}
                style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
              >
                <View style={styles.optionIconTile}>
                  <OptionIcon name="table" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{t(language, 'csv.title')}</Text>
                  <Text style={styles.optionBody}>{t(language, 'csv.importBody')}</Text>
                </View>
                <Chevron />
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.csvContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.subtitle}>{t(language, 'csv.pasteHint')}</Text>

              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                multiline
                placeholder={'Day,Exercise,Sets,Reps\nDay 1,Bench Press,4,6-10\n…'}
                placeholderTextColor={theme.faint}
                style={styles.csvInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.csvLinkRow}>
                <Pressable accessibilityRole="button" onPress={() => setCsvText(SAMPLE_CSV)} hitSlop={6}>
                  <Text style={styles.sampleLink}>{t(language, 'csv.loadSample')}</Text>
                </Pressable>
                {/* A photo of the reader's spreadsheet becomes the same text a
                    paste would have produced, so it lands in the box above and
                    joins this flow rather than getting one of its own. */}
                {onPickImage ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={readingImage}
                    onPress={() => void handlePickImage()}
                    hitSlop={6}
                  >
                    <Text style={styles.sampleLink}>
                      {readingImage ? t(language, 'csv.photo.reading') : t(language, 'csv.photo.cta')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {imageNote ? <Text style={styles.errorNote}>{imageNote}</Text> : null}

              {hevyPreview ? (
                <>
                  <View style={[styles.resultBanner, hevyPreview.workouts.length > 0 ? styles.resultBannerOk : styles.resultBannerWarn]}>
                    <Text style={styles.resultBannerText}>
                      {hevyPreview.workouts.length === 0
                        ? t(language, 'hevy.empty')
                        : t(language, 'hevy.detected', {
                            workouts: hevyPreview.workouts.length,
                            sets: hevyPreview.setCount,
                            first: hevyPreview.firstDate ? new Date(hevyPreview.firstDate).toLocaleDateString() : '',
                            last: hevyPreview.lastDate ? new Date(hevyPreview.lastDate).toLocaleDateString() : '',
                          })}
                    </Text>
                  </View>
                  {hevyPreview.skippedRowCount > 0 ? (
                    <Text style={styles.errorNote}>
                      {t(language, 'hevy.skipped', { count: hevyPreview.skippedRowCount })}
                    </Text>
                  ) : null}
                  {hevyPreview.workouts.length > 0 && onImportHistory ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(language, 'hevy.import', { count: hevyPreview.workouts.length })}
                      onPress={() => void handleImportHistory()}
                      disabled={importing}
                      style={({ pressed }) => [styles.importButton, (pressed || importing) && styles.pressed]}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.importButtonText}>
                        {importing
                          ? t(language, 'csv.importing')
                          : t(language, 'hevy.import', { count: hevyPreview.workouts.length })}
                      </Text>
                    </Pressable>
                  ) : null}
                  {hevyPreview.workouts.length > 0 && !onImportHistory ? (
                    <Text style={styles.errorNote}>{t(language, 'hevy.useSettings')}</Text>
                  ) : null}
                </>
              ) : preview ? (
                <>
                  <View style={[styles.resultBanner, preview.unmatchedCount === 0 && preview.rows.length > 0 ? styles.resultBannerOk : styles.resultBannerWarn]}>
                    <Text style={styles.resultBannerText}>
                      {preview.rows.length === 0
                        ? preview.errors[0] ?? t(language, 'csv.noRows')
                        : `${t(language, 'csv.rowSummary', {
                            rows: preview.rows.length,
                            matched: preview.matchedCount,
                          })}${
                            preview.unmatchedCount
                              ? t(language, 'csv.unmatchedSuffix', { count: preview.unmatchedCount })
                              : t(language, 'csv.allMatchedSuffix')
                          }`}
                    </Text>
                  </View>

                  {/* What the book did for this import. Without a line saying
                      so, the reader's earlier corrections are invisible work
                      and look like the app simply got better at guessing. */}
                  {recognisedOwnNames > 0 ? (
                    <Text style={styles.ownNamesNote}>
                      {t(language, 'csv.ownNames', { count: recognisedOwnNames })}
                    </Text>
                  ) : null}

                  {preview.errors.length > 0 && preview.rows.length > 0 ? (
                    <Text style={styles.errorNote}>{preview.errors.join('\n')}</Text>
                  ) : null}

                  {preview.rows.length > 0 ? (
                    <View style={styles.previewTable}>
                      <View style={styles.previewHeader}>
                        <Text style={[styles.previewHeaderCell, styles.previewDay]}>{t(language, 'csv.col.day')}</Text>
                        <Text style={[styles.previewHeaderCell, styles.previewName]}>
                          {t(language, 'csv.col.exercise')}
                        </Text>
                        <Text style={[styles.previewHeaderCell, styles.previewSets]}>{t(language, 'csv.col.sets')}</Text>
                        <Text style={[styles.previewHeaderCell, styles.previewReps]}>{t(language, 'csv.col.reps')}</Text>
                      </View>
                      {preview.rows.map((row, index) => {
                        const teachable = !row.matchedName && Boolean(onTeachName);
                        const open = teaching !== null && teaching === row.exerciseName;
                        return (
                        <View key={`${row.day}-${row.exerciseName}-${index}`}>
                        <Pressable
                          accessibilityRole={teachable ? 'button' : undefined}
                          accessibilityLabel={
                            teachable ? t(language, 'csv.teach.a11y', { name: row.exerciseName }) : undefined
                          }
                          disabled={!teachable}
                          onPress={() => {
                            setTeaching(open ? null : row.exerciseName);
                            setTeachQuery('');
                          }}
                          style={[styles.previewRow, !row.matchedName && styles.previewRowUnmatched]}
                        >
                          <Text style={[styles.previewCellDay, styles.previewDay]} numberOfLines={1}>
                            {row.day}
                          </Text>
                          <View style={styles.previewName}>
                            <Text style={[styles.previewCellName, !row.matchedName && styles.previewCellNameUnmatched]} numberOfLines={1}>
                              {row.matchedName ?? row.exerciseName}
                            </Text>
                            {row.viaNameBook ? (
                              // Say which of the two happened. "We guessed" and
                              // "you told us" are different promises, and only
                              // one of them is worth trusting without a look.
                              <Text style={styles.previewCellLearned} numberOfLines={1}>
                                {t(language, 'csv.yourName', { name: row.exerciseName })}
                              </Text>
                            ) : null}
                            {!row.matchedName ? (
                              <Text style={styles.previewCellHint} numberOfLines={1}>
                                {teachable
                                  ? t(language, 'csv.teach.prompt')
                                  : row.suggestion
                                    ? t(language, 'csv.didYouMean', { name: row.suggestion })
                                    : t(language, 'csv.willSkip')}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.previewCellMeta, styles.previewSets]}>{row.sets}</Text>
                          <Text style={[styles.previewCellMeta, styles.previewReps]}>
                            {row.repMin === row.repMax ? row.repMax : `${row.repMin}–${row.repMax}`}
                          </Text>
                        </Pressable>
                        {open ? (
                          <View style={styles.teachPanel}>
                            <Text style={styles.teachTitle}>
                              {t(language, 'csv.teach.title', { name: row.exerciseName })}
                            </Text>
                            <TextInput
                              value={teachQuery}
                              onChangeText={setTeachQuery}
                              placeholder={t(language, 'csv.teach.search')}
                              placeholderTextColor={theme.faint}
                              autoCorrect={false}
                              style={styles.teachInput}
                            />
                            {teachResults.map((entry) => (
                              <Pressable
                                key={entry.id}
                                accessibilityRole="button"
                                onPress={() => void handleTeach(entry)}
                                style={({ pressed }) => [styles.teachResult, pressed && styles.teachResultPressed]}
                              >
                                <Text style={styles.teachResultText} numberOfLines={1}>
                                  {entry.name}
                                </Text>
                              </Pressable>
                            ))}
                            {teachResults.length === 0 ? (
                              <Text style={styles.previewCellHint}>{t(language, 'csv.teach.noMatch')}</Text>
                            ) : null}
                          </View>
                        ) : null}
                        </View>
                        );
                      })}
                    </View>
                  ) : null}

                  {preview.matchedCount > 0 ? (
                    <>
                      <Text style={styles.nameLabel}>{t(language, 'csv.programName')}</Text>
                      <TextInput
                        value={programName}
                        onChangeText={setProgramName}
                        style={styles.nameInput}
                        placeholder={defaultProgramName}
                        placeholderTextColor={theme.faint}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(language, 'csv.importCount', { count: preview.matchedCount })}
                        onPress={() => void handleImport()}
                        disabled={importing}
                        style={({ pressed }) => [styles.importButton, (pressed || importing) && styles.pressed]}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.importButtonText}>
                          {importing
                            ? t(language, 'csv.importing')
                            : t(
                                language,
                                preview.matchedCount === 1 ? 'csv.importOne' : 'csv.importCount',
                                { count: preview.matchedCount },
                              )}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </>
              ) : (
                <View style={styles.columnsCard}>
                  <Text style={styles.columnsTitle}>{t(language, 'csv.expectedColumns')}</Text>
                  {/* The header names stay English — the parser matches on them. */}
                  {(
                    [
                      ['Day', 'csv.help.day'],
                      ['Exercise', 'csv.help.exercise'],
                      ['Sets', 'csv.help.sets'],
                      ['Reps', 'csv.help.reps'],
                    ] as Array<[string, I18nKey]>
                  ).map(([key, helpKey]) => (
                    <View key={key} style={styles.columnsRow}>
                      <Text style={styles.columnsKey}>{key}</Text>
                      <Text style={styles.columnsHelp}>{t(language, helpKey)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,12,40,0.42)',
  },
  panelWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: theme.bg,
    paddingHorizontal: 20,
    paddingBottom: 28,
    shadowColor: '#140C28',
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -14 },
    elevation: 20,
  },
  panelTall: {
    height: '92%',
  },
  grabHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.border,
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    color: theme.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonSpacer: {
    width: 34,
    height: 34,
  },
  subtitle: {
    color: theme.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 14,
  },
  menu: {
    paddingTop: 6,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 15,
  },
  optionIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconTileAccent: {
    backgroundColor: ACCENT,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  optionTitle: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  optionBody: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  csvContent: {
    paddingTop: 6,
    paddingBottom: 24,
    gap: 12,
  },
  csvInput: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 12,
    color: theme.ink,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  sampleLink: {
    color: theme.purple,
    fontSize: 12.5,
    fontWeight: '800',
  },
  resultBanner: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
  },
  resultBannerOk: {
    backgroundColor: ACCENT_SOFT,
    borderColor: ACCENT_LINE,
  },
  resultBannerWarn: {
    backgroundColor: '#FEF6E7',
    borderColor: '#F2D8A0',
  },
  resultBannerText: {
    color: theme.ink,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  errorNote: {
    color: '#B45309',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  previewTable: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: theme.purpleSoft,
    gap: 8,
  },
  previewHeaderCell: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  previewRowUnmatched: {
    backgroundColor: '#FEF6E7',
  },
  previewDay: {
    width: 54,
  },
  previewName: {
    flex: 1,
  },
  previewSets: {
    width: 34,
    textAlign: 'center',
  },
  previewReps: {
    width: 52,
    textAlign: 'right',
  },
  previewCellDay: {
    color: theme.purple,
    fontSize: 12,
    fontWeight: '800',
  },
  previewCellName: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  previewCellNameUnmatched: {
    color: '#B45309',
  },
  previewCellHint: {
    color: '#B45309',
    fontSize: 10.5,
    fontWeight: '600',
  },
  previewCellLearned: {
    color: theme.purple,
    fontSize: 10.5,
    fontWeight: '700',
  },
  csvLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ownNamesNote: {
    color: theme.purple,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  // The "what did you mean" panel, opening under the row it belongs to.
  teachPanel: {
    backgroundColor: theme.surfaceSoft,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    gap: 6,
  },
  teachTitle: {
    color: theme.ink,
    fontSize: 12.5,
    fontWeight: '800',
  },
  teachInput: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
    color: theme.ink,
    fontSize: 13,
  },
  teachResult: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  teachResultPressed: {
    backgroundColor: theme.purpleLight,
  },
  teachResultText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  previewCellMeta: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  nameLabel: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nameInput: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 13,
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  importButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ACCENT,
    shadowOpacity: 0.27,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  columnsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
    gap: 10,
  },
  columnsTitle: {
    color: theme.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  columnsKey: {
    width: 74,
    color: theme.purple,
    fontSize: 13,
    fontWeight: '800',
  },
  columnsHelp: {
    flex: 1,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
});

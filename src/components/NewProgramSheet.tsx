import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildDraftFromCsvPreview, CsvLibraryEntry, parseCsvProgram } from '../lib/csvProgramImport';
import { I18nKey, t } from '../lib/i18n';
import type { AppLanguage, WorkoutTemplateDraft } from '../types/models';
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
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

function OptionIcon({ name }: { name: 'spark' | 'build' | 'table' }) {
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
  onImportProgram,
}: NewProgramSheetProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The sheet sits on the system navigation bar. Its own 28dp used to be the
  // whole bottom padding, so on a phone with three-button navigation the last
  // option ("Tuo CSV") sat under the buttons.
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'menu' | 'csv'>(initialView);
  const [csvText, setCsvText] = useState('');
  const defaultProgramName = t(language, 'csv.defaultName');
  const [programName, setProgramName] = useState(defaultProgramName);
  const [importing, setImporting] = useState(false);

  const preview = useMemo(
    () => (csvText.trim() ? parseCsvProgram(csvText, exerciseLibrary) : null),
    [csvText, exerciseLibrary],
  );

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(language, 'csv.aiA11y')}
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
                  <Text style={styles.optionTitle}>{t(language, 'csv.ai')}</Text>
                  <Text style={styles.optionBody}>{t(language, 'csv.aiBody')}</Text>
                </View>
                <Chevron />
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
              <Pressable accessibilityRole="button" onPress={() => setCsvText(SAMPLE_CSV)} hitSlop={6}>
                <Text style={styles.sampleLink}>{t(language, 'csv.loadSample')}</Text>
              </Pressable>

              {preview ? (
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
                      {preview.rows.map((row, index) => (
                        <View key={`${row.day}-${row.exerciseName}-${index}`} style={[styles.previewRow, !row.matchedName && styles.previewRowUnmatched]}>
                          <Text style={[styles.previewCellDay, styles.previewDay]} numberOfLines={1}>
                            {row.day}
                          </Text>
                          <View style={styles.previewName}>
                            <Text style={[styles.previewCellName, !row.matchedName && styles.previewCellNameUnmatched]} numberOfLines={1}>
                              {row.matchedName ?? row.exerciseName}
                            </Text>
                            {!row.matchedName ? (
                              <Text style={styles.previewCellHint} numberOfLines={1}>
                                {row.suggestion
                                  ? t(language, 'csv.didYouMean', { name: row.suggestion })
                                  : t(language, 'csv.willSkip')}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.previewCellMeta, styles.previewSets]}>{row.sets}</Text>
                          <Text style={[styles.previewCellMeta, styles.previewReps]}>
                            {row.repMin === row.repMax ? row.repMax : `${row.repMin}–${row.repMax}`}
                          </Text>
                        </View>
                      ))}
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

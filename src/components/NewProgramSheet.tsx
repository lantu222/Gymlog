import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { buildDraftFromCsvPreview, CsvLibraryEntry, parseCsvProgram } from '../lib/csvProgramImport';
import type { WorkoutTemplateDraft } from '../types/models';
import { HG3 } from '../lightTheme';

// Program accent (design_handoff_programs_redesign, hue 150). The handoff
// specifies oklch values; RN has no oklch support, so these are the closest hex.
const ACCENT = '#16A34A';
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
  exerciseLibrary: CsvLibraryEntry[];
  onClose: () => void;
  onAiAssisted: () => void;
  onBuildYourself: () => void;
  onImportProgram: (draft: WorkoutTemplateDraft) => Promise<void> | void;
}

function OptionIcon({ name }: { name: 'spark' | 'build' | 'table' }) {
  const stroke = name === 'spark' ? '#FFFFFF' : HG3.purple;
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
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="m9 6 6 6-6 6" stroke={HG3.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function NewProgramSheet({
  visible,
  exerciseLibrary,
  onClose,
  onAiAssisted,
  onBuildYourself,
  onImportProgram,
}: NewProgramSheetProps) {
  const [view, setView] = useState<'menu' | 'csv'>('menu');
  const [csvText, setCsvText] = useState('');
  const [programName, setProgramName] = useState('Imported program');
  const [importing, setImporting] = useState(false);

  const preview = useMemo(
    () => (csvText.trim() ? parseCsvProgram(csvText, exerciseLibrary) : null),
    [csvText, exerciseLibrary],
  );

  function reset() {
    setView('menu');
    setCsvText('');
    setProgramName('Imported program');
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
      await onImportProgram(buildDraftFromCsvPreview(preview, programName.trim() || 'Imported program'));
      handleClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.scrim} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.panelWrap} pointerEvents="box-none">
        <View style={[styles.panel, view === 'csv' && styles.panelTall]}>
          <View style={styles.grabHandle} />
          <View style={styles.headerRow}>
            {view !== 'menu' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setView('menu')} hitSlop={8} style={styles.roundButton}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 6l-6 6 6 6" stroke={HG3.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            ) : (
              <View style={styles.roundButtonSpacer} />
            )}
            <Text style={styles.headerTitle}>{view === 'csv' ? 'Import CSV' : 'New program'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} hitSlop={8} style={styles.roundButton}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M6 6l12 12M18 6L6 18" stroke={HG3.ink} strokeWidth={2.2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          {view === 'menu' ? (
            <View style={styles.menu}>
              <Text style={styles.subtitle}>Pick how you want to build it.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="AI-assisted: answer a few questions and GAINER AI builds the split"
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
                  <Text style={styles.optionTitle}>AI-assisted</Text>
                  <Text style={styles.optionBody}>Answer a few questions — GAINER AI builds the split for you.</Text>
                </View>
                <Chevron />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Build it yourself: browse the library and pick your own lifts"
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
                  <Text style={styles.optionTitle}>Build it yourself</Text>
                  <Text style={styles.optionBody}>Browse the library and pick your own lifts, day by day.</Text>
                </View>
                <Chevron />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Import CSV: bring a plan in from a spreadsheet or another app"
                onPress={() => setView('csv')}
                style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
              >
                <View style={styles.optionIconTile}>
                  <OptionIcon name="table" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>Import CSV</Text>
                  <Text style={styles.optionBody}>Bring a plan in from a spreadsheet or another app.</Text>
                </View>
                <Chevron />
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.csvContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.subtitle}>
                Paste rows with the columns Day, Exercise, Sets, Reps. Unmatched names get flagged so you can fix or skip them.
              </Text>

              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                multiline
                placeholder={'Day,Exercise,Sets,Reps\nDay 1,Bench Press,4,6-10\n…'}
                placeholderTextColor={HG3.faint}
                style={styles.csvInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable accessibilityRole="button" onPress={() => setCsvText(SAMPLE_CSV)} hitSlop={6}>
                <Text style={styles.sampleLink}>Load a sample</Text>
              </Pressable>

              {preview ? (
                <>
                  <View style={[styles.resultBanner, preview.unmatchedCount === 0 && preview.rows.length > 0 ? styles.resultBannerOk : styles.resultBannerWarn]}>
                    <Text style={styles.resultBannerText}>
                      {preview.rows.length === 0
                        ? preview.errors[0] ?? 'No rows found.'
                        : `${preview.rows.length} rows · ${preview.matchedCount} matched${preview.unmatchedCount ? ` · ${preview.unmatchedCount} unmatched` : ', all matched'}`}
                    </Text>
                  </View>

                  {preview.errors.length > 0 && preview.rows.length > 0 ? (
                    <Text style={styles.errorNote}>{preview.errors.join('\n')}</Text>
                  ) : null}

                  {preview.rows.length > 0 ? (
                    <View style={styles.previewTable}>
                      <View style={styles.previewHeader}>
                        <Text style={[styles.previewHeaderCell, styles.previewDay]}>DAY</Text>
                        <Text style={[styles.previewHeaderCell, styles.previewName]}>EXERCISE</Text>
                        <Text style={[styles.previewHeaderCell, styles.previewSets]}>SETS</Text>
                        <Text style={[styles.previewHeaderCell, styles.previewReps]}>REPS</Text>
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
                                {row.suggestion ? `No match — did you mean ${row.suggestion}?` : 'No match — will be skipped'}
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
                      <Text style={styles.nameLabel}>PROGRAM NAME</Text>
                      <TextInput
                        value={programName}
                        onChangeText={setProgramName}
                        style={styles.nameInput}
                        placeholder="Imported program"
                        placeholderTextColor={HG3.faint}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Import ${preview.matchedCount} exercises`}
                        onPress={() => void handleImport()}
                        disabled={importing}
                        style={({ pressed }) => [styles.importButton, (pressed || importing) && styles.pressed]}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.importButtonText}>
                          {importing ? 'Importing…' : `Import ${preview.matchedCount} ${preview.matchedCount === 1 ? 'exercise' : 'exercises'}`}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </>
              ) : (
                <View style={styles.columnsCard}>
                  <Text style={styles.columnsTitle}>Expected columns</Text>
                  {[
                    ['Day', 'Which session — Day 1, Push, Legs…'],
                    ['Exercise', 'Must match a library name'],
                    ['Sets', 'A number, e.g. 4'],
                    ['Reps', 'Range or number, e.g. 6–10'],
                  ].map(([key, help]) => (
                    <View key={key} style={styles.columnsRow}>
                      <Text style={styles.columnsKey}>{key}</Text>
                      <Text style={styles.columnsHelp}>{help}</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: HG3.bg,
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
    backgroundColor: HG3.border,
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
    color: HG3.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonSpacer: {
    width: 34,
    height: 34,
  },
  subtitle: {
    color: HG3.muted,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    padding: 15,
  },
  optionIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: HG3.purpleSoft,
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
    color: HG3.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  optionBody: {
    color: HG3.muted,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    padding: 12,
    color: HG3.ink,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  sampleLink: {
    color: HG3.purple,
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
    color: HG3.ink,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: HG3.purpleSoft,
    gap: 8,
  },
  previewHeaderCell: {
    color: HG3.muted,
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
    borderTopColor: HG3.border,
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
    color: HG3.purple,
    fontSize: 12,
    fontWeight: '800',
  },
  previewCellName: {
    color: HG3.ink,
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
    color: HG3.muted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  nameLabel: {
    color: HG3.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nameInput: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    paddingHorizontal: 13,
    color: HG3.ink,
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
    borderColor: HG3.border,
    backgroundColor: HG3.surface,
    padding: 14,
    gap: 10,
  },
  columnsTitle: {
    color: HG3.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  columnsKey: {
    width: 74,
    color: HG3.purple,
    fontSize: 13,
    fontWeight: '800',
  },
  columnsHelp: {
    flex: 1,
    color: HG3.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
});

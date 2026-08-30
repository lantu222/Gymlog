import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { bodyPartLabel, t } from '../lib/i18n';
import {
  DaySwapCandidate,
  daySwapMuscleOptions,
  filterDaySwapCandidates,
} from '../lib/programDaySwap';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * Swapping one day of a programme for a day that trains something else.
 *
 * The list is real catalogue days, each showing the programme it comes from.
 * That is the point of the design rather than a detail of it: the reader is
 * choosing a session somebody wrote, with its sets, reps and ordering already
 * decided, instead of accepting a block the app assembled on the spot.
 *
 * The muscle filter leads, because the request that produced this feature was
 * phrased in muscles — "haluan rinta ja vatsat treenit myös mukaan" — and not
 * in programme names.
 */
interface DaySwapSheetProps {
  visible: boolean;
  candidates: readonly DaySwapCandidate[];
  language: AppLanguage;
  onPick: (candidate: DaySwapCandidate) => void;
  onClose: () => void;
  /** Read on the SCREEN: inside a Modal this app measures the inset as zero. */
  bottomInset: number;
}

export function DaySwapSheet({
  visible,
  candidates,
  language,
  onPick,
  onClose,
  bottomInset,
}: DaySwapSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const [muscle, setMuscle] = useState<string | null>(null);

  const muscles = useMemo(() => daySwapMuscleOptions(candidates), [candidates]);
  const shown = useMemo(() => filterDaySwapCandidates(candidates, muscle), [candidates, muscle]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" />

        <View style={[styles.sheet, { paddingBottom: 16 + bottomInset }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t(language, 'programDay.swapDay.title')}</Text>
          <Text style={styles.lead}>{t(language, 'programDay.swapDay.lead')}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setMuscle(null)}
              style={[styles.chip, muscle === null && styles.chipOn]}
            >
              <Text style={[styles.chipText, muscle === null && styles.chipTextOn]}>
                {t(language, 'programDay.swapDay.all')}
              </Text>
            </Pressable>
            {muscles.map((entry) => (
              <Pressable
                key={entry}
                accessibilityRole="button"
                onPress={() => setMuscle(entry)}
                style={[styles.chip, muscle === entry && styles.chipOn]}
              >
                <Text style={[styles.chipText, muscle === entry && styles.chipTextOn]}>
                  {bodyPartLabel(language, entry)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {shown.map((candidate) => (
              <Pressable
                key={`${candidate.templateId}:${candidate.sessionId}`}
                accessibilityRole="button"
                onPress={() => onPick(candidate)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{candidate.sessionName}</Text>
                  {/* The programme it came from. A day with no provenance is a
                      day the reader cannot judge. */}
                  <Text style={styles.rowFrom}>{candidate.templateName}</Text>
                </View>
                <Text style={styles.rowMeta}>
                  {t(language, 'programDay.swapDay.meta', {
                    exercises: candidate.exerciseCount,
                    sets: candidate.setCount,
                  })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>{t(language, 'common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      maxHeight: '86%',
      backgroundColor: theme.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 14,
    },
    title: { fontSize: 21, fontWeight: '800', color: theme.ink, letterSpacing: -0.4 },
    lead: { fontSize: 14, fontWeight: '500', color: theme.muted, lineHeight: 20, marginTop: 6 },
    filterRow: { gap: 8, paddingVertical: 14, paddingRight: 20 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipOn: { backgroundColor: theme.purple, borderColor: theme.purple },
    chipText: { fontSize: 14, fontWeight: '700', color: theme.muted },
    chipTextOn: { color: '#FFFFFF' },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    rowBody: { flex: 1 },
    rowName: { fontSize: 16, fontWeight: '700', color: theme.ink, lineHeight: 21 },
    rowFrom: { fontSize: 13, fontWeight: '500', color: theme.muted, marginTop: 2 },
    rowMeta: { fontSize: 13, fontWeight: '600', color: theme.muted },
    close: {
      height: 50,
      borderRadius: 999,
      backgroundColor: theme.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    closeText: { fontSize: 15.5, fontWeight: '700', color: theme.ink },
    pressed: { opacity: 0.85 },
  });

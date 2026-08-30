import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { bodyPartLabel, t } from '../lib/i18n';
import {
  DaySwapCandidate,
  daySwapCandidatesExcluding,
  daySwapMuscleOptions,
  filterDaySwapCandidates,
} from '../lib/programDaySwap';
import { KitBar, KitRow, KitSheet, KIT_BAR_SPACE } from './sheetKit';
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
 *
 * On the sheet kit: a tap picks, the commit bar rises with the whole change on
 * one line, and only the button writes — replacing a whole day is the largest
 * single edit a programme can take, and it used to happen on the row tap.
 */
interface DaySwapSheetProps {
  visible: boolean;
  /** Every catalogue day. Built once against the library and cached there. */
  candidates: readonly DaySwapCandidate[];
  /** The day being replaced, which cannot be its own replacement. */
  excludeSessionId: string;
  /** The day's current name, for the bar's left half. */
  currentDayName: string;
  language: AppLanguage;
  onPick: (candidate: DaySwapCandidate) => void;
  onClose: () => void;
  /** Read on the SCREEN: inside a Modal this app measures the inset as zero. */
  bottomInset: number;
}

export function DaySwapSheet({
  visible,
  candidates,
  excludeSessionId,
  currentDayName,
  language,
  onPick,
  onClose,
  bottomInset,
}: DaySwapSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const [muscle, setMuscle] = useState<string | null>(null);
  /** Picked but not committed — the bar carries the confirm. */
  const [pick, setPick] = useState<DaySwapCandidate | null>(null);
  const close = () => {
    setPick(null);
    onClose();
  };

  // Memos over a `candidates` identity that is now stable: the list is built
  // once against the exercise library instead of once per render, so these
  // stop recomputing on every keystroke behind the sheet.
  const usable = useMemo(
    () => daySwapCandidatesExcluding(candidates, excludeSessionId),
    [candidates, excludeSessionId],
  );
  const muscles = useMemo(() => daySwapMuscleOptions(usable), [usable]);
  const shown = useMemo(() => filterDaySwapCandidates(usable, muscle), [usable, muscle]);

  const renderRow = useCallback(
    ({ item }: { item: DaySwapCandidate }) => (
      <KitRow
        title={item.sessionName}
        // The programme it came from, then the size. A day with no provenance
        // is a day the reader cannot judge.
        meta={`${item.templateName} · ${t(language, 'programDay.swapDay.meta', {
          exercises: item.exerciseCount,
          sets: item.setCount,
        })}`}
        state={
          pick && pick.templateId === item.templateId && pick.sessionId === item.sessionId
            ? 'sel'
            : 'idle'
        }
        onPress={() =>
          setPick((current) =>
            current && current.templateId === item.templateId && current.sessionId === item.sessionId
              ? null
              : item,
          )
        }
      />
    ),
    [language, pick],
  );

  return (
    <KitSheet
      visible={visible}
      onClose={close}
      title={t(language, 'programDay.swapDay.title')}
      description={t(language, 'programDay.swapDay.lead')}
      bottomInset={bottomInset}
      barUp={pick !== null}
      bar={
        <KitBar
          visible={pick !== null}
          from={currentDayName}
          to={pick?.sessionName ?? ''}
          buttons={[
            {
              label: t(language, 'programDay.swapDay.action'),
              // Replacing a day rewrites its contents for good — danger's
              // colour, by the kit's own rule: permanent, not "this time".
              kind: 'd',
              onPress: () => {
                if (pick) {
                  onPick(pick);
                }
                close();
              },
            },
          ]}
          clearLabel={t(language, 'kit.pickAnotherDay')}
          onClear={() => setPick(null)}
          bottomInset={bottomInset}
        />
      }
    >
      {/* A height on the scroller AND on the chips. Two scrollers are siblings
          in this column, and without both the horizontal one is squeezed to
          nothing by the list below it — the chips still lay out and still read
          correctly to the accessibility tree, they just paint as empty pills.
          Found on a device; the same collapse that once flattened the
          set-screen dials. */}
      <ScrollView
        horizontal
        style={styles.filterScroll}
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

      {/* FlatList, not a ScrollView: unfiltered this is every written day
          in the catalogue — around 197 rows — and a ScrollView mounts all
          of them in one frame, during the sheet's own slide-in, which is
          exactly where a dropped frame is seen. */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listPad}
        data={shown}
        renderItem={renderRow}
        keyExtractor={(candidate) => `${candidate.templateId}:${candidate.sessionId}`}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={5}
      />
    </KitSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    filterScroll: { flexGrow: 0, flexShrink: 0, height: 64 },
    filterRow: {
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: 'center',
    },
    chip: {
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
    },
    chipOn: {
      backgroundColor: theme.purpleLight,
      borderColor: theme.purpleBright,
    },
    chipText: { fontSize: 13.5, fontWeight: '700', color: theme.muted },
    chipTextOn: { color: theme.purpleBright },
    list: { flexGrow: 0, maxHeight: 430 - KIT_BAR_SPACE / 2 },
    listPad: { paddingHorizontal: 18, paddingBottom: 6 },
  });

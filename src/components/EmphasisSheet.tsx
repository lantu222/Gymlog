import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CutButton } from './CutButton';
import { t } from '../lib/i18n';
import { EMPHASIS_AREA_KEYS, EmphasisArea, summariseEmphasis } from '../lib/programEmphasis';
import {
  adjustEmphasis,
  EmphasisExercise,
  EMPHASIS_STEP,
  MAX_SETS_PER_EXERCISE,
  MIN_SETS_PER_EXERCISE,
} from '../lib/programEmphasisAdjust';
import { EMPHASIS_RAMP } from '../lib/programVisualIdentity';
import { radii, spacing } from '../theme';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * "Muokkaa painotusta" (design: GAINER Hourglass Shape, screen 3).
 *
 * It opens from the distribution card it edits, and paints the same bar, so
 * the design's promise — the change shows immediately in screen 1's split —
 * is literal rather than a second view of the same numbers.
 *
 * Steppers, not sliders: the design's own script quantises a drag to whole
 * four-set jumps, and a stepper is that with no gesture imprecision. The
 * numbers beside each row are the sets that actually moved, not the ones
 * requested — see adjustEmphasis.
 */

interface EmphasisSheetProps {
  visible: boolean;
  language: AppLanguage;
  /** Flat, in the order the caller will write the results back. */
  exercises: EmphasisExercise[];
  onClose: () => void;
  onSave: (setsByExerciseIndex: number[]) => void;
}

export function EmphasisSheet({ visible, language, exercises, onClose, onSave }: EmphasisSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [working, setWorking] = useState<number[]>(() => exercises.map((exercise) => exercise.sets));

  // Reopening starts from the programme as it is now, not from the last
  // unsaved fiddle — a sheet that remembers a discarded edit is lying about
  // what the programme currently says.
  useEffect(() => {
    if (visible) {
      setWorking(exercises.map((exercise) => exercise.sets));
    }
  }, [visible, exercises]);

  const withWorkingSets = useMemo(
    () => exercises.map((exercise, index) => ({ ...exercise, sets: working[index] ?? exercise.sets })),
    [exercises, working],
  );

  // Summed from the already-classified rows. Running them back through the
  // name classifier would drop every one into `other`.
  const preview = useMemo(() => summariseEmphasis(withWorkingSets), [withWorkingSets]);

  // The bar and the rows are built from the areas the programme actually has,
  // in the order the unedited programme had them — rows that reorder under the
  // thumb are unusable.
  const areas = useMemo(() => {
    const order: EmphasisArea[] = [];
    for (const exercise of exercises) {
      if (!order.includes(exercise.area)) {
        order.push(exercise.area);
      }
    }
    return order;
  }, [exercises]);

  const setsInArea = (area: EmphasisArea) =>
    withWorkingSets.reduce((sum, exercise) => (exercise.area === area ? sum + exercise.sets : sum), 0);
  const baseInArea = (area: EmphasisArea) =>
    exercises.reduce((sum, exercise) => (exercise.area === area ? sum + exercise.sets : sum), 0);

  const totalSets = withWorkingSets.reduce((sum, exercise) => sum + exercise.sets, 0);
  const percentByArea = new Map(preview?.slices.map((slice) => [slice.area, slice.percent]) ?? []);
  const touched = withWorkingSets.some((exercise, index) => exercise.sets !== exercises[index].sets);

  const step = (area: EmphasisArea, direction: 1 | -1) => {
    const result = adjustEmphasis(withWorkingSets, area, direction * EMPHASIS_STEP);
    if (result.moved !== 0) {
      setWorking(result.sets);
    }
  };

  const canGrow = (area: EmphasisArea) =>
    adjustEmphasis(withWorkingSets, area, EMPHASIS_STEP).moved !== 0;
  const canShrink = (area: EmphasisArea) =>
    adjustEmphasis(withWorkingSets, area, -EMPHASIS_STEP).moved !== 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <Text style={styles.eyebrow}>{t(language, 'emphasis.sheet.title')}</Text>
            <Text style={styles.total}>{t(language, 'emphasis.sheet.total', { sets: totalSets })}</Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.bar}>
              {(preview?.slices ?? []).map((slice) => (
                <View
                  key={slice.area}
                  style={[styles.barSegment, { flex: slice.sets, backgroundColor: EMPHASIS_RAMP[slice.area] }]}
                />
              ))}
            </View>

            <View style={styles.rows}>
              {areas.map((area) => {
                const current = setsInArea(area);
                const delta = current - baseInArea(area);
                return (
                  <View key={area} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: EMPHASIS_RAMP[area] }]} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {t(language, EMPHASIS_AREA_KEYS[area])}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {t(language, 'emphasis.sheet.sets', { sets: current })}
                        {delta !== 0 ? (
                          <Text style={styles.rowDelta}>{`  ${delta > 0 ? '+' : ''}${delta}`}</Text>
                        ) : null}
                      </Text>
                    </View>
                    <Text style={styles.rowPercent}>{percentByArea.get(area) ?? 0} %</Text>
                    <Stepper
                      styles={styles}
                      label="−"
                      enabled={canShrink(area)}
                      accessibilityLabel={t(language, 'emphasis.sheet.less', {
                        area: t(language, EMPHASIS_AREA_KEYS[area]),
                      })}
                      onPress={() => step(area, -1)}
                    />
                    <Stepper
                      styles={styles}
                      label="+"
                      enabled={canGrow(area)}
                      accessibilityLabel={t(language, 'emphasis.sheet.more', {
                        area: t(language, EMPHASIS_AREA_KEYS[area]),
                      })}
                      onPress={() => step(area, 1)}
                    />
                  </View>
                );
              })}
            </View>

            <Text style={styles.note}>
              {t(language, 'emphasis.sheet.note', {
                step: EMPHASIS_STEP,
                min: MIN_SETS_PER_EXERCISE,
                max: MAX_SETS_PER_EXERCISE,
              })}
            </Text>
          </ScrollView>

          <View style={styles.dock}>
            <CutButton
              label={t(language, 'common.cancel')}
              onPress={onClose}
              variant="secondary"
              size="lg"
              stretch
            />
            <CutButton
              label={t(language, 'emphasis.sheet.save')}
              onPress={touched ? () => onSave(working) : undefined}
              variant={touched ? 'primary' : 'disabled'}
              size="lg"
              stretch
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Stepper({
  styles,
  label,
  enabled,
  accessibilityLabel,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  enabled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.stepper, !enabled && styles.stepperOff, pressed && enabled && styles.stepperOn]}
    >
      <Text style={[styles.stepperText, !enabled && styles.stepperTextOff]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 18, 70, 0.42)',
  },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    maxHeight: '82%',
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginTop: 10,
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  total: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  body: {
    flexGrow: 0,
  },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  barSegment: {
    height: '100%',
  },
  rows: {
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  rowMeta: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  rowDelta: {
    color: theme.purple,
    fontWeight: '800',
  },
  rowPercent: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'right',
  },
  stepper: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperOn: {
    backgroundColor: theme.surfaceSoft,
  },
  stepperOff: {
    opacity: 0.4,
  },
  stepperText: {
    color: theme.purple,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  stepperTextOff: {
    color: theme.faint,
  },
  note: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 4,
  },
  dock: {
    flexDirection: 'row',
    gap: 9,
    paddingTop: 12,
  },
});

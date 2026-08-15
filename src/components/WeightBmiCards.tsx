import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

import { WeightTrendChart } from './WeightTrendChart';
import {
  BMI_BANDS,
  BMI_SCALE_MAX_TICK,
  BMI_SCALE_TICKS,
  WeightWindowDay,
  bmiBand,
  bmiMarkerPosition,
  calculateBmi,
} from '../lib/bodyweightCard';
import { removeTrailingZeros } from '../lib/format';
import { t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The weight card and the BMI gauge (design reference: Home Workout's Report
 * tab, adopted 2026-08-13 — the one part of that tab worth taking).
 *
 * What was deliberately NOT taken from the reference: the kcal counter (this
 * app does not estimate calories and will not print a number it cannot
 * measure) and the day streak (a gym app's rest days are the programme
 * working, not a broken streak — see the greeting's week streak instead).
 */

/** Wide enough for "18.5" on one line — at 24 it wrapped to "18." / "5". */
const TICK_LABEL_WIDTH = 34;

interface WeightBmiCardsProps {
  language: AppLanguage;
  currentKg: number | null;
  heaviestKg: number | null;
  lightestKg: number | null;
  heightCm: number | null;
  /** The calendar window the curve is drawn over — see buildWeightWindow. */
  chartDays: WeightWindowDay[];
  onLogWeight: () => void;
  onEditBmi: () => void;
}

function EditPencil({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4l10-10-4-4L4 16v4z M13.5 6.5l4 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The seven WHO bands as equal segments with a marker above the reader's
 * value. Equal segments, not to scale: 15–16 is one point wide and 18.5–25 is
 * six and a half, so a true-to-scale bar renders the two thinnest underweight
 * bands as invisible slivers — a scale nobody can read is decoration.
 */
function BmiGauge({ bmi, width }: { bmi: number; width: number }) {
  const styles = useThemedStyles(makeStyles);
  const barHeight = 12;
  const segment = width / BMI_BANDS.length;
  const markerX = bmiMarkerPosition(bmi) * width;

  return (
    <View>
      <Svg width={width} height={barHeight + 10}>
        {/* The marker sits ABOVE the bar, pointing down at it — over the bar it
            would hide the very band it is naming. */}
        <Polygon
          points={`${markerX - 5},0 ${markerX + 5},0 ${markerX},8`}
          fill="#101828"
        />
        {BMI_BANDS.map((band, index) => (
          <Rect
            key={band.key}
            x={index * segment + (index === 0 ? 0 : 1)}
            y={10}
            width={segment - (index === 0 || index === BMI_BANDS.length - 1 ? 1 : 2)}
            height={barHeight}
            rx={3}
            fill={band.color}
          />
        ))}
      </Svg>
      <View style={[styles.tickRow, { width }]}>
        {BMI_SCALE_TICKS.map((tick, index) => (
          // Boundary i sits where band i ends, at (i + 1) * segment.
          <Text key={tick} style={[styles.tickLabel, { left: (index + 1) * segment - TICK_LABEL_WIDTH / 2 }]}>
            {removeTrailingZeros(tick)}
          </Text>
        ))}
        <Text style={[styles.tickLabel, { left: width - TICK_LABEL_WIDTH / 2 }]}>
          {BMI_SCALE_MAX_TICK}
        </Text>
      </View>
    </View>
  );
}

export function WeightBmiCards({
  language,
  currentKg,
  heaviestKg,
  lightestKg,
  heightCm,
  chartDays,
  onLogWeight,
  onEditBmi,
}: WeightBmiCardsProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [gaugeWidth, setGaugeWidth] = React.useState(0);

  const bmi = currentKg !== null && heightCm !== null ? calculateBmi(currentKg, heightCm) : null;
  const band = bmi !== null ? bmiBand(bmi) : null;

  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t(language, 'weightCard.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'weightCard.log')}
          onPress={onLogWeight}
          style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
        >
          <Text style={styles.actionPillText}>{t(language, 'weightCard.log')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.weightHeadRow}>
          <View>
            <Text style={styles.mutedLabel}>{t(language, 'weightCard.current')}</Text>
            <View style={styles.currentRow}>
              <Text style={styles.currentValue}>
                {currentKg !== null ? removeTrailingZeros(Number(currentKg.toFixed(1))) : '—'}
              </Text>
              {currentKg !== null ? <Text style={styles.currentUnit}>kg</Text> : null}
            </View>
          </View>
          {/* Shown from the first entry on, exactly like the reference. An
              earlier version hid the pair while the two were equal, on the
              grounds that "heaviest 75 / lightest 75" says nothing. It also
              made the card look unfinished and hid where the numbers will
              appear — the reader asked for all three, so all three are here. */}
          {heaviestKg !== null && lightestKg !== null ? (
            <View style={styles.extremes}>
              <View style={styles.extremeRow}>
                <Text style={styles.mutedLabel}>{t(language, 'weightCard.heaviest')}</Text>
                <Text style={styles.extremeValue}>{removeTrailingZeros(Number(heaviestKg.toFixed(1)))}</Text>
              </View>
              <View style={styles.extremeRow}>
                <Text style={styles.mutedLabel}>{t(language, 'weightCard.lightest')}</Text>
                <Text style={styles.extremeValue}>{removeTrailingZeros(Number(lightestKg.toFixed(1)))}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {chartDays.some((day) => day.value !== null) ? (
          <WeightTrendChart days={chartDays} />
        ) : (
          <Text style={styles.emptyLine}>{t(language, 'weightCard.empty')}</Text>
        )}
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t(language, 'bmi.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'bmi.edit')}
          onPress={onEditBmi}
          style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
        >
          <Text style={styles.actionPillText}>{t(language, 'bmi.edit')}</Text>
        </Pressable>
      </View>

      <View style={styles.card} onLayout={(event) => setGaugeWidth(event.nativeEvent.layout.width - 32)}>
        {bmi !== null && band ? (
          <>
            <View
              style={styles.bmiHeadRow}
              accessible
              accessibilityLabel={t(language, 'bmi.a11y.gauge', {
                bmi: removeTrailingZeros(Number(bmi.toFixed(1))),
                band: t(language, band.labelKey),
              })}
            >
              <Text style={styles.bmiValue}>{removeTrailingZeros(Number(bmi.toFixed(1)))}</Text>
              <View style={styles.bandRow}>
                <View style={[styles.bandDot, { backgroundColor: band.color }]} />
                <Text style={styles.bandLabel}>{t(language, band.labelKey)}</Text>
              </View>
            </View>
            {gaugeWidth > 0 ? <BmiGauge bmi={bmi} width={gaugeWidth} /> : null}
          </>
        ) : (
          <Text style={styles.emptyLine}>
            {t(language, currentKg === null ? 'bmi.needWeight' : 'bmi.needHeight')}
          </Text>
        )}

        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'bmi.height')}
          onPress={onEditBmi}
          style={({ pressed }) => [styles.heightRow, pressed && styles.pressed]}
        >
          <Text style={styles.heightLabel}>{t(language, 'bmi.height')}</Text>
          <View style={styles.heightValueRow}>
            <Text style={styles.heightValue}>{heightCm !== null ? `${Math.round(heightCm)} cm` : '—'}</Text>
            <EditPencil color={theme.muted} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: theme.ink,
  },
  actionPill: {
    backgroundColor: theme.highlight,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  actionPillText: {
    color: theme.onHighlight,
    fontSize: 14.5,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  },
  weightHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  mutedLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.muted,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 2,
  },
  currentValue: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.8,
  },
  currentUnit: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.ink,
    marginBottom: 4,
  },
  extremes: {
    gap: 3,
  },
  extremeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  extremeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.ink,
    minWidth: 44,
    textAlign: 'right',
  },
  emptyLine: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    color: theme.muted,
    marginTop: 8,
  },
  bmiHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bmiValue: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    color: theme.ink,
    letterSpacing: -0.8,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  bandDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  bandLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.ink,
    flexShrink: 1,
  },
  tickRow: {
    height: 18,
    marginTop: 2,
  },
  tickLabel: {
    position: 'absolute',
    top: 0,
    width: TICK_LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.muted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginTop: 16,
    marginBottom: 4,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  heightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.muted,
  },
  heightValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightValue: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.ink,
  },
});

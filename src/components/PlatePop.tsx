import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { parseNumberInput } from '../lib/format';
import { BAR_WEIGHT_KG, PLATE_COLORS, platesPerSide } from '../lib/plateMath';
import { HG } from '../lightTheme';

interface PlatePopProps {
  /** Raw kg input for the active set — may be empty or partial while typing. */
  kg: string;
  barKg?: number;
}

function formatPlate(plate: number) {
  return `${plate}`;
}

/**
 * Compact per-side plate readout under the active set (AW3 design language).
 * Shared by the freestyle logger; Active Workout v3 will reuse it.
 */
export function PlatePop({ kg, barKg = BAR_WEIGHT_KG }: PlatePopProps) {
  const total = parseNumberInput(kg);
  const valid = total !== null && total > 0;
  const plates = valid ? platesPerSide(total, barKg) : [];

  return (
    <View>
      <Text style={styles.eyebrow}>PLATES · PER SIDE · {barKg}KG BAR</Text>
      {!valid ? (
        <Text style={styles.hint}>Enter a weight to see plates.</Text>
      ) : plates.length === 0 ? (
        <Text style={styles.barOnly}>Just the bar ({barKg} kg).</Text>
      ) : (
        <View style={styles.chipRow}>
          {plates.map((plate, index) => (
            <View key={`${plate}-${index}`} style={[styles.chip, { backgroundColor: PLATE_COLORS[plate] }]}>
              <Text style={styles.chipText}>{formatPlate(plate)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.84,
    color: HG.faint,
  },
  hint: {
    fontSize: 13,
    fontWeight: '700',
    color: HG.faint,
    marginTop: 7,
  },
  barOnly: {
    fontSize: 13.5,
    fontWeight: '800',
    color: HG.ink,
    marginTop: 7,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  chip: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

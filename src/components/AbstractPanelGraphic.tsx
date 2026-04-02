import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../theme';
import { SurfaceAccent } from './MainScreenPrimitives';

type GraphicVariant = 'active' | 'browse' | 'coach' | 'week';

interface AbstractPanelGraphicProps {
  accent?: SurfaceAccent;
  variant?: GraphicVariant;
  compact?: boolean;
}

const accentMap: Record<SurfaceAccent, { border: string; fill: string; glow: string }> = {
  blue: {
    border: 'rgba(150, 216, 255, 0.34)',
    fill: 'rgba(150, 216, 255, 0.20)',
    glow: 'rgba(150, 216, 255, 0.14)',
  },
  rose: {
    border: 'rgba(216, 106, 134, 0.34)',
    fill: 'rgba(216, 106, 134, 0.20)',
    glow: 'rgba(216, 106, 134, 0.14)',
  },
  orange: {
    border: 'rgba(240, 106, 57, 0.34)',
    fill: 'rgba(240, 106, 57, 0.18)',
    glow: 'rgba(240, 106, 57, 0.14)',
  },
  neutral: {
    border: 'rgba(255,255,255,0.16)',
    fill: 'rgba(255,255,255,0.08)',
    glow: 'rgba(255,255,255,0.05)',
  },
};

export function AbstractPanelGraphic({
  accent = 'blue',
  variant = 'browse',
  compact = false,
}: AbstractPanelGraphicProps) {
  const tone = accentMap[accent];

  return (
    <View
      style={[
        styles.frame,
        compact && styles.frameCompact,
        { borderColor: tone.border, backgroundColor: 'rgba(10, 15, 21, 0.44)' },
      ]}
    >
      <View style={[styles.glow, { backgroundColor: tone.glow }]} />
      <View style={styles.gridLineVertical} />
      <View style={styles.gridLineHorizontal} />

      {variant === 'active' ? (
        <>
          <View style={[styles.pulseDot, { backgroundColor: tone.fill, borderColor: tone.border }]} />
          <View style={[styles.longBar, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.shortBar, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.cornerCard, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.68)' }]} />
        </>
      ) : null}

      {variant === 'browse' ? (
        <>
          <View style={[styles.stackCardBack, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.54)' }]} />
          <View style={[styles.stackCardFront, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.stackMiniPill, styles.stackMiniPillTop, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
          <View style={[styles.stackMiniPill, styles.stackMiniPillBottom, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
        </>
      ) : null}

      {variant === 'coach' ? (
        <>
          <View style={[styles.orb, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.chatLine, styles.chatLineTop, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
          <View style={[styles.chatLine, styles.chatLineMid, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
          <View style={[styles.chatChip, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
        </>
      ) : null}

      {variant === 'week' ? (
        <>
          <View style={[styles.weekPill, styles.weekPillOne, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.weekPill, styles.weekPillTwo, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.68)' }]} />
          <View style={[styles.weekPill, styles.weekPillThree, { borderColor: tone.border, backgroundColor: tone.fill }]} />
          <View style={[styles.weekPanel, { borderColor: tone.border, backgroundColor: 'rgba(11, 16, 22, 0.64)' }]} />
          <View style={[styles.weekBar, styles.weekBarOne, { backgroundColor: tone.fill }]} />
          <View style={[styles.weekBar, styles.weekBarTwo, { backgroundColor: tone.fill }]} />
          <View style={[styles.weekBar, styles.weekBarThree, { backgroundColor: tone.fill }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    width: 122,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  frameCompact: {
    width: 102,
    height: 82,
  },
  glow: {
    position: 'absolute',
    top: -28,
    right: -12,
    width: 78,
    height: 78,
    borderRadius: 78,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '48%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pulseDot: {
    position: 'absolute',
    top: 16,
    left: 15,
    width: 18,
    height: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  longBar: {
    position: 'absolute',
    left: 15,
    right: 18,
    bottom: 18,
    height: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  shortBar: {
    position: 'absolute',
    left: 15,
    width: 48,
    bottom: 40,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  cornerCard: {
    position: 'absolute',
    top: 13,
    right: 14,
    width: 38,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  stackCardBack: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 50,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  stackCardFront: {
    position: 'absolute',
    top: 31,
    left: 17,
    width: 62,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  stackMiniPill: {
    position: 'absolute',
    width: 26,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  stackMiniPillTop: {
    left: 17,
    top: 18,
  },
  stackMiniPillBottom: {
    right: 18,
    bottom: 16,
  },
  orb: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 34,
    height: 34,
    borderRadius: 34,
    borderWidth: 1,
  },
  chatLine: {
    position: 'absolute',
    left: 61,
    right: 14,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chatLineTop: {
    top: 18,
  },
  chatLineMid: {
    top: 36,
    right: 24,
  },
  chatChip: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  weekPill: {
    position: 'absolute',
    top: 16,
    width: 24,
    height: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  weekPillOne: {
    left: 14,
  },
  weekPillTwo: {
    left: 44,
  },
  weekPillThree: {
    left: 74,
  },
  weekPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  weekBar: {
    position: 'absolute',
    bottom: 23,
    width: 10,
    borderRadius: radii.pill,
  },
  weekBarOne: {
    left: 32,
    height: 8,
  },
  weekBarTwo: {
    left: 48,
    height: 16,
  },
  weekBarThree: {
    left: 64,
    height: 24,
  },
});

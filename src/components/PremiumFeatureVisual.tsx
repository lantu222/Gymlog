import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { radii } from '../theme';
import { SurfaceAccent } from './MainScreenPrimitives';

type PremiumFeatureVariant = 'hero' | 'coach' | 'rest' | 'rescue' | 'week' | 'compare';

interface PremiumFeatureVisualProps {
  variant: PremiumFeatureVariant;
  accent?: SurfaceAccent;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Tone = {
  border: string;
  glow: string;
  card: string;
  soft: string;
  strong: string;
  pale: string;
};

const tones: Record<SurfaceAccent, Tone> = {
  blue: {
    border: 'rgba(150, 216, 255, 0.34)',
    glow: 'rgba(150, 216, 255, 0.16)',
    card: 'rgba(11, 17, 24, 0.82)',
    soft: 'rgba(150, 216, 255, 0.18)',
    strong: '#84C6FF',
    pale: '#CFEFFF',
  },
  rose: {
    border: 'rgba(231, 116, 150, 0.34)',
    glow: 'rgba(231, 116, 150, 0.16)',
    card: 'rgba(18, 15, 21, 0.82)',
    soft: 'rgba(231, 116, 150, 0.18)',
    strong: '#F39AB2',
    pale: '#FFD2DE',
  },
  orange: {
    border: 'rgba(240, 106, 57, 0.34)',
    glow: 'rgba(240, 106, 57, 0.18)',
    card: 'rgba(21, 16, 12, 0.82)',
    soft: 'rgba(240, 106, 57, 0.18)',
    strong: '#FFB389',
    pale: '#FFD4BC',
  },
  neutral: {
    border: 'rgba(255,255,255,0.16)',
    glow: 'rgba(255,255,255,0.08)',
    card: 'rgba(14, 18, 24, 0.82)',
    soft: 'rgba(255,255,255,0.08)',
    strong: '#D6E1EA',
    pale: '#F4FAFF',
  },
};

function HeroArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="12" y="12" width="92" height="100" rx="20" fill={tone.card} stroke={tone.border} />
      <Rect x="110" y="24" width="42" height="72" rx="16" fill="rgba(11,15,20,0.68)" stroke={tone.border} />
      <Rect x="30" y="30" width="46" height="8" rx="4" fill={tone.soft} />
      <Rect x="30" y="44" width="30" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Circle cx="58" cy="74" r="20" fill="none" stroke={tone.border} strokeWidth="5" />
      <Path d="M58 54 A20 20 0 0 1 76 83" fill="none" stroke={tone.strong} strokeWidth="5" strokeLinecap="round" />
      <Circle cx="58" cy="74" r="4" fill={tone.pale} />
      <Rect x="22" y="94" width="72" height="10" rx="5" fill={tone.soft} />
      <Rect x="118" y="38" width="26" height="6" rx="3" fill={tone.soft} />
      <Rect x="118" y="50" width="18" height="6" rx="3" fill="rgba(255,255,255,0.10)" />
      <Rect x="118" y="64" width="22" height="18" rx="6" fill={tone.soft} />
      <Polyline
        points="122,76 128,70 134,72 140,60"
        fill="none"
        stroke={tone.pale}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CoachArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 136 96">
      <Rect x="10" y="10" width="116" height="76" rx="18" fill={tone.card} stroke={tone.border} />
      <Circle cx="30" cy="28" r="8" fill={tone.soft} />
      <Circle cx="50" cy="28" r="8" fill={tone.soft} />
      <Circle cx="70" cy="28" r="8" fill={tone.soft} />
      <Circle cx="90" cy="28" r="8" fill={tone.strong} />
      <Path d="M102 28 L114 28" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M110 22 L116 28 L110 34" fill="none" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="22" y="48" width="44" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="70" y="46" width="38" height="16" rx="8" fill={tone.soft} />
      <Rect x="22" y="66" width="86" height="8" rx="4" fill={tone.soft} />
    </Svg>
  );
}

function RestArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 136 96">
      <Rect x="10" y="10" width="116" height="76" rx="18" fill={tone.card} stroke={tone.border} />
      <Circle cx="40" cy="48" r="20" fill="none" stroke={tone.border} strokeWidth="5" />
      <Path d="M40 28 A20 20 0 0 1 58 52" fill="none" stroke={tone.strong} strokeWidth="5" strokeLinecap="round" />
      <Line x1="40" y1="48" x2="40" y2="36" stroke={tone.pale} strokeWidth="3" strokeLinecap="round" />
      <Line x1="40" y1="48" x2="49" y2="53" stroke={tone.pale} strokeWidth="3" strokeLinecap="round" />
      <Polyline
        points="70,57 78,57 84,39 90,63 96,48 102,48 108,34 114,34"
        fill="none"
        stroke={tone.strong}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="70" y="22" width="38" height="9" rx="4.5" fill={tone.soft} />
    </Svg>
  );
}

function RescueArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 136 96">
      <Rect x="10" y="10" width="116" height="76" rx="18" fill={tone.card} stroke={tone.border} />
      <Rect x="22" y="54" width="18" height="18" rx="6" fill={tone.soft} />
      <Rect x="46" y="42" width="18" height="30" rx="6" fill={tone.soft} />
      <Rect x="70" y="30" width="18" height="42" rx="6" fill={tone.strong} />
      <Rect x="94" y="48" width="18" height="24" rx="6" fill="rgba(255,255,255,0.10)" />
      <Path d="M96 24 L112 24" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M104 18 L112 24 L104 30" fill="none" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="22" y="22" width="42" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
    </Svg>
  );
}

function WeekArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 136 96">
      <Rect x="10" y="10" width="116" height="76" rx="18" fill={tone.card} stroke={tone.border} />
      <Rect x="22" y="22" width="10" height="10" rx="5" fill={tone.soft} />
      <Rect x="38" y="22" width="10" height="10" rx="5" fill={tone.soft} />
      <Rect x="54" y="22" width="10" height="10" rx="5" fill={tone.strong} />
      <Rect x="70" y="22" width="10" height="10" rx="5" fill={tone.soft} />
      <Rect x="86" y="22" width="10" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="102" y="22" width="10" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="24" y="52" width="10" height="14" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="42" y="44" width="10" height="22" rx="5" fill={tone.soft} />
      <Rect x="60" y="36" width="10" height="30" rx="5" fill={tone.strong} />
      <Rect x="78" y="48" width="10" height="18" rx="5" fill={tone.soft} />
      <Rect x="96" y="40" width="10" height="26" rx="5" fill={tone.pale} />
      <Polyline
        points="26,44 48,38 66,28 84,40 102,30"
        fill="none"
        stroke={tone.pale}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CompareArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 108">
      <Rect x="12" y="14" width="62" height="80" rx="18" fill="rgba(11,15,20,0.56)" stroke="rgba(255,255,255,0.16)" />
      <Rect x="90" y="14" width="62" height="80" rx="18" fill={tone.card} stroke={tone.border} />
      <Circle cx="31" cy="34" r="6" fill="rgba(255,255,255,0.14)" />
      <Circle cx="31" cy="54" r="6" fill="rgba(255,255,255,0.14)" />
      <Circle cx="31" cy="74" r="6" fill="rgba(255,255,255,0.14)" />
      <Rect x="43" y="30" width="20" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Rect x="43" y="50" width="14" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Rect x="43" y="70" width="18" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Circle cx="109" cy="34" r="6" fill={tone.strong} />
      <Circle cx="109" cy="54" r="6" fill={tone.strong} />
      <Circle cx="109" cy="74" r="6" fill={tone.strong} />
      <Rect x="121" y="30" width="20" height="8" rx="4" fill={tone.soft} />
      <Rect x="121" y="50" width="24" height="8" rx="4" fill={tone.soft} />
      <Rect x="121" y="70" width="18" height="8" rx="4" fill={tone.soft} />
      <Path d="M68 54 L96 54" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M88 47 L96 54 L88 61" fill="none" stroke={tone.pale} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PremiumFeatureVisual({
  variant,
  accent = 'orange',
  compact = false,
  style,
}: PremiumFeatureVisualProps) {
  const tone = tones[accent];

  return (
    <View
      style={[
        styles.frame,
        compact && styles.frameCompact,
        { borderColor: tone.border, backgroundColor: tone.card },
        style,
      ]}
    >
      <View style={[styles.glow, { backgroundColor: tone.glow }]} />
      <View style={styles.gridVertical} />
      <View style={styles.gridHorizontal} />
      {variant === 'hero' ? <HeroArt tone={tone} /> : null}
      {variant === 'coach' ? <CoachArt tone={tone} /> : null}
      {variant === 'rest' ? <RestArt tone={tone} /> : null}
      {variant === 'rescue' ? <RescueArt tone={tone} /> : null}
      {variant === 'week' ? <WeekArt tone={tone} /> : null}
      {variant === 'compare' ? <CompareArt tone={tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    height: 118,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  frameCompact: {
    height: 94,
    borderRadius: radii.md,
  },
  glow: {
    position: 'absolute',
    top: -26,
    right: -12,
    width: 88,
    height: 88,
    borderRadius: 88,
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '56%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});

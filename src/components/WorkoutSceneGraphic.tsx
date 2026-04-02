import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { radii } from '../theme';
import { SurfaceAccent } from './MainScreenPrimitives';

type WorkoutSceneVariant = 'today' | 'plan' | 'build' | 'browse' | 'search';

interface WorkoutSceneGraphicProps {
  variant: WorkoutSceneVariant;
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
    card: 'rgba(12, 18, 25, 0.84)',
    soft: 'rgba(150, 216, 255, 0.18)',
    strong: '#84C6FF',
    pale: '#D9F0FF',
  },
  rose: {
    border: 'rgba(231, 116, 150, 0.34)',
    glow: 'rgba(231, 116, 150, 0.16)',
    card: 'rgba(18, 15, 21, 0.84)',
    soft: 'rgba(231, 116, 150, 0.18)',
    strong: '#F39AB2',
    pale: '#FFE0E9',
  },
  orange: {
    border: 'rgba(240, 106, 57, 0.34)',
    glow: 'rgba(240, 106, 57, 0.18)',
    card: 'rgba(21, 16, 12, 0.84)',
    soft: 'rgba(240, 106, 57, 0.18)',
    strong: '#FFB389',
    pale: '#FFE0D0',
  },
  neutral: {
    border: 'rgba(255,255,255,0.16)',
    glow: 'rgba(255,255,255,0.08)',
    card: 'rgba(14, 18, 24, 0.84)',
    soft: 'rgba(255,255,255,0.08)',
    strong: '#D6E1EA',
    pale: '#F4FAFF',
  },
};

function TodayArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="12" y="12" width="92" height="100" rx="22" fill={tone.card} stroke={tone.border} />
      <Circle cx="58" cy="62" r="26" fill="none" stroke={tone.border} strokeWidth="6" />
      <Path d="M58 36 A26 26 0 0 1 80 69" fill="none" stroke={tone.strong} strokeWidth="6" strokeLinecap="round" />
      <Circle cx="58" cy="62" r="5" fill={tone.pale} />
      <Rect x="32" y="24" width="52" height="8" rx="4" fill={tone.soft} />
      <Rect x="30" y="88" width="56" height="10" rx="5" fill={tone.soft} />
      <Rect x="112" y="22" width="40" height="80" rx="18" fill="rgba(11,15,20,0.70)" stroke={tone.border} />
      <Rect x="120" y="32" width="24" height="6" rx="3" fill={tone.soft} />
      <Rect x="120" y="44" width="16" height="6" rx="3" fill="rgba(255,255,255,0.10)" />
      <Rect x="120" y="58" width="26" height="24" rx="10" fill={tone.soft} />
      <Polyline
        points="124,74 130,68 136,70 142,58"
        fill="none"
        stroke={tone.pale}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PlanArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="12" y="12" width="140" height="100" rx="22" fill={tone.card} stroke={tone.border} />
      <Rect x="28" y="24" width="14" height="12" rx="6" fill={tone.soft} />
      <Rect x="48" y="24" width="14" height="12" rx="6" fill={tone.soft} />
      <Rect x="68" y="24" width="14" height="12" rx="6" fill={tone.strong} />
      <Rect x="88" y="24" width="14" height="12" rx="6" fill={tone.soft} />
      <Rect x="108" y="24" width="14" height="12" rx="6" fill="rgba(255,255,255,0.10)" />
      <Rect x="128" y="24" width="14" height="12" rx="6" fill="rgba(255,255,255,0.10)" />
      <Rect x="30" y="62" width="12" height="18" rx="6" fill="rgba(255,255,255,0.10)" />
      <Rect x="50" y="52" width="12" height="28" rx="6" fill={tone.soft} />
      <Rect x="70" y="42" width="12" height="38" rx="6" fill={tone.strong} />
      <Rect x="90" y="56" width="12" height="24" rx="6" fill={tone.soft} />
      <Rect x="110" y="48" width="12" height="32" rx="6" fill={tone.pale} />
      <Polyline
        points="32,50 56,44 76,34 96,46 116,38 136,58"
        fill="none"
        stroke={tone.pale}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BuildArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="18" y="18" width="70" height="88" rx="18" fill={tone.card} stroke={tone.border} />
      <Rect x="76" y="30" width="70" height="76" rx="18" fill="rgba(11,15,20,0.66)" stroke={tone.border} />
      <Rect x="30" y="30" width="44" height="8" rx="4" fill={tone.soft} />
      <Rect x="30" y="46" width="30" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Rect x="30" y="64" width="44" height="8" rx="4" fill={tone.soft} />
      <Rect x="30" y="80" width="24" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Path d="M94 80 L122 52" stroke={tone.strong} strokeWidth="7" strokeLinecap="round" />
      <Path d="M116 46 L128 46 L128 58" fill="none" stroke={tone.strong} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="102" cy="48" r="9" fill={tone.soft} />
      <Rect x="92" y="88" width="38" height="8" rx="4" fill={tone.soft} />
    </Svg>
  );
}

function BrowseArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="14" y="18" width="58" height="80" rx="18" fill={tone.card} stroke={tone.border} />
      <Rect x="54" y="28" width="48" height="64" rx="18" fill="rgba(11,15,20,0.68)" stroke={tone.border} />
      <Rect x="92" y="18" width="58" height="80" rx="18" fill={tone.card} stroke={tone.border} />
      <Rect x="26" y="30" width="26" height="8" rx="4" fill={tone.soft} />
      <Rect x="26" y="46" width="34" height="24" rx="10" fill={tone.soft} />
      <Rect x="104" y="30" width="30" height="8" rx="4" fill={tone.soft} />
      <Rect x="104" y="46" width="22" height="8" rx="4" fill="rgba(255,255,255,0.10)" />
      <Rect x="104" y="60" width="30" height="22" rx="10" fill={tone.soft} />
      <Path d="M74 108 L90 108" stroke={tone.pale} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

function SearchArt({ tone }: { tone: Tone }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 164 124">
      <Rect x="12" y="18" width="140" height="88" rx="20" fill={tone.card} stroke={tone.border} />
      <Rect x="24" y="30" width="116" height="18" rx="9" fill="rgba(11,15,20,0.74)" stroke={tone.border} />
      <Circle cx="42" cy="39" r="7" fill="none" stroke={tone.strong} strokeWidth="3.5" />
      <Line x1="47" y1="44" x2="53" y2="50" stroke={tone.strong} strokeWidth="3.5" strokeLinecap="round" />
      <Rect x="60" y="34" width="44" height="8" rx="4" fill={tone.soft} />
      <Rect x="28" y="62" width="34" height="10" rx="5" fill={tone.soft} />
      <Rect x="68" y="62" width="48" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="28" y="80" width="24" height="10" rx="5" fill="rgba(255,255,255,0.10)" />
      <Rect x="58" y="80" width="58" height="10" rx="5" fill={tone.soft} />
    </Svg>
  );
}

export function WorkoutSceneGraphic({
  variant,
  accent = 'blue',
  compact = false,
  style,
}: WorkoutSceneGraphicProps) {
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
      {variant === 'today' ? <TodayArt tone={tone} /> : null}
      {variant === 'plan' ? <PlanArt tone={tone} /> : null}
      {variant === 'build' ? <BuildArt tone={tone} /> : null}
      {variant === 'browse' ? <BrowseArt tone={tone} /> : null}
      {variant === 'search' ? <SearchArt tone={tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    width: '100%',
    height: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  frameCompact: {
    height: 86,
    borderRadius: radii.md,
  },
  glow: {
    position: 'absolute',
    top: -26,
    right: -10,
    width: 78,
    height: 78,
    borderRadius: 78,
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '52%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});

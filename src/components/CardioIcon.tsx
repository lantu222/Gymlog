/** Cardio activity glyphs (Cardio v1) — phosphor for run/walk/bike, custom strokes for treadmill and rower. */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PersonSimpleRun } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleRun';
import { PersonSimpleWalk } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleWalk';
import { PersonSimpleBike } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleBike';

import { CardioIconKind } from '../lib/cardio';

export function CardioIcon({ kind, size, color }: { kind: CardioIconKind; size: number; color: string }) {
  if (kind === 'run') {
    return <PersonSimpleRun size={size} color={color} weight="bold" />;
  }
  if (kind === 'walk') {
    return <PersonSimpleWalk size={size} color={color} weight="bold" />;
  }
  if (kind === 'cycle') {
    return <PersonSimpleBike size={size} color={color} weight="bold" />;
  }
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'treadmill') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M3 17.5L19 13" {...stroke} strokeWidth={2.4} />
        <Path d="M4 21h13M8.5 17.5V21M19 13v8M19 13l2-8.5" {...stroke} />
      </Svg>
    );
  }
  // rower
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 18h18" {...stroke} strokeWidth={2.4} />
      <Path d="M7 18v-3.5h5L15 18M15 9.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM12 14.5l3-3.5 4 2" {...stroke} />
    </Svg>
  );
}

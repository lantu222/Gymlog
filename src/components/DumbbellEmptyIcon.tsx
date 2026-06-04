import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type Props = {
  size?: number;
};

export default function DumbbellEmptyIcon({ size = 96 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id="purple" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A78BFA" />
          <Stop offset="0.55" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#5B21B6" />
        </LinearGradient>
      </Defs>

      <Circle cx="48" cy="48" r="38" fill="#F3ECFF" />

      <G rotation="-25" origin="48,48">
        <Ellipse cx="45" cy="59" rx="25" ry="6" fill="#C4B5FD" opacity="0.22" />

        <Rect x="28" y="43" width="34" height="10" rx="4" fill="url(#purple)" />
        <Rect x="31" y="45" width="28" height="3" rx="1.5" fill="#C4B5FD" opacity="0.65" />

        <Rect x="19" y="35" width="10" height="26" rx="4" fill="url(#purple)" />
        <Rect x="26" y="32" width="9" height="32" rx="4" fill="url(#purple)" />

        <Rect x="61" y="32" width="9" height="32" rx="4" fill="url(#purple)" />
        <Rect x="68" y="35" width="10" height="26" rx="4" fill="url(#purple)" />

        <Rect x="21" y="38" width="5" height="18" rx="2" fill="#C4B5FD" opacity="0.55" />
        <Rect x="63" y="35" width="5" height="22" rx="2" fill="#C4B5FD" opacity="0.55" />
      </G>
    </Svg>
  );
}

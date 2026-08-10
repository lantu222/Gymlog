import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { CUT_BY_SIZE, CutSize, cutCornerPath, skewAboutCentre } from '../lib/cutCorner';

/**
 * The A3 shape as a surface: one SVG path behind the content, sized from
 * onLayout, with everything else laid out normally on top.
 *
 * Only the outline, the sheen and the speed line live here. Fills, shadows and
 * press behaviour belong to whatever uses it, so a button and a list row can
 * share one shape without sharing a look.
 */

export type { CutSize };
export { CUT_BY_SIZE };

interface CutSurfaceProps {
  size: CutSize;
  /** Painted inside the shape. */
  fill: string;
  /** Optional 2px inner border, for the outline button variant. */
  stroke?: string;
  strokeWidth?: number;
  /**
   * The diagonal highlight, drawn INSIDE the shape.
   *
   * As a plain overlay View it escaped the cut: `overflow: hidden` clips to the
   * rectangle, not to the path, so the band reappeared across the corner the
   * shape had just removed. Clipping it with the same path is the only way the
   * two read as one gesture.
   */
  sheen?: { left: number; width: number; opacity?: number };
  /**
   * The left-edge speed line: a solid head and a fainter echo, same angle.
   *
   * Also drawn inside the SVG rather than as overlay Views. On Android a
   * transformed child escapes `overflow: hidden`, so the skewed bars rendered
   * outside the row and read as loose furniture beside the card.
   */
  speedLine?: { color: string };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function CutSurface({
  size,
  fill,
  stroke,
  strokeWidth = 2,
  sheen,
  speedLine,
  style,
  children,
}: CutSurfaceProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) {
      setBox({ width, height });
    }
  };

  const cut = CUT_BY_SIZE[size];

  return (
    <View style={[styles.surface, style]} onLayout={onLayout}>
      {box.width > 0 && box.height > 0 ? (
        <Svg
          width={box.width}
          height={box.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <ClipPath id="cutClip">
              <Path d={cutCornerPath(box.width, box.height, cut)} />
            </ClipPath>
          </Defs>
          <Path
            d={cutCornerPath(box.width, box.height, cut)}
            fill={fill}
            stroke={stroke}
            // Half the width sits outside the path, so double it to keep the
            // visible line the requested thickness.
            strokeWidth={stroke ? strokeWidth * 2 : undefined}
          />
          {speedLine ? (
            <G clipPath="url(#cutClip)">
              <Rect
                x={-4}
                y={-10}
                width={10}
                height={box.height + 20}
                fill={speedLine.color}
                transform={skewAboutCentre(box.height)}
              />
              <Rect
                x={9}
                y={-10}
                width={4}
                height={box.height + 20}
                fill={speedLine.color}
                opacity={0.3}
                transform={skewAboutCentre(box.height)}
              />
            </G>
          ) : null}
          {sheen ? (
            <G clipPath="url(#cutClip)">
              <Rect
                x={sheen.left}
                y={-8}
                width={sheen.width}
                height={box.height + 16}
                fill="#FFFFFF"
                opacity={sheen.opacity ?? 0.14}
                // The same angle the cut implies.
                transform={skewAboutCentre(box.height)}
              />
            </G>
          ) : null}
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    // The path is the background; overflow keeps the sheen inside the shape.
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});

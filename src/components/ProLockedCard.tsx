import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { CutSurface } from './CutSurface';
import { t } from '../lib/i18n';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The single locked pattern used at every paywall moment (pw-shared.jsx):
 * the app states the finding in plain text, then blurs ONLY the conclusion.
 *
 * The blurred lines are the REAL conclusion computed from the user's own log
 * (src/lib/proInsights.ts) — never a generic feature list. RN has no CSS blur
 * for text, so the blur is transparent ink + a soft text shadow, which reads
 * the same and stays selectable-proof.
 *
 * A3: the card is a dashed cut surface — dashed is the set's word for "an
 * opening, not a card" (the Create-programme row uses it the same way), and a
 * locked conclusion is exactly that. The PRO badge is the cut chip.
 */
export function ProLockIcon({ color = PW.proInk, size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={9} rx={2.5} stroke={color} strokeWidth={2.3} />
      <Path d="M8.5 11V8a3.5 3.5 0 017 0v3" stroke={color} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}

export function ProPill({ label = 'PRO' }: { label?: string }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <CutSurface size="chip" fill={theme.purple} style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </CutSurface>
  );
}

interface ProLockedCardProps {
  language: AppLanguage;
  /** Short plain-text finding line on the lock. */
  teaser: string;
  /** The real conclusion, shown blurred. Wraps on its own. */
  body: string;
  /** CTA label; defaults to "See the recommendation". */
  cta?: string;
  compact?: boolean;
  onPress: () => void;
}

export function ProLockedCard({ language, teaser, body, cta, compact, onPress }: ProLockedCardProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={teaser}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <CutSurface
        size="md"
        fill={theme.purpleLight}
        stroke={theme.purple}
        strokeWidth={1.5}
        dashed
        style={[styles.card, compact && styles.cardCompact]}
      >
      <View style={styles.headRow}>
        <ProLockIcon />
        <Text style={styles.teaser} numberOfLines={2}>
          {teaser}
        </Text>
        <ProPill />
      </View>
      <View style={styles.hiddenBlock}>
        {/* No numberOfLines: this is a real conclusion, so a longer
            translation must wrap rather than lose its second half. */}
        <Text style={styles.hiddenLine}>{body}</Text>
        {/* Android's text shadow is a mask filter, not a gaussian blur: on
            device the glyph shapes survived it and short lines stayed
            readable. A scrim over the top is what the old coach sheet had to
            do for the same reason. You can see there is an answer here; you
            cannot read it. */}
        <View style={styles.hiddenScrim} pointerEvents="none" />
      </View>
      <Text style={styles.cta}>{cta ?? t(language, 'pro.locked.cta')} →</Text>
      </CutSurface>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  cardCompact: {
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  teaser: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: PW.proInk,
  },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hiddenBlock: {
    marginTop: 9,
    position: 'relative',
  },
  hiddenScrim: {
    ...StyleSheet.absoluteFillObject,
    // 0.55 still left a short line readable on device; 0.75 leaves the shape
    // of an answer and nothing else, which is the whole point.
    backgroundColor: 'rgba(239,231,255,0.75)',
  },
  hiddenLine: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    // The blur: real text, unreadable. Transparent ink, soft shadow. Radius 7
    // still read cleanly on device for short lines — 11 is the point where the
    // shape survives and the words do not.
    color: 'transparent',
    textShadowColor: 'rgba(16,24,40,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 11,
  },
  cta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: theme.purple,
  },
});

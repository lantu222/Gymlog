import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { t } from '../lib/i18n';
import { HG, PW } from '../lightTheme';
import { AppLanguage } from '../types/models';

/**
 * The single locked pattern used at every paywall moment (pw-shared.jsx):
 * the app states the finding in plain text, then blurs ONLY the conclusion.
 *
 * The blurred lines are the REAL conclusion computed from the user's own log
 * (src/lib/proInsights.ts) — never a generic feature list. RN has no CSS blur
 * for text, so the blur is transparent ink + a soft text shadow, which reads
 * the same and stays selectable-proof.
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
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

interface ProLockedCardProps {
  language: AppLanguage;
  /** Short plain-text finding line on the lock. */
  teaser: string;
  /** The real conclusion, shown blurred. */
  lines: string[];
  /** CTA label; defaults to "See the recommendation". */
  cta?: string;
  compact?: boolean;
  onPress: () => void;
}

export function ProLockedCard({ language, teaser, lines, cta, compact, onPress }: ProLockedCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={teaser}
      onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.pressed]}
    >
      <View style={styles.headRow}>
        <ProLockIcon />
        <Text style={styles.teaser} numberOfLines={2}>
          {teaser}
        </Text>
        <ProPill />
      </View>
      <View style={styles.hiddenBlock}>
        {lines.map((line, index) => (
          <Text key={index} style={styles.hiddenLine} numberOfLines={2}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={styles.cta}>{cta ?? t(language, 'pro.locked.cta')} →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HG.purpleLight,
    borderWidth: 1.5,
    borderColor: HG.purple,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  cardCompact: {
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  pressed: {
    opacity: 0.85,
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
    backgroundColor: HG.purple,
    borderRadius: 6,
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
  },
  hiddenLine: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    // The blur: real text, unreadable. Transparent ink, soft shadow.
    color: 'transparent',
    textShadowColor: 'rgba(16,24,40,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  cta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: HG.purple,
  },
});

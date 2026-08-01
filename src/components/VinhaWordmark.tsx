import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Theme, useThemedStyles } from '../theming';

/**
 * The Vinha wordmark.
 *
 * "V·in·ha" with the middle syllable in the accent — the same trick the old
 * Vinha mark used with its "AI", so the shape of the brand survives the
 * rename even though the letters do not.
 *
 * The `app` tag is a first-launch aid, not part of the name. *Vinha* is an
 * ordinary Finnish adjective and a well-known wood stain, so on the splash the
 * tag says which one this is; by the time the welcome screen settles it has
 * flown off and the mark stands alone. Written solid, "Vinhaapp" would pull
 * the stress onto a long "aa" that is not in the word — which is exactly why
 * the tag is a separate, smaller, quieter token.
 */
interface VinhaWordmarkProps {
  size?: number;
  /** Shows the transient "app" tag beside the mark. */
  showAppTag?: boolean;
  /** Animated style for the tag alone, so it can exit without the mark. */
  appTagStyle?: Animated.WithAnimatedValue<object>;
  /** Overrides for the splash's ghost trails. */
  color?: string;
  accentColor?: string;
  fontFamily?: string;
}

export function VinhaWordmark({
  size = 64,
  showAppTag = false,
  appTagStyle,
  color,
  accentColor,
  fontFamily,
}: VinhaWordmarkProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.row, { gap: size * 0.14 }]}>
      <Text
        style={[
          styles.mark,
          // Tracking scales with the mark like everything else here. Left at a
          // fixed -2.9 it would read tighter at 64 and looser at 74, so the
          // lockup would change shape whenever the size changed.
          { fontSize: size, lineHeight: size, letterSpacing: size * -0.0453, fontFamily },
          color ? { color } : null,
        ]}
      >
        V
        <Text style={[styles.accent, accentColor ? { color: accentColor } : null]}>in</Text>
        ha
      </Text>
      {showAppTag ? (
        <Animated.Text
          style={[
            styles.tag,
            { fontSize: size * 0.26, lineHeight: size * 0.26, fontFamily },
            appTagStyle,
          ]}
        >
          app
        </Animated.Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    mark: {
      fontWeight: '800',
      color: theme.ink,
    },
    accent: {
      color: theme.purple,
    },
    tag: {
      fontWeight: '700',
      letterSpacing: 0.3,
      color: theme.faint,
    },
  });

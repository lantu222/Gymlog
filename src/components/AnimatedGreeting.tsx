import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

/**
 * The Home greeting, revealed one word at a time.
 *
 * Each word rises and fades in on a short stagger, and any occurrence of
 * "GAINER" gets the brand's purple "AI" treatment — the same three letters the
 * logo colours, so the word reads the same wherever it appears.
 *
 * Words, not letters: a per-letter stagger on a Finnish greeting means thirty
 * animated nodes on every Home mount, and long compounds ("Ensimmäinen") read
 * as a stutter rather than a flourish. Word-level keeps it to a handful of
 * nodes and still lands the effect.
 *
 * Re-runs whenever the text changes, so tomorrow's rotated greeting animates
 * in the same way rather than appearing fully formed.
 */
interface AnimatedGreetingProps {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Colour for the "AI" inside GAINER. */
  accentColor?: string;
  /** Milliseconds between consecutive words. */
  staggerMs?: number;
  /** Set false to render instantly (reduced motion, tests). */
  animate?: boolean;
  /**
   * 'words' staggers each word; 'line' rises the whole string as one node.
   *
   * Use 'line' wherever the text must stay on one line and shrink to fit —
   * `adjustsFontSizeToFit` measures a single Text, so the word-split version
   * would size each word on its own and the line would come out ragged.
   */
  mode?: 'words' | 'line';
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}

const BRAND = 'GAINER';

/** "GAINER" → G + AI (accented) + NER, so the logo's colour break survives. */
function renderBrandWord(word: string, accentColor: string, key: string) {
  const at = word.toUpperCase().indexOf(BRAND);
  if (at === -1) {
    return word;
  }

  const before = word.slice(0, at);
  const brand = word.slice(at, at + BRAND.length);
  const after = word.slice(at + BRAND.length);

  return (
    <Text key={key}>
      {before}
      {brand.slice(0, 1)}
      <Text style={{ color: accentColor }}>{brand.slice(1, 3)}</Text>
      {brand.slice(3)}
      {after}
    </Text>
  );
}

export function AnimatedGreeting({
  text,
  style,
  accentColor = '#7C3AED',
  staggerMs = 55,
  animate = true,
  mode = 'words',
  numberOfLines,
  adjustsFontSizeToFit,
  minimumFontScale,
}: AnimatedGreetingProps) {
  // Split on spaces but keep them, so wrapping and spacing stay natural.
  // 'line' mode is a single unit, so it gets exactly one driver.
  const words = useMemo(
    () => (mode === 'line' ? [text] : text.split(/(\s+)/).filter((part) => part.length > 0)),
    [text, mode],
  );
  const progress = useRef<Animated.Value[]>([]).current;

  // One driver per word; rebuilt when the greeting changes.
  if (progress.length !== words.length) {
    progress.length = 0;
    words.forEach(() => progress.push(new Animated.Value(animate ? 0 : 1)));
  }

  useEffect(() => {
    if (!animate) {
      progress.forEach((value) => value.setValue(1));
      return;
    }

    progress.forEach((value) => value.setValue(0));
    const animation = Animated.stagger(
      staggerMs,
      progress.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [text, animate, staggerMs, progress]);

  if (mode === 'line') {
    const value = progress[0];
    return (
      <Animated.Text
        style={[
          style,
          {
            opacity: value,
            transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        minimumFontScale={minimumFontScale}
      >
        {renderBrandWord(text, accentColor, 'line-brand')}
      </Animated.Text>
    );
  }

  return (
    <View style={styles.row}>
      {words.map((word, index) => {
        const value = progress[index];
        // Whitespace still needs a node so the stagger indexes line up, but it
        // must not animate on its own or the gaps flicker.
        if (/^\s+$/.test(word)) {
          return (
            <Text key={`space-${index}`} style={style}>
              {word}
            </Text>
          );
        }

        return (
          <Animated.Text
            key={`${word}-${index}`}
            style={[
              style,
              {
                opacity: value,
                transform: [
                  {
                    translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                  },
                ],
              },
            ]}
          >
            {renderBrandWord(word, accentColor, `${word}-${index}-brand`)}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Theme, useThemedStyles } from '../theming';

/**
 * The gap between the system splash and the brand animation, while storage
 * hydrates. It is the background colour and nothing else, on purpose.
 *
 * It used to draw a wordmark here — until the rename, the GAINER one, which is
 * how the old brand survived every sweep: the doc comment said Vinha, the JSX
 * said otherwise. But a mark drawn here would have to vanish so VinhaSplash
 * can streak the real one in from off-screen, and the whole point of that
 * sequence is that the name arrives having travelled. Showing it, hiding it,
 * then flying it in reads as a stutter.
 */
export function LaunchScreen() {
  const styles = useThemedStyles(makeStyles);

  return <View style={styles.screen} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
  });

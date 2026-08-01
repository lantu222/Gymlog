import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Theme, useThemedStyles } from '../theming';

/**
 * The first frame the app owns: the Vinha wordmark alone on the light
 * background, breathing in while storage hydrates. Deliberately nothing else —
 * the system splash before this one is only a colour, so the wordmark should
 * feel like it fades up onto that same surface.
 */
export function LaunchScreen() {
  const styles = useThemedStyles(makeStyles);
  const enter = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    <View style={styles.screen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundLogo,
          {
            opacity: enter,
            transform: [{ translateY: -48 }, { scale: enterScale }],
          },
        ]}
      >
        <Text style={styles.gainerText}>
          <Text style={styles.gainerTextInk}>G</Text>
          <Text style={styles.gainerTextPurple}>AI</Text>
          <Text style={styles.gainerTextInk}>NER</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  backgroundLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
  },
  gainerText: {
    fontSize: 74,
    lineHeight: 96,
    fontWeight: '900',
    letterSpacing: 0,
  },
  gainerTextInk: {
    color: theme.ink,
  },
  gainerTextPurple: {
    color: theme.purple,
  },
});

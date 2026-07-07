import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HG } from '../lightTheme';

export function LaunchScreen() {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.backgroundLogo}>
        <Text style={styles.gainerText}>
          <Text style={styles.gainerTextInk}>G</Text>
          <Text style={styles.gainerTextPurple}>AI</Text>
          <Text style={styles.gainerTextInk}>NER</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  backgroundLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
    transform: [{ translateY: -48 }],
  },
  gainerText: {
    fontSize: 74,
    lineHeight: 96,
    fontWeight: '900',
    letterSpacing: 0,
  },
  gainerTextInk: {
    color: HG.ink,
  },
  gainerTextPurple: {
    color: HG.purple,
  },
});

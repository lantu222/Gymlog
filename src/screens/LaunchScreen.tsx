import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function LaunchScreen() {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.backgroundLogo}>
        <Text style={styles.gainerText}>
          <Text style={styles.gainerTextWhite}>G</Text>
          <Text style={styles.gainerTextPurple}>AI</Text>
          <Text style={styles.gainerTextWhite}>NER</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080815',
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
  gainerTextWhite: {
    color: '#FFFFFF',
  },
  gainerTextPurple: {
    color: '#7F77DD',
  },
});

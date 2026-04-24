import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function LaunchScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.topHalf} />
      <View style={styles.bottomHalf} />

      <View pointerEvents="none" style={styles.backgroundLogo}>
        <Text style={styles.gymText}>GYM</Text>
        <Text style={styles.logText}>LOG</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHalf: {
    ...StyleSheet.absoluteFillObject,
    bottom: '50%',
    backgroundColor: '#000000',
  },
  bottomHalf: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
    backgroundColor: '#FFFFFF',
  },
  backgroundLogo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
    transform: [{ translateY: -118 }],
  },
  gymText: {
    color: '#FFFFFF',
    marginBottom: -10,
    fontSize: 122,
    lineHeight: 122,
    fontWeight: '900',
    letterSpacing: -4.4,
  },
  logText: {
    color: '#000000',
    marginTop: -10,
    fontSize: 130,
    lineHeight: 130,
    fontWeight: '900',
    letterSpacing: -3.8,
  },
});

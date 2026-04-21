import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function LaunchScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.topHalf}>
        <Text style={styles.gymText}>GYM</Text>
      </View>
      <View style={styles.bottomHalf}>
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
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  bottomHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  gymText: {
    color: '#FFFFFF',
    marginBottom: -10,
    fontSize: 100,
    lineHeight: 100,
    fontWeight: '900',
    letterSpacing: -4.4,
  },
  logText: {
    color: '#000000',
    marginTop: -14,
    fontSize: 112,
    lineHeight: 112,
    fontWeight: '900',
    letterSpacing: -3.8,
  },
});

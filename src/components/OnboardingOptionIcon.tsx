import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Barbell } from 'phosphor-react-native/lib/commonjs/icons/Barbell';
import { HouseSimple } from 'phosphor-react-native/lib/commonjs/icons/HouseSimple';
import { PersonSimple } from 'phosphor-react-native/lib/commonjs/icons/PersonSimple';
import { PersonSimpleRun } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleRun';

export type OnboardingOptionIconName = 'barbell' | 'home' | 'run' | 'person';

const ICONS = {
  barbell: Barbell,
  home: HouseSimple,
  run: PersonSimpleRun,
  person: PersonSimple,
};

export function OnboardingOptionIcon({ name }: { name: OnboardingOptionIconName }) {
  const Icon = ICONS[name];

  return (
    <View style={styles.container}>
      <Icon size={24} color="#FFFFFF" weight="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
});

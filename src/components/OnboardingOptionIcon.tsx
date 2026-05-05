import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Barbell } from 'phosphor-react-native/lib/commonjs/icons/Barbell';
import { CalendarBlank } from 'phosphor-react-native/lib/commonjs/icons/CalendarBlank';
import { Heart } from 'phosphor-react-native/lib/commonjs/icons/Heart';
import { HouseSimple } from 'phosphor-react-native/lib/commonjs/icons/HouseSimple';
import { PersonArmsSpread } from 'phosphor-react-native/lib/commonjs/icons/PersonArmsSpread';
import { PersonSimple } from 'phosphor-react-native/lib/commonjs/icons/PersonSimple';
import { PersonSimpleRun } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleRun';
import { Scales } from 'phosphor-react-native/lib/commonjs/icons/Scales';
import { SneakerMove } from 'phosphor-react-native/lib/commonjs/icons/SneakerMove';
import { Star } from 'phosphor-react-native/lib/commonjs/icons/Star';
import { TrendUp } from 'phosphor-react-native/lib/commonjs/icons/TrendUp';
import { Trophy } from 'phosphor-react-native/lib/commonjs/icons/Trophy';

export type OnboardingOptionIconName =
  | 'barbell'
  | 'calendar'
  | 'home'
  | 'run'
  | 'person'
  | 'bodyweight'
  | 'running_shoe'
  | 'star'
  | 'heart'
  | 'scales'
  | 'trend_up'
  | 'trophy';

const ICONS = {
  barbell: Barbell,
  calendar: CalendarBlank,
  home: HouseSimple,
  run: PersonSimpleRun,
  person: PersonSimple,
  bodyweight: PersonArmsSpread,
  running_shoe: SneakerMove,
  star: Star,
  heart: Heart,
  scales: Scales,
  trend_up: TrendUp,
  trophy: Trophy,
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

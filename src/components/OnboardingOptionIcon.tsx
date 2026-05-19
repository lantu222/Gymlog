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

export function OnboardingOptionIcon({
  name,
  active = false,
  subdued = false,
}: {
  name: OnboardingOptionIconName;
  active?: boolean;
  subdued?: boolean;
}) {
  const Icon = ICONS[name];

  return (
    <View style={[styles.container, active && styles.containerActive, subdued && styles.containerSubdued]}>
      <Icon size={24} color={subdued ? 'rgba(255,255,255,0.52)' : '#FFFFFF'} weight="fill" />
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
    backgroundColor: 'rgba(6,5,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(169,139,255,0.10)',
  },
  containerActive: {
    backgroundColor: 'rgba(18,14,48,0.78)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  containerSubdued: {
    backgroundColor: 'rgba(7,7,18,0.66)',
    borderColor: 'rgba(169,139,255,0.05)',
  },
});

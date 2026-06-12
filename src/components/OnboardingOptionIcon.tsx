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

// Light redesign tokens: purpleLight tile with purple icon; selected card
// flips to a translucent white tile with a white icon (design OptionCard).
const TILE_BG = '#EFE7FF';
const TILE_BG_ACTIVE = 'rgba(255,255,255,0.16)';
const ICON_PURPLE = '#7C3AED';

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
      <Icon size={22} color={active ? '#FFFFFF' : ICON_PURPLE} weight="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE_BG,
  },
  containerActive: {
    backgroundColor: TILE_BG_ACTIVE,
  },
  containerSubdued: {
    opacity: 0.6,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RootTabKey } from '../navigation/routes';
import { colors, radii, spacing } from '../theme';

interface BottomTabBarProps {
  activeTab: RootTabKey;
  onTabPress: (tab: RootTabKey) => void;
}

const tabs: { key: RootTabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'workout', label: 'Workout' },
  { key: 'progress', label: 'Progress' },
  { key: 'profile', label: 'Profile' },
];

const tabTones: Record<
  RootTabKey,
  {
    activeBorder: string;
    activeGlow: string;
    activeBackground: string;
    activeIndicator: string;
    activeLabel: string;
    inactivePlate: string;
    inactiveIndicator: string;
  }
> = {
  home: {
    activeBorder: 'rgba(135, 198, 255, 0.56)',
    activeGlow: 'rgba(85, 138, 189, 0.22)',
    activeBackground: 'rgba(85, 138, 189, 0.20)',
    activeIndicator: '#87C6FF',
    activeLabel: '#F4FAFF',
    inactivePlate: 'rgba(85, 138, 189, 0.08)',
    inactiveIndicator: '#A2B8CD',
  },
  workout: {
    activeBorder: 'rgba(216, 106, 134, 0.54)',
    activeGlow: 'rgba(191, 74, 105, 0.22)',
    activeBackground: 'rgba(191, 74, 105, 0.18)',
    activeIndicator: '#E77496',
    activeLabel: '#FFF4F8',
    inactivePlate: 'rgba(191, 74, 105, 0.08)',
    inactiveIndicator: '#AE95A7',
  },
  progress: {
    activeBorder: 'rgba(240, 106, 57, 0.56)',
    activeGlow: 'rgba(162, 54, 18, 0.24)',
    activeBackground: 'rgba(162, 54, 18, 0.18)',
    activeIndicator: '#F06A39',
    activeLabel: '#FFF7F2',
    inactivePlate: 'rgba(240, 106, 57, 0.08)',
    inactiveIndicator: '#B1988F',
  },
  profile: {
    activeBorder: 'rgba(154, 204, 255, 0.54)',
    activeGlow: 'rgba(114, 181, 255, 0.22)',
    activeBackground: 'rgba(114, 181, 255, 0.17)',
    activeIndicator: '#9ACCFF',
    activeLabel: '#F4FAFF',
    inactivePlate: 'rgba(114, 181, 255, 0.07)',
    inactiveIndicator: '#9AAFC4',
  },
};

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={styles.wrapperHighlight} />
      <View pointerEvents="none" style={styles.wrapperInnerShade} />

      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        const tone = tabTones[tab.key];

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={[
              styles.tab,
              { borderColor: active ? tone.activeBorder : 'rgba(255,255,255,0.06)' },
              active && [styles.tabActive, { backgroundColor: tone.activeBackground }],
            ]}
          >
            <View pointerEvents="none" style={[styles.tabGlass, { backgroundColor: active ? 'rgba(255,255,255,0.035)' : tone.inactivePlate }]} />
            <View pointerEvents="none" style={styles.tabTopSheen} />
            {active ? <View pointerEvents="none" style={[styles.activeGlow, { backgroundColor: tone.activeGlow }]} /> : null}
            <View style={[styles.indicator, { backgroundColor: active ? tone.activeIndicator : tone.inactiveIndicator }]} />
            <Text style={[styles.label, active && { color: tone.activeLabel }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg + 4,
    padding: 6,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(135, 198, 255, 0.40)',
    backgroundColor: 'rgba(24, 36, 49, 0.90)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  wrapperHighlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  wrapperInnerShade: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 6,
    height: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 11, 16, 0.10)',
  },
  tab: {
    overflow: 'hidden',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 60,
    borderRadius: 20,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  tabGlass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tabTopSheen: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  activeGlow: {
    position: 'absolute',
    top: -12,
    right: -10,
    width: 72,
    height: 72,
    borderRadius: 72,
  },
  indicator: {
    width: 22,
    height: 3,
    borderRadius: radii.pill,
  },
  label: {
    color: '#B4C4D3',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});
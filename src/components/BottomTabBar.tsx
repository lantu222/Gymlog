import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { RootTabKey } from '../navigation/routes';
import { radii, spacing } from '../theme';

interface BottomTabBarProps {
  activeTab: RootTabKey;
  onTabPress: (tab: RootTabKey) => void;
}

const tabs: { key: RootTabKey; label: string }[] = [
  { key: 'home', label: 'Training' },
  { key: 'workout', label: 'Workout' },
  { key: 'progress', label: 'Progress' },
  { key: 'profile', label: 'Profile' },
];

function TabIcon({ tab, active }: { tab: RootTabKey; active: boolean }) {
  const stroke = active ? '#050505' : '#FFFFFF';
  const strokeOpacity = active ? 1 : 0.84;
  const fill = active ? '#050505' : 'none';

  if (tab === 'home') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3.5 8.2L10 3.5L16.5 8.2V15.6C16.5 16.1 16.1 16.5 15.6 16.5H11.9V12.4H8.1V16.5H4.4C3.9 16.5 3.5 16.1 3.5 15.6V8.2Z"
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={1.7}
          strokeLinejoin="round"
          fill={fill}
        />
      </Svg>
    );
  }

  if (tab === 'workout') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Rect x="2.3" y="7.4" width="2.2" height="5.2" rx="0.6" fill={stroke} fillOpacity={strokeOpacity} />
        <Rect x="5.1" y="6.1" width="1.7" height="7.8" rx="0.6" fill={stroke} fillOpacity={strokeOpacity} />
        <Rect x="13.2" y="6.1" width="1.7" height="7.8" rx="0.6" fill={stroke} fillOpacity={strokeOpacity} />
        <Rect x="15.5" y="7.4" width="2.2" height="5.2" rx="0.6" fill={stroke} fillOpacity={strokeOpacity} />
        <Rect x="6.4" y="9.1" width="7.2" height="1.8" rx="0.9" fill={stroke} fillOpacity={strokeOpacity} />
      </Svg>
    );
  }

  if (tab === 'progress') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3 13.8L7.1 9.7L10 12.1L15.8 6.3"
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="15.8" cy="6.3" r="1.1" fill={stroke} fillOpacity={strokeOpacity} />
      </Svg>
    );
  }

  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="6.8" r="2.9" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={1.7} />
      <Path
        d="M4.5 16.2C4.9 13.4 7 11.9 10 11.9C13 11.9 15.1 13.4 15.5 16.2"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <TabIcon tab={tab.key} active={active} />
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg + 2,
    padding: 8,
    borderRadius: 28,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  labelActive: {
    color: '#050505',
  },
});

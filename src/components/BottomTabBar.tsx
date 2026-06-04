import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { RootTabKey } from '../navigation/routes';
import { radii, spacing } from '../theme';

interface BottomTabBarProps {
  activeTab: RootTabKey | null;
  aiActive?: boolean;
  onTabPress: (tab: RootTabKey) => void;
  onAiPress: () => void;
}

const sideTabs: { key: RootTabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'workout', label: 'Exercises' },
  { key: 'progress', label: 'Progress' },
  { key: 'profile', label: 'Profile' },
];

function TabIcon({ tab, active }: { tab: RootTabKey; active: boolean }) {
  const stroke = active ? '#7C3AED' : '#667085';
  const fill = active ? '#7C3AED' : 'none';
  const size = 22;

  if (tab === 'home') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3.5 8.2L10 3.5L16.5 8.2V15.6C16.5 16.1 16.1 16.5 15.6 16.5H11.9V12.4H8.1V16.5H4.4C3.9 16.5 3.5 16.1 3.5 15.6V8.2Z"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill={fill}
        />
      </Svg>
    );
  }

  if (tab === 'workout') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Rect x="2.3" y="7.4" width="2.2" height="5.2" rx="0.6" fill={stroke} />
        <Rect x="5.1" y="6.1" width="1.7" height="7.8" rx="0.6" fill={stroke} />
        <Rect x="13.2" y="6.1" width="1.7" height="7.8" rx="0.6" fill={stroke} />
        <Rect x="15.5" y="7.4" width="2.2" height="5.2" rx="0.6" fill={stroke} />
        <Rect x="6.4" y="9.1" width="7.2" height="1.8" rx="0.9" fill={stroke} />
      </Svg>
    );
  }

  if (tab === 'progress') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M3 13.8L7.1 9.7L10 12.1L15.8 6.3"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="15.8" cy="6.3" r="1.1" fill={stroke} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="6.8" r="2.9" stroke={stroke} strokeWidth={1.8} />
      <Path
        d="M4.5 16.2C4.9 13.4 7 11.9 10 11.9C13 11.9 15.1 13.4 15.5 16.2"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SideTab({
  tab,
  active,
  onPress,
}: {
  tab: { key: RootTabKey; label: string };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sideTab}>
      <TabIcon tab={tab.key} active={active} />
      <Text style={[styles.sideLabel, active && styles.sideLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export function BottomTabBar({ activeTab, aiActive = false, onTabPress, onAiPress }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const leftTabs = sideTabs.slice(0, 2);
  const rightTabs = sideTabs.slice(2);

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        <View style={styles.sideGroup}>
          {leftTabs.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={!aiActive && activeTab !== null && activeTab === tab.key}
              onPress={() => onTabPress(tab.key)}
            />
          ))}
        </View>

        <Pressable onPress={onAiPress} style={[styles.centerButton, aiActive && styles.centerButtonActive]}>
          <Text style={[styles.centerPlus, aiActive && styles.centerLabelActive]}>+</Text>
          <Text style={[styles.centerLabel, aiActive && styles.centerLabelActive]}>Start</Text>
        </Pressable>

        <View style={styles.sideGroup}>
          {rightTabs.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={!aiActive && activeTab !== null && activeTab === tab.key}
              onPress={() => onTabPress(tab.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E4D8FF',
    paddingTop: 10,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  sideTab: {
    minWidth: 62,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingBottom: 2,
  },
  sideLabel: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  sideLabelActive: {
    color: '#7C3AED',
  },
  centerButton: {
    width: 58,
    minHeight: 58,
    marginTop: -14,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4D8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#D8C7FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  centerButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  centerLabel: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  centerPlus: {
    color: '#7C3AED',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '600',
  },
  centerLabelActive: {
    color: '#FFFFFF',
  },
});

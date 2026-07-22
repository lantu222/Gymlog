import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ChevronIcon, SectionLabel, settingsStyles } from '../components/SettingsUi';
import { getSetupEquipmentTitle, getSetupGoalTitle } from '../lib/firstRunSetup';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppPreferences, SetupCautionArea, SetupCautionFlag } from '../types/models';

interface MyDataScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  /** Every row edits through the setup editor — there is no per-field form. */
  onEditSetup: () => void;
}

// Mirrors AVOID_AREA_OPTIONS + AVOID_EXTRA_AREA_OPTIONS in OnboardingScreen —
// keep in sync if the questionnaire renames a body part.
const CAUTION_AREA_LABELS: Record<SetupCautionArea, string> = {
  neck: 'Neck',
  shoulders: 'Shoulders',
  elbows: 'Elbows',
  wrists: 'Wrists',
  lower_back: 'Lower back',
  hips: 'Hips',
  knees: 'Knees',
  ankles: 'Ankles',
};

const AGE_RANGE_LABELS: Record<string, string> = {
  '18': 'Under 19',
  '19_25': '19–25',
  '26_30': '26–30',
  '31_40': '31–40',
  '41_plus': '41+',
};

function genderLabel(preferences: AppPreferences) {
  switch (preferences.setupGender) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    default:
      return null;
  }
}

function ageLabel(preferences: AppPreferences) {
  if (preferences.setupAge !== null) {
    return `${preferences.setupAge} years`;
  }
  if (preferences.setupAgeRange && preferences.setupAgeRange !== 'unspecified') {
    return AGE_RANGE_LABELS[preferences.setupAgeRange] ?? null;
  }
  return null;
}

function levelLabel(preferences: AppPreferences) {
  switch (preferences.setupLevel) {
    case 'beginner':
      return 'Beginner';
    case 'advanced':
      return 'Advanced';
    case 'pro':
      return 'Pro';
    default:
      return null;
  }
}

function limitationLabel(flag: SetupCautionFlag) {
  // Same wording rule as buildCautionSummaryLabel: avoid = the area is left
  // out of plans entirely, careful = joint-friendly swaps only.
  return `${CAUTION_AREA_LABELS[flag.area]} — ${flag.level === 'avoid' ? 'left out' : 'be careful'}`;
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DocIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3h7l5 5v13H7V3zM14 3v5h5M10 13h6M10 17h6"
        stroke={HG.faint}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DataRow({
  label,
  value,
  isLast = false,
  onPress,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.dataRow, !isLast && styles.dataRowDivider, pressed && { opacity: 0.65 }]}
    >
      <View style={styles.dataCopy}>
        <Text style={styles.dataLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.dataValue}>{value}</Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

/**
 * Screen 4 of the profile suite: everything the questionnaire knows about the
 * user, in one place. Rows show "Not set" honestly instead of hiding, and every
 * row opens the setup editor — the questionnaire stays the single write path
 * for this data.
 */
export function MyDataScreen({ preferences, onBack, onEditSetup }: MyDataScreenProps) {
  const basics: Array<{ label: string; value: string | null }> = [
    { label: 'Gender', value: genderLabel(preferences) },
    { label: 'Age', value: ageLabel(preferences) },
    { label: 'Height', value: preferences.setupHeightCm !== null ? `${preferences.setupHeightCm} cm` : null },
    {
      label: 'Weight',
      value: preferences.setupCurrentWeightKg !== null ? `${preferences.setupCurrentWeightKg} kg` : null,
    },
  ];

  const training: Array<{ label: string; value: string | null }> = [
    { label: 'Goal', value: preferences.setupGoal ? getSetupGoalTitle(preferences.setupGoal) : null },
    { label: 'Experience', value: levelLabel(preferences) },
    {
      label: 'Sessions per week',
      value: preferences.setupDaysPerWeek !== null ? `${preferences.setupDaysPerWeek}× per week` : null,
    },
    {
      label: 'Weekly time',
      value: preferences.setupWeeklyMinutes !== null ? `~${preferences.setupWeeklyMinutes} min` : null,
    },
    {
      label: 'Equipment',
      value: preferences.setupEquipment ? getSetupEquipmentTitle(preferences.setupEquipment) : null,
    },
  ];

  const limitations = preferences.setupCautionFlags.filter((flag) => flag.level !== 'info');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>My data</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={settingsStyles.section}>
          <SectionLabel label="BASICS" />
          <View style={settingsStyles.card}>
            {basics.map((row, index) => (
              <DataRow
                key={row.label}
                label={row.label}
                value={row.value ?? 'Not set'}
                isLast={index === basics.length - 1}
                onPress={onEditSetup}
              />
            ))}
          </View>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label="TRAINING PREFERENCES" />
          <View style={settingsStyles.card}>
            {training.map((row, index) => (
              <DataRow
                key={row.label}
                label={row.label}
                value={row.value ?? 'Not set'}
                isLast={index === training.length - 1}
                onPress={onEditSetup}
              />
            ))}
          </View>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label="ADDITIONAL" />
          <View style={settingsStyles.card}>
            {limitations.length > 0 ? (
              limitations.map((flag, index) => (
                <Pressable
                  key={flag.area}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit limitation ${CAUTION_AREA_LABELS[flag.area]}`}
                  onPress={onEditSetup}
                  style={({ pressed }) => [
                    styles.limitRow,
                    index !== limitations.length - 1 && styles.dataRowDivider,
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <View style={[styles.limitTile, flag.level === 'avoid' ? styles.limitTileAvoid : styles.limitTileCareful]}>
                    <ShieldIcon color={flag.level === 'avoid' ? '#C0392B' : '#B45309'} />
                  </View>
                  <Text style={[styles.limitText, flag.level === 'avoid' && styles.limitTextAvoid]}>
                    {limitationLabel(flag)}
                  </Text>
                  <ChevronIcon />
                </Pressable>
              ))
            ) : (
              <DataRow label="Limitations" value="Nothing noted" isLast onPress={onEditSetup} />
            )}
          </View>
        </View>

        <View style={styles.footerRow}>
          <DocIcon />
          <Text style={styles.footerText}>
            These details help us build the right plan and track your progress. You can change them any time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dataRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  dataCopy: {
    flex: 1,
    minWidth: 0,
  },
  dataLabel: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dataValue: {
    color: HG.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  limitTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitTileCareful: {
    backgroundColor: '#FBF0DD',
  },
  limitTileAvoid: {
    backgroundColor: '#FBEAE7',
  },
  limitText: {
    flex: 1,
    color: '#B45309',
    fontSize: 15,
    fontWeight: '800',
  },
  limitTextAvoid: {
    color: '#C0392B',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 22,
    paddingHorizontal: 4,
  },
  footerText: {
    flex: 1,
    color: HG.faint,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
});

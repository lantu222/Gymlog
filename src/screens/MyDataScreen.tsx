import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW, ChevronIcon, SectionLabel, settingsStyles } from '../components/SettingsUi';
import { getSetupEquipmentTitle, getSetupGoalTitle } from '../lib/firstRunSetup';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { AppPreferences, SetupCautionArea, SetupCautionFlag, SetupGender } from '../types/models';

interface MyDataScreenProps {
  preferences: AppPreferences;
  onBack: () => void;
  /** Basics edit in place — writes straight to preferences. */
  onSaveBasics: (patch: Partial<AppPreferences>) => void;
  /** Opens the questionnaire directly at the avoid step. */
  onEditLimitations: () => void;
  /** Runs the full questionnaire again → two fresh programs to pick from. */
  onCreateNewPlan: () => void;
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

type BasicField = 'gender' | 'age' | 'height' | 'weight';

const BASIC_FIELD_META: Record<Exclude<BasicField, 'gender'>, { title: string; unit: string; min: number; max: number }> = {
  age: { title: 'Age', unit: 'years', min: 13, max: 100 },
  height: { title: 'Height', unit: 'cm', min: 120, max: 230 },
  weight: { title: 'Weight', unit: 'kg', min: 30, max: 300 },
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

function DataRow({
  label,
  value,
  isLast = false,
  onPress,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const inner = (
    <View style={[styles.dataRow, !isLast && styles.dataRowDivider]}>
      <View style={styles.dataCopy}>
        <Text style={styles.dataLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.dataValue}>{value}</Text>
      </View>
      {onPress ? <ChevronIcon /> : null}
    </View>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}`}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.65 }}
    >
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

/**
 * Screen 4 of the profile suite. Basics edit in place through a small sheet;
 * limitations jump straight into the questionnaire's avoid step; training
 * preferences are read-only context for the "create a new plan" action, which
 * re-runs the questionnaire and ends at the two-program picker.
 */
export function MyDataScreen({ preferences, onBack, onSaveBasics, onEditLimitations, onCreateNewPlan }: MyDataScreenProps) {
  const [editing, setEditing] = useState<BasicField | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [draftGender, setDraftGender] = useState<SetupGender>('unspecified');

  const basics: Array<{ field: BasicField; label: string; value: string | null }> = [
    { field: 'gender', label: 'Gender', value: genderLabel(preferences) },
    { field: 'age', label: 'Age', value: ageLabel(preferences) },
    { field: 'height', label: 'Height', value: preferences.setupHeightCm !== null ? `${preferences.setupHeightCm} cm` : null },
    {
      field: 'weight',
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

  const openEditor = (field: BasicField) => {
    if (field === 'gender') {
      setDraftGender(preferences.setupGender ?? 'unspecified');
    } else if (field === 'age') {
      setDraftValue(preferences.setupAge !== null ? `${preferences.setupAge}` : '');
    } else if (field === 'height') {
      setDraftValue(preferences.setupHeightCm !== null ? `${preferences.setupHeightCm}` : '');
    } else {
      setDraftValue(preferences.setupCurrentWeightKg !== null ? `${preferences.setupCurrentWeightKg}` : '');
    }
    setEditing(field);
  };

  const numericDraftValid = (() => {
    if (editing === null || editing === 'gender') {
      return true;
    }
    const meta = BASIC_FIELD_META[editing];
    const parsed = Number(draftValue.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= meta.min && parsed <= meta.max;
  })();

  const saveEditor = () => {
    if (editing === null) {
      return;
    }
    if (editing === 'gender') {
      onSaveBasics({ setupGender: draftGender });
    } else {
      const parsed = Number(draftValue.replace(',', '.'));
      if (!numericDraftValid) {
        return;
      }
      if (editing === 'age') {
        onSaveBasics({ setupAge: Math.round(parsed) });
      } else if (editing === 'height') {
        onSaveBasics({ setupHeightCm: Math.round(parsed) });
      } else {
        onSaveBasics({ setupCurrentWeightKg: Math.round(parsed * 10) / 10 });
      }
    }
    setEditing(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>My data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={settingsStyles.section}>
          <SectionLabel label="BASICS" />
          <View style={styles.card}>
            {basics.map((row, index) => (
              <DataRow
                key={row.field}
                label={row.label}
                value={row.value ?? 'Not set'}
                isLast={index === basics.length - 1}
                onPress={() => openEditor(row.field)}
              />
            ))}
          </View>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label="TRAINING PREFERENCES" />
          <View style={styles.card}>
            {training.map((row, index) => (
              <DataRow key={row.label} label={row.label} value={row.value ?? 'Not set'} isLast={index === training.length - 1} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onCreateNewPlan}
            style={({ pressed }) => [styles.newPlanButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.newPlanButtonText}>Create a new training plan</Text>
          </Pressable>
          <Text style={styles.newPlanCaption}>
            Runs the setup questions again and builds two fresh programs to pick from. You can cancel any time.
          </Text>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label="ADDITIONAL" />
          <View style={styles.card}>
            {limitations.length > 0 ? (
              limitations.map((flag, index) => (
                <Pressable
                  key={flag.area}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit limitation ${CAUTION_AREA_LABELS[flag.area]}`}
                  onPress={onEditLimitations}
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
              <DataRow label="Limitations" value="Nothing noted" isLast onPress={onEditLimitations} />
            )}
          </View>
        </View>

        <Text style={styles.footerText}>
          These details help us build the right plan and track your progress. You can change them any time.
        </Text>
      </ScrollView>

      {/* basics edit sheet */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.sheetScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing === 'gender' ? 'Gender' : editing !== null ? BASIC_FIELD_META[editing].title : ''}
            </Text>

            {editing === 'gender' ? (
              <View style={styles.genderRow}>
                {(
                  [
                    { key: 'male', label: 'Male' },
                    { key: 'female', label: 'Female' },
                    { key: 'unspecified', label: 'Rather not say' },
                  ] as Array<{ key: SetupGender; label: string }>
                ).map((option) => {
                  const active = draftGender === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setDraftGender(option.key)}
                      style={[styles.genderChip, active && styles.genderChipActive]}
                    >
                      <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : editing !== null ? (
              <View style={styles.numericRow}>
                <TextInput
                  value={draftValue}
                  onChangeText={setDraftValue}
                  keyboardType="numeric"
                  autoFocus
                  placeholder="0"
                  placeholderTextColor={HG.faint}
                  style={styles.numericInput}
                />
                <Text style={styles.numericUnit}>{BASIC_FIELD_META[editing].unit}</Text>
              </View>
            ) : null}

            {editing !== null && editing !== 'gender' && draftValue.length > 0 && !numericDraftValid ? (
              <Text style={styles.sheetError}>
                {BASIC_FIELD_META[editing].min}–{BASIC_FIELD_META[editing].max} {BASIC_FIELD_META[editing].unit}
              </Text>
            ) : null}

            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setEditing(null)} style={styles.sheetCancel}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !numericDraftValid }}
                onPress={saveEditor}
                style={({ pressed }) => [
                  styles.sheetSave,
                  !numericDraftValid && styles.sheetSaveDisabled,
                  pressed && numericDraftValid && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.sheetSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 12,
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
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: -1,
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
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
  newPlanButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  newPlanButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  newPlanCaption: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
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
  footerText: {
    color: HG.faint,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 10,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(16,10,32,0.42)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sheet: {
    backgroundColor: HG.surface,
    borderRadius: 20,
    padding: 20,
  },
  sheetTitle: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  genderRow: {
    gap: 8,
    marginTop: 14,
  },
  genderChip: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  genderChipText: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  genderChipTextActive: {
    color: HG.purpleDark,
  },
  numericRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  numericInput: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: '#F4F0FC',
    paddingHorizontal: 15,
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  numericUnit: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  sheetError: {
    color: '#C0392B',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 8,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  sheetCancel: {
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  sheetCancelText: {
    color: HG.muted,
    fontSize: 14.5,
    fontWeight: '800',
  },
  sheetSave: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: HG.purple,
  },
  sheetSaveDisabled: {
    backgroundColor: '#D8D2E6',
  },
  sheetSaveText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});

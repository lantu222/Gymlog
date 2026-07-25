import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW, ChevronIcon, SectionLabel, settingsStyles } from '../components/SettingsUi';
import { getSetupEquipmentTitle, getSetupGoalTitle } from '../lib/firstRunSetup';
import { I18nKey, t } from '../lib/i18n';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import {
  AppLanguage,
  AppPreferences,
  SetupCautionArea,
  SetupCautionFlag,
  SetupGender,
} from '../types/models';

interface MyDataScreenProps {
  preferences: AppPreferences;
  language?: AppLanguage;
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
const CAUTION_AREA_KEYS: Record<SetupCautionArea, I18nKey> = {
  neck: 'onb.area.neck',
  shoulders: 'onb.area.shoulders',
  elbows: 'onb.area.elbows',
  wrists: 'onb.area.wrists',
  lower_back: 'onb.area.lower_back',
  hips: 'onb.area.hips',
  knees: 'onb.area.knees',
  ankles: 'onb.area.ankles',
};

const AGE_RANGE_KEYS: Record<string, I18nKey> = {
  '18': 'myData.age.under19',
  '19_25': 'myData.age.19to25',
  '26_30': 'myData.age.26to30',
  '31_40': 'myData.age.31to40',
  '41_plus': 'myData.age.41plus',
};

type BasicField = 'gender' | 'age' | 'height' | 'weight';

const BASIC_FIELD_META: Record<
  Exclude<BasicField, 'gender'>,
  { titleKey: I18nKey; unitKey: I18nKey; min: number; max: number }
> = {
  age: { titleKey: 'myData.ageField', unitKey: 'myData.unit.years', min: 13, max: 100 },
  height: { titleKey: 'myData.height', unitKey: 'myData.unit.cm', min: 120, max: 230 },
  weight: { titleKey: 'myData.weight', unitKey: 'myData.unit.kg', min: 30, max: 300 },
};

function genderLabel(preferences: AppPreferences, language: AppLanguage) {
  switch (preferences.setupGender) {
    case 'male':
      return t(language, 'myData.gender.male');
    case 'female':
      return t(language, 'myData.gender.female');
    default:
      return null;
  }
}

function ageLabel(preferences: AppPreferences, language: AppLanguage) {
  if (preferences.setupAge !== null) {
    return t(language, 'myData.years', { count: preferences.setupAge });
  }
  if (preferences.setupAgeRange && preferences.setupAgeRange !== 'unspecified') {
    const key = AGE_RANGE_KEYS[preferences.setupAgeRange];
    return key ? t(language, key) : null;
  }
  return null;
}

function levelLabel(preferences: AppPreferences, language: AppLanguage) {
  switch (preferences.setupLevel) {
    case 'beginner':
      return t(language, 'myData.level.beginner');
    case 'advanced':
      return t(language, 'myData.level.advanced');
    case 'pro':
      return t(language, 'myData.level.pro');
    default:
      return null;
  }
}

function limitationLabel(flag: SetupCautionFlag, language: AppLanguage) {
  const area = t(language, CAUTION_AREA_KEYS[flag.area]);
  return `${area} — ${t(language, flag.level === 'avoid' ? 'myData.leftOut' : 'myData.beCareful')}`;
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
  editLabel,
  isLast = false,
  onPress,
}: {
  label: string;
  value: string;
  editLabel?: string;
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
      accessibilityLabel={editLabel ?? label}
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
export function MyDataScreen({
  preferences,
  language = 'en',
  onBack,
  onSaveBasics,
  onEditLimitations,
  onCreateNewPlan,
}: MyDataScreenProps) {
  const [editing, setEditing] = useState<BasicField | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [draftGender, setDraftGender] = useState<SetupGender>('unspecified');

  const basics: Array<{ field: BasicField; label: string; value: string | null }> = [
    { field: 'gender', label: t(language, 'myData.gender'), value: genderLabel(preferences, language) },
    { field: 'age', label: t(language, 'myData.ageField'), value: ageLabel(preferences, language) },
    {
      field: 'height',
      label: t(language, 'myData.height'),
      value: preferences.setupHeightCm !== null ? `${preferences.setupHeightCm} cm` : null,
    },
    {
      field: 'weight',
      label: t(language, 'myData.weight'),
      value: preferences.setupCurrentWeightKg !== null ? `${preferences.setupCurrentWeightKg} kg` : null,
    },
  ];

  const training: Array<{ label: string; value: string | null }> = [
    {
      label: t(language, 'myData.goal'),
      value: preferences.setupGoal ? getSetupGoalTitle(preferences.setupGoal, language) : null,
    },
    { label: t(language, 'myData.experience'), value: levelLabel(preferences, language) },
    {
      label: t(language, 'myData.sessionsPerWeek'),
      value:
        preferences.setupDaysPerWeek !== null
          ? t(language, 'myData.perWeek', { count: preferences.setupDaysPerWeek })
          : null,
    },
    {
      label: t(language, 'myData.weeklyTime'),
      value: preferences.setupWeeklyMinutes !== null ? `~${preferences.setupWeeklyMinutes} min` : null,
    },
    {
      label: t(language, 'myData.equipment'),
      value: preferences.setupEquipment ? getSetupEquipmentTitle(preferences.setupEquipment, language) : null,
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
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'myData.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={settingsStyles.section}>
          <SectionLabel label={t(language, 'myData.basics')} />
          <View style={styles.card}>
            {basics.map((row, index) => (
              <DataRow
                key={row.field}
                label={row.label}
                value={row.value ?? t(language, 'myData.notSet')}
                editLabel={t(language, 'myData.edit', { field: row.label })}
                isLast={index === basics.length - 1}
                onPress={() => openEditor(row.field)}
              />
            ))}
          </View>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label={t(language, 'myData.trainingPrefs')} />
          <View style={styles.card}>
            {training.map((row, index) => (
              <DataRow
                key={row.label}
                label={row.label}
                value={row.value ?? t(language, 'myData.notSet')}
                isLast={index === training.length - 1}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onCreateNewPlan}
            style={({ pressed }) => [styles.newPlanButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.newPlanButtonText}>{t(language, 'myData.createPlan')}</Text>
          </Pressable>
          <Text style={styles.newPlanCaption}>
            {t(language, 'myData.createPlanCaption')}
          </Text>
        </View>

        <View style={settingsStyles.section}>
          <SectionLabel label={t(language, 'myData.additional')} />
          <View style={styles.card}>
            {limitations.length > 0 ? (
              limitations.map((flag, index) => (
                <Pressable
                  key={flag.area}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'myData.editLimitation', {
                    area: t(language, CAUTION_AREA_KEYS[flag.area]),
                  })}
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
                    {limitationLabel(flag, language)}
                  </Text>
                  <ChevronIcon />
                </Pressable>
              ))
            ) : (
              <DataRow
                label={t(language, 'myData.limitations')}
                value={t(language, 'myData.nothingNoted')}
                editLabel={t(language, 'myData.edit', { field: t(language, 'myData.limitations') })}
                isLast
                onPress={onEditLimitations}
              />
            )}
          </View>
        </View>

        <Text style={styles.footerText}>
          {t(language, 'myData.footer')}
        </Text>
      </ScrollView>

      {/* basics edit sheet */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.sheetScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing === 'gender'
                ? t(language, 'myData.gender')
                : editing !== null
                  ? t(language, BASIC_FIELD_META[editing].titleKey)
                  : ''}
            </Text>

            {editing === 'gender' ? (
              <View style={styles.genderRow}>
                {(
                  [
                    { key: 'male', label: t(language, 'myData.gender.male') },
                    { key: 'female', label: t(language, 'myData.gender.female') },
                    { key: 'unspecified', label: t(language, 'myData.gender.unspecified') },
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
                <Text style={styles.numericUnit}>{t(language, BASIC_FIELD_META[editing].unitKey)}</Text>
              </View>
            ) : null}

            {editing !== null && editing !== 'gender' && draftValue.length > 0 && !numericDraftValid ? (
              <Text style={styles.sheetError}>
                {BASIC_FIELD_META[editing].min}–{BASIC_FIELD_META[editing].max}{' '}
                {t(language, BASIC_FIELD_META[editing].unitKey)}
              </Text>
            ) : null}

            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setEditing(null)} style={styles.sheetCancel}>
                <Text style={styles.sheetCancelText}>{t(language, 'common.cancel')}</Text>
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
                <Text style={styles.sheetSaveText}>{t(language, 'common.save')}</Text>
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

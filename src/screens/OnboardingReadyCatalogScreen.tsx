import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { READY_PROGRAM_COLLECTIONS } from '../lib/readyProgramCollections';
import { getReadyProgramBlockWeeks } from '../lib/readyProgramDuration';
import { getReadyTemplatePresentation } from '../lib/templatePresentation';

// Light design tokens (HG palette, same as the other onboarding screens).
const BG = '#F7F3FF';
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const FAINT = '#9A93AC';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';

// Template difficulty -> the same tier wording the questionnaire uses.
const LEVEL_TIERS: Array<{ key: WorkoutTemplateV1['level'] | 'all'; label: string }> = [
  { key: 'all', label: 'All levels' },
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Advanced' },
  { key: 'advanced', label: 'Pro' },
];

const DAY_FILTERS: Array<{ key: number | 'all'; label: string }> = [
  { key: 'all', label: 'All days' },
  { key: 2, label: '2' },
  { key: 3, label: '3' },
  { key: 4, label: '4' },
  { key: 5, label: '5' },
  { key: 6, label: '6' },
];

interface OnboardingReadyCatalogScreenProps {
  onPick: (programId: string) => void;
  onBack: () => void;
  busy?: boolean;
}

function CheckCircle({ selected }: { selected: boolean }) {
  if (!selected) {
    return <View style={styles.checkRing} />;
  }
  return (
    <View style={styles.checkCircle}>
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function OnboardingReadyCatalogScreen({ onPick, onBack, busy = false }: OnboardingReadyCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;

  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<WorkoutTemplateV1['level'] | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Same section titles the Programs catalog already uses; a template renders
  // under its first matching collection only, so the list stays scannable.
  const sections = useMemo(() => {
    const seen = new Set<string>();

    return READY_PROGRAM_COLLECTIONS.map((collection) => {
      const programs = collection.templateIds
        .filter((templateId) => !seen.has(templateId))
        .map((templateId) => getWorkoutTemplateById(templateId))
        .filter((template): template is WorkoutTemplateV1 => Boolean(template))
        .filter((template) => (dayFilter === 'all' ? true : template.daysPerWeek === dayFilter))
        .filter((template) => (levelFilter === 'all' ? true : template.level === levelFilter))
        .map((template) => {
          seen.add(template.id);
          return { template, presentation: getReadyTemplatePresentation(template) };
        });

      return { collection, programs };
    }).filter((section) => section.programs.length > 0);
  }, [dayFilter, levelFilter]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 14 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { fontFamily }]}>Pick a ready program</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>
          Browse in peace — you can switch programs any time.
        </Text>

        <View style={styles.filterRow}>
          {DAY_FILTERS.map((filter) => {
            const active = dayFilter === filter.key;
            return (
              <Pressable
                key={String(filter.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setDayFilter(filter.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive, { fontFamily }]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.filterRow}>
          {LEVEL_TIERS.map((tier) => {
            const active = levelFilter === tier.key;
            return (
              <Pressable
                key={String(tier.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setLevelFilter(tier.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive, { fontFamily }]}>
                  {tier.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sections.map(({ collection, programs }) => (
          <View key={collection.key} style={styles.section}>
            <Text style={[styles.sectionLabel, { fontFamily }]}>{collection.label.toUpperCase()}</Text>
            <View style={styles.sectionList}>
              {programs.map(({ template, presentation }) => {
                const selected = selectedId === template.id;
                return (
                  <Pressable
                    key={template.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={presentation.title}
                    onPress={() => setSelectedId(template.id)}
                    style={[styles.programRow, selected && styles.programRowSelected]}
                  >
                    <View style={styles.programCopy}>
                      <Text
                        numberOfLines={1}
                        style={[styles.programTitle, selected && styles.programTitleSelected, { fontFamily }]}
                      >
                        {presentation.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.programMeta, selected && styles.programMetaSelected, { fontFamily }]}
                      >
                        {`${template.daysPerWeek} days / week · ${template.estimatedSessionDuration} min · ${
                          LEVEL_TIERS.find((tier) => tier.key === template.level)?.label ?? 'All levels'
                        } · ${getReadyProgramBlockWeeks(template)} weeks`}
                      </Text>
                    </View>
                    <CheckCircle selected={selected} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {sections.length === 0 ? (
          <Text style={[styles.emptyNote, { fontFamily }]}>
            No programs match these filters — try loosening them.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save plan and start"
          disabled={!selectedId || busy}
          onPress={() => {
            if (selectedId) {
              onPick(selectedId);
            }
          }}
          style={({ pressed }) => [
            styles.cta,
            (!selectedId || busy) && styles.ctaDisabled,
            pressed && selectedId && !busy && styles.ctaPressed,
          ]}
        >
          <Text style={[styles.ctaLabel, { fontFamily }]}>{busy ? 'Saving…' : 'Save plan & start'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          disabled={busy}
          style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.backText, { fontFamily }]}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  title: {
    color: PURPLE,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#475467',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    backgroundColor: SURFACE,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE_DARK,
  },
  filterChipText: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    color: FAINT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionList: {
    gap: 8,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  programRowSelected: {
    backgroundColor: PURPLE,
    borderColor: PURPLE_DARK,
    shadowColor: PURPLE,
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  programCopy: {
    flex: 1,
    gap: 2,
  },
  programTitle: {
    color: INK,
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  programTitleSelected: {
    color: '#FFFFFF',
  },
  programMeta: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  programMetaSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  emptyNote: {
    color: MUTED,
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 36,
  },
  checkRing: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#C9B6FF',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: PURPLE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 8,
  },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  ctaDisabled: {
    backgroundColor: '#DDD1F6',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.17,
  },
  backLink: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backText: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '700',
  },
});

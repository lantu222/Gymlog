import React, { useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern as SvgPattern, Rect } from 'react-native-svg';

import { PrimaryCTAButton } from '../components/PrimaryCTAButton';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { I18nKey, t } from '../lib/i18n';
import { AppLanguage } from '../types/models';
import { getReadyProgramCollectionCopy, READY_PROGRAM_COLLECTIONS } from '../lib/readyProgramCollections';
import { getReadyTemplatePresentation } from '../lib/templatePresentation';
import { Theme, useThemedStyles } from '../theming';

// Light design tokens (HG palette, same as the other onboarding screens).
const SURFACE = '#FFFFFF';
const INK = '#101828';
const MUTED = '#667085';
const FAINT = '#9A93AC';
const BORDER = '#E4D8FF';
const PURPLE = '#7C3AED';
const PURPLE_DARK = '#5B21B6';
const SEGMENT_TRACK = '#EBE3FA';
const STRIPE_LIGHT = '#F3EDFE';
const STRIPE_DARK = '#ECE3FC';

// Template difficulty -> the same tier wording the questionnaire uses.
const LEVEL_TIERS: Array<{ key: WorkoutTemplateV1['level'] | 'all'; labelKey: I18nKey }> = [
  { key: 'all', labelKey: 'catalog.level.all' },
  { key: 'beginner', labelKey: 'catalog.level.beginner' },
  { key: 'intermediate', labelKey: 'catalog.level.intermediate' },
  { key: 'advanced', labelKey: 'catalog.level.advanced' },
];

const DAY_FILTERS: Array<{ key: number | 'all'; label: string | null }> = [
  { key: 'all', label: null },
  { key: 2, label: '2' },
  { key: 3, label: '3' },
  { key: 4, label: '4' },
  { key: 5, label: '5' },
  { key: 6, label: '6' },
];

function tierLabelFor(level: WorkoutTemplateV1['level'], language: AppLanguage) {
  const tier = LEVEL_TIERS.find((entry) => entry.key === level);
  return t(language, tier?.labelKey ?? 'catalog.level.all');
}

interface OnboardingReadyCatalogScreenProps {
  language?: AppLanguage;
  onPick: (programId: string) => void;
  onBack: () => void;
  busy?: boolean;
  /** Optional per-program cover images; the striped placeholder is the fallback. */
  coverImages?: Record<string, ImageSourcePropType>;
}

function BackChevron() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Diagonal light-purple stripes standing in for the real program cover.
function CoverStripes({ patternId }: { patternId: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgPattern id={patternId} patternUnits="userSpaceOnUse" width={18} height={18} patternTransform="rotate(-45)">
          <Rect x={0} y={0} width={18} height={18} fill={STRIPE_LIGHT} />
          <Rect x={0} y={0} width={9} height={18} fill={STRIPE_DARK} />
        </SvgPattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}

function SelectionCircle({ selected }: { selected: boolean }) {
  const styles = useThemedStyles(makeStyles);

  if (!selected) {
    return <View style={styles.selectRing} />;
  }
  return (
    <View style={styles.selectCircle}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export function OnboardingReadyCatalogScreen({
  language = 'en',
  onPick,
  onBack,
  busy = false,
  coverImages,
}: OnboardingReadyCatalogScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [manropeLoaded] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
  const fontFamily = manropeLoaded ? 'Manrope' : undefined;

  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<WorkoutTemplateV1['level'] | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtersActive = dayFilter !== 'all' || levelFilter !== 'all';

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
          return { template, presentation: getReadyTemplatePresentation(template, language) };
        });

      return { collection, programs };
    }).filter((section) => section.programs.length > 0);
  }, [dayFilter, levelFilter]);

  const resultCount = sections.reduce((sum, section) => sum + section.programs.length, 0);
  const selectedProgram = selectedId
    ? sections.flatMap((section) => section.programs).find((entry) => entry.template.id === selectedId) ?? null
    : null;
  const ctaTitle = busy
    ? t(language, 'catalog.saving')
    : selectedProgram
      ? t(language, 'catalog.ctaWith', { program: selectedProgram.presentation.title.toUpperCase() })
      : t(language, 'catalog.cta');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          disabled={busy}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <BackChevron />
        </Pressable>

        <Text style={[styles.title, { fontFamily }]}>{t(language, 'catalog.title')}</Text>
        <Text style={[styles.subtitle, { fontFamily }]}>{t(language, 'catalog.sub')}</Text>

        <Text style={[styles.overline, { fontFamily }]}>{t(language, 'catalog.daysPerWeek')}</Text>
        <View style={styles.chipRow}>
          {DAY_FILTERS.map((filter) => {
            const active = dayFilter === filter.key;
            const label = filter.label ?? t(language, 'catalog.days.any');
            return (
              <Pressable
                key={String(filter.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  filter.key === 'all'
                    ? t(language, 'catalog.a11y.anyDays')
                    : t(language, 'catalog.a11y.days', { count: label })
                }
                onPress={() => setDayFilter(filter.key)}
                style={[
                  styles.chip,
                  filter.key !== 'all' && styles.chipNumeric,
                  active && styles.chipActive,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive, { fontFamily }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.overline, { fontFamily }]}>{t(language, 'catalog.level')}</Text>
        <View style={styles.segmentTrack}>
          {LEVEL_TIERS.map((tier) => {
            const active = levelFilter === tier.key;
            const label = t(language, tier.labelKey);
            return (
              <Pressable
                key={String(tier.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(language, 'catalog.a11y.level', { label })}
                onPress={() => setLevelFilter(tier.key)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive, { fontFamily }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.resultRow}>
          <Text style={[styles.resultCount, { fontFamily }]}>
            {resultCount === 1
              ? t(language, 'catalog.countOne')
              : t(language, 'catalog.countMany', { count: resultCount })}
          </Text>
          {filtersActive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'catalog.clearFilters')}
              onPress={() => {
                setDayFilter('all');
                setLevelFilter('all');
              }}
              hitSlop={8}
            >
              <Text style={[styles.clearFilters, { fontFamily }]}>{t(language, 'catalog.clearFilters')}</Text>
            </Pressable>
          ) : null}
        </View>

        {sections.map(({ collection, programs }) => (
          <View key={collection.key} style={styles.section}>
            <Text style={[styles.sectionLabel, { fontFamily }]}>
              {getReadyProgramCollectionCopy(collection.key, language).label.toUpperCase()}
            </Text>
            <View style={styles.cardGrid}>
              {programs.map(({ template, presentation }) => {
                const selected = selectedId === template.id;
                const coverImage = coverImages?.[template.id];
                const coverWord = presentation.title.trim().split(/\s+/)[0] ?? 'GAINER';

                return (
                  <Pressable
                    key={template.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(language, 'catalog.a11y.card', {
                      program: presentation.title,
                      days: template.daysPerWeek,
                      minutes: template.estimatedSessionDuration,
                      level: tierLabelFor(template.level, language),
                    })}
                    onPress={() => setSelectedId((current) => (current === template.id ? null : template.id))}
                    style={[styles.card, selected && styles.cardSelected]}
                  >
                    <View style={styles.cover}>
                      {coverImage ? (
                        <Image source={coverImage} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <>
                          <CoverStripes patternId={`cover_${template.id}`} />
                          <Text numberOfLines={1} style={[styles.coverWord, { fontFamily }]}>
                            {coverWord}
                          </Text>
                          <Text style={styles.coverCaption}>{t(language, 'catalog.coverCaption')}</Text>
                        </>
                      )}
                      <View style={styles.levelBadge}>
                        <Text style={[styles.levelBadgeText, { fontFamily }]}>
                          {tierLabelFor(template.level, language).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.selectSlot}>
                        <SelectionCircle selected={selected} />
                      </View>
                    </View>
                    <View style={styles.cardBody}>
                      <Text numberOfLines={1} style={[styles.cardTitle, { fontFamily }]}>
                        {presentation.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.cardMeta, { fontFamily }]}>
                        {t(language, 'catalog.cardMeta', {
                          days: template.daysPerWeek,
                          minutes: template.estimatedSessionDuration,
                        })}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { fontFamily }]}>{t(language, 'catalog.empty.title')}</Text>
            <Text style={[styles.emptyBody, { fontFamily }]}>{t(language, 'catalog.empty.body')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryCTAButton
          title={ctaTitle}
          disabled={!selectedId || busy}
          onPress={() => {
            if (selectedId) {
              onPick(selectedId);
            }
          }}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    color: PURPLE,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  overline: {
    color: FAINT,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 7,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 13,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNumeric: {
    minWidth: 40,
    paddingHorizontal: 8,
  },
  chipActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE_DARK,
  },
  chipText: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: SEGMENT_TRACK,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: SURFACE,
    shadowColor: '#1E1246',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: PURPLE_DARK,
    fontWeight: '800',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  resultCount: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '700',
  },
  clearFilters: {
    color: PURPLE,
    fontSize: 12.5,
    fontWeight: '800',
  },
  section: {
    marginTop: 18,
  },
  sectionLabel: {
    color: FAINT,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '48.4%',
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 2,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cover: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverWord: {
    color: 'rgba(124,58,237,0.20)',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  coverCaption: {
    color: FAINT,
    fontSize: 8.5,
    letterSpacing: 0.8,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  levelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 999,
    backgroundColor: SURFACE,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  levelBadgeText: {
    color: PURPLE_DARK,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectSlot: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  selectRing: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.35)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: PURPLE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cardBody: {
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 11,
    gap: 2,
  },
  cardTitle: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardMeta: {
    color: MUTED,
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 48,
    gap: 4,
  },
  emptyTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyBody: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 10,
  },
});

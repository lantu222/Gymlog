import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CutButton } from '../components/CutButton';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { getDefaultCooldown, getDefaultWarmup, classifySessionFocus } from '../lib/homeSessionHero';
import { I18nKey, t } from '../lib/i18n';
import { ProgramDetailSessionItem } from '../lib/programDetails';
import { programCoverStyle } from '../lib/programVisualIdentity';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { layout, radii, spacing } from '../theme';
import { Theme, darkTheme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The day view (design: GAINER Hourglass Shape, screen 2) — the one separate
 * screen the programme page opens. A read-out of the session, not a logger:
 * sets, rep ranges and rests from the catalog's own numbers, roles explained
 * once at the top, warm-up and cool-down from the same generator Home uses so
 * the two screens cannot describe different sessions.
 */

const HERO_SEAM_RATIO = 0.88;

const ROLE_TAG_KEYS: Record<string, I18nKey> = {
  primary: 'detail.role.primary',
  secondary: 'detail.role.secondary',
  accessory: 'detail.role.accessory',
};

const ROLE_LINE_KEYS: Record<string, I18nKey> = {
  primary: 'detail.role.anchorLine',
  secondary: 'detail.role.supportLine',
  accessory: 'detail.role.accessoryLine',
};

/** Same wash logic the detail screen's role tags use. */
const roleTints = (theme: Theme): Record<string, { bg: string; ink: string }> =>
  theme === darkTheme
    ? {
        primary: { bg: 'rgba(167, 139, 250, 0.16)', ink: '#C4B0FF' },
        secondary: { bg: 'rgba(79, 168, 255, 0.14)', ink: '#8CC6FF' },
        accessory: { bg: 'rgba(255, 255, 255, 0.07)', ink: theme.faint },
      }
    : {
        primary: { bg: '#EDE4FF', ink: '#5B21B6' },
        secondary: { bg: '#E4EEFF', ink: '#2C4E9A' },
        accessory: { bg: '#F2F1F5', ink: '#7A7387' },
      };

interface ProgramDayScreenProps {
  programTitle: string;
  templateId: string;
  session: ProgramDetailSessionItem;
  dayNumber: number;
  dayCount: number;
  language?: AppLanguage;
  availableEquipment?: string[] | null;
  onBack: () => void;
  onStart: () => void;
}

export function ProgramDayScreen({
  programTitle,
  templateId,
  session,
  dayNumber,
  dayCount,
  language = 'en',
  availableEquipment = null,
  onBack,
  onStart,
}: ProgramDayScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tints = roleTints(theme);
  const { width: heroWidth } = useWindowDimensions();
  const identity = programCoverStyle(templateId);

  const focusKind = useMemo(
    () => classifySessionFocus(session.exercises.map((exercise) => exercise.name)),
    [session.exercises],
  );
  const warmup = getDefaultWarmup(focusKind, language, availableEquipment);
  const cooldown = getDefaultCooldown(focusKind, language, availableEquipment);

  // Only the roles this day actually contains — a legend for a role that
  // never appears below it is furniture.
  const presentRoles = useMemo(() => {
    const seen = new Set(session.exercises.map((exercise) => exercise.role as string));
    return ['primary', 'secondary', 'accessory'].filter((role) => seen.has(role));
  }, [session.exercises]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Svg width={heroWidth} height={172} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="dayHero" x1="0" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={identity.hero[0]} />
                <Stop offset="1" stopColor={identity.hero[1]} />
              </SvgLinearGradient>
              <ClipPath id="dayHeroSeam">
                <Path d={`M0 0 H${heroWidth} V172 L0 ${172 * HERO_SEAM_RATIO} Z`} />
              </ClipPath>
            </Defs>
            <G clipPath="url(#dayHeroSeam)">
              <Rect x="0" y="0" width={heroWidth} height={172} fill="url(#dayHero)" />
            </G>
          </Svg>
          <View style={styles.heroTopRow}>
            <Pressable hitSlop={8} onPress={onBack} style={styles.heroGlass}>
              <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Path d="M15 6l-6 6 6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
            <Text style={styles.heroKick} numberOfLines={1}>
              {t(language, 'detail.day.kick', {
                program: programTitle.toUpperCase(),
                day: dayNumber,
                total: dayCount,
              })}
            </Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {localizeSessionName(session.name, language).replace(/^[^:]*:\s*/, '')}
          </Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatValue}>{session.exerciseCount}</Text>
              <Text style={styles.heroStatLabel}>{t(language, 'detail.day.exercisesStat')}</Text>
            </View>
            <View>
              <Text style={styles.heroStatValue}>{session.totalSets}</Text>
              <Text style={styles.heroStatLabel}>{t(language, 'detail.day.sets')}</Text>
            </View>
          </View>
        </View>

        {presentRoles.length > 0 ? (
          <View style={styles.roleCard}>
            {presentRoles.map((role, index) => (
              <View key={role} style={[styles.roleRow, index > 0 && styles.roleRowDivider]}>
                <View style={[styles.roleTag, { backgroundColor: tints[role].bg }]}>
                  <Text style={[styles.roleTagText, { color: tints[role].ink }]}>
                    {t(language, ROLE_TAG_KEYS[role])}
                  </Text>
                </View>
                <Text style={styles.roleLine}>{t(language, ROLE_LINE_KEYS[role])}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.day.warmup')}</Text>
          <Text style={styles.sectionMeta}>{t(language, 'detail.day.warmupMeta')}</Text>
        </View>
        <View style={styles.noteCard}>
          {warmup.drills.map((drill) => (
            <Text key={drill.name} style={styles.noteLine}>
              {drill.name} · {drill.schemeLabel}
            </Text>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.day.exercises')}</Text>
          <Text style={styles.sectionMeta}>{t(language, 'detail.day.exercisesMeta')}</Text>
        </View>
        <View style={styles.exerciseList}>
          {session.exercises.map((exercise, index) => (
            <View key={exercise.id} style={[styles.exerciseCard, index === 0 && styles.exerciseCardAnchor]}>
              <View style={styles.exerciseTop}>
                <View style={[styles.exerciseNum, index === 0 && styles.exerciseNumAnchor]}>
                  <Text style={[styles.exerciseNumText, index === 0 && styles.exerciseNumTextAnchor]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.exerciseName} numberOfLines={2}>
                  {exerciseNameLabel(language, exercise.name)}
                </Text>
                <View style={[styles.roleTag, { backgroundColor: tints[exercise.role]?.bg ?? theme.surfaceSoft }]}>
                  <Text style={[styles.roleTagText, { color: tints[exercise.role]?.ink ?? theme.muted }]}>
                    {t(language, ROLE_TAG_KEYS[exercise.role] ?? 'detail.role.accessory')}
                  </Text>
                </View>
              </View>
              <Text style={styles.exerciseScheme}>
                {exercise.prescription}
                <Text style={styles.exerciseRest}>
                  {'  ·  '}
                  {t(language, 'detail.day.rest', { range: exercise.restLabel })}
                </Text>
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t(language, 'detail.day.cooldown')}</Text>
          <Text style={styles.sectionMeta}>{t(language, 'detail.day.cooldownMeta')}</Text>
        </View>
        <View style={styles.noteCard}>
          {cooldown.drills.map((drill) => (
            <Text key={drill.name} style={styles.noteLine}>
              {drill.name} · {drill.schemeLabel}
            </Text>
          ))}
        </View>
      </ScrollView>

      <View style={styles.dock}>
        <CutButton label={t(language, 'detail.day.start')} onPress={onStart} size="lg" stretch />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingBottom: layout.bottomTabBarReserve + 84,
  },
  hero: {
    height: 172,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 46,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroGlass: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKick: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 12,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 10,
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  roleCard: {
    marginTop: 14,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 9,
  },
  roleRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  roleTag: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  roleTagText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  roleLine: {
    flex: 1,
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 9,
  },
  sectionTitle: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  sectionMeta: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  noteCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  noteLine: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  exerciseList: {
    marginHorizontal: spacing.lg,
    gap: 9,
  },
  exerciseCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  exerciseCardAnchor: {
    borderColor: theme.purpleBright,
  },
  exerciseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseNum: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumAnchor: {
    backgroundColor: theme.purpleBright,
  },
  exerciseNumText: {
    color: theme.purpleDark,
    fontSize: 12.5,
    fontWeight: '800',
  },
  exerciseNumTextAnchor: {
    color: '#FFFFFF',
  },
  exerciseName: {
    flex: 1,
    color: theme.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  exerciseScheme: {
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: -0.1,
    marginTop: 9,
    paddingLeft: 40,
  },
  exerciseRest: {
    color: theme.faint,
    fontWeight: '700',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: layout.bottomTabBarReserve,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});

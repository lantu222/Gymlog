import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CutSurface } from '../components/CutSurface';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { getDefaultCooldown, getDefaultWarmup, classifySessionFocus } from '../lib/homeSessionHero';
import { I18nKey, t } from '../lib/i18n';
import { ProgramDetailSessionItem } from '../lib/programDetails';
import { programCoverStyle } from '../lib/programVisualIdentity';
import { buildSwapOptionsForSlot } from '../lib/tailoringFit';
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

/**
 * The hero is a painted area, not a strip.
 *
 * At 172px it stopped just under the title and the stats sat on the page
 * below it, so the colour read as a band that had been cut off. It now runs
 * past the role card and under the first section heading — the seam lands in
 * empty space rather than through a line of text.
 */
const HERO_HEIGHT = 292;
const HERO_SEAM_RATIO = 0.93;

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
  /** Slot id -> chosen lift, shared with the session this screen starts. */
  sessionSwaps?: Record<string, string>;
  onSwapExercise?: (slotId: string, exerciseName: string) => void;
  tailoringPreferences?: Parameters<typeof buildSwapOptionsForSlot>[2];
  onBack: () => void;
}

export function ProgramDayScreen({
  programTitle,
  templateId,
  session,
  dayNumber,
  dayCount,
  language = 'en',
  availableEquipment = null,
  sessionSwaps = {},
  onSwapExercise,
  tailoringPreferences,
  onBack,
}: ProgramDayScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tints = roleTints(theme);
  const { width: heroWidth } = useWindowDimensions();
  const identity = programCoverStyle(templateId, programTitle);

  // Warm-up and recovery closed by default: they are the same generated
  // blocks on every session of this focus, and the lifts are what the reader
  // came for.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    warmup: false,
    exercises: true,
    cooldown: false,
  });
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);

  const swapRow = useMemo(() => {
    const exercise = session.exercises.find((item) => item.slotId && item.slotId === swapSlotId);
    if (!exercise?.slotId) {
      return null;
    }
    const currentName = sessionSwaps[exercise.slotId] ?? exercise.name;
    return {
      slotId: exercise.slotId,
      currentName,
      options: buildSwapOptionsForSlot(exercise.substitutionGroup ?? '', currentName, tailoringPreferences),
    };
  }, [session.exercises, swapSlotId, sessionSwaps, tailoringPreferences]);

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
          <Svg width={heroWidth} height={HERO_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="dayHero" x1="0" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={identity.hero[0]} />
                <Stop offset="1" stopColor={identity.hero[1]} />
              </SvgLinearGradient>
              <ClipPath id="dayHeroSeam">
                <Path d={`M0 0 H${heroWidth} V${HERO_HEIGHT} L0 ${HERO_HEIGHT * HERO_SEAM_RATIO} Z`} />
              </ClipPath>
            </Defs>
            <G clipPath="url(#dayHeroSeam)">
              <Rect x="0" y="0" width={heroWidth} height={HERO_HEIGHT} fill="url(#dayHero)" />
            </G>
          </Svg>
          <View style={styles.heroTopRow}>
            <Pressable hitSlop={8} onPress={onBack} style={styles.heroGlass}>
              <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Path d="M15 6l-6 6 6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
          </View>
          {/* The programme's name, big. "PÄIVÄ 1 / 1" was a counter on a
              one-day programme — a fraction that only ever reads 1/1 tells the
              reader nothing they cannot see. */}
          <Text style={styles.heroTitle} numberOfLines={2}>
            {programTitle}
          </Text>
          <Text style={styles.heroSession} numberOfLines={1}>
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

        {/* Three accordions in Home's shape: the warm-up used to be a plain
            paragraph card next to a list of exercise cards, which made the
            same session look like two different screens. */}
        <Section
          styles={styles}
          theme={theme}
          title={t(language, 'detail.day.warmup')}
          count={t(language, 'detail.day.warmupMeta')}
          open={openSections.warmup}
          onToggle={() => setOpenSections((current) => ({ ...current, warmup: !current.warmup }))}
        >
          {warmup.drills.map((drill, index) => (
            <View key={drill.name} style={styles.drillRow}>
              <View style={styles.drillChip}>
                <Text style={styles.drillChipText}>{index + 1}</Text>
              </View>
              <Text style={styles.drillName} numberOfLines={2}>
                {drill.name}
              </Text>
              <Text style={styles.drillScheme}>{drill.schemeLabel}</Text>
            </View>
          ))}
        </Section>

        <Section
          styles={styles}
          theme={theme}
          title={t(language, 'detail.day.exercises')}
          count={`${session.totalSets} ${t(language, 'detail.day.sets').toLowerCase()}`}
          open={openSections.exercises}
          onToggle={() => setOpenSections((current) => ({ ...current, exercises: !current.exercises }))}
        >
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
                  {exerciseNameLabel(
                    language,
                    (exercise.slotId ? sessionSwaps[exercise.slotId] : undefined) ?? exercise.name,
                  )}
                </Text>
                <View style={[styles.roleTag, { backgroundColor: tints[exercise.role]?.bg ?? theme.surfaceSoft }]}>
                  <Text style={[styles.roleTagText, { color: tints[exercise.role]?.ink ?? theme.muted }]}>
                    {t(language, ROLE_TAG_KEYS[exercise.role] ?? 'detail.role.accessory')}
                  </Text>
                </View>
              </View>
              <View style={styles.exerciseBottom}>
                <Text style={styles.exerciseScheme}>
                  {exercise.prescription}
                  <Text style={styles.exerciseRest}>
                    {'  ·  '}
                    {t(language, 'detail.day.rest', { range: exercise.restLabel })}
                  </Text>
                </Text>
                {exercise.slotId && onSwapExercise ? (
                  <Pressable
                    hitSlop={6}
                    onPress={() => setSwapSlotId(exercise.slotId ?? null)}
                    style={({ pressed }) => [styles.swapButton, pressed && styles.swapOptionPressed]}
                  >
                    <Text style={styles.swapButtonText}>{t(language, 'home.swap')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        </Section>

        <Section
          styles={styles}
          theme={theme}
          title={t(language, 'detail.day.cooldown')}
          count={t(language, 'detail.day.cooldownMeta')}
          open={openSections.cooldown}
          onToggle={() => setOpenSections((current) => ({ ...current, cooldown: !current.cooldown }))}
        >
          {cooldown.drills.map((drill, index) => (
            <View key={drill.name} style={styles.drillRow}>
              <View style={styles.drillChip}>
                <Text style={styles.drillChipText}>{index + 1}</Text>
              </View>
              <Text style={styles.drillName} numberOfLines={2}>
                {drill.name}
              </Text>
              <Text style={styles.drillScheme}>{drill.schemeLabel}</Text>
            </View>
          ))}
        </Section>
      </ScrollView>

      {/* The swap writes into the same map the session start reads, so what
          you choose here is what you lift. */}
      <Modal
        visible={swapRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapSlotId(null)}
      >
        <View style={styles.swapOverlay}>
          <Pressable style={styles.swapScrim} onPress={() => setSwapSlotId(null)} />
          <View style={styles.swapSheet}>
            <View style={styles.swapGrip} />
            <Text style={styles.swapTitle} numberOfLines={2}>
              {t(language, 'home.swapSheet.title', {
                name: exerciseNameLabel(language, swapRow?.currentName ?? ''),
              })}
            </Text>
            <ScrollView style={styles.swapList} showsVerticalScrollIndicator={false}>
              {(swapRow?.options ?? []).length === 0 ? (
                <Text style={styles.swapEmpty}>{t(language, 'home.swapSheet.empty')}</Text>
              ) : (
                (swapRow?.options ?? []).map((option) => (
                  <Pressable
                    key={option.exerciseName}
                    onPress={() => {
                      if (swapRow) {
                        onSwapExercise?.(swapRow.slotId, option.exerciseName);
                      }
                      setSwapSlotId(null);
                    }}
                    style={({ pressed }) => [styles.swapOption, pressed && styles.swapOptionPressed]}
                  >
                    <Text style={styles.swapOptionName} numberOfLines={1}>
                      {exerciseNameLabel(language, option.exerciseName)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* The "Start this workout" dock was removed on request. */}
    </View>
  );
}

/**
 * Home's section card, rebuilt here rather than imported: Home's version is
 * wired to its own animation values and rise stagger, and lifting that out
 * would drag half a screen with it. The shape — cut card, title, count,
 * chevron, body — is the part that has to match.
 */
function Section({
  styles,
  theme,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
  title: string;
  count: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <CutSurface
      size="lg"
      fill={theme.surface}
      stroke={theme.border}
      strokeWidth={1}
      style={styles.secCard}
    >
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.secHead}>
        <Text style={styles.secTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.secCount}>{count}</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
            stroke={theme.faint}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      {open ? <View style={styles.secBody}>{children}</View> : null}
    </CutSurface>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    // The dock is absolute; without room for it the last exercise row sat
    // under the start button.
    paddingBottom: layout.bottomTabBarReserve + 120,
  },
  hero: {
    height: HERO_HEIGHT,
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
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 18,
  },
  heroSession: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 18,
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
  // Pulled up onto the hero so the colour reads as a header the content sits
  // on, rather than a band that stops.
  roleCard: {
    marginTop: -58,
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
  secCard: {
    marginHorizontal: spacing.lg,
    marginTop: 12,
    paddingHorizontal: 14,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  secTitle: {
    flex: 1,
    color: theme.ink,
    textTransform: 'capitalize',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secCount: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  secBody: {
    paddingBottom: 12,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  drillChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: theme.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillChipText: {
    color: theme.purpleDark,
    fontSize: 11,
    fontWeight: '800',
  },
  drillName: {
    flex: 1,
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  drillScheme: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  exerciseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  swapButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  swapButtonText: {
    color: theme.purple,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  swapOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  swapScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 18, 70, 0.42)',
  },
  swapSheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  swapGrip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginTop: 10,
    marginBottom: 14,
  },
  swapTitle: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    marginBottom: 10,
  },
  swapList: {
    flexGrow: 0,
  },
  swapEmpty: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    paddingVertical: 12,
  },
  swapOption: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  swapOptionPressed: {
    opacity: 0.7,
  },
  swapOptionName: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  exerciseList: {
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
    flex: 1,
    color: theme.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  exerciseRest: {
    color: theme.faint,
    fontWeight: '700',
  },
});

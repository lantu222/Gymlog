import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddExerciseSheet } from '../components/AddExerciseSheet';
import { CutSurface } from '../components/CutSurface';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { buildExerciseSearchHaystack, exerciseMatchesQuery } from '../lib/exerciseSearch';
import { getDefaultCooldown, getDefaultWarmup, classifySessionFocus } from '../lib/homeSessionHero';
import { I18nKey, t } from '../lib/i18n';
import { ProgramDetailSessionItem } from '../lib/programDetails';
import { programCoverStyle } from '../lib/programVisualIdentity';
import { buildSwapOptionsForSlot } from '../lib/tailoringFit';
import { buildSwapShortlist } from '../lib/swapShortlist';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { layout, radii, spacing } from '../theme';
import { Theme, darkTheme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage, ExerciseLibraryItem } from '../types/models';

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
  /**
   * Lifts added to this day, by library name.
   *
   * "+ Lisää liike" used to navigate to the template editor on the Workout
   * tab — a different screen, on a different tab, with its own save button and
   * its own idea of what was being edited. The reader tapped it and asked what
   * tab they had landed on ("vie johonkin ihan outoon välilehteen", #bugs
   * 2026-08-26). The library opens here instead, over the day it is adding to,
   * and a ready programme is copied behind it exactly as removing a lift
   * already does.
   */
  onAddExercises?: (exerciseNames: string[]) => void;
  exerciseLibrary?: ExerciseLibraryItem[];
  recentExerciseLibraryItems?: ExerciseLibraryItem[];
  /**
   * Out of the programme for good, by the template's own exercise id.
   *
   * Replaces "tee tästä oma versio", which was the only way to make a fixed
   * day editable and which nobody found: the reader was looking for a way to
   * drop one lift, not for a lesson in how the catalog is stored. A ready
   * programme is copied behind this, silently.
   */
  onRemoveExercise?: (exerciseId: string) => void;
  /**
   * Keep today's swap in the programme. Offered only on a row that is already
   * swapped — before the choice there is nothing to make permanent.
   */
  onKeepSwap?: (exerciseId: string, exerciseName: string) => void;
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
  onAddExercises,
  exerciseLibrary,
  recentExerciseLibraryItems = [],
  onRemoveExercise,
  onKeepSwap,
  tailoringPreferences,
  onBack,
}: ProgramDayScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  /** Narrows the pool. Cleared with the sheet, so it never opens pre-filtered. */
  const [swapQuery, setSwapQuery] = useState('');
  const closeSwapSheet = () => {
    setSwapSlotId(null);
    setSwapQuery('');
  };

  const swapRow = useMemo(() => {
    const exercise = session.exercises.find((item) => item.slotId && item.slotId === swapSlotId);
    if (!exercise?.slotId) {
      return null;
    }
    const currentName = sessionSwaps[exercise.slotId] ?? exercise.name;
    return {
      slotId: exercise.slotId,
      currentName,
      // The stored programme's own id, which removal is written against.
      exerciseId: exercise.id ?? null,
      // Split rather than listed — see swapShortlist: nine valid lifts ranked
      // together buried the machine version and pushed the actions off the
      // bottom of the sheet.
      shortlist: buildSwapShortlist(
        currentName,
        buildSwapOptionsForSlot(exercise.substitutionGroup ?? '', currentName, tailoringPreferences).map(
          (option) => ({ ...option, searchLabel: exerciseNameLabel(language, option.exerciseName) }),
        ),
        {
          // Offering a lift the day already holds is a change that changes
          // nothing (#bugs 2026-08-26).
          alreadyInSession: session.exercises.map(
            (item) => (item.slotId ? sessionSwaps[item.slotId] : undefined) ?? item.name,
          ),
          query: swapQuery,
        },
      ),
    };
  }, [session.exercises, swapSlotId, sessionSwaps, tailoringPreferences, swapQuery, language]);

  /**
   * What the search box reaches once the shortlist runs out.
   *
   * The shortlist is the slot's substitution group, six rows of it. That is
   * the right default and the wrong search: typing "taka" returned "Tälle
   * paikalle ei ole vaihtoehtoa — ohjelma määrää tämän liikkeen", which is a
   * sentence about the pool being empty, read as a sentence about the app
   * having nothing ("ei pysty hakemaan todellisuudessa mitään ainoastaan ne 6
   * mitä ehdotetaan", #bugs 2026-08-26). With a query typed, the whole library
   * is on offer — a named lift is the reader's decision, not a suggestion to
   * be ranked.
   */
  const swapLibraryMatches = useMemo(() => {
    const query = swapQuery.trim().toLowerCase();
    if (!query || !swapRow || !exerciseLibrary) {
      return [];
    }

    const alreadyOffered = new Set([
      swapRow.currentName,
      ...swapRow.shortlist.variations.map((option) => option.exerciseName),
      ...swapRow.shortlist.related.map((option) => option.exerciseName),
      ...session.exercises.map((item) => (item.slotId ? sessionSwaps[item.slotId] : undefined) ?? item.name),
    ]);

    return exerciseLibrary
      .filter((item) => !alreadyOffered.has(item.name))
      .filter((item) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), query))
      .slice(0, 12);
  }, [exerciseLibrary, language, session.exercises, sessionSwaps, swapQuery, swapRow]);

  const focusKind = useMemo(
    () => classifySessionFocus(session.exercises.map((exercise) => exercise.name)),
    [session.exercises],
  );
  const warmup = getDefaultWarmup(focusKind, language, availableEquipment);
  const cooldown = getDefaultCooldown(focusKind, language, availableEquipment);

  const canAddExercises = Boolean(onAddExercises && exerciseLibrary && exerciseLibrary.length > 0);

  // What the day already holds, so the picker can rank around it rather than
  // offering back what is on the screen behind it.
  const currentLibraryItemIds = useMemo(() => {
    if (!exerciseLibrary) {
      return [];
    }
    const present = new Set(
      session.exercises.map((item) => (item.slotId ? sessionSwaps[item.slotId] : undefined) ?? item.name),
    );
    return exerciseLibrary.filter((item) => present.has(item.name)).map((item) => item.id);
  }, [exerciseLibrary, session.exercises, sessionSwaps]);

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
          {/* The end of the list is where "and one more" is felt. The library
              opens over this screen — see onAddExercises. */}
          {canAddExercises ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddSheetOpen(true)}
              style={({ pressed }) => [styles.addRow, pressed && styles.swapOptionPressed]}
            >
              <View style={styles.addGlyph}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5v14M5 12h14"
                    stroke={theme.purple}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text style={styles.addRowText}>{t(language, 'editor.addExercise')}</Text>
            </Pressable>
          ) : null}
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
        onRequestClose={() => closeSwapSheet()}
      >
        <View style={styles.swapOverlay}>
          <Pressable style={styles.swapScrim} onPress={() => closeSwapSheet()} />
          {/* The sheet's own padding was a fixed 28, so on a phone with system
              buttons the last row sat behind them and could not be pressed
              (user 2026-08-26). The bar's height is only known at runtime. */}
          <View style={[styles.swapSheet, { paddingBottom: insets.bottom + 28 }]}>
            <View style={styles.swapGrip} />
            <Text style={styles.swapTitle} numberOfLines={2}>
              {t(language, 'home.swapSheet.title', {
                name: exerciseNameLabel(language, swapRow?.currentName ?? ''),
              })}
            </Text>
            {/* The shortlist is deliberately six rows and the pool behind it is
                not: a reader who knows what they want should not have to be
                offered it (#bugs 2026-08-26). */}
            <TextInput
              value={swapQuery}
              onChangeText={setSwapQuery}
              placeholder={t(language, 'home.swapSheet.search')}
              placeholderTextColor={theme.faint}
              style={styles.swapSearch}
              autoCorrect={false}
              accessibilityLabel={t(language, 'home.swapSheet.search')}
            />
            <ScrollView style={styles.swapList} showsVerticalScrollIndicator={false}>
              {swapRow && swapRow.shortlist.total === 0 && swapLibraryMatches.length === 0 ? (
                <Text style={styles.swapEmpty}>
                  {t(language, swapQuery.trim() ? 'home.swapSheet.noMatches' : 'home.swapSheet.empty')}
                </Text>
              ) : (
                ([
                  { key: 'home.swapSheet.variations' as const, rows: swapRow?.shortlist.variations ?? [] },
                  { key: 'home.swapSheet.related' as const, rows: swapRow?.shortlist.related ?? [] },
                  {
                    key: 'home.swapSheet.library' as const,
                    rows: swapLibraryMatches.map((item) => ({
                      exerciseName: item.name,
                      reason: null,
                      score: 0,
                    })),
                  },
                ]).map((section) =>
                  section.rows.length === 0 ? null : (
                    <View key={section.key}>
                      {/* Named only when there is more than one group — one
                          heading over the whole list labels nothing. */}
                      {[
                        swapRow?.shortlist.variations.length ?? 0,
                        swapRow?.shortlist.related.length ?? 0,
                        swapLibraryMatches.length,
                      ].filter((count) => count > 0).length > 1 ? (
                        <Text style={styles.swapGroup}>{t(language, section.key)}</Text>
                      ) : null}
                      {section.rows.map((option) => (
                        <View key={option.exerciseName} style={styles.swapOptionRow}>
                          {/* The row is today's answer — the one you can undo. */}
                          <Pressable
                            onPress={() => {
                              if (swapRow) {
                                onSwapExercise?.(swapRow.slotId, option.exerciseName);
                              }
                              closeSwapSheet();
                            }}
                            style={({ pressed }) => [
                              styles.swapOption,
                              styles.swapOptionGrow,
                              pressed && styles.swapOptionPressed,
                            ]}
                          >
                            <Text style={styles.swapOptionName} numberOfLines={1}>
                              {exerciseNameLabel(language, option.exerciseName)}
                            </Text>
                          </Pressable>
                          {/* And the durable one, here rather than behind a
                              second visit to this sheet. */}
                          {swapRow?.exerciseId && onKeepSwap ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t(language, 'home.swapSheet.keepOne', {
                                name: exerciseNameLabel(language, option.exerciseName),
                              })}
                              hitSlop={8}
                              onPress={() => {
                                onKeepSwap(swapRow.exerciseId as string, option.exerciseName);
                                closeSwapSheet();
                              }}
                              style={({ pressed }) => [styles.swapOptionKeep, pressed && styles.swapOptionPressed]}
                            >
                              <Text style={styles.swapOptionKeepText}>{t(language, 'home.swapSheet.keepShort')}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ),
                )
              )}
            </ScrollView>
            {/* A swap answers today. This makes it the programme's answer —
                offered only once there is a swap to keep. */}
            {swapRow?.exerciseId && sessionSwaps[swapRow.slotId] && onKeepSwap ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onKeepSwap(swapRow.exerciseId as string, sessionSwaps[swapRow.slotId]);
                  closeSwapSheet();
                }}
                style={({ pressed }) => [styles.swapRemove, pressed && styles.swapOptionPressed]}
              >
                <Text style={[styles.swapRemoveText, { color: theme.highlight }]}>
                  {t(language, 'home.swapSheet.keep')}
                </Text>
                <Text style={styles.swapRemoveNote}>
                  {t(language, 'home.swapSheet.keepNote', {
                    name: exerciseNameLabel(language, sessionSwaps[swapRow.slotId]),
                  })}
                </Text>
              </Pressable>
            ) : null}
            {/* The other thing a reader wants from a lift they cannot do. It
                was reachable only through "tee tästä oma versio", which nobody
                found and which asked them to understand the catalog first. */}
            {swapRow?.exerciseId && onRemoveExercise ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onRemoveExercise(swapRow.exerciseId as string);
                  closeSwapSheet();
                }}
                style={({ pressed }) => [styles.swapRemove, pressed && styles.swapOptionPressed]}
              >
                <Text style={[styles.swapRemoveText, { color: theme.danger }]}>
                  {t(language, 'home.swapSheet.remove')}
                </Text>
                <Text style={styles.swapRemoveNote}>{t(language, 'home.swapSheet.removeNote')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* The library, over the day it is adding to. Same component the editor
          uses, so search, body-part chips and the photos are the ones the
          reader already knows. */}
      {canAddExercises ? (
        <AddExerciseSheet
          visible={addSheetOpen}
          language={language}
          items={exerciseLibrary ?? []}
          recentItems={recentExerciseLibraryItems}
          currentItemIds={currentLibraryItemIds}
          title={t(language, 'editor.addExercise')}
          subtitle={localizeSessionName(session.name, language)}
          multiSelect
          onClose={() => setAddSheetOpen(false)}
          onSelectItem={() => undefined}
          onConfirmSelection={(items) => {
            setAddSheetOpen(false);
            if (items.length > 0) {
              onAddExercises?.(items.map((item) => item.name));
            }
          }}
        />
      ) : null}

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
    // The start dock this once cleared is gone (removed on request), but its
    // 120dp of room stayed — a blank stretch between the last block and the
    // tab bar on every day page. Just the tab bar's reserve now.
    paddingBottom: layout.bottomTabBarReserve,
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
  // Below the replacements and behind a rule: a different kind of answer, and
  // not one that should sit where a mis-tap in the list lands.
  swapRemove: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 2,
  },
  // Red, like Home's: this is the answer that does not come back.
  swapRemoveText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  swapSearch: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.surfaceSoft,
    color: theme.ink,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  swapOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapOptionGrow: { flex: 1 },
  swapOptionKeep: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  swapOptionKeepText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  swapGroup: {
    color: theme.faint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 2,
  },
  swapRemoveNote: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  swapOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  swapScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 18, 70, 0.42)',
  },
  /**
   * 88%, not 70%.
   *
   * The sheet now carries a search box, up to three groups of rows and two
   * actions under them, and at 70% the rows were a peephole with the whole
   * screen dark and unused above it ("vähän sumpussa koko pakka voi antaa
   * reilusti tilaa", #bugs 2026-08-26). The cap still exists so the row being
   * swapped stays visible behind the sheet.
   */
  swapSheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    maxHeight: '88%',
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
  // Shrinks so the actions under it stay on screen, grows into whatever the
  // taller sheet leaves over.
  swapList: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
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
  // Same dashed affordance the empty workout already uses for "add a lift", so
  // the one gesture looks the same wherever a list can grow.
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: theme.border,
  },
  addGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceSoft,
  },
  addRowText: {
    flex: 1,
    color: theme.purpleDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  addFixedBlock: {
    gap: 10,
  },
  addFixedNote: {
    color: theme.faint,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
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

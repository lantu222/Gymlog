import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { t } from '../lib/i18n';
import {
  describeStretch,
  estimateWeeksToTarget,
  ObservedRate,
  orderTargetLifts,
  TARGET_DELTAS_KG,
} from '../lib/strengthGoalPlan';
import { layout } from '../theme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * Setting a target, in three steps: which lift, how much, and the week.
 *
 * This replaces a page of ready-made numbers — five lifts at three round
 * figures each. The round figures were the problem the brief names: 100 kg
 * means one thing to someone benching 95 and another to someone benching 60,
 * so a target here is the reader's own best plus something they can add, and
 * the time it would take is arithmetic on their own log.
 *
 * Nothing is created until the last step is accepted. The proposal is a real
 * programme from the catalog — the one that trains this lift and fits the
 * reader's week — copied into their own programmes so it can be edited
 * afterwards. It is not generated: a composer that invents a week has already
 * invented exercise names in this app once.
 */

export interface GoalFlowLift {
  /** The stored English library name — what a goal is keyed by. */
  exerciseName: string;
  bestKg: number | null;
  rate: ObservedRate | null;
  lastLoggedAt: number | null;
  /** Days since the last logged session, for the row's "4 wks ago". */
  daysSinceLogged: number | null;
}

export interface GoalFlowProposalDay {
  sessionId: string;
  name: string;
  /** The first few lifts, already joined — the screen does not compose. */
  lead: string;
  trainsTarget: boolean;
}

export interface GoalFlowProposal {
  templateId: string;
  programmeName: string;
  daysPerWeek: number;
  minutes: number;
  blockWeeks: number;
  days: GoalFlowProposalDay[];
  /** How many of the week's days touch the target lift. */
  targetDays: number;
}

interface StrengthGoalFlowScreenProps {
  language?: AppLanguage;
  lifts: GoalFlowLift[];
  unitLabel: string;
  /** The programme that would be built, for the lift picked in step 1. */
  getProposal: (exerciseName: string) => GoalFlowProposal | null;
  onBack: () => void;
  /**
   * Accepting the proposal. The programme cap is the caller's business: full
   * on the free tier routes to the paywall from inside the adoption, and a
   * disabled button here would be this screen guessing at an answer it does
   * not have.
   */
  onCreate: (input: { exerciseName: string; targetKg: number; templateId: string }) => void;
}

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4a7 7 0 100 14 7 7 0 000-14zm5 12l4 4"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12.5l5 5L20 6.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FlowHead({
  step,
  title,
  sub,
  onBack,
  language,
}: {
  step: 1 | 2 | 3;
  title: string;
  sub: string;
  onBack: () => void;
  language: AppLanguage;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          hitSlop={8}
          style={styles.backButton}
        >
          <ChevronLeftIcon color={theme.ink} />
        </Pressable>
        <View style={styles.stepBars}>
          {[1, 2, 3].map((index) => (
            <View key={index} style={[styles.stepBar, index <= step && styles.stepBarOn]} />
          ))}
        </View>
        <Text style={styles.stepCount}>{t(language, 'goalFlow.step', { step, total: 3 })}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

export function StrengthGoalFlowScreen({
  language = 'en',
  lifts,
  unitLabel,
  getProposal,
  onBack,
  onCreate,
}: StrengthGoalFlowScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [delta, setDelta] = useState<number>(TARGET_DELTAS_KG[1]);

  const ordered = useMemo(() => orderTargetLifts(lifts), [lifts]);
  const shown = useMemo(() => {
    const needle = search.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!needle) {
      return ordered;
    }
    return ordered.filter((lift) =>
      exerciseNameLabel(language, lift.exerciseName).toLowerCase().includes(needle) ||
      lift.exerciseName.toLowerCase().includes(needle),
    );
  }, [language, ordered, search]);

  const picked = pickedName ? (lifts.find((lift) => lift.exerciseName === pickedName) ?? null) : null;

  /**
   * Nothing logged means no best to add to. The flow still works — someone may
   * be aiming at a lift they are about to start — but the number is then the
   * delta itself, and the estimate says there is no rate rather than inventing
   * a starting point.
   */
  const bestKg = picked?.bestKg ?? null;
  const targetKg = (bestKg ?? 0) + delta;
  const estimate = estimateWeeksToTarget(bestKg ?? 0, targetKg, picked?.rate ?? null);
  const stretch = describeStretch(bestKg ?? 0, targetKg);
  const proposal = picked ? getProposal(picked.exerciseName) : null;

  function goBack() {
    if (step === 1) {
      onBack();
      return;
    }
    setStep(step === 3 ? 2 : 1);
  }

  if (step === 1) {
    return (
      <View style={styles.screen}>
        <FlowHead
          step={1}
          language={language}
          onBack={goBack}
          title={t(language, 'goalFlow.step1.title')}
          sub={t(language, 'goalFlow.step1.sub')}
        />
        <View style={styles.searchField}>
          <SearchIcon color={theme.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t(language, 'goalFlow.searchPlaceholder', { count: lifts.length })}
            placeholderTextColor={theme.faint}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t(language, 'goalFlow.searchPlaceholder', { count: lifts.length })}
          />
        </View>
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={shown}
          keyExtractor={(lift) => lift.exerciseName}
          ItemSeparatorComponent={() => <View style={styles.rowGap} />}
          ListEmptyComponent={<Text style={styles.empty}>{t(language, 'goalFlow.noMatch')}</Text>}
          renderItem={({ item }) => {
            const on = item.exerciseName === pickedName;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setPickedName(item.exerciseName)}
                style={({ pressed }) => [styles.liftRow, on && styles.liftRowOn, pressed && styles.pressed]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.liftName} numberOfLines={1}>
                    {exerciseNameLabel(language, item.exerciseName)}
                  </Text>
                  <Text style={[styles.liftMeta, item.bestKg === null && styles.liftMetaFaint]}>
                    {item.bestKg === null
                      ? t(language, 'goalFlow.neverLogged')
                      : t(language, 'goalFlow.yourBest', {
                          kg: item.bestKg,
                          unit: unitLabel,
                          ago:
                            item.daysSinceLogged === null
                              ? ''
                              : t(language, 'goalFlow.daysAgo', { days: item.daysSinceLogged }),
                        })}
                  </Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on ? <CheckIcon color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          }}
        />
        <View style={styles.footer}>
          {picked ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(2)}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>
                {t(language, 'goalFlow.continueWith', {
                  name: exerciseNameLabel(language, picked.exerciseName),
                })}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.ctaIdle}>
              <Text style={styles.ctaIdleText}>{t(language, 'goalFlow.pickOne')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!picked) {
    // Only reachable if the lift list changed under a picked name; step 1 is
    // the honest place to land rather than a step 2 about nothing.
    setStep(1);
    return <View style={styles.screen} />;
  }

  if (step === 2) {
    return (
      <View style={styles.screen}>
        <FlowHead
          step={2}
          language={language}
          onBack={goBack}
          title={t(language, 'goalFlow.step2.title')}
          sub={
            bestKg === null
              ? t(language, 'goalFlow.step2.subUnlogged', {
                  name: exerciseNameLabel(language, picked.exerciseName),
                })
              : t(language, 'goalFlow.step2.sub', {
                  name: exerciseNameLabel(language, picked.exerciseName),
                  kg: bestKg,
                  unit: unitLabel,
                })
          }
        />
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <View style={styles.numberCard}>
            <View style={styles.numberLine}>
              <Text style={styles.number}>{targetKg}</Text>
              <Text style={styles.numberUnit}>{unitLabel}</Text>
            </View>
            <Text style={styles.numberDelta}>
              {bestKg === null
                ? t(language, 'goalFlow.deltaNoBest', { kg: delta, unit: unitLabel })
                : t(language, 'goalFlow.deltaOnBest', { kg: delta, unit: unitLabel })}
            </Text>
            <View style={styles.deltaRow}>
              {TARGET_DELTAS_KG.map((option) => {
                const on = option === delta;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setDelta(option)}
                    style={[styles.deltaChip, on && styles.deltaChipOn]}
                  >
                    <Text style={[styles.deltaChipText, on && styles.deltaChipTextOn]}>+{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* The estimate, or the reason there is not one. Every branch is a
              sentence rather than a blank, because "no rate yet" and "no gain"
              are different things to tell someone. */}
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>
              {estimate.kind === 'weeks'
                ? t(language, 'goalFlow.weeksAtRate', { weeks: estimate.weeks })
                : t(language, `goalFlow.estimate.${estimate.kind}` as 'goalFlow.estimate.noRate')}
            </Text>
            <Text style={styles.noteBody}>
              {estimate.kind === 'weeks' || estimate.kind === 'noGain' || estimate.kind === 'beyondHorizon'
                ? t(language, 'goalFlow.rateBody', {
                    kg: Math.round(estimate.rate.gainKg * 10) / 10,
                    weeks: Math.round(estimate.rate.spanWeeks),
                    sessions: estimate.rate.sessions,
                    unit: unitLabel,
                  })
                : t(language, 'goalFlow.rateBodyNone')}
            </Text>
          </View>

          {stretch.stretch ? (
            <View style={styles.warnCard}>
              <Text style={styles.warnText}>
                {t(language, 'goalFlow.stretch', { percent: stretch.percent })}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep(3)}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>{t(language, 'goalFlow.buildWeeks')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlowHead
        step={3}
        language={language}
        onBack={goBack}
        title={t(language, 'goalFlow.step3.title')}
        sub={
          proposal
            ? t(language, 'goalFlow.step3.sub', {
                weeks: proposal.blockWeeks,
                days: proposal.daysPerWeek,
                touching: proposal.targetDays,
                name: exerciseNameLabel(language, picked.exerciseName),
              })
            : t(language, 'goalFlow.step3.subNone', {
                name: exerciseNameLabel(language, picked.exerciseName),
              })
        }
      />
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {proposal ? (
          <>
            <View style={styles.proposalCard}>
              <Text style={styles.proposalEyebrow}>{t(language, 'goalFlow.proposed')}</Text>
              <Text style={styles.proposalName}>{proposal.programmeName}</Text>
              <Text style={styles.proposalTowards}>
                {t(language, 'goalFlow.towards', {
                  name: exerciseNameLabel(language, picked.exerciseName),
                  kg: targetKg,
                  unit: unitLabel,
                })}
              </Text>
              <View style={styles.statRow}>
                {[
                  [t(language, 'programs.weeksShort', { count: proposal.blockWeeks }), t(language, 'goalFlow.stat.length')],
                  [t(language, 'goalFlow.perWeek', { days: proposal.daysPerWeek }), t(language, 'goalFlow.stat.days')],
                  [`~${proposal.minutes} min`, t(language, 'goalFlow.stat.session')],
                ].map(([value, label]) => (
                  <View key={label}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.weekEyebrow}>{t(language, 'goalFlow.weekOne')}</Text>
            <View style={{ gap: 9 }}>
              {proposal.days.map((day) => (
                <View key={day.sessionId} style={styles.dayRow}>
                  <View style={styles.dayHead}>
                    <Text style={styles.dayName} numberOfLines={1}>
                      {day.name}
                    </Text>
                    {day.trainsTarget ? (
                      <View style={styles.targetTag}>
                        <Text style={styles.targetTagText}>{t(language, 'goalFlow.targetLift')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.dayLead} numberOfLines={2}>
                    {day.lead}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteBody}>{t(language, 'goalFlow.nothingYet')}</Text>
            </View>
          </>
        ) : (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>{t(language, 'goalFlow.noProgramme')}</Text>
            <Text style={styles.noteBody}>{t(language, 'goalFlow.noProgrammeBody')}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!proposal) {
              return;
            }
            onCreate({
              exerciseName: picked.exerciseName,
              targetKg,
              templateId: proposal.templateId,
            });
          }}
          disabled={!proposal}
          style={({ pressed }) => [
            styles.cta,
            !proposal && styles.ctaDisabled,
            pressed && proposal && styles.pressed,
          ]}
        >
          <Text style={[styles.ctaText, !proposal && styles.ctaTextDisabled]}>
            {t(language, 'goalFlow.create')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    head: {
      paddingHorizontal: 20,
      paddingTop: 52,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBars: {
      flex: 1,
      flexDirection: 'row',
      gap: 5,
    },
    stepBar: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    stepBarOn: {
      backgroundColor: theme.purple,
    },
    stepCount: {
      color: theme.faint,
      fontSize: 11.5,
      fontWeight: '800',
    },
    title: {
      color: theme.ink,
      fontSize: 25,
      lineHeight: 29,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 18,
    },
    sub: {
      color: theme.muted,
      fontSize: 13.5,
      lineHeight: 20,
      fontWeight: '600',
      marginTop: 8,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 44,
      marginHorizontal: 20,
      marginTop: 18,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: theme.ink,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 0,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 20,
    },
    rowGap: {
      height: 9,
    },
    empty: {
      color: theme.muted,
      fontSize: 13.5,
      lineHeight: 19,
      fontWeight: '600',
      paddingVertical: 18,
    },
    liftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 15,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    liftRowOn: {
      borderColor: theme.purple,
      backgroundColor: theme.surfaceSoft,
    },
    pressed: {
      opacity: 0.7,
    },
    liftName: {
      color: theme.ink,
      fontSize: 15.5,
      lineHeight: 20,
      fontWeight: '800',
    },
    liftMeta: {
      color: theme.muted,
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: '700',
      marginTop: 3,
    },
    liftMetaFaint: {
      color: theme.faint,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 999,
      borderWidth: 1.6,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: {
      borderWidth: 0,
      backgroundColor: theme.purple,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: layout.bottomTabBarReserve,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    cta: {
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.highlight,
    },
    ctaDisabled: {
      backgroundColor: theme.surface,
    },
    ctaText: {
      color: theme.onHighlight,
      fontSize: 15,
      fontWeight: '800',
    },
    ctaTextDisabled: {
      color: theme.faint,
    },
    ctaIdle: {
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    ctaIdleText: {
      color: theme.faint,
      fontSize: 15,
      fontWeight: '800',
    },
    numberCard: {
      alignItems: 'center',
      padding: 22,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
    },
    numberLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    number: {
      color: theme.ink,
      fontSize: 58,
      lineHeight: 62,
      fontWeight: '800',
      letterSpacing: -2,
    },
    numberUnit: {
      color: theme.muted,
      fontSize: 20,
      fontWeight: '800',
    },
    numberDelta: {
      color: theme.purple,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 8,
    },
    deltaRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
      alignSelf: 'stretch',
    },
    deltaChip: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deltaChipOn: {
      borderColor: theme.highlight,
      backgroundColor: theme.highlight,
    },
    deltaChipText: {
      color: theme.muted,
      fontSize: 14.5,
      fontWeight: '800',
    },
    deltaChipTextOn: {
      color: theme.onHighlight,
    },
    noteCard: {
      marginTop: 16,
      padding: 16,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    noteTitle: {
      color: theme.ink,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '800',
    },
    noteBody: {
      color: theme.muted,
      fontSize: 12.5,
      lineHeight: 19,
      fontWeight: '600',
      marginTop: 3,
    },
    warnCard: {
      marginTop: 10,
      padding: 16,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.amberBorder,
      backgroundColor: theme.amberSoft,
    },
    warnText: {
      color: theme.amberInk,
      fontSize: 12.5,
      lineHeight: 19,
      fontWeight: '700',
    },
    proposalCard: {
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
    },
    proposalEyebrow: {
      color: theme.purple,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    proposalName: {
      color: theme.ink,
      fontSize: 19.5,
      lineHeight: 24,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 5,
    },
    proposalTowards: {
      color: theme.muted,
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: '700',
      marginTop: 3,
    },
    statRow: {
      flexDirection: 'row',
      gap: 20,
      marginTop: 14,
    },
    statValue: {
      color: theme.ink,
      fontSize: 16.5,
      lineHeight: 21,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.faint,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      marginTop: 2,
    },
    weekEyebrow: {
      color: theme.faint,
      fontSize: 11.5,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginTop: 22,
      marginBottom: 11,
    },
    dayRow: {
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    dayName: {
      flex: 1,
      minWidth: 0,
      color: theme.ink,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },
    targetTag: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.surfaceSoft,
    },
    targetTagText: {
      color: theme.purple,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    dayLead: {
      color: theme.muted,
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: '600',
      marginTop: 5,
    },
  });

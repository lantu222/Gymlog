import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CutSurface } from '../components/CutSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import { CutButton } from '../components/CutButton';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { GoalProgrammeSuggestionView } from '../lib/goalProgramme';
import { t } from '../lib/i18n';
import { StrengthGoalPresetRow } from '../lib/strengthGoalPresets';
import { layout, spacing } from '../theme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * "Valitse tavoite" — a page of ready-made targets.
 *
 * Not the exercise library. The library is 873 rows and answers "what could I
 * train"; a target answers "what am I trying to reach", and there are about
 * five lifts anybody says that sentence about. Picking one is one tap on a
 * round number.
 *
 * A target already reached still shows, marked. Hiding it would leave a lift
 * with three options one day and two the next, and "you already did this" is
 * worth reading next to "you have not".
 *
 * A target always comes with a programme (feedback round 2, #1). Under a lift
 * with a target set, the page says which programme goes towards it: the active
 * one if it trains the lift, the best ready one that does if not, and — for a
 * lift no ready programme trains — that plainly, with the way to build one.
 */

interface StrengthGoalPickerScreenProps {
  language: AppLanguage;
  rows: StrengthGoalPresetRow[];
  unitLabel: string;
  /** Keyed by the preset's exerciseName. Missing means nothing to say. */
  suggestions: Record<string, GoalProgrammeSuggestionView>;
  onBack: () => void;
  onPick: (exerciseName: string, targetKg: number) => void;
  /** Clears the target for a lift — tapping the one already set. */
  onClear: (exerciseName: string) => void;
  onAdoptProgramme: (templateId: string) => void;
  onOpenProgramme: (templateId: string) => void;
  onBuildOwn: () => void;
}

export function StrengthGoalPickerScreen({
  language,
  rows,
  unitLabel,
  suggestions,
  onBack,
  onPick,
  onClear,
  onAdoptProgramme,
  onOpenProgramme,
  onBuildOwn,
}: StrengthGoalPickerScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        language={language}
        title={t(language, 'goals.picker.title')}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t(language, 'goals.picker.lead')}</Text>

        {rows.map((row) => (
          <View key={row.exerciseName} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{exerciseNameLabel(language, row.exerciseName)}</Text>
              <Text style={styles.groupMeta}>
                {row.bestKg === null
                  ? t(language, 'goals.picker.noBest')
                  : t(language, 'goals.picker.best', { kg: row.bestKg, unit: unitLabel })}
              </Text>
            </View>
            <View style={styles.optionRow}>
              {row.options.map((option) => (
                <Pressable
                  key={option.targetKg}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.selected }}
                  accessibilityLabel={`${exerciseNameLabel(language, row.exerciseName)} ${option.targetKg} ${unitLabel}`}
                  onPress={() =>
                    option.selected ? onClear(row.exerciseName) : onPick(row.exerciseName, option.targetKg)
                  }
                  style={({ pressed }) => [styles.optionWrap, pressed && styles.pressed]}
                >
                  <CutSurface
                    size="md"
                    fill={option.selected ? theme.purple : theme.surface}
                    stroke={option.selected ? theme.purple : theme.border}
                    strokeWidth={1}
                    style={styles.option}
                  >
                    <Text style={[styles.optionKg, option.selected && styles.optionKgOn]}>
                      {option.targetKg}
                    </Text>
                    <Text style={[styles.optionUnit, option.selected && styles.optionUnitOn]}>
                      {unitLabel}
                    </Text>
                    {option.alreadyReached && !option.selected ? (
                      <View style={styles.reached}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M5 13l4 4L19 7"
                            stroke={theme.green}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    ) : null}
                  </CutSurface>
                </Pressable>
              ))}
            </View>
            {row.currentTargetKg !== null ? (
              <Text style={styles.groupHint}>{t(language, 'goals.picker.clearHint')}</Text>
            ) : null}
            {row.currentTargetKg !== null && suggestions[row.exerciseName] ? (
              <ProgrammePanel
                language={language}
                suggestion={suggestions[row.exerciseName]}
                onAdopt={onAdoptProgramme}
                onOpen={onOpenProgramme}
                onBuildOwn={onBuildOwn}
              />
            ) : null}
          </View>
        ))}

        {/* Said once, at the bottom, rather than under every row: the app does
            not know what you should aim at, and the bar is your own best set
            and never an estimate. */}
        <Text style={styles.footnote}>{t(language, 'goals.picker.footnote')}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * The programme under a set target. Three states, one card, no projection:
 * the copy says which programme contains the lift and how often, never how
 * soon it would reach the number.
 */
function ProgrammePanel({
  language,
  suggestion,
  onAdopt,
  onOpen,
  onBuildOwn,
}: {
  language: AppLanguage;
  suggestion: GoalProgrammeSuggestionView;
  onAdopt: (templateId: string) => void;
  onOpen: (templateId: string) => void;
  onBuildOwn: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const programme = suggestion.programme;

  return (
    <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.panel}>
      <Text style={styles.panelEyebrow}>{t(language, 'goals.picker.programme.title')}</Text>
      {suggestion.status === 'covered' && programme ? (
        <>
          <Text style={styles.panelBody}>
            {t(language, 'goals.picker.programme.coveredBody', { programme: programme.title })}
          </Text>
          <View style={styles.panelActions}>
            <CutButton
              label={t(language, 'goals.picker.programme.open')}
              variant="secondary"
              onPress={() => onOpen(programme.id)}
            />
          </View>
        </>
      ) : suggestion.status === 'suggest' && programme ? (
        <>
          <Text style={styles.panelBody}>
            {t(language, 'goals.picker.programme.suggestBody', {
              programme: programme.title,
              count: programme.sessionCount,
              total: programme.totalSessions,
            })}
          </Text>
          <View style={styles.panelActions}>
            <CutButton
              label={t(language, 'goals.picker.programme.adopt')}
              onPress={() => onAdopt(programme.id)}
            />
            <CutButton
              label={t(language, 'goals.picker.programme.open')}
              variant="secondary"
              onPress={() => onOpen(programme.id)}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.panelBody}>{t(language, 'goals.picker.programme.noneBody')}</Text>
          <View style={styles.panelActions}>
            <CutButton label={t(language, 'goals.picker.programme.build')} variant="secondary" onPress={onBuildOwn} />
          </View>
        </>
      )}
    </CutSurface>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.xl,
  },
  lead: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  group: {
    gap: 10,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  groupTitle: {
    flex: 1,
    color: theme.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  groupMeta: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  groupHint: {
    color: theme.faint,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionWrap: {
    flex: 1,
  },
  option: {
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  optionKg: {
    color: theme.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  optionKgOn: {
    color: '#FFFFFF',
  },
  optionUnit: {
    color: theme.faint,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  optionUnitOn: {
    color: 'rgba(255,255,255,0.82)',
  },
  reached: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
  footnote: {
    color: theme.faint,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  panel: {
    padding: spacing.md,
    gap: 8,
  },
  panelEyebrow: {
    color: theme.purple,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  panelBody: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  panelActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});

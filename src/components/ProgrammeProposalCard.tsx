import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CutButton } from './CutButton';
import { CutSurface } from './CutSurface';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { ProgrammeProposal } from '../lib/programmeBrief';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { spacing } from '../theme';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * A composed week, wherever it is being read.
 *
 * It lived inside AiProgramComposerScreen, which meant the chat could only
 * hand a brief over and navigate away. Putting a second copy in the chat was
 * the obvious move and the wrong one: the day list, the unmet-lift notes, the
 * save path and the programme-cap dialog would exist twice and drift.
 *
 * So there is one card. The composer screen shows it under its own text field;
 * the chat shows it as a message. That is what makes the merge safe rather
 * than merely shorter — and it is why the reader can now keep talking after a
 * proposal instead of leaving the conversation to look at one.
 */

export interface ProgrammeProposalCardProps {
  proposal: ProgrammeProposal;
  language: AppLanguage;
  /** 'saving' disables the actions; the label says which one is running. */
  busy?: 'idle' | 'saving';
  onSave: () => void;
  /**
   * Compose the same brief again. Absent in the chat, where asking again is
   * what the conversation is for.
   */
  onAgain?: () => void;
}

export function ProgrammeProposalCard({
  proposal,
  language,
  busy = 'idle',
  onSave,
  onAgain,
}: ProgrammeProposalCardProps) {
  const styles = useThemedStyles(makeStyles);

  /**
   * The line that proves the brief was read. Only what was actually found — an
   * empty read is stated as such rather than padded.
   */
  const readLine = useMemo(() => {
    const parts: string[] = [];
    const { signals } = proposal;
    if (signals.daysPerWeek) {
      // When the ask was bigger than the composer can lay out, say both — it
      // used to report the capped number as though the reader had written it.
      parts.push(
        signals.requestedDaysPerWeek
          ? t(language, 'aiCompose.read.daysCapped', {
              asked: signals.requestedDaysPerWeek,
              count: signals.daysPerWeek,
            })
          : t(language, 'aiCompose.read.days', { count: signals.daysPerWeek }),
      );
    }
    if (signals.lifts.length) {
      parts.push(signals.lifts.map((lift) => exerciseNameLabel(language, lift)).join(', '));
    }
    if (signals.cautions.length) {
      parts.push(
        t(language, 'aiCompose.read.cautions', {
          areas: signals.cautions
            .map((area) => t(language, `aiCompose.caution.${area.replace(' ', '_')}` as I18nKey))
            .join(', '),
        }),
      );
    }
    if (signals.sessionMinutes) {
      parts.push(`~${signals.sessionMinutes} min`);
    }
    return parts.length ? parts.join(' · ') : t(language, 'aiCompose.read.nothing');
  }, [language, proposal]);

  return (
    <CutSurface size="lg" fill="transparent" stroke="transparent" strokeWidth={0} style={styles.card}>
      <Text style={styles.readEyebrow}>{t(language, 'aiCompose.read')}</Text>
      <Text style={styles.readLine}>{readLine}</Text>

      <Text style={styles.title}>{proposal.title}</Text>
      {proposal.sessions.map((session, index) => (
        <View key={`${session.name}-${index}`} style={styles.session}>
          <Text style={styles.sessionName}>{localizeSessionName(session.name, language)}</Text>
          {session.exercises.map((exercise) => (
            <View key={exercise.libraryItemId} style={styles.exerciseRow}>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exerciseNameLabel(language, exercise.name)}
              </Text>
              <Text style={styles.exerciseScheme}>
                {exercise.sets} ×{' '}
                {exercise.repsMin === exercise.repsMax
                  ? exercise.repsMin
                  : `${exercise.repsMin}–${exercise.repsMax}`}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {/* What the composer could not fit or could not place. Listed, never
          hidden: a week that quietly dropped the lift you asked for is worse
          than one that says it could not find room. */}
      {proposal.unmetLifts.length ? (
        <Text style={styles.note}>
          {t(language, 'aiCompose.unmet', {
            lifts: proposal.unmetLifts.map((lift) => exerciseNameLabel(language, lift)).join(', '),
          })}
        </Text>
      ) : null}
      {proposal.unresolvedNames.length ? (
        <Text style={styles.note}>
          {t(language, 'aiCompose.unresolved', { names: proposal.unresolvedNames.join(', ') })}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <CutButton
          label={busy === 'saving' ? t(language, 'aiCompose.saving') : t(language, 'aiCompose.save')}
          variant={busy === 'idle' ? 'primary' : 'disabled'}
          onPress={onSave}
        />
        {onAgain ? (
          <Pressable onPress={onAgain} hitSlop={8} style={styles.again} disabled={busy !== 'idle'}>
            <Text style={styles.againText}>{t(language, 'aiCompose.again')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.source}>
        {t(language, proposal.source === 'live' ? 'aiCompose.source.live' : 'aiCompose.source.preview')}
      </Text>
    </CutSurface>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    // The surround is the caller's: the composer frames it as a panel, the
    // chat as a message. Only the contents live here.
    card: { padding: spacing.md, gap: 10 },
    readEyebrow: {
      color: theme.purple,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    readLine: { color: theme.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    title: {
      color: theme.ink,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 6,
    },
    session: { gap: 6, marginTop: 6 },
    sessionName: { color: theme.ink, fontSize: 15, fontWeight: '800' },
    exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    exerciseName: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' },
    exerciseScheme: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
    note: { color: theme.muted, fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: 4 },
    actions: { gap: 10, marginTop: 8 },
    again: { alignSelf: 'center', paddingVertical: 6 },
    againText: { color: theme.purple, fontSize: 14, fontWeight: '800' },
    source: { color: theme.faint, fontSize: 11.5, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  });

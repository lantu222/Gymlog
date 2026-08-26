import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CutButton } from '../components/CutButton';
import { CutSurface } from '../components/CutSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import { exerciseNameLabel } from '../lib/exerciseNameLabel';
import { I18nKey, t } from '../lib/i18n';
import { ProgrammeProposal } from '../lib/programmeBrief';
import { localizeSessionName } from '../lib/sessionNameLabel';
import { layout, spacing } from '../theme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage, AppPreferences } from '../types/models';

/**
 * "AI assisted" — one text field (feedback round 2, #3).
 *
 * The reader says what they want in their own words. What the app already
 * knows from onboarding is shown as chips under the field so nothing has to be
 * typed twice, and the proposal that comes back begins with what was READ from
 * the brief — days, lifts, cautions — so the reader can see it was heard before
 * scrolling to the week. Every exercise in the week is a library exercise;
 * anything the composer could not fit or resolve is listed, not hidden.
 *
 * Saving makes a programme of the reader's own. Nothing runs from here.
 */

interface AiProgramComposerScreenProps {
  language: AppLanguage;
  preferences: AppPreferences;
  /** True when a coach server is configured; the footnote says which composer answered. */
  liveConfigured: boolean;
  compose: (brief: string) => Promise<ProgrammeProposal>;
  /**
   * A brief the coach chat already gathered. The screen opens with it in the
   * field and composes straight away — the reader stated it in the
   * conversation, and an empty field here would be the app asking twice.
   */
  initialBrief?: string;
  onSave: (proposal: ProgrammeProposal) => Promise<void> | void;
  onBack: () => void;
}



export function AiProgramComposerScreen({
  language,
  preferences,
  liveConfigured,
  compose,
  onSave,
  initialBrief,
  onBack,
}: AiProgramComposerScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [brief, setBrief] = useState(initialBrief ?? '');
  const [busy, setBusy] = useState<'idle' | 'composing' | 'saving'>(initialBrief ? 'composing' : 'idle');
  const [proposal, setProposal] = useState<ProgrammeProposal | null>(null);

  const canCompose = brief.trim().length >= 3 && busy === 'idle';

  const runCompose = useCallback(
    async (text: string) => {
      setBusy('composing');
      try {
        const next = await compose(text);
        setProposal(next);
      } finally {
        setBusy('idle');
      }
    },
    [compose],
  );

  // The brief came from the chat, so the week is what the reader is waiting
  // for — not a filled-in field with a button still to press. Runs once: the
  // dependency is the brief the screen opened with, and the screen is keyed on
  // it, so a second handover mounts a new screen rather than recomposing this
  // one over a proposal the reader may already be reading.
  useEffect(() => {
    const seed = initialBrief?.trim();
    if (seed && seed.length >= 3) {
      void runCompose(seed);
    } else if (seed !== undefined) {
      // Too short to compose; leave the reader in the field rather than in a
      // spinner that resolves to nothing.
      setBusy('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrief]);

  const handleCompose = async () => {
    if (!canCompose) {
      return;
    }
    await runCompose(brief.trim());
  };

  const handleSave = async () => {
    if (!proposal || busy !== 'idle') {
      return;
    }
    setBusy('saving');
    try {
      await onSave(proposal);
    } finally {
      setBusy('idle');
    }
  };

  // The line that proves the brief was read. Only what was actually found —
  // an empty read is stated as such rather than padded.
  const readLine = useMemo(() => {
    if (!proposal) {
      return null;
    }
    const parts: string[] = [];
    const { signals } = proposal;
    if (signals.daysPerWeek) {
      // When the ask was bigger than the composer can lay out, say both — it
      // used to report the capped number as though the reader had written it
      // (user asked for five and was told "read: 4 days", 2026-08-26).
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
          areas: signals.cautions.map((area) => t(language, `aiCompose.caution.${area.replace(' ', '_')}` as I18nKey)).join(', '),
        }),
      );
    }
    if (signals.sessionMinutes) {
      parts.push(`~${signals.sessionMinutes} min`);
    }
    return parts.length ? parts.join(' · ') : t(language, 'aiCompose.read.nothing');
  }, [language, proposal]);

  return (
    <View style={styles.screen}>
      <ScreenHeader language={language} title={t(language, 'aiCompose.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t(language, 'aiCompose.lead')}</Text>

        <TextInput
          value={brief}
          onChangeText={(next) => {
            setBrief(next);
            if (proposal) {
              // A changed brief is a new question; the old answer must not sit
              // under it as if it still applied.
              setProposal(null);
            }
          }}
          multiline
          numberOfLines={4}
          placeholder={t(language, 'aiCompose.placeholder')}
          placeholderTextColor={theme.faint}
          style={styles.input}
          textAlignVertical="top"
          accessibilityLabel={t(language, 'aiCompose.title')}
        />

        {/* The "Tiedossa jo" chips stood here — days, level, equipment,
            cautions, drawn as a row of pills. They were meant to save typing
            and read as a fence instead: a list of things already decided,
            above a field asking what you want (user 2026-08-26, "se rajoittaa
            liikaa"). The setup still travels with the brief; it just no longer
            announces itself as the answer before the question. */}

        <CutButton
          label={busy === 'composing' ? t(language, 'aiCompose.composing') : t(language, 'aiCompose.compose')}
          variant={canCompose ? 'primary' : 'disabled'}
          onPress={handleCompose}
        />

        {busy === 'composing' ? <ActivityIndicator color={theme.purple} style={styles.spinner} /> : null}

        {proposal ? (
          <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.proposal}>
            <Text style={styles.readEyebrow}>{t(language, 'aiCompose.read')}</Text>
            <Text style={styles.readLine}>{readLine}</Text>

            <Text style={styles.proposalTitle}>{proposal.title}</Text>
            {proposal.sessions.map((session, index) => (
              <View key={`${session.name}-${index}`} style={styles.session}>
                <Text style={styles.sessionName}>{localizeSessionName(session.name, language)}</Text>
                {session.exercises.map((exercise) => (
                  <View key={exercise.libraryItemId} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {exerciseNameLabel(language, exercise.name)}
                    </Text>
                    <Text style={styles.exerciseScheme}>
                      {exercise.sets} × {exercise.repsMin === exercise.repsMax ? exercise.repsMin : `${exercise.repsMin}–${exercise.repsMax}`}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {proposal.unmetLifts.length ? (
              <Text style={styles.note}>
                {t(language, 'aiCompose.unmet', {
                  lifts: proposal.unmetLifts.map((lift) => exerciseNameLabel(language, lift)).join(', '),
                })}
              </Text>
            ) : null}
            {proposal.unresolvedNames.length ? (
              <Text style={styles.note}>{t(language, 'aiCompose.unresolved', { names: proposal.unresolvedNames.join(', ') })}</Text>
            ) : null}

            <View style={styles.actions}>
              <CutButton
                label={busy === 'saving' ? t(language, 'aiCompose.saving') : t(language, 'aiCompose.save')}
                variant={busy === 'idle' ? 'primary' : 'disabled'}
                onPress={handleSave}
              />
              <Pressable onPress={handleCompose} hitSlop={8} style={styles.again} disabled={busy !== 'idle'}>
                <Text style={styles.againText}>{t(language, 'aiCompose.again')}</Text>
              </Pressable>
            </View>

            <Text style={styles.source}>
              {t(language, proposal.source === 'live' ? 'aiCompose.source.live' : 'aiCompose.source.preview')}
            </Text>
          </CutSurface>
        ) : null}

        {!proposal ? (
          <Text style={styles.footnote}>
            {t(language, liveConfigured ? 'aiCompose.footnote.live' : 'aiCompose.footnote.preview')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: layout.bottomTabBarReserve,
      gap: spacing.md,
    },
    lead: { color: theme.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    input: {
      minHeight: 116,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      backgroundColor: theme.surface,
      color: theme.ink,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
    },
    spinner: { marginTop: 4 },
    proposal: { padding: spacing.md, gap: 10 },
    readEyebrow: { color: theme.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    readLine: { color: theme.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    proposalTitle: { color: theme.ink, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3, marginTop: 6 },
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
    footnote: { color: theme.faint, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  });

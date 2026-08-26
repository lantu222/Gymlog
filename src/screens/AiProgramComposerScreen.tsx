import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CutButton } from '../components/CutButton';
import { CutSurface } from '../components/CutSurface';
import { ProgrammeProposalCard } from '../components/ProgrammeProposalCard';
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
  onSave: (proposal: ProgrammeProposal) => Promise<void> | void;
  onBack: () => void;
}



export function AiProgramComposerScreen({
  language,
  preferences,
  liveConfigured,
  compose,
  onSave,
  onBack,
}: AiProgramComposerScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState<'idle' | 'composing' | 'saving'>('idle');
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
          <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1}>
            {/* The same card the chat draws. One renderer, so a week cannot
                look like two different weeks depending on where it is read. */}
            <ProgrammeProposalCard
              proposal={proposal}
              language={language}
              busy={busy === 'saving' ? 'saving' : 'idle'}
              onSave={handleSave}
              onAgain={handleCompose}
            />
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
    footnote: { color: theme.faint, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  });

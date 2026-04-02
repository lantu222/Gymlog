import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { buildValluActions } from '../lib/valluActions';
import { requestValluAdvice } from '../lib/valluClient';
import { ValluAction, ValluTrainingContext, ValluAdvice } from '../types/vallu';
import { colors, layout, radii, spacing } from '../theme';

interface AICoachScreenProps {
  initialPrompt?: string;
  suggestions?: string[];
  trainingContext: ValluTrainingContext;
  onBack: () => void;
  onSubmitPrompt: (prompt: string) => void;
  onSelectAction: (action: ValluAction, prompt: string) => void;
}

type PreviewState = 'empty' | 'loading' | 'ready' | 'error';

interface PreviewRequest {
  prompt: string;
  nonce: number;
}

export function AICoachScreen({
  initialPrompt,
  suggestions,
  trainingContext,
  onBack,
  onSubmitPrompt,
  onSelectAction,
}: AICoachScreenProps) {
  const [draft, setDraft] = useState(initialPrompt ?? '');
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const [request, setRequest] = useState<PreviewRequest | null>(
    initialPrompt?.trim() ? { prompt: initialPrompt.trim(), nonce: Date.now() } : null,
  );
  const [state, setState] = useState<PreviewState>(initialPrompt?.trim() ? 'loading' : 'empty');
  const [answer, setAnswer] = useState<ValluAdvice | null>(null);
  const [answerSource, setAnswerSource] = useState<'live' | 'preview'>('preview');
  const [statusNote, setStatusNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDraft(initialPrompt ?? '');
    if (initialPrompt?.trim()) {
      setRequest({ prompt: initialPrompt.trim(), nonce: Date.now() });
      return;
    }

    setRequest(null);
    setState('empty');
    setAnswer(null);
    setStatusNote('');
    setErrorMessage('');
  }, [initialPrompt]);

  useEffect(() => {
    if (!request?.prompt) {
      setState('empty');
      setAnswer(null);
      setStatusNote('');
      setErrorMessage('');
      return;
    }

    if (request.prompt.trim().length < 6) {
      setState('error');
      setAnswer(null);
      setErrorMessage('Ask one short question.');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setState('loading');
    setAnswer(null);
    setStatusNote('');
    setErrorMessage('');

    requestValluAdvice(
      {
        prompt: request.prompt,
        context: trainingContext,
      },
      controller.signal,
    )
      .then((result) => {
        if (cancelled) {
          return;
        }

        setAnswer(result.answer);
        setAnswerSource(result.source);
        setStatusNote(result.note ?? '');
        setState('ready');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setState('error');
        setAnswer(null);
        setErrorMessage('Try one clear question.');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [request, trainingContext]);

  const submittedPrompt = request?.prompt ?? '';
  const helperText = useMemo(
    () =>
      state === 'ready'
        ? answerSource === 'live'
          ? 'Live answer.'
          : 'Preview answer.'
        : 'Goal, lift, or split?',
    [answerSource, state],
  );
  const operationalActions = useMemo(() => {
    if (state !== 'ready' || !answer || !submittedPrompt) {
      return [];
    }

    return Array.isArray(answer.actions) && answer.actions.length > 0
      ? answer.actions
      : buildValluActions(submittedPrompt, trainingContext);
  }, [answer, state, submittedPrompt, trainingContext]);

  function submitPrompt(nextPrompt: string) {
    const trimmed = nextPrompt.trim();
    if (!trimmed) {
      return;
    }

    setRequest({ prompt: trimmed, nonce: Date.now() });
    onSubmitPrompt(trimmed);
  }

  function retryPrompt() {
    if (!submittedPrompt) {
      return;
    }

    setRequest({ prompt: submittedPrompt, nonce: Date.now() });
  }

  return (
    <>
      <ScreenHeader
        title="Vallu Beta"
        subtitle="One question. Short answers."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.askCard}>
          <View pointerEvents="none" style={styles.cardAccent} />
          <View pointerEvents="none" style={styles.cardSheen} />
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Vallu Beta</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>Preview</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>What do you need?</Text>
          <Text style={styles.heroSubtitle}>Ask one clear question.</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Bench stuck?"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.warning}
            multiline
            textAlignVertical="top"
            style={styles.input}
          />
          <View style={styles.suggestionRow}>
            {safeSuggestions.map((suggestion) => (
              <Pressable key={suggestion} onPress={() => setDraft(suggestion)} style={styles.suggestionChip}>
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => submitPrompt(draft)} style={[styles.button, !draft.trim() && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>Ask Vallu</Text>
          </Pressable>
        </View>

        {state === 'empty' ? (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionLabel}>Try one</Text>
            <Text style={styles.emptyText}>Short questions work best.</Text>
            <View style={styles.exampleBlock}>
              <Text style={styles.exampleText}>- Bench stuck?</Text>
              <Text style={styles.exampleText}>- Best 3-day plan?</Text>
              <Text style={styles.exampleText}>- Fix my split?</Text>
            </View>
          </View>
        ) : null}

        {state === 'loading' ? (
          <View style={styles.statusCard}>
            <View pointerEvents="none" style={styles.loadingAccent} />
            <ActivityIndicator color={colors.accentAlt} size="small" />
            <Text style={styles.statusTitle}>Vallu is answering.</Text>
            <Text style={styles.statusText}>{helperText}</Text>
          </View>
        ) : null}

        {state === 'error' ? (
          <View style={styles.errorCard}>
            <View pointerEvents="none" style={styles.errorAccent} />
            <Text style={styles.statusTitle}>Need one clear question.</Text>
            <Text style={styles.statusText}>{errorMessage}</Text>
            <Pressable onPress={retryPrompt} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {state === 'ready' && answer ? (
          <View style={styles.answerCard}>
            <View pointerEvents="none" style={styles.answerAccent} />
            <View pointerEvents="none" style={styles.cardSheen} />
            <View style={styles.answerTopRow}>
              <Text style={styles.sectionLabel}>Question</Text>
              <View style={[styles.sourceChip, answerSource === 'live' ? styles.sourceChipLive : styles.sourceChipPreview]}>
                <Text style={styles.sourceChipText}>{answerSource === 'live' ? 'Live' : 'Preview'}</Text>
              </View>
            </View>
            <Text style={styles.questionText}>{submittedPrompt}</Text>
            {statusNote ? <Text style={styles.noteText}>{statusNote}</Text> : null}

            <View style={styles.answerBlock}>
              <Text style={styles.answerTitle}>Answer</Text>
              <Text style={styles.answerBody}>{answer.takeaway}</Text>
            </View>

            {operationalActions.length ? (
              <View style={styles.answerBlock}>
                <Text style={styles.answerTitle}>Do this in Gymlog</Text>
                <View style={styles.actionList}>
                  {operationalActions.map((action, index) => (
                    <Pressable
                      key={`${action.kind}:${index}`}
                      onPress={() => onSelectAction(action, submittedPrompt)}
                      style={[styles.actionCard, index === 0 && styles.actionCardPrimary]}
                    >
                      <Text style={styles.actionTitle}>{action.label}</Text>
                      <Text style={styles.actionDescription}>{action.description}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.answerBlock}>
              <Text style={styles.answerTitle}>Why</Text>
              {answer.why.map((item) => (
                <Text key={item} style={styles.answerBullet}>- {item}</Text>
              ))}
            </View>

            <View style={styles.answerBlock}>
              <Text style={styles.answerTitle}>Do next</Text>
              {answer.nextSteps.map((item) => (
                <Text key={item} style={styles.answerBullet}>- {item}</Text>
              ))}
            </View>

            <View style={styles.answerBlock}>
              <Text style={styles.answerTitle}>Quick plan</Text>
              {answer.plan.map((item) => (
                <Text key={item} style={styles.answerBullet}>- {item}</Text>
              ))}
            </View>

            <View style={styles.answerBlock}>
              <Text style={styles.answerTitle}>Note</Text>
              {answer.assumptions.map((item) => (
                <Text key={item} style={styles.answerBullet}>- {item}</Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
  },
  askCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(28, 36, 46, 0.9)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  answerCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(216, 106, 134, 0.32)',
    backgroundColor: 'rgba(28, 40, 54, 0.9)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(85, 138, 189, 0.28)',
    backgroundColor: 'rgba(26, 36, 48, 0.86)',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statusCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(150, 216, 255, 0.24)',
    backgroundColor: 'rgba(25, 37, 50, 0.88)',
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  errorCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.32)',
    backgroundColor: 'rgba(38, 28, 24, 0.9)',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#F06A39',
  },
  loadingAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.accentAlt,
  },
  errorAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#F06A39',
  },
  answerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.feature,
  },
  cardSheen: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: {
    color: '#FFB389',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  betaBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(240, 106, 57, 0.12)',
  },
  betaBadgeText: {
    color: '#FFF0E7',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    color: '#E2CEC4',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  input: {
    minHeight: 112,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.22)',
    backgroundColor: 'rgba(11, 15, 20, 0.26)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionChip: {
    minHeight: 32,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216, 106, 134, 0.28)',
    backgroundColor: 'rgba(216, 106, 134, 0.14)',
  },
  suggestionChipText: {
    color: '#FFF6F9',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F06A39',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 170, 0.34)',
    shadowColor: '#F06A39',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 7,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionLabel: {
    color: '#F29AB4',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 42,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(240, 106, 57, 0.14)',
  },
  retryButtonText: {
    color: '#FFF2EA',
    fontSize: 13,
    fontWeight: '900',
  },
  answerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sourceChip: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  sourceChipLive: {
    borderColor: 'rgba(150, 216, 255, 0.34)',
    backgroundColor: 'rgba(150, 216, 255, 0.12)',
  },
  sourceChipPreview: {
    borderColor: 'rgba(240, 106, 57, 0.34)',
    backgroundColor: 'rgba(240, 106, 57, 0.12)',
  },
  sourceChipText: {
    color: '#FFF8F4',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  noteText: {
    color: '#FFD4C3',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  answerBlock: {
    gap: spacing.xs,
  },
  answerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  answerBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  answerBullet: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  actionList: {
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(11, 15, 20, 0.28)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  actionCardPrimary: {
    borderColor: 'rgba(240, 106, 57, 0.28)',
    backgroundColor: 'rgba(240, 106, 57, 0.12)',
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  actionDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  exampleBlock: {
    gap: spacing.xs,
  },
  exampleText: {
    color: '#E6EDF5',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});

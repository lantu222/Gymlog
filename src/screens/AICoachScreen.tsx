import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { BadgePill, SurfaceCard } from '../components/MainScreenPrimitives';
import { ScreenHeader } from '../components/ScreenHeader';
import { buildValluActions } from '../lib/valluActions';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { requestValluAdvice } from '../lib/valluClient';
import { ValluAction, ValluAdvice, ValluTrainingContext } from '../types/vallu';
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

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signalCard}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.signalValue}>
        {value}
      </Text>
    </View>
  );
}

function InfoList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoTitle}>{title}</Text>
      <View style={styles.infoList}>
        {items.map((item) => (
          <Text key={item} style={styles.infoItem}>
            {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

function compactItems(items: string[], maxItems = 2) {
  return items.filter(Boolean).slice(0, maxItems);
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
        setErrorMessage('Try one short question.');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [request, trainingContext]);

  const submittedPrompt = request?.prompt ?? '';
  const hasAnswer = state === 'ready' && Boolean(answer);
  const operationalActions = useMemo(() => {
    if (state !== 'ready' || !answer || !submittedPrompt) {
      return [];
    }

    return Array.isArray(answer.actions) && answer.actions.length > 0
      ? answer.actions
      : buildValluActions(submittedPrompt, trainingContext);
  }, [answer, state, submittedPrompt, trainingContext]);

  const heroVariant = useMemo(
    () =>
      getFitnessPhotoVariant({
        title: trainingContext.activeSession?.title ?? trainingContext.recommendedProgramTitle ?? submittedPrompt,
        goal: trainingContext.activeSession?.nextExercise ?? trainingContext.trackedLifts[0]?.name ?? undefined,
      }),
    [submittedPrompt, trainingContext.activeSession?.nextExercise, trainingContext.activeSession?.title, trainingContext.recommendedProgramTitle, trainingContext.trackedLifts],
  );

  const heroTokens = useMemo(() => {
    const tokens: string[] = [];

    if (trainingContext.activeSession) {
      tokens.push('Live workout');
    }

    if (trainingContext.recommendedProgramTitle) {
      tokens.push('Plan ready');
    }

    if (trainingContext.sessionsThisWeek > 0) {
      tokens.push(`${trainingContext.sessionsThisWeek} this week`);
    }

    return tokens.slice(0, 3);
  }, [trainingContext.activeSession, trainingContext.recommendedProgramTitle, trainingContext.sessionsThisWeek]);

  const promptSignals = useMemo(() => {
    const signals = [];

    if (trainingContext.activeSession) {
      signals.push({
        label: 'Workout',
        value: formatWorkoutDisplayLabel(trainingContext.activeSession.title, 'Workout'),
      });
    }

    if (trainingContext.trackedLifts[0]) {
      signals.push({
        label: 'Lift',
        value: formatLiftDisplayLabel(trainingContext.trackedLifts[0].name),
      });
    }

    if (trainingContext.recommendedProgramTitle) {
      signals.push({
        label: 'Plan',
        value: formatWorkoutDisplayLabel(trainingContext.recommendedProgramTitle, 'Plan'),
      });
    } else if (trainingContext.sessionsThisWeek > 0) {
      signals.push({
        label: 'This week',
        value: `${trainingContext.sessionsThisWeek} sessions`,
      });
    }

    return signals.slice(0, 3);
  }, [trainingContext.activeSession, trainingContext.recommendedProgramTitle, trainingContext.sessionsThisWeek, trainingContext.trackedLifts]);

  const heroMeta = trainingContext.activeSession
    ? `Live help for ${formatWorkoutDisplayLabel(trainingContext.activeSession.title, 'Workout')}`
    : 'Lift, plan, or session.';

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
      <ScreenHeader title="Ask Gymlog AI" subtitle="One question. Quick answer." onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroVariant} style={[styles.heroSurface, hasAnswer && styles.heroSurfaceCompact]}>
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroKicker}>Gymlog AI</Text>
              <BadgePill accent="neutral" label={trainingContext.activeSession ? 'Live help' : 'Quick answer'} />
            </View>

            <View style={styles.heroTokenRow}>
              {heroTokens.map((token) => (
                <BadgePill key={token} accent="neutral" label={token} />
              ))}
            </View>

            <Text style={styles.heroTitle}>Get help instantly</Text>
            <Text style={styles.heroMeta}>{heroMeta}</Text>
          </View>
        </FitnessPhotoSurface>

        <SurfaceCard accent="neutral" emphasis="standard" style={[styles.askSurface, hasAnswer && styles.askSurfaceCompact]}>
          <View style={styles.signalRow}>
            {promptSignals.map((signal) => (
              <SignalCard key={signal.label} label={signal.label} value={signal.value} />
            ))}
          </View>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask one short question"
            placeholderTextColor={colors.textMuted}
            selectionColor="#FFFFFF"
            multiline
            textAlignVertical="top"
            style={[styles.input, hasAnswer && styles.inputCompact]}
          />

          {!hasAnswer ? (
            <View style={styles.suggestionRow}>
              {safeSuggestions.slice(0, 4).map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setDraft(suggestion)} style={styles.suggestionChip}>
                  <Text style={styles.suggestionChipText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => submitPrompt(draft)} style={[styles.button, !draft.trim() && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>Get answer</Text>
          </Pressable>
        </SurfaceCard>

        {state === 'loading' ? (
          <SurfaceCard accent="neutral" emphasis="flat" style={styles.feedbackCard}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <View style={styles.feedbackCopy}>
              <Text style={styles.feedbackTitle}>Getting an answer</Text>
              <Text style={styles.feedbackBody}>
                {trainingContext.activeSession ? 'Using your live workout.' : 'Using your current plan.'}
              </Text>
            </View>
          </SurfaceCard>
        ) : null}

        {state === 'error' ? (
          <SurfaceCard accent="neutral" emphasis="flat" style={styles.feedbackCard}>
            <View style={styles.feedbackCopy}>
              <Text style={styles.feedbackTitle}>Try one short question</Text>
              <Text style={styles.feedbackBody}>{errorMessage}</Text>
            </View>
            <Pressable onPress={retryPrompt} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </SurfaceCard>
        ) : null}

        {state === 'ready' && answer ? (
          <SurfaceCard accent="neutral" emphasis="standard" style={styles.answerSurface}>
            <View style={styles.answerTopRow}>
              <SectionLabel label="Answer" />
              <BadgePill accent="neutral" label={answerSource === 'live' ? 'Live' : 'Preview'} />
            </View>

            <Text style={styles.questionText}>{submittedPrompt}</Text>
            {statusNote ? <Text style={styles.answerNote}>{statusNote}</Text> : null}
            <Text style={styles.takeawayText}>{answer.takeaway}</Text>

            {operationalActions.length ? (
              <View style={styles.actionList}>
                {operationalActions.map((action, index) => (
                  <Pressable
                    key={`${action.kind}:${index}`}
                    onPress={() => onSelectAction(action, submittedPrompt)}
                    style={[styles.actionCard, index === 0 && styles.actionCardPrimary]}
                  >
                    <Text style={[styles.actionTitle, index === 0 && styles.actionTitlePrimary]}>{action.label}</Text>
                    <Text style={[styles.actionDescription, index === 0 && styles.actionDescriptionPrimary]}>
                      {action.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <InfoList title="Why it fits" items={compactItems(answer.why)} />
            <InfoList title="Do next" items={compactItems(answer.nextSteps)} />
            <InfoList title="Quick plan" items={compactItems(answer.plan)} />

            {answer.assumptions.length > 0 ? (
              <Text style={styles.assumptionText}>
                Assumes {compactItems(answer.assumptions).join(' | ')}
              </Text>
            ) : null}
          </SurfaceCard>
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
  heroSurface: {
    minHeight: 220,
  },
  heroSurfaceCompact: {
    minHeight: 188,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  askSurface: {
    gap: spacing.md,
  },
  askSurfaceCompact: {
    gap: spacing.sm,
  },
  signalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signalCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 10, 14, 0.36)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  signalLabel: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  input: {
    minHeight: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 10, 14, 0.42)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  inputCompact: {
    minHeight: 84,
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  suggestionChipText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#0B0F14',
    fontSize: 15,
    fontWeight: '900',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  feedbackCopy: {
    flex: 1,
    gap: 2,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  feedbackBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 42,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  retryButtonText: {
    color: '#0B0F14',
    fontSize: 13,
    fontWeight: '900',
  },
  answerSurface: {
    gap: spacing.md,
  },
  answerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  answerNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  takeawayText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  actionList: {
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 10, 14, 0.36)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  actionCardPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  actionTitlePrimary: {
    color: '#0B0F14',
  },
  actionDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionDescriptionPrimary: {
    color: 'rgba(11,15,20,0.72)',
  },
  infoBlock: {
    gap: spacing.xs,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  infoList: {
    gap: spacing.xs,
  },
  infoItem: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  assumptionText: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});

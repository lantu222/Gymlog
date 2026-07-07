import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import { buildAiCoachActions } from '../lib/aiCoachActions';
import { formatLiftDisplayLabel, formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { AICoachAction, AICoachAdvice, AICoachTrainingContext } from '../types/aiCoach';
import { HG } from '../lightTheme';
import { layout, radii, spacing } from '../theme';

interface AICoachScreenProps {
  initialPrompt?: string;
  suggestions?: string[];
  trainingContext: AICoachTrainingContext;
  onBack: () => void;
  onSubmitPrompt: (prompt: string) => void;
  onSelectAction: (action: AICoachAction, prompt: string) => void;
}

type PreviewState = 'empty' | 'loading' | 'ready' | 'error';

interface PreviewRequest {
  prompt: string;
  nonce: number;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function HeroPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function SourceBadge({ label }: { label: string }) {
  return (
    <View style={styles.sourceBadge}>
      <Text style={styles.sourceBadgeText}>{label}</Text>
    </View>
  );
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
  const [answer, setAnswer] = useState<AICoachAdvice | null>(null);
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
      setErrorMessage('Ask about the saved plan.');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setState('loading');
    setAnswer(null);
    setStatusNote('');
    setErrorMessage('');

    requestAiCoachAdvice(
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
      : buildAiCoachActions(submittedPrompt, trainingContext);
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
      tokens.push('Workout active');
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

  const heroMeta = 'Uses saved training context only.';

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
      <ScreenHeader title="GAINER AI" subtitle="Preview guidance. Not for live workout decisions." tone="dark" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FitnessPhotoSurface variant={heroVariant} style={[styles.heroSurface, hasAnswer && styles.heroSurfaceCompact]}>
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroKicker}>GAINER AI</Text>
              <HeroPill label="Preview" />
            </View>

            <View style={styles.heroTokenRow}>
              {heroTokens.map((token) => (
                <HeroPill key={token} label={token} />
              ))}
            </View>

            <Text style={styles.heroTitle}>Review your plan</Text>
            <Text style={styles.heroMeta}>{heroMeta}</Text>
          </View>
        </FitnessPhotoSurface>

        <View style={[styles.askSurface, hasAnswer && styles.askSurfaceCompact]}>
          <View style={styles.signalRow}>
            {promptSignals.map((signal) => (
              <SignalCard key={signal.label} label={signal.label} value={signal.value} />
            ))}
          </View>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your saved plan"
            placeholderTextColor={HG.faint}
            selectionColor={HG.purple}
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
            <Text style={styles.buttonText}>Review</Text>
          </Pressable>
        </View>

        {state === 'loading' ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator color={HG.purple} size="small" />
            <View style={styles.feedbackCopy}>
              <Text style={styles.feedbackTitle}>Getting an answer</Text>
              <Text style={styles.feedbackBody}>
                Using saved plan and training history.
              </Text>
            </View>
          </View>
        ) : null}

        {state === 'error' ? (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackCopy}>
              <Text style={styles.feedbackTitle}>Try a saved-plan question</Text>
              <Text style={styles.feedbackBody}>{errorMessage}</Text>
            </View>
            <Pressable onPress={retryPrompt} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {state === 'ready' && answer ? (
          <View style={styles.answerSurface}>
            <View style={styles.answerTopRow}>
              <SectionLabel label="Answer" />
              <SourceBadge label={answerSource === 'live' ? 'Live' : 'Preview'} />
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
    color: 'rgba(255,255,255,0.72)',
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
  heroPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sourceBadge: {
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: HG.purpleLight,
  },
  sourceBadgeText: {
    color: HG.purpleDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
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
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  signalLabel: {
    color: HG.faint,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  signalValue: {
    color: HG.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  input: {
    minHeight: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: HG.ink,
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
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
  },
  suggestionChipText: {
    color: HG.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.purple,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.md,
  },
  feedbackCopy: {
    flex: 1,
    gap: 2,
  },
  feedbackTitle: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  feedbackBody: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  retryButton: {
    minHeight: 42,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HG.purple,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  answerSurface: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  answerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionLabel: {
    color: HG.faint,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    color: HG.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  answerNote: {
    color: HG.faint,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  takeawayText: {
    color: HG.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  actionList: {
    gap: spacing.sm,
  },
  actionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  actionCardPrimary: {
    backgroundColor: HG.purple,
    borderColor: HG.purple,
  },
  actionTitle: {
    color: HG.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  actionTitlePrimary: {
    color: '#FFFFFF',
  },
  actionDescription: {
    color: HG.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionDescriptionPrimary: {
    color: 'rgba(255,255,255,0.82)',
  },
  infoBlock: {
    gap: spacing.xs,
  },
  infoTitle: {
    color: HG.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  infoList: {
    gap: spacing.xs,
  },
  infoItem: {
    color: HG.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  assumptionText: {
    color: HG.faint,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});

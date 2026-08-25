import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CoachReadoutTicker } from '../components/CoachReadoutTicker';
import { ProLockedCard } from '../components/ProLockedCard';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { buildAiCoachPreviewAnswer } from '../lib/aiCoachPreview';
import { FREE_COACH_QUESTIONS_PER_WEEK } from '../lib/aiCoachQuota';
import { CoachChatIntroInput, CoachContextChip, buildCoachContextChips, buildCoachContextReadout, buildCoachNoticed, buildCoachOpeningLine, buildCoachOpeningOffer, buildCoachOpeningRows } from '../lib/coachChat';
import { coachSmallTalkReplyKey, parseCoachSmallTalk } from '../lib/coachSmallTalk';
import { appendCoachTurn } from '../lib/coachConversation';
import { CoachSuggestionKind } from '../lib/coachSuggestions';
import { MEASUREMENT_LABEL_KEYS } from '../lib/homeStatCards';
import { I18nKey, t } from '../lib/i18n';
import { MeasurementIntent, isMeasurementIntentKind, parseMeasurementIntent } from '../lib/measurementIntent';
import { GoalIntent, parseGoalIntent } from '../lib/goalIntent';
import { AI_COACH_DEBUG_TRANSCRIPTS } from '../lib/aiCoachDebug';
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { layout, spacing } from '../theme';
import { AICoachAdvice, AICoachConversationTurn, AICoachTrainingContext } from '../types/aiCoach';
import { AppLanguage } from '../types/models';

/**
 * The AI tab (design: Vinha AI Tab).
 *
 * The middle button used to open a paywall-shaped sheet: the app's most
 * valuable placement spent on an advert, which teaches a user to stop pressing
 * it. The design's rule is the opposite and this screen implements it — THE
 * DOOR IS ALWAYS OPEN. Free users get the same chat, the same data and full
 * answers; the quota runs out, not the quality. Pro adds initiative: the coach
 * speaks first with what it noticed.
 *
 * The opening state (context strip, first line, the noticed card) is entirely
 * deterministic — see coachChat.ts. It costs nothing and it proves the coach
 * read the log before the user typed anything.
 */
interface AICoachChatScreenProps {
  language?: AppLanguage;
  proUnlocked: boolean;
  /**
   * Online mode: questions leave the device. The privacy policy promises the
   * reader is told in the app before that happens, so while this is true
   * and the notice is unacknowledged, the chat shows the disclosure and
   * sends nothing.
   */
  liveConfigured: boolean;
  onlineNoticeAcknowledged: boolean;
  onAcknowledgeOnlineNotice: () => void;
  freeQuestionsRemaining: number;
  onFreeQuestionUsed: () => void;
  trainingContext: AICoachTrainingContext;
  intro: CoachChatIntroInput;
  /** Total logged sessions, for the header line and the evidence footer. */
  sessionCount: number;
  quickAskKeys: I18nKey[];
  /**
   * The most recent session, for the written-analysis entry. That entry used
   * to live only in the coach sheet this screen replaces, and the Pro page's
   * table promises it — so it moves here rather than disappearing.
   */
  lastSession: { id: string; name: string } | null;
  onOpenAnalysis: (sessionId: string) => void;
  onOpenPremium: () => void;
  /**
   * "Rinnanympärys on 90 cm" typed into the chat is a reading to log, not a
   * question (user, 2026-08-23). The chat offers to log it — one tap — and,
   * if that measurement has no card on Home yet, offers the card once.
   * Nothing is written without the tap.
   */
  pinnedStatCardKeys: string[];
  onLogMeasurement: (intent: MeasurementIntent) => Promise<void>;
  onPinStatCard: (key: string) => void;
  /** "Yritän kasvattaa rinnanympärystä" stated in chat becomes a saved goal — offered, never assumed. */
  onSetGoal: (intent: GoalIntent) => Promise<void>;
  /**
   * How a coach-proposed offer ended. A refusal buys a month of silence and a
   * second one ends that kind of offer for good, so it has to be recorded
   * whichever way the reader answered.
   */
  onCoachSuggestionResolved: (kind: CoachSuggestionKind, accepted: boolean) => void;
  /** Whether the morning weigh-in nudge is already on, so it is never offered twice. */
  weighInReminderEnabled: boolean;
  onEnableWeighInReminder: () => void;
  /** Opens the measures page on one measurement, so a question can be answered with a tap. */
  onOpenMeasure: (kind: string) => void;
  /** TEMPORARY: the signed-in email, attached to the development transcript log. */
  transcriptReporter: string | null;
}

interface ChatMessage {
  id: string;
  fromCoach: boolean;
  text: string;
  /** The coach's structured answer, rendered as sections rather than prose. */
  advice?: AICoachAdvice;
  /** An offer with buttons: log the reading, put its card on Home, or save the stated goal. */
  offer?:
    | { type: 'log'; intent: MeasurementIntent }
    // Only the kind is ever read, and a coach-proposed card has no reading
    // behind it — asking for a value here would mean inventing one.
    | { type: 'pin'; intent: Pick<MeasurementIntent, 'kind'> }
    | { type: 'goal'; intent: GoalIntent }
    // Nothing to carry: the offer is the switch itself.
    | { type: 'weighIn' }
    // Opens the page that records this measurement. The coach cannot log one
    // itself — the reading is the thing it does not have.
    | { type: 'openMeasure'; intent: Pick<MeasurementIntent, 'kind'> };
  /**
   * Set when the coach proposed this rather than the typed message. Only those
   * count towards the cooldown: it exists to stop the coach nagging.
   */
  suggestionKind?: CoachSuggestionKind;
  evidence?: string;
  /** Set when the answer is withheld: the real conclusion, blurred. */
  lockedBody?: string;
}

/** Width of the soft light behind the dark thread's header. */
const TOP_LIGHT = 460;

function SparkGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={color} />
    </Svg>
  );
}

export function AICoachChatScreen({
  language = 'en',
  proUnlocked,
  liveConfigured,
  onlineNoticeAcknowledged,
  onAcknowledgeOnlineNotice,
  freeQuestionsRemaining,
  onFreeQuestionUsed,
  trainingContext,
  intro,
  sessionCount,
  quickAskKeys,
  lastSession,
  onOpenAnalysis,
  onOpenPremium,
  pinnedStatCardKeys,
  onLogMeasurement,
  onPinStatCard,
  onSetGoal,
  onCoachSuggestionResolved,
  weighInReminderEnabled,
  onEnableWeighInReminder,
  onOpenMeasure,
  transcriptReporter,
}: AICoachChatScreenProps) {
  const theme = useTheme();
  const themeName = useThemeName();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const askToken = useRef(0);
  /**
   * The open conversation, in a ref rather than state: `send` must read the
   * exchanges as they are at the moment of sending, and a state value captured
   * in its dependency list would be one turn behind.
   */
  const conversation = useRef<AICoachConversationTurn[]>([]);

  const chips = useMemo(() => buildCoachContextChips(intro, language), [intro, language]);
  // Shown until the first question. It is the reader's own log, which is both
  // the honest way to fill the screen and the claim Pro is sold on.
  const readout = useMemo(
    () => buildCoachContextReadout(trainingContext, language),
    [language, trainingContext, transcriptReporter],
  );
  const noticed = useMemo(
    () => (proUnlocked ? buildCoachNoticed(intro.weeklyRead, language) : []),
    [intro.weeklyRead, language, proUnlocked],
  );
  const openingLine = useMemo(() => buildCoachOpeningLine(intro, language), [intro, language]);
  // Today's line, what the coach noticed, and the readout — one rotating
  // stage instead of three stacked surfaces (user, 2026-08-23).
  const openingRows = useMemo(
    () =>
      buildCoachOpeningRows({
        openingLine,
        offer: buildCoachOpeningOffer(intro, language),
        noticed,
        readout,
        language,
      }),
    [intro, language, noticed, openingLine, readout],
  );
  const showReadout = messages.length === 0 && openingRows.length > 0;

  /**
   * What the coach has read, and what today is — one line.
   *
   * These used to be three surfaces: a subtitle, a strip of context chips, and
   * an evidence footnote under every answer. They are the same fact told three
   * times, and stacking them is what made the screen feel like a form.
   */
  const contextLine = useMemo(() => {
    const read =
      sessionCount > 0
        ? t(language, 'coachChat.subtitle', { count: sessionCount })
        : t(language, 'coachChat.subtitleFresh');
    const today = chips[0]?.label;
    return today ? `${read} · ${today}` : read;
  }, [chips, language, sessionCount]);

  const canAsk = proUnlocked || freeQuestionsRemaining > 0;
  const used = FREE_COACH_QUESTIONS_PER_WEEK - Math.max(0, freeQuestionsRemaining);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToEnd();
    }
  }, [messages.length, scrollToEnd]);

  const mustAcknowledgeOnline = liveConfigured && !onlineNoticeAcknowledged;

  const measurementLabel = useCallback(
    (intent: Pick<MeasurementIntent, 'kind'>) =>
      intent.kind === 'bodyweight' ? t(language, 'cards.bodyweight') : t(language, MEASUREMENT_LABEL_KEYS[intent.kind]),
    [language],
  );
  const formatReading = useCallback(
    (intent: MeasurementIntent | { kind: MeasurementIntent['kind']; value: number; unit: string }) =>
      `${measurementLabel(intent)} ${String(intent.value).replace('.', language === 'fi' ? ',' : '.')} ${intent.unit}`,
    [language, measurementLabel],
  );

  const resolveOffer = useCallback(
    async (
      messageId: string,
      offer: NonNullable<ChatMessage['offer']>,
      accepted: boolean,
      suggestionKind?: CoachSuggestionKind,
    ) => {
      // Both answers are answers. Recording only the acceptances would leave
      // the refusal invisible and the same offer would come back next week.
      if (suggestionKind) {
        onCoachSuggestionResolved(suggestionKind, accepted);
      }
      if (!accepted) {
        setMessages((current) => current.filter((message) => message.id !== messageId));
        return;
      }
      if (offer.type === 'openMeasure') {
        onOpenMeasure(offer.intent.kind);
        setMessages((current) => current.filter((message) => message.id !== messageId));
        return;
      }
      if (offer.type === 'weighIn') {
        onEnableWeighInReminder();
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { id: `${messageId}:done`, fromCoach: true, text: t(language, 'coachChat.weighIn.done') }
              : message,
          ),
        );
        return;
      }
      if (offer.type === 'goal') {
        await onSetGoal(offer.intent);
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { id: `${messageId}:done`, fromCoach: true, text: t(language, 'coachChat.goal.done') }
              : message,
          ),
        );
        return;
      }
      if (offer.type === 'log') {
        await onLogMeasurement(offer.intent);
        const pinned = pinnedStatCardKeys.includes(offer.intent.kind);
        setMessages((current) =>
          current.flatMap((message) =>
            message.id === messageId
              ? [
                  { id: `${messageId}:done`, fromCoach: true, text: t(language, 'coachChat.measure.logged', { reading: formatReading(offer.intent) }) },
                  // The card offer follows only when Home does not have it — a
                  // pinned card offered again would be the sign explaining a sign.
                  ...(pinned ? [] : [{ id: `${messageId}:pin`, fromCoach: true, text: '', offer: { type: 'pin' as const, intent: offer.intent } }]),
                ]
              : [message],
          ),
        );
        return;
      }
      onPinStatCard(offer.intent.kind);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { id: `${messageId}:done`, fromCoach: true, text: t(language, 'coachChat.measure.pinned', { label: measurementLabel(offer.intent) }) }
            : message,
        ),
      );
    },
    [
      formatReading,
      language,
      measurementLabel,
      onCoachSuggestionResolved,
      onEnableWeighInReminder,
      onLogMeasurement,
      onOpenMeasure,
      onPinStatCard,
      onSetGoal,
      pinnedStatCardKeys,
    ],
  );

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || asking || mustAcknowledgeOnline) {
        // Nothing leaves the device until the online disclosure is answered.
        return;
      }

      const token = (askToken.current += 1);
      setDraft('');

      // "Kiitos" is answered here. It never reaches the network, so it costs
      // nothing and cannot come back as an analysis with a four-week plan
      // attached (transcript review, 2026-08-23). Checked before the quota
      // gate on purpose: being out of questions must not stop the coach from
      // saying you are welcome.
      const smallTalk = parseCoachSmallTalk(trimmed);
      if (smallTalk) {
        setMessages((current) => [
          ...current,
          { id: `me:${token}`, fromCoach: false, text: trimmed },
          {
            id: `coach:${token}`,
            fromCoach: true,
            text: t(language, coachSmallTalkReplyKey(smallTalk, current.length)),
          },
        ]);
        return;
      }

      const measurement = parseMeasurementIntent(trimmed, language);
      const goal = measurement ? null : parseGoalIntent(trimmed, language);
      setMessages((current) => [
        ...current,
        { id: `me:${token}`, fromCoach: false, text: trimmed },
        ...(measurement
          ? [{ id: `offer:${token}`, fromCoach: true, text: '', offer: { type: 'log' as const, intent: measurement } }]
          : []),
        ...(goal
          ? [{ id: `offer:${token}`, fromCoach: true, text: '', offer: { type: 'goal' as const, intent: goal } }]
          : []),
      ]);

      // Out of quota: the question still lands, and the answer that exists is
      // shown blurred rather than refused. The door stays open (design rule);
      // what is withheld is the conclusion, not the conversation.
      //
      // The blurred text is the REAL answer — the offline coach is
      // deterministic and costs nothing, so withholding it is a choice about
      // access, not about having something to say. Blurring a placeholder
      // instead would make the lock a bluff.
      if (!canAsk) {
        const withheld = buildAiCoachPreviewAnswer(trimmed, trainingContext, language);
        setMessages((current) => [
          ...current,
          {
            id: `locked:${token}`,
            fromCoach: true,
            text: '',
            // Two real sentences, joined into one paragraph — unlike the pro
            // insights, these were never a single sentence cut in half.
            lockedBody: [withheld.takeaway, withheld.nextSteps[0] ?? withheld.why[0] ?? '']
              .filter(Boolean)
              .join(' '),
          },
        ]);
        return;
      }

      setAsking(true);
      try {
        const result = await requestAiCoachAdvice({
          prompt: trimmed,
          context: trainingContext,
          language,
          // What was already said in this thread, so a follow-up resolves.
          history: conversation.current,
          ...(AI_COACH_DEBUG_TRANSCRIPTS && transcriptReporter ? { reporter: transcriptReporter } : {}),
        });
        if (token !== askToken.current) {
          return;
        }
        const answer = result.answer;
        // The endpoint answers with a canned offline reply when it cannot
        // reach the model — rate limited, upstream down, key missing. Until
        // now the chat showed that as if the coach had said it, which is how
        // "the AI chat does not work" looks from the reader's side: a real
        // answer, just a useless one. Say which it was.
        const fellBackToPreview = liveConfigured && result.source === 'preview';
        // Charged for an answer, not for a send. An answer that could only ask
        // for a clearer question is free: three a week is too few to spend one
        // on a chip the app itself offered and could not handle.
        if (!proUnlocked && !answer.unanswered) {
          onFreeQuestionUsed();
        }
        // Kept even when the answer was a follow-up question: without it the
        // reader's reply to that question would arrive with no antecedent,
        // which is the exact failure this exists to fix.
        conversation.current = appendCoachTurn(conversation.current, {
          question: trimmed,
          takeaway: answer.takeaway,
        });
        // The whole answer, as sections: a takeaway, then the reasons, the
        // steps and the plan each on their own lines. One run-on paragraph
        // buried the dates and numbers (#bugs, 2026-08-23).
        const reply = answer.takeaway;
        // The coach's own offer, turned into a button — but only one it can
        // actually carry out. A pin needs a measurement the app knows; a goal
        // is read with the same parser the typed path uses, and an offer that
        // will not parse is dropped rather than shown as a dead button.
        const suggestion = answer.suggestion ?? null;
        const suggestedOffer: ChatMessage | null = (() => {
          if (!suggestion) {
            return null;
          }
          if (suggestion.kind === 'log_measurement') {
            const kind = suggestion.statKey ?? '';
            // Never offered for something already measured: the point is the
            // reading the record does not have.
            const measured = (trainingContext.body?.measurements ?? []).some((entry) => entry.kind === kind);
            if (!isMeasurementIntentKind(kind) || measured) {
              return null;
            }
            return {
              id: `suggest:${token}`,
              fromCoach: true,
              text: '',
              offer: { type: 'openMeasure' as const, intent: { kind } },
              suggestionKind: 'log_measurement' as const,
            };
          }
          if (suggestion.kind === 'weigh_in_reminder') {
            return weighInReminderEnabled
              ? null
              : {
                  id: `suggest:${token}`,
                  fromCoach: true,
                  text: '',
                  offer: { type: 'weighIn' as const },
                  suggestionKind: 'weigh_in_reminder' as const,
                };
          }
          if (suggestion.kind === 'pin_stat_card') {
            const kind = suggestion.statKey ?? '';
            if (!isMeasurementIntentKind(kind) || pinnedStatCardKeys.includes(kind)) {
              return null;
            }
            return {
              id: `suggest:${token}`,
              fromCoach: true,
              text: '',
              offer: { type: 'pin' as const, intent: { kind } },
              suggestionKind: 'pin_stat_card' as const,
            };
          }
          const intent = suggestion.goalText ? parseGoalIntent(suggestion.goalText, language) : null;
          if (!intent) {
            return null;
          }
          return {
            id: `suggest:${token}`,
            fromCoach: true,
            text: '',
            offer: { type: 'goal' as const, intent },
            suggestionKind: 'set_goal' as const,
          };
        })();
        setMessages((current) => [
          ...current,
          {
            id: `coach:${token}`,
            fromCoach: true,
            text: reply || answer.takeaway,
            advice: answer,
            ...(fellBackToPreview ? { evidence: t(language, 'coachChat.offlineAnswer') } : {}),
          },
          ...(suggestedOffer ? [suggestedOffer] : []),
        ]);
      } catch {
        if (token !== askToken.current) {
          return;
        }
        // An upstream failure still knocked: the call was made and it costs.
        if (!proUnlocked) {
          onFreeQuestionUsed();
        }
        setMessages((current) => [
          ...current,
          { id: `coach:${token}`, fromCoach: true, text: t(language, 'coach.error') },
        ]);
      } finally {
        if (token === askToken.current) {
          setAsking(false);
        }
      }
    },
    [
      asking,
      canAsk,
      language,
      mustAcknowledgeOnline,
      onFreeQuestionUsed,
      pinnedStatCardKeys,
      proUnlocked,
      sessionCount,
      trainingContext,
      weighInReminderEnabled,
    ],
  );

  return (
    <View style={styles.screen}>
      {/* A soft light at the top so the dark field is not flat. Light already
          has its own depth from the surfaces, so it does not need one. */}
      {themeName === 'dark' ? (
        <Svg pointerEvents="none" style={styles.topLight} width={TOP_LIGHT} height={TOP_LIGHT * 0.72}>
          <Defs>
            <RadialGradient id="coachTopLight" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#8B5CF6" stopOpacity={0.34} />
              <Stop offset="1" stopColor="#8B5CF6" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={TOP_LIGHT} height={TOP_LIGHT * 0.72} fill="url(#coachTopLight)" />
        </Svg>
      ) : null}
      <View style={styles.header}>
        <View style={styles.headerTile}>
          <SparkGlyph color={theme.purple} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{t(language, 'coachChat.title')}</Text>
          {/* One line, not a subtitle plus a strip of chips plus a footnote.
              What the coach has read and what today is are the same fact. */}
          <Text style={styles.headerSub} numberOfLines={2}>
            {contextLine}
          </Text>
        </View>
      </View>

      {/* 'padding' on Android too. The manifest's adjustResize used to lift the
          composer above the keyboard; with RN 0.83's mandatory edge-to-edge it
          no longer does, and the keyboard covered the thread and the field
          (#bugs, 2026-08-23: 'hard to see what you are typing'). */}
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.body}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
        >
          {mustAcknowledgeOnline ? (
            <View style={styles.onlineCard}>
              <Text style={styles.onlineTitle}>{t(language, 'coachChat.online.title')}</Text>
              <Text style={styles.onlineBody}>{t(language, 'coachChat.online.body')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onAcknowledgeOnlineNotice}
                style={({ pressed }) => [styles.onlineButton, pressed && styles.pressed]}
              >
                <Text style={styles.onlineButtonText}>{t(language, 'coachChat.online.ok')}</Text>
              </Pressable>
            </View>
          ) : null}

          {showReadout ? (
            <CoachReadoutTicker
              rows={openingRows}
              askLabel={t(language, 'coachChat.noticedAsk')}
              onAsk={(question) => void send(question)}
            />
          ) : null}

          {/* The written analysis is Pro (the Pro page's table says so), so a
              free user gets the link and the reason, not a dead end. It is a
              link rather than a card: one sentence does not need a surface. */}
          {lastSession ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => (proUnlocked ? onOpenAnalysis(lastSession.id) : onOpenPremium())}
              style={({ pressed }) => [styles.analysisLink, pressed && styles.pressed]}
            >
              <Text style={styles.analysisCta}>
                {t(language, proUnlocked ? 'coach.seeFullAnalysis' : 'coach.analysisLocked')}
              </Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12h13M12 6l6 6-6 6"
                  stroke={theme.highlight}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ) : null}

          {messages.map((message) =>
            message.offer ? (
              <View key={message.id} style={styles.bubbleRow}>
                <View style={[styles.coachBubble, styles.offerBubble]}>
                  <Text style={styles.coachText}>
                    {message.offer.type === 'openMeasure'
                      ? t(language, 'coachChat.measure.firstOffer', {
                          label: measurementLabel(message.offer.intent),
                        })
                      : message.offer.type === 'weighIn'
                        ? t(language, 'coachChat.weighIn.offer')
                      : message.offer.type === 'goal'
                      ? t(language, 'coachChat.goal.offer', { text: message.offer.intent.text })
                      : message.offer.type === 'log'
                        ? t(language, 'coachChat.measure.offer', { reading: formatReading(message.offer.intent) })
                        : t(language, 'coachChat.measure.pinOffer', { label: measurementLabel(message.offer.intent) })}
                  </Text>
                  <View style={styles.offerActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void resolveOffer(
                          message.id,
                          message.offer as NonNullable<ChatMessage['offer']>,
                          false,
                          message.suggestionKind,
                        )
                      }
                      style={({ pressed }) => [styles.offerGhost, pressed && styles.pressed]}
                    >
                      <Text style={styles.offerGhostText}>{t(language, 'coachChat.measure.skip')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void resolveOffer(
                          message.id,
                          message.offer as NonNullable<ChatMessage['offer']>,
                          true,
                          message.suggestionKind,
                        )
                      }
                      style={({ pressed }) => [styles.offerCta, pressed && styles.pressed]}
                    >
                      <Text style={styles.offerCtaText}>
                        {t(
                          language,
                          message.offer.type === 'openMeasure'
                            ? 'coachChat.measure.open'
                            : message.offer.type === 'weighIn'
                              ? 'coachChat.weighIn.on'
                            : message.offer.type === 'goal'
                              ? 'coachChat.goal.set'
                              : message.offer.type === 'log'
                                ? 'coachChat.measure.log'
                                : 'coachChat.measure.pin',
                        )}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : message.lockedBody ? (
              <View key={message.id} style={styles.lockWrap}>
                <ProLockedCard
                  language={language}
                  teaser={t(language, 'coachChat.locked.teaser')}
                  body={message.lockedBody}
                  cta={t(language, 'coachChat.locked.cta')}
                  onPress={onOpenPremium}
                />
              </View>
            ) : (
              <View
                key={message.id}
                style={[styles.bubbleRow, !message.fromCoach && styles.bubbleRowMe]}
              >
                <View style={message.fromCoach ? styles.coachBubble : styles.meBubble}>
                  <Text style={message.fromCoach ? styles.coachText : styles.meText}>{message.text}</Text>
                  {message.advice
                    ? (
                        [
                          { key: 'why', label: 'coachChat.section.why' as const, lines: message.advice.why, mark: (_i: number) => '\u2022' },
                          { key: 'next', label: 'coachChat.section.next' as const, lines: message.advice.nextSteps, mark: (i: number) => `${i + 1}.` },
                          { key: 'plan', label: 'coachChat.section.plan' as const, lines: message.advice.plan, mark: (_i: number) => '\u2192' },
                        ] as const
                      )
                        .filter((sectionDef) => sectionDef.lines.length > 0)
                        .map((sectionDef) => (
                          <View key={sectionDef.key} style={styles.answerSection}>
                            <Text style={styles.answerSectionLabel}>{t(language, sectionDef.label)}</Text>
                            {sectionDef.lines.map((lineText, index) => (
                              <View key={`${sectionDef.key}-${index}`} style={styles.answerLine}>
                                <Text style={styles.answerMark}>{sectionDef.mark(index)}</Text>
                                <Text style={styles.answerLineText}>{lineText}</Text>
                              </View>
                            ))}
                          </View>
                        ))
                    : null}
                  {message.evidence ? <Text style={styles.evidence}>{message.evidence}</Text> : null}
                </View>
              </View>
            ),
          )}

          {asking ? (
            <View style={styles.bubbleRow}>
              <View style={[styles.coachBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={theme.purple} />
                <Text style={styles.thinkingText}>{t(language, 'coachChat.thinking')}</Text>
              </View>
            </View>
          ) : null}

          {!proUnlocked && freeQuestionsRemaining > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenPremium}
              style={({ pressed }) => [styles.quotaRow, pressed && styles.pressed]}
            >
              <Text style={styles.quotaText}>
                {freeQuestionsRemaining === 1
                  ? t(language, 'coachChat.quotaLeftOne')
                  : t(language, 'coachChat.quotaLeft', { count: freeQuestionsRemaining })}
              </Text>
              <Text style={styles.quotaCta}>{t(language, 'coachChat.quotaUnlimited')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.quickAsksRail}
          contentContainerStyle={styles.quickAsks}
        >
          {quickAskKeys.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => void send(t(language, key))}
              style={({ pressed }) => [styles.quickAsk, pressed && styles.pressed]}
            >
              <Text style={styles.quickAskText}>{t(language, key)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!canAsk ? (
          <Text style={styles.resetNote}>{t(language, 'coachChat.quotaReset')}</Text>
        ) : null}

        <View style={styles.composerWrap}>
          <View style={[styles.composer, !canAsk && styles.composerSpent]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t(language, canAsk ? 'coachChat.placeholder' : 'coachChat.placeholderSpent')}
              placeholderTextColor={theme.faint}
              selectionColor={theme.highlight}
              style={styles.input}
              onSubmitEditing={() => void send(draft)}
              returnKeyType="send"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'coach.send')}
              onPress={() => void send(draft)}
              style={({ pressed }) => [styles.sendButton, !canAsk && styles.sendButtonSpent, pressed && styles.pressed]}
            >
              {canAsk ? (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12h14M13 6l6 6-6 6" stroke={theme.onHighlight} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3" stroke={theme.onHighlight} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  headerTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.ink,
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.muted,
    marginTop: 1,
  },
  // A gradient, not a disc: a flat circle with a radius is a shape, and it
  // reads as one. Sized in pixels because a %-sized Svg does not stretch on
  // Android (the trap the unlock screen paid for).
  topLight: {
    position: 'absolute',
    top: -TOP_LIGHT * 0.34,
    left: -TOP_LIGHT * 0.18,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  // Bottom-anchored: a half-empty thread starting at the top leaves a dead
  // middle, and the first thing you read should sit where the next one will.
  thread: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 20,
  },
  onlineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSoft,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  onlineTitle: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  onlineBody: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  onlineButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.highlight,
  },
  onlineButtonText: {
    color: theme.onHighlight,
    fontSize: 13.5,
    fontWeight: '800',
  },
  offerBubble: {
    gap: 10,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  offerGhost: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  offerGhostText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  offerCta: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.highlight,
  },
  offerCtaText: {
    color: theme.onHighlight,
    fontSize: 13,
    fontWeight: '800',
  },
  answerSection: {
    marginTop: 10,
    gap: 4,
  },
  answerSectionLabel: {
    color: theme.faint,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  answerLine: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  answerMark: {
    color: theme.highlight,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    minWidth: 16,
  },
  answerLineText: {
    flex: 1,
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  // The coach gets no bubble at all: it is the voice of the screen, not a
  // participant in it. Only the user's own words are enclosed.
  coachBubble: {
    maxWidth: '96%',
  },
  meBubble: {
    maxWidth: '82%',
    backgroundColor: theme.purple,
    borderRadius: 20,
    borderBottomRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  coachText: {
    fontSize: 16.5,
    fontWeight: '500',
    letterSpacing: -0.15,
    color: theme.ink,
    lineHeight: 25.5,
  },
  meText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22.5,
  },
  evidence: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.muted,
  },
  lockWrap: {
    marginTop: 2,
  },
  // A link, not a card: the row title only repeated the session name that the
  // context line already carries.
  analysisLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  analysisCta: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.highlight,
    marginTop: 4,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: theme.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  quotaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: theme.muted,
  },
  quotaCta: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.purple,
  },
  quickAsksRail: {
    flexGrow: 0,
    flexShrink: 0,
  },
  quickAsks: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  // A surface, not a tint: purpleLight sits within a few points of the light
  // background, which left the chips reading as floating text.
  quickAsk: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  quickAskText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.highlight,
  },
  resetNote: {
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.faint,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  composerWrap: {
    paddingHorizontal: 20,
    // The floating bar is 88 tall; the reserve added another 32 on top, which
    // is why the field sat well above it with dead space underneath.
    paddingBottom: layout.bottomTabBarHeight + spacing.sm,
  },
  composer: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 15,
    paddingLeft: 15,
    paddingRight: 6,
  },
  composerSpent: {
    backgroundColor: theme.surfaceSoft,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.ink,
    padding: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonSpent: {
    backgroundColor: theme.faint,
  },
  pressed: {
    opacity: 0.85,
  },
});

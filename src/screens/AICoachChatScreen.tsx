import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ProLockedCard } from '../components/ProLockedCard';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { buildAiCoachPreviewAnswer } from '../lib/aiCoachPreview';
import { FREE_COACH_QUESTIONS_PER_WEEK } from '../lib/aiCoachQuota';
import {
  CoachChatIntroInput,
  CoachContextChip,
  CoachNoticedItem,
  buildCoachContextChips,
  buildCoachNoticed,
  buildCoachOpeningLine,
} from '../lib/coachChat';
import { I18nKey, t } from '../lib/i18n';
import { HG, PW } from '../lightTheme';
import { layout } from '../theme';
import { AICoachTrainingContext } from '../types/aiCoach';
import { AppLanguage } from '../types/models';

/**
 * The AI tab (design: GAINER AI Tab).
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
}

interface ChatMessage {
  id: string;
  fromCoach: boolean;
  text: string;
  evidence?: string;
  /** Set when the answer is withheld: the real conclusion, blurred. */
  lockedLines?: string[];
}

function SparkGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z" fill={color} />
    </Svg>
  );
}

function toneColor(tone: CoachContextChip['tone']) {
  return tone === 'plan' ? HG.purple : tone === 'warn' ? PW.amber : PW.red;
}

export function AICoachChatScreen({
  language = 'en',
  proUnlocked,
  freeQuestionsRemaining,
  onFreeQuestionUsed,
  trainingContext,
  intro,
  sessionCount,
  quickAskKeys,
  lastSession,
  onOpenAnalysis,
  onOpenPremium,
}: AICoachChatScreenProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const askToken = useRef(0);

  const chips = useMemo(() => buildCoachContextChips(intro, language), [intro, language]);
  const noticed = useMemo(
    () => (proUnlocked ? buildCoachNoticed(intro.weeklyRead, language) : []),
    [intro.weeklyRead, language, proUnlocked],
  );
  const openingLine = useMemo(() => buildCoachOpeningLine(intro, language), [intro, language]);

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

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || asking) {
        return;
      }

      const token = (askToken.current += 1);
      setDraft('');
      setMessages((current) => [...current, { id: `me:${token}`, fromCoach: false, text: trimmed }]);

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
            lockedLines: [withheld.takeaway, withheld.nextSteps[0] ?? withheld.why[0] ?? ''].filter(Boolean),
          },
        ]);
        return;
      }

      if (!proUnlocked) {
        // Spent on send, not on answer: a failed upstream call still knocked.
        onFreeQuestionUsed();
      }

      setAsking(true);
      try {
        const result = await requestAiCoachAdvice({ prompt: trimmed, context: trainingContext, language });
        if (token !== askToken.current) {
          return;
        }
        const answer = result.answer;
        const reply = [answer.takeaway, answer.nextSteps?.[0]].filter(Boolean).join(' ');
        setMessages((current) => [
          ...current,
          {
            id: `coach:${token}`,
            fromCoach: true,
            text: reply || answer.takeaway,
            evidence: sessionCount > 0 ? t(language, 'coachChat.evidence', { count: sessionCount }) : undefined,
          },
        ]);
      } catch {
        if (token !== askToken.current) {
          return;
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
    [asking, canAsk, language, onFreeQuestionUsed, proUnlocked, sessionCount, trainingContext],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTile}>
          <SparkGlyph color={HG.purple} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{t(language, 'coachChat.title')}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {sessionCount > 0
              ? t(language, 'coachChat.subtitle', { count: sessionCount })
              : t(language, 'coachChat.subtitleFresh')}
          </Text>
        </View>
        <View style={[styles.badge, proUnlocked && styles.badgePro]}>
          <Text style={[styles.badgeText, proUnlocked && styles.badgeTextPro]}>
            {proUnlocked
              ? t(language, 'coachChat.badge.pro')
              : t(language, 'coachChat.badge.quota', { used, total: FREE_COACH_QUESTIONS_PER_WEEK })}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.chipStrip}>
          {chips.map((chip) => (
            <View key={chip.key} style={styles.contextChip}>
              <View style={[styles.contextDot, { backgroundColor: toneColor(chip.tone) }]} />
              <Text style={styles.contextChipText} numberOfLines={1}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
        >
          {/* Pro's real difference: the coach opens the conversation. */}
          {noticed.length > 0 ? (
            <View style={styles.noticedCard}>
              <View style={styles.noticedHead}>
                <SparkGlyph color={PW.sheetLavender} size={15} />
                <Text style={styles.noticedLabel}>
                  {noticed.length === 1
                    ? t(language, 'coachChat.noticedOne')
                    : t(language, 'coachChat.noticed', { count: noticed.length })}
                </Text>
              </View>
              {noticed.map((item: CoachNoticedItem) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => void send(item.question)}
                  style={({ pressed }) => [styles.noticedRow, pressed && styles.pressed]}
                >
                  <View style={[styles.noticedDot, { backgroundColor: toneColor(item.tone) }]} />
                  <View style={styles.noticedCopy}>
                    <Text style={styles.noticedTitle}>{item.title}</Text>
                    <Text style={styles.noticedBody}>{item.body}</Text>
                    <Text style={styles.noticedAsk}>{t(language, 'coachChat.noticedAsk')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.bubbleRow}>
            <View style={styles.coachBubble}>
              <Text style={styles.coachText}>{openingLine}</Text>
            </View>
          </View>

          {/* The written analysis is Pro (the Pro page's table says so), so a
              free user gets the row and the reason, not a dead end. */}
          {lastSession ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => (proUnlocked ? onOpenAnalysis(lastSession.id) : onOpenPremium())}
              style={({ pressed }) => [styles.analysisRow, pressed && styles.pressed]}
            >
              <View style={styles.analysisCopy}>
                <Text style={styles.analysisTitle} numberOfLines={1}>
                  {t(language, 'coachChat.analysisRow', { name: lastSession.name })}
                </Text>
                <Text style={styles.analysisCta}>
                  {t(language, proUnlocked ? 'coach.seeFullAnalysis' : 'coach.analysisLocked')}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {messages.map((message) =>
            message.lockedLines ? (
              <View key={message.id} style={styles.lockWrap}>
                <ProLockedCard
                  language={language}
                  teaser={t(language, 'coachChat.locked.teaser')}
                  lines={message.lockedLines}
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
                  {message.evidence ? <Text style={styles.evidence}>{message.evidence}</Text> : null}
                </View>
              </View>
            ),
          )}

          {asking ? (
            <View style={styles.bubbleRow}>
              <View style={[styles.coachBubble, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={HG.purple} />
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

        <View style={styles.quickAsks}>
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
        </View>

        {!canAsk ? (
          <Text style={styles.resetNote}>{t(language, 'coachChat.quotaReset')}</Text>
        ) : null}

        <View style={styles.composerWrap}>
          <View style={[styles.composer, !canAsk && styles.composerSpent]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t(language, canAsk ? 'coachChat.placeholder' : 'coachChat.placeholderSpent')}
              placeholderTextColor={HG.faint}
              selectionColor={HG.purple}
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
                  <Path d="M5 12h14M13 6l6 6-6 6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
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
    backgroundColor: HG.purpleLight,
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
    color: HG.ink,
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: HG.muted,
    marginTop: 1,
  },
  badge: {
    backgroundColor: HG.purpleLight,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgePro: {
    backgroundColor: HG.purple,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: PW.proInk,
  },
  badgeTextPro: {
    color: '#FFFFFF',
  },
  chipStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  contextChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  contextDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  contextChipText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    color: HG.ink,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  thread: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  noticedCard: {
    backgroundColor: PW.sheetTop,
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 6,
  },
  noticedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  noticedLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: PW.sheetLavender,
  },
  noticedRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 13,
    paddingBottom: 10,
  },
  noticedDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 5,
  },
  noticedCopy: {
    flex: 1,
    minWidth: 0,
  },
  noticedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noticedBody: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginTop: 3,
  },
  noticedAsk: {
    fontSize: 12,
    fontWeight: '800',
    color: PW.sheetLavender,
    marginTop: 7,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  coachBubble: {
    maxWidth: '88%',
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  meBubble: {
    maxWidth: '88%',
    backgroundColor: HG.purple,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  coachText: {
    fontSize: 14,
    fontWeight: '600',
    color: HG.ink,
    lineHeight: 22,
  },
  meText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  evidence: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: HG.border,
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.faint,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '700',
    color: HG.muted,
  },
  lockWrap: {
    marginTop: 2,
  },
  analysisRow: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  analysisCopy: {
    minWidth: 0,
  },
  analysisTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: HG.muted,
  },
  analysisCta: {
    fontSize: 13,
    fontWeight: '800',
    color: HG.purple,
    marginTop: 4,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: HG.surfaceSoft,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  quotaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: HG.muted,
  },
  quotaCta: {
    fontSize: 12,
    fontWeight: '800',
    color: HG.purple,
  },
  quickAsks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  quickAsk: {
    backgroundColor: HG.purpleLight,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickAskText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: PW.proInk,
  },
  resetNote: {
    fontSize: 11.5,
    fontWeight: '700',
    color: HG.faint,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  composerWrap: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  composer: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 15,
    paddingLeft: 15,
    paddingRight: 6,
  },
  composerSpent: {
    backgroundColor: HG.surfaceSoft,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: HG.ink,
    padding: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonSpent: {
    backgroundColor: HG.faint,
  },
  pressed: {
    opacity: 0.85,
  },
});

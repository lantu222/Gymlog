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
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

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
import { PW } from '../lightTheme';
import { Theme, useTheme, useThemeName, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AICoachTrainingContext } from '../types/aiCoach';
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

function toneColor(tone: CoachContextChip['tone']) {
  const theme = useTheme();

  return tone === 'plan' ? theme.purple : tone === 'warn' ? PW.amber : PW.red;
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
  const theme = useTheme();
  const themeName = useThemeName();
  const styles = useThemedStyles(makeStyles);
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
            // Two real sentences, joined into one paragraph — unlike the pro
            // insights, these were never a single sentence cut in half.
            lockedBody: [withheld.takeaway, withheld.nextSteps[0] ?? withheld.why[0] ?? '']
              .filter(Boolean)
              .join(' '),
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
            message.lockedBody ? (
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
    paddingBottom: layout.bottomTabBarReserve,
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CoachHighlightedText } from './CoachHighlightedText';
import { requestAiCoachAdvice } from '../lib/aiCoachClient';
import { CoachBullet, CoachModules } from '../lib/aiCoachModules';
import { I18nKey, t } from '../lib/i18n';
import { COACH } from '../lightTheme';
import { AICoachTrainingContext } from '../types/aiCoach';
import { AppLanguage } from '../types/models';

interface AICoachSheetProps {
  visible: boolean;
  /** False shows the locked preview instead of the coach. */
  proUnlocked: boolean;
  /**
   * The real free tier (Pro page table row "AI Coach — 3 / wk"): questions a
   * free user may still ask this week. The lock only closes when it hits 0.
   */
  freeQuestionsRemaining?: number;
  /** Called when a free user's question is actually sent. */
  onFreeQuestionUsed?: () => void;
  modules: CoachModules;
  trainingContext: AICoachTrainingContext;
  language?: AppLanguage;
  onClose: () => void;
  onStartTrial: () => void;
  onOpenFullAnalysis?: (sessionId: string) => void;
}

interface ChatMessage {
  id: string;
  fromCoach: boolean;
  text: string;
}

const QUICK_ASKS: Array<{ key: string; labelKey: I18nKey }> = [
  { key: 'analyze', labelKey: 'coach.chip.analyze' },
  { key: 'program', labelKey: 'coach.chip.program' },
  { key: 'protein', labelKey: 'coach.chip.protein' },
];

const SPARKLE = 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z';

function SparkleGlyph({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SPARKLE} fill={color} />
    </Svg>
  );
}

/**
 * The focus card's gradient. Percentage-sized Svg does not stretch to a
 * dynamic parent on Android, so the gradient is a fixed-size rect clipped by
 * the card's overflow — the same trap the Workout Complete hero already
 * documents.
 */
function FocusGradient({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="coachFocus" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={COACH.focusTop} />
          <Stop offset="1" stopColor={COACH.focusBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#coachFocus)" />
    </Svg>
  );
}

function BulletGlyph({ tone }: { tone: CoachBullet['tone'] }) {
  const color = tone === 'up' ? COACH.good : tone === 'down' ? COACH.warn : COACH.gold;
  const mark = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '◆';
  return <Text style={[styles.bulletGlyph, { color }]}>{mark}</Text>;
}

export function AICoachSheet({
  visible,
  proUnlocked,
  freeQuestionsRemaining = 0,
  onFreeQuestionUsed,
  modules,
  trainingContext,
  language = 'en',
  onClose,
  onStartTrial,
  onOpenFullAnalysis,
}: AICoachSheetProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [focusWidth, setFocusWidth] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const askToken = useRef(0);

  // The chat is per-visit: the coach reads the user's data fresh each time, so
  // a stale transcript would only invite questions about numbers that moved.
  useEffect(() => {
    if (!visible) {
      setMessages([]);
      setDraft('');
      setAsking(false);
      setDismissedSuggestion(false);
      askToken.current += 1;
    }
  }, [visible]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const chatUnlocked = proUnlocked || freeQuestionsRemaining > 0;

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || asking || !chatUnlocked) {
        return;
      }
      if (!proUnlocked) {
        // Free question spent the moment it is sent, not answered — a failed
        // upstream call still called the model's front door.
        onFreeQuestionUsed?.();
      }

      const token = (askToken.current += 1);
      setMessages((current) => [
        ...current,
        { id: `me:${token}`, fromCoach: false, text: trimmed },
      ]);
      setDraft('');
      setAsking(true);
      scrollToEnd();

      try {
        const result = await requestAiCoachAdvice({ prompt: trimmed, context: trainingContext });
        if (token !== askToken.current) {
          return;
        }
        // The client answers in structured form; the chat wants one honest
        // paragraph, so the takeaway leads and the first next step follows.
        const answer = result.answer;
        const reply = [answer.takeaway, answer.nextSteps?.[0]].filter(Boolean).join(' ');
        setMessages((current) => [
          ...current,
          { id: `coach:${token}`, fromCoach: true, text: reply || answer.takeaway },
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
          scrollToEnd();
        }
      }
    },
    [asking, chatUnlocked, language, onFreeQuestionUsed, proUnlocked, scrollToEnd, trainingContext],
  );

  const suggestion = dismissedSuggestion ? null : modules.suggestion;
  const showEmptyState = modules.needsMoreData;

  const chips = useMemo(
    () => QUICK_ASKS.map((chip) => ({ key: chip.key, label: t(language, chip.labelKey) })),
    [language],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.scrim} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.grip} />

          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <SparkleGlyph />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{t(language, 'coach.title')}</Text>
              <Text style={styles.headerSubline}>{t(language, 'coach.subline')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'coach.close')}
              onPress={onClose}
              hitSlop={8}
              style={styles.closeButton}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6L6 18"
                  stroke={COACH.muted}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.body}>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={chatUnlocked}
            >
              <View style={chatUnlocked ? null : styles.lockedModules} pointerEvents={chatUnlocked ? 'auto' : 'none'}>
                {showEmptyState ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>{t(language, 'coach.empty.title')}</Text>
                    <Text style={styles.emptyBody}>{t(language, 'coach.empty.body')}</Text>
                    <Text style={styles.emptyNote}>{t(language, 'coach.empty.note')}</Text>
                  </View>
                ) : null}

                {modules.focus ? (
                  <View
                    style={styles.focusCard}
                    onLayout={(event) => setFocusWidth(event.nativeEvent.layout.width)}
                  >
                    {focusWidth > 0 ? <FocusGradient width={focusWidth} height={FOCUS_HEIGHT} /> : null}
                    <Text style={styles.moduleLabel}>{t(language, 'coach.focusLabel')}</Text>
                    <CoachHighlightedText
                      text={modules.focus.body.text}
                      highlights={modules.focus.body.highlights}
                      style={styles.focusText}
                      highlightStyle={styles.goldText}
                    />
                    {modules.focus.metrics.length > 0 ? (
                      <View style={styles.metricRow}>
                        {modules.focus.metrics.map((metric) => (
                          <View key={`${metric.label}:${metric.value}`} style={styles.metric}>
                            <Text style={styles.metricValue}>{metric.value}</Text>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {modules.analysis ? (
                  <View style={styles.module}>
                    <View style={styles.moduleHeadRow}>
                      <Text style={styles.moduleLabel}>{t(language, 'coach.analysisLabel')}</Text>
                      <Text style={styles.moduleAside}>{modules.analysis.caption}</Text>
                    </View>
                    <View style={styles.bullets}>
                      {modules.analysis.bullets.map((bullet, index) => (
                        <View key={`${bullet.tone}:${index}`} style={styles.bulletRow}>
                          <BulletGlyph tone={bullet.tone} />
                          <CoachHighlightedText
                            text={bullet.body.text}
                            highlights={bullet.body.highlights}
                            style={styles.bulletText}
                            highlightStyle={styles.bulletStrong}
                          />
                        </View>
                      ))}
                    </View>
                    {onOpenFullAnalysis ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onOpenFullAnalysis(modules.analysis!.sessionId)}
                        style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.ghostButtonText}>
                          {t(language, 'coach.seeFullAnalysis')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {suggestion ? (
                  <View style={styles.module}>
                    <Text style={styles.moduleLabel}>{t(language, 'coach.suggestionLabel')}</Text>
                    <CoachHighlightedText
                      text={suggestion.body.text}
                      highlights={suggestion.body.highlights}
                      style={styles.suggestionText}
                      highlightStyle={styles.goldText}
                    />
                    <View style={styles.suggestionButtons}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => send(suggestion.body.text)}
                        style={({ pressed }) => [styles.goldButton, styles.flex, pressed && styles.pressed]}
                      >
                        <Text style={styles.goldButtonText}>{t(language, 'coach.apply')}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setDismissedSuggestion(true)}
                        style={({ pressed }) => [styles.ghostButton, styles.flex, styles.inlineGhost, pressed && styles.pressed]}
                      >
                        <Text style={styles.ghostButtonText}>{t(language, 'coach.dismiss')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <View style={styles.module}>
                  <Text style={styles.moduleLabel}>{t(language, 'coach.askLabel')}</Text>
                  <View style={styles.messages}>
                    <View style={styles.message}>
                      <View style={styles.avatar}>
                        <SparkleGlyph size={13} />
                      </View>
                      <View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{t(language, 'coach.intro')}</Text>
                      </View>
                    </View>

                    {messages.map((message) =>
                      message.fromCoach ? (
                        <View key={message.id} style={styles.message}>
                          <View style={styles.avatar}>
                            <SparkleGlyph size={13} />
                          </View>
                          <View style={styles.bubble}>
                            <Text style={styles.bubbleText}>{message.text}</Text>
                          </View>
                        </View>
                      ) : (
                        <View key={message.id} style={[styles.message, styles.messageMine]}>
                          <View style={[styles.avatar, styles.avatarMine]}>
                            <Text style={styles.avatarMineText}>{t(language, 'coach.you')}</Text>
                          </View>
                          <View style={[styles.bubble, styles.bubbleMine]}>
                            <Text style={styles.bubbleText}>{message.text}</Text>
                          </View>
                        </View>
                      ),
                    )}

                    {asking ? (
                      <View style={styles.message}>
                        <View style={styles.avatar}>
                          <SparkleGlyph size={13} />
                        </View>
                        <View style={[styles.bubble, styles.bubbleThinking]}>
                          <ActivityIndicator color={COACH.gold} size="small" />
                          <Text style={styles.thinkingText}>{t(language, 'coach.thinking')}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.chips}>
                    {chips.map((chip) => (
                      <Pressable
                        key={chip.key}
                        accessibilityRole="button"
                        onPress={() => void send(chip.label)}
                        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      >
                        <Text style={styles.chipText}>{chip.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {!proUnlocked && freeQuestionsRemaining > 0 ? (
                    <View style={styles.quotaPill}>
                      <Text style={styles.quotaPillText}>
                        {t(language, 'pro.coach.quotaLeft', { count: freeQuestionsRemaining })}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.composer}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder={t(language, 'coach.placeholder')}
                      placeholderTextColor={COACH.faint}
                      selectionColor={COACH.gold}
                      style={styles.input}
                      onSubmitEditing={() => void send(draft)}
                      returnKeyType="send"
                      editable={chatUnlocked}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(language, 'coach.send')}
                      onPress={() => void send(draft)}
                      style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M5 12h14M13 6l6 6-6 6"
                          stroke={COACH.goldInk}
                          strokeWidth={2.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Pressable>
                  </View>
                </View>
              </View>
            </ScrollView>

            {chatUnlocked ? null : (
              <View style={styles.lockLayer} pointerEvents="box-none">
                {/* Dimming alone still left the figures readable on device, so a
                    scrim sits over the preview: you can see there is a coach
                    here, you cannot read it. */}
                <View style={styles.lockScrim} pointerEvents="none" />
                <View style={styles.lockCard}>
                  <View style={styles.lockIcon}>
                    <Svg width={27} height={27} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M5 11h14v9H5zM8 11V8a4 4 0 018 0v3"
                        stroke={COACH.gold}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  {/* The lock only closes when the week's 3 free questions
                      are spent — a fresh free user chats first. */}
                  <Text style={styles.lockTitle}>{t(language, 'pro.coach.quotaUsed')}</Text>
                  <Text style={styles.lockBody}>{t(language, 'pro.coach.quotaBody')}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onStartTrial}
                    style={({ pressed }) => [styles.goldButton, styles.lockCta, pressed && styles.pressed]}
                  >
                    <Text style={styles.lockCtaText}>{t(language, 'coach.lock.cta')}</Text>
                  </Pressable>
                  <Text style={styles.lockFine}>{t(language, 'coach.lock.fine')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const FOCUS_HEIGHT = 220;

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,20,0.62)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '95%',
    backgroundColor: COACH.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  grip: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginTop: 11,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: COACH.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubline: {
    color: COACH.gold,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 30,
  },
  lockedModules: {
    // expo-blur is not a dependency, so the locked preview dims rather than
    // blurs. Paired with lockScrim below.
    opacity: 0.16,
  },
  emptyCard: {
    backgroundColor: COACH.surface,
    borderWidth: 1,
    borderColor: COACH.hairline,
    borderRadius: 18,
    padding: 18,
    marginBottom: 4,
  },
  emptyTitle: {
    color: COACH.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyBody: {
    color: COACH.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyNote: {
    color: COACH.faint,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 12,
  },
  focusCard: {
    borderWidth: 1,
    borderColor: COACH.focusBorder,
    borderRadius: 18,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 2,
  },
  moduleLabel: {
    color: COACH.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 9,
  },
  focusText: {
    color: COACH.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  goldText: {
    color: COACH.gold,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 15,
  },
  metric: {
    gap: 3,
  },
  metricValue: {
    color: COACH.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metricLabel: {
    color: COACH.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  module: {
    borderTopWidth: 1,
    borderTopColor: COACH.hairline,
    paddingVertical: 18,
  },
  moduleHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  moduleAside: {
    color: COACH.faint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  bullets: {
    gap: 9,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletGlyph: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 19,
  },
  bulletText: {
    flex: 1,
    color: COACH.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  bulletStrong: {
    color: COACH.text,
    fontWeight: '800',
  },
  suggestionText: {
    color: COACH.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  suggestionButtons: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  flex: {
    flex: 1,
  },
  ghostButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 13,
  },
  inlineGhost: {
    marginTop: 0,
  },
  ghostButtonText: {
    color: COACH.text,
    fontSize: 13,
    fontWeight: '800',
  },
  goldButton: {
    backgroundColor: COACH.gold,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  goldButtonText: {
    color: COACH.goldInk,
    fontSize: 13.5,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  messages: {
    gap: 9,
    marginBottom: 13,
  },
  message: {
    flexDirection: 'row',
    gap: 9,
    // Held short so the two sides read as a conversation: the coach hugs the
    // left, the user hugs the right, and neither fills the column.
    maxWidth: '84%',
    alignSelf: 'flex-start',
  },
  messageMine: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarMine: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarMineText: {
    color: COACH.text,
    fontSize: 9,
    fontWeight: '800',
  },
  bubble: {
    // Shrink, never grow: flex:1 made every bubble fill the column, which left
    // the user's messages looking left-aligned no matter which side they sat on.
    flexShrink: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COACH.hairline,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  bubbleMine: {
    backgroundColor: 'rgba(155,109,255,0.22)',
    borderColor: 'rgba(155,109,255,0.38)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 4,
  },
  bubbleThinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  bubbleText: {
    color: COACH.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  thinkingText: {
    color: COACH.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 13,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COACH.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: {
    color: COACH.text,
    fontSize: 12.5,
    fontWeight: '700',
  },
  quotaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244,183,64,0.14)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    marginTop: 10,
  },
  quotaPillText: {
    color: COACH.gold,
    fontSize: 11.5,
    fontWeight: '800',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COACH.hairline,
    paddingHorizontal: 14,
    color: COACH.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COACH.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  lockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23,18,42,0.72)',
  },
  lockCard: {
    backgroundColor: COACH.surface,
    borderWidth: 1,
    borderColor: 'rgba(228,177,76,0.4)',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxWidth: 304,
  },
  lockIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(228,177,76,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  lockTitle: {
    color: COACH.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  lockBody: {
    color: COACH.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 20,
  },
  lockCta: {
    alignSelf: 'stretch',
    paddingVertical: 14,
  },
  lockCtaText: {
    color: COACH.goldInk,
    fontSize: 15,
    fontWeight: '800',
  },
  lockFine: {
    color: COACH.faint,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 13,
    textAlign: 'center',
  },
});

/**
 * Cardio v1 (Home → Cardio list → player → finish).
 *
 * One route, three internal modes driven by the live cardio session in
 * WorkoutProvider: no session → activity list; session → full-screen player
 * (elapsed timer counting UP, pause/resume); "Finish" → dark summary with
 * optional manual distance, derived pace, weekly minutes and feel pills.
 * Offline-first and timer-based — no GPS anywhere in v1.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';

import { CardioIcon } from '../components/CardioIcon';
import {
  ActiveCardioSession,
  CARDIO_ACTIVITIES,
  CARDIO_FEEL_OPTIONS,
  CardioIconKind,
  formatCardioDuration,
  formatCardioPace,
  getCardioActivity,
  getCardioAvgPaceSecPerKm,
  getCardioElapsedMs,
  getWeekCardioMinutes,
  parseCardioDistanceKm,
} from '../lib/cardio';
import { I18nKey, t } from '../lib/i18n';
import { haptics } from '../utils/haptics';
import { sound } from '../utils/sound';
import { HG } from '../lightTheme';
import { AppLanguage, CardioActivityType, CardioFeel, CardioSession } from '../types/models';
import { useWorkoutContext } from '../features/workout/WorkoutProvider';
import { useKeepScreenAwake } from '../utils/keepAwake';

function cardioActivityName(language: AppLanguage, activityType: CardioActivityType) {
  return t(language, `cardio.activity.${activityType}` as I18nKey);
}

function cardioEquipmentLabel(language: AppLanguage, equipmentLabel: string) {
  return t(language, `cardio.equipment.${equipmentLabel}` as I18nKey);
}

interface CardioScreenProps {
  /** Keep the display on while the cardio player runs. */
  keepScreenAwake?: boolean;
  language?: AppLanguage;
  cardioSessions: CardioSession[];
  hasActiveStrengthSession: boolean;
  isSaving: boolean;
  onResumeStrengthSession: () => void;
  onDiscardStrengthSession: () => Promise<void> | void;
  onSaveCardioSession: (input: {
    activityType: CardioActivityType;
    startedAt: string;
    durationSec: number;
    distanceKm: number | null;
    feel: CardioFeel | null;
  }) => Promise<void>;
  onLeave: () => void;
}

export function CardioScreen({
  keepScreenAwake = false,
  language = 'en',
  cardioSessions,
  hasActiveStrengthSession,
  isSaving,
  onResumeStrengthSession,
  onDiscardStrengthSession,
  onSaveCardioSession,
  onLeave,
}: CardioScreenProps) {
  const workout = useWorkoutContext();
  const activeCardio = workout.activeCardio;
  // Only hold the screen while a cardio session is actually running.
  useKeepScreenAwake(keepScreenAwake && activeCardio !== null, 'cardio-player');

  const [finishing, setFinishing] = useState(false);
  const [conflictFor, setConflictFor] = useState<CardioActivityType | null>(null);
  const [endSheetOpen, setEndSheetOpen] = useState(false);

  const mode: 'list' | 'player' | 'finish' = activeCardio ? (finishing ? 'finish' : 'player') : 'list';

  // Reset transient state whenever the live session goes away.
  useEffect(() => {
    if (!activeCardio) {
      setFinishing(false);
      setEndSheetOpen(false);
    }
  }, [activeCardio]);

  const startActivity = (activityType: CardioActivityType) => {
    if (hasActiveStrengthSession) {
      setConflictFor(activityType);
      return;
    }
    void haptics.impactMedium();
    sound.go();
    workout.startCardio(activityType);
  };

  /* ── hardware back: player → end sheet, finish → back to player, list → leave ── */
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'finish') {
        setFinishing(false);
        return true;
      }
      if (mode === 'player') {
        setEndSheetOpen(true);
        return true;
      }
      onLeave();
      return true;
    });
    return () => handler.remove();
  }, [mode, onLeave]);

  return (
    <View style={{ flex: 1, backgroundColor: HG.bg }}>
      <StatusBar style="dark" backgroundColor={HG.bg} />

      {mode === 'list' && <CardioListView language={language} onLeave={onLeave} onStart={startActivity} />}

      {mode === 'player' && activeCardio && (
        <CardioPlayerView
          language={language}
          session={activeCardio}
          onPause={() => {
            void haptics.select();
            workout.pauseCardio();
          }}
          onResume={() => {
            void haptics.select();
            workout.resumeCardio();
          }}
          onExit={() => setEndSheetOpen(true)}
        />
      )}

      {mode === 'finish' && activeCardio && (
        <CardioFinishView
          language={language}
          session={activeCardio}
          cardioSessions={cardioSessions}
          isSaving={isSaving}
          onComplete={async (distanceKm, feel) => {
            const durationSec = Math.round(getCardioElapsedMs(activeCardio, Date.now()) / 1000);
            try {
              await onSaveCardioSession({
                activityType: activeCardio.activityType,
                startedAt: activeCardio.startedAt,
                durationSec,
                distanceKm,
                feel,
              });
            } catch {
              // Save failed (App shows the toast) — keep the session so the
              // user can retry; never claim success before the save resolves.
              return;
            }
            void haptics.success();
            sound.finish();
            workout.clearCardio();
            onLeave();
          }}
        />
      )}

      {endSheetOpen && activeCardio && (
        <CardioSheet onClose={() => setEndSheetOpen(false)}>
          <Text style={styles.sheetTitle}>{t(language, 'cardio.endTitle')}</Text>
          <View style={{ gap: 10 }}>
            <SheetPrimaryBtn
              label={t(language, 'cardio.finish')}
              color={HG.green}
              onPress={() => {
                setEndSheetOpen(false);
                workout.pauseCardio();
                setFinishing(true);
              }}
            />
            <SheetGhostBtn
              label={t(language, 'cardio.discard')}
              onPress={() => {
                setEndSheetOpen(false);
                workout.clearCardio();
              }}
            />
            <SheetGhostBtn label={t(language, 'common.cancel')} onPress={() => setEndSheetOpen(false)} />
          </View>
        </CardioSheet>
      )}

      {conflictFor !== null && (
        <CardioSheet onClose={() => setConflictFor(null)}>
          <Text style={styles.sheetTitle}>{t(language, 'cardio.conflictTitle')}</Text>
          <View style={{ gap: 10 }}>
            <SheetPrimaryBtn
              label={t(language, 'cardio.resumeIt')}
              color={HG.purple}
              onPress={() => {
                setConflictFor(null);
                onResumeStrengthSession();
              }}
            />
            <SheetGhostBtn
              label={t(language, 'cardio.discardAndStart')}
              onPress={() => {
                const activityType = conflictFor;
                setConflictFor(null);
                void (async () => {
                  await onDiscardStrengthSession();
                  void haptics.impactMedium();
                  workout.startCardio(activityType);
                })();
              }}
            />
            <SheetGhostBtn label={t(language, 'common.cancel')} onPress={() => setConflictFor(null)} />
          </View>
        </CardioSheet>
      )}
    </View>
  );
}

/* ── 1 · activity list ── */
function CardioListView({
  language,
  onLeave,
  onStart,
}: {
  language: AppLanguage;
  onLeave: () => void;
  onStart: (activityType: CardioActivityType) => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={onLeave} style={styles.backBtn} hitSlop={8}>
        <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={HG.purpleDark} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      </Pressable>
      <Text style={styles.listTitle}>{t(language, 'cardio.list.title')}</Text>
      <Text style={styles.listSub}>{t(language, 'cardio.list.sub')}</Text>
      <View style={{ gap: 12, marginTop: 20 }}>
        {CARDIO_ACTIVITIES.map((activity) => (
          <Pressable
            key={activity.id}
            style={({ pressed }) => [styles.activityCard, pressed && { opacity: 0.85 }]}
            onPress={() => onStart(activity.id)}
          >
            <View style={styles.activityIconTile}>
              <CardioIcon kind={activity.icon} size={24} color={HG.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityName}>{cardioActivityName(language, activity.id)}</Text>
              <View style={styles.equipmentChip}>
                <Text style={styles.equipmentChipText}>{cardioEquipmentLabel(language, activity.equipmentLabel).toUpperCase()}</Text>
              </View>
            </View>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={HG.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 6l6 6-6 6" />
            </Svg>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── 2 · in-session player ── */
function CardioPlayerView({
  language,
  session,
  onPause,
  onResume,
  onExit,
}: {
  language: AppLanguage;
  session: ActiveCardioSession;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
}) {
  const activity = getCardioActivity(session.activityType);
  const running = session.resumedAt !== null;
  const [elapsedMs, setElapsedMs] = useState(() => getCardioElapsedMs(session, Date.now()));

  useEffect(() => {
    setElapsedMs(getCardioElapsedMs(session, Date.now()));
    if (!running) {
      return;
    }
    const interval = setInterval(() => {
      setElapsedMs(getCardioElapsedMs(session, Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [session, running]);

  // Pulsing icon tile while the clock runs.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!running) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, running]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.playerTopBar}>
        <Pressable onPress={onExit} style={styles.playerTopBtn} hitSlop={8}>
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={HG.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>
        <Text style={styles.playerTopLabel}>{t(language, 'cardio.eyebrow')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 }}>
        <Animated.View style={[styles.playerIconTile, { transform: [{ scale: pulse }] }]}>
          <CardioIcon kind={activity.icon} size={34} color={HG.purple} />
        </Animated.View>
        <Text style={styles.playerActivityName}>{cardioActivityName(language, session.activityType)}</Text>
        <Text style={[styles.playerTimer, { color: running ? HG.ink : HG.faint }]}>
          {formatCardioDuration(elapsedMs / 1000)}
        </Text>
        {!running ? <Text style={styles.pausedLabel}>{t(language, 'cardio.paused')}</Text> : <View style={{ height: 20 }} />}
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 36 }}>
        <Pressable onPress={running ? onPause : onResume} style={styles.pauseBtn}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            {running ? <Path d="M9 5v14M15 5v14" /> : <Path d="M8 5l11 7-11 7z" />}
          </Svg>
        </Pressable>
        <Text style={{ fontSize: 13, fontWeight: '700', color: HG.muted, marginTop: 10 }}>
          {t(language, running ? 'cardio.pause' : 'cardio.resume')}
        </Text>
      </View>
    </View>
  );
}

/* ── 3 · finish (dark summary) ── */
function CardioFinishView({
  language,
  session,
  cardioSessions,
  isSaving,
  onComplete,
}: {
  language: AppLanguage;
  session: ActiveCardioSession;
  cardioSessions: CardioSession[];
  isSaving: boolean;
  onComplete: (distanceKm: number | null, feel: CardioFeel | null) => Promise<void>;
}) {
  const durationSec = Math.round(getCardioElapsedMs(session, Date.now()) / 1000);
  const [distanceText, setDistanceText] = useState('');
  const [feel, setFeel] = useState<CardioFeel | null>(null);

  const distanceKm = parseCardioDistanceKm(distanceText);
  const pace = getCardioAvgPaceSecPerKm(durationSec, distanceKm);
  const weekMinutes = getWeekCardioMinutes(cardioSessions) + Math.round(durationSec / 60);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, gap: 11 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.finishTitle}>
          {t(language, 'cardio.done', { activity: cardioActivityName(language, session.activityType) })}
        </Text>

        <View style={[styles.finishCard, { alignItems: 'center' }]}>
          <Text style={styles.finishHeroStat}>{formatCardioDuration(durationSec)}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: HG.muted, marginTop: 4 }}>
            {t(language, 'cardio.stat.duration')}
          </Text>
        </View>

        <View style={styles.finishCard}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: HG.purple }}>
            {t(language, 'cardio.stat.distance')}
          </Text>
          <TextInput
            value={distanceText}
            onChangeText={setDistanceText}
            placeholder={t(language, 'cardio.addDistance')}
            placeholderTextColor={HG.faint}
            keyboardType="decimal-pad"
            style={styles.distanceInput}
          />
          {pace !== null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: HG.muted }}>{t(language, 'cardio.avgPace')}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: HG.ink, fontVariant: ['tabular-nums'] }}>
                {formatCardioPace(pace)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.finishCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: HG.green }}>{t(language, 'cardio.thisWeek')}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: HG.ink }}>
              {t(language, 'cardio.weekMinutes', { min: weekMinutes })}{' '}
              <Text style={{ fontSize: 12, fontWeight: '700', color: HG.muted }}>{t(language, 'cardio.weekCardio')}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.finishCard}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, color: HG.purple }}>
            {t(language, 'cardio.howFeel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
            {CARDIO_FEEL_OPTIONS.map((option) => {
              const selected = feel === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setFeel(selected ? null : option.key)}
                  style={[styles.feelPill, selected && styles.feelPillSelected]}
                >
                  <Text style={[styles.feelPillText, selected && { color: '#fff' }]}>
                    {t(language, `cardio.feel.${option.key}` as I18nKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.finishFooter}>
        <Pressable
          style={[styles.completeBtn, { opacity: isSaving ? 0.6 : 1 }]}
          onPress={isSaving ? undefined : () => void onComplete(distanceKm, feel)}
        >
          <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>
            {t(language, isSaving ? 'cardio.saving' : 'cardio.complete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── sheets ── */
function CardioSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetPrimaryBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.sheetPrimaryBtn, { backgroundColor: color, shadowColor: color }]}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}

function SheetGhostBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.sheetGhostBtn}>
      <Text style={{ fontSize: 14.5, fontWeight: '800', color: HG.ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* list */
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  listTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: HG.ink },
  listSub: { fontSize: 14, fontWeight: '600', color: HG.muted, marginTop: 4 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4D8FF',
    borderRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 15,
    paddingBottom: 14,
    shadowColor: 'rgba(120,80,200,1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  activityIconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityName: { fontSize: 16.5, fontWeight: '800', color: HG.ink },
  equipmentChip: {
    alignSelf: 'flex-start',
    backgroundColor: HG.purpleLight,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 7,
  },
  equipmentChipText: {
    fontFamily: 'JetBrainsMono',
    fontSize: 10,
    letterSpacing: 0.6,
    color: HG.purpleDark,
  },

  /* player */
  playerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  playerTopBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
  },
  playerTopLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.6, color: HG.muted },
  playerIconTile: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  playerActivityName: { fontSize: 20, fontWeight: '800', color: HG.ink, textAlign: 'center' },
  playerTimer: {
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2.5,
    lineHeight: 80,
    fontVariant: ['tabular-nums'],
    marginTop: 8,
  },
  pausedLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.8, color: HG.muted, marginTop: 2 },
  pauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HG.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },

  /* finish (light — same theme as every other screen) */
  finishTitle: { marginTop: 6, marginHorizontal: 2, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: HG.ink },
  finishCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4DBF5',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 17,
  },
  finishHeroStat: {
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: HG.ink,
    lineHeight: 60,
    fontVariant: ['tabular-nums'],
  },
  distanceInput: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E4DBF5',
    backgroundColor: HG.bg,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    color: HG.ink,
  },
  feelPill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E4DBF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  feelPillSelected: {
    backgroundColor: HG.purple,
    borderColor: HG.purple,
  },
  feelPillText: { fontSize: 13.5, fontWeight: '800', color: HG.muted },
  finishFooter: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4DBF5',
  },
  completeBtn: {
    height: 56,
    borderRadius: 17,
    backgroundColor: HG.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HG.green,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 6,
  },

  /* sheets */
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(14,8,30,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 30,
  },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E4DBF5', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: HG.ink, marginBottom: 16 },
  sheetPrimaryBtn: {
    height: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  sheetGhostBtn: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E4DBF5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

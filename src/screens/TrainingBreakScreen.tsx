import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW, SectionLabel } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';
import { TrainingBreak, TrainingBreakReason } from '../types/models';

interface TrainingBreakScreenProps {
  trainingBreak: TrainingBreak | null;
  onBack: () => void;
  onStartBreak: (reason: TrainingBreakReason, note: string | null) => void;
  onEndBreak: () => void;
}

const REASONS: Array<{ key: TrainingBreakReason; label: string }> = [
  { key: 'injury', label: 'Injury' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'other', label: 'Other' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function reasonLabel(reason: TrainingBreakReason) {
  return REASONS.find((item) => item.key === reason)?.label ?? 'Break';
}

/**
 * Log an injury or holiday. The break is a stored state, not a punishment:
 * starting one records the date and reason, ending it clears the state. Plan
 * pausing logic can hook onto this later.
 */
export function TrainingBreakScreen({ trainingBreak, onBack, onStartBreak, onEndBreak }: TrainingBreakScreenProps) {
  const [reason, setReason] = useState<TrainingBreakReason | null>(null);
  const [note, setNote] = useState('');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle} pointerEvents="none">
          Training break
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {trainingBreak ? (
          <>
            <View style={[styles.card, styles.statusCard]}>
              <View style={styles.statusDotWrap}>
                <View style={styles.statusDot} />
                <Text style={styles.statusEyebrow}>ON A BREAK</Text>
              </View>
              <Text style={styles.statusTitle}>
                {reasonLabel(trainingBreak.reason)} · since {formatDate(trainingBreak.startedAt)}
              </Text>
              {trainingBreak.note ? <Text style={styles.statusNote}>{trainingBreak.note}</Text> : null}
              <Text style={styles.statusBody}>
                Your plan and streak-free stats are exactly where you left them. Come back when you&apos;re ready.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onEndBreak}
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryButtonText}>End break</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <SectionLabel label="REASON" />
              <View style={styles.reasonRow}>
                {REASONS.map((item) => {
                  const active = reason === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setReason(item.key)}
                      style={[styles.reasonChip, active && styles.reasonChipActive]}
                    >
                      <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel label="NOTE (OPTIONAL)" />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Knee acting up, back in two weeks…"
                placeholderTextColor={HG.faint}
                style={styles.noteInput}
                multiline
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: reason === null }}
              onPress={() => {
                if (reason !== null) {
                  onStartBreak(reason, note.trim().length > 0 ? note.trim() : null);
                }
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                reason === null && styles.primaryButtonDisabled,
                pressed && reason !== null && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Start break</Text>
            </Pressable>

            <Text style={styles.footer}>
              A break just marks the pause honestly — nothing is lost and nothing counts against you.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HG.bg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: -1,
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  statusCard: {
    padding: 16,
    marginTop: 4,
  },
  statusDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B45309',
  },
  statusEyebrow: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusTitle: {
    color: HG.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  statusNote: {
    color: HG.muted,
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 6,
  },
  statusBody: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
  },
  section: {
    marginTop: 22,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reasonChip: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: HG.surface,
    borderWidth: 1.5,
    borderColor: HG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonChipActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  reasonChipText: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  reasonChipTextActive: {
    color: HG.purpleDark,
  },
  noteInput: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: HG.ink,
    fontSize: 14,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  primaryButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonDisabled: {
    backgroundColor: '#D8D2E6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 14,
    paddingHorizontal: 10,
  },
});

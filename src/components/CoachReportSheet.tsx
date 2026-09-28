import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { KitRow, KitSheet } from './sheetKit';
import { COACH_REPORT_REASONS, CoachReportReason } from '../lib/coachAnswerReport';
import { I18nKey, t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

const REASON_KEYS: Record<CoachReportReason, I18nKey> = {
  offensive: 'coachChat.report.reason.offensive',
  harmful: 'coachChat.report.reason.harmful',
  wrong: 'coachChat.report.reason.wrong',
  other: 'coachChat.report.reason.other',
};

interface CoachReportSheetProps {
  visible: boolean;
  language: AppLanguage;
  /** Read on the screen — inside this Modal the safe-area hook answers 0. */
  bottomInset: number;
  /** Sends the report; resolves true only when the server said it arrived. */
  onSend: (reason: CoachReportReason) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Report one coach answer (lib/coachAnswerReport): a reason, one button, and
 * a line saying what is sent. The sheet closes only after the report has
 * landed — a failure keeps it open with the reason still picked, so a retry
 * is one tap and nothing claims "sent" that was not.
 */
export function CoachReportSheet({ visible, language, bottomInset, onSend, onClose }: CoachReportSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const [reason, setReason] = useState<CoachReportReason | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Each opening starts clean: the sheet is reused for every answer.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setSending(false);
      setFailed(false);
    }
  }, [visible]);

  const send = async () => {
    if (!reason || sending) {
      return;
    }
    setSending(true);
    setFailed(false);
    const arrived = await onSend(reason);
    setSending(false);
    if (!arrived) {
      setFailed(true);
    }
  };

  return (
    <KitSheet
      visible={visible}
      onClose={onClose}
      title={t(language, 'coachChat.report.title')}
      description={t(language, 'coachChat.report.body')}
      bottomInset={bottomInset}
      closeLabel={t(language, 'common.close')}
    >
      {COACH_REPORT_REASONS.map((key) => (
        <KitRow
          key={key}
          title={t(language, REASON_KEYS[key])}
          state={reason === key ? 'sel' : 'idle'}
          onPress={() => {
            setReason(key);
            setFailed(false);
          }}
        />
      ))}
      {failed ? (
        <Text accessibilityLiveRegion="polite" style={styles.failed}>
          {t(language, 'coachChat.report.failed')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !reason || sending, busy: sending }}
        disabled={!reason || sending}
        onPress={send}
        style={({ pressed }) => [styles.cta, (!reason || sending) && styles.ctaIdle, pressed && styles.pressed]}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>{t(language, 'coachChat.report.send')}</Text>
        )}
      </Pressable>
    </KitSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    failed: { fontSize: 14, fontWeight: '700', color: theme.amberInk, marginTop: 12, lineHeight: 20 },
    cta: {
      height: 52,
      borderRadius: 16,
      backgroundColor: theme.purpleFill,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    ctaIdle: { opacity: 0.45 },
    ctaText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
    pressed: { opacity: 0.9 },
  });

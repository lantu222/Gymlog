import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../lib/i18n';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The permission moment, at the first rest (design: Background Timer, rule 05).
 *
 * The reader has just logged set 1 and the timer is already running behind
 * this sheet. The ask names the exact benefit, and the OS dialog only appears
 * after Allow. It is shown once; "Not now" is remembered, and the app then
 * says plainly at each rest what is off rather than pretending.
 */
interface RestAlertsSheetProps {
  visible: boolean;
  language: AppLanguage;
  onAllow: () => void;
  onLater: () => void;
}

export function RestAlertsSheet({ visible, language, onAllow, onLater }: RestAlertsSheetProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.veil}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} accessibilityLabel={t(language, 'rest.perm.later')} />
        <View style={styles.sheet}>
          <View style={styles.grip} />
          <Text style={styles.title}>{t(language, 'rest.perm.title')}</Text>
          <Text style={styles.body}>{t(language, 'rest.perm.body')}</Text>
          <View style={styles.bullets}>
            {(['rest.perm.b1', 'rest.perm.b2', 'rest.perm.b3'] as const).map((key, index) => (
              <View key={key} style={styles.bullet}>
                <View style={[styles.dot, index === 2 && styles.dotCalm]} />
                <Text style={styles.bulletText}>{t(language, key)}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onAllow}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.ctaText}>{t(language, 'rest.perm.allow')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onLater} style={styles.ghost} hitSlop={8}>
            <Text style={styles.ghostText}>{t(language, 'rest.perm.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    veil: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,10,32,0.42)' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingTop: 22,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    grip: { width: 44, height: 5, borderRadius: 999, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 18 },
    title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5, color: theme.ink },
    body: { fontSize: 14.5, fontWeight: '600', color: theme.muted, marginTop: 8, lineHeight: 21 },
    bullets: { gap: 11, marginTop: 18, marginBottom: 20 },
    bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: theme.purple, marginTop: 7 },
    dotCalm: { backgroundColor: theme.green },
    bulletText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.ink, lineHeight: 20 },
    cta: {
      height: 52,
      borderRadius: 16,
      backgroundColor: theme.purple,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
    ghost: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    ghostText: { fontSize: 15, fontWeight: '800', color: theme.muted },
  });

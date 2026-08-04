import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../lib/i18n';
import { ProgramSlots } from '../lib/programSlots';
import { Theme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

/**
 * The free-tier program cap, shown where the user pressed.
 *
 * Not a route. They were part-way into making something, and navigating away
 * would lose that to a limit they may well dismiss — which is also why the
 * secondary action is a plain "not now" rather than a back arrow.
 *
 * The copy names what the cap does NOT touch. "Three programs" on its own
 * reads as a limit on training, and this app has spent a lot of effort not
 * being the kind that holds your log hostage: every ready program stays open,
 * every logged set stays yours, and what is capped is how many of your own you
 * keep at once.
 */
export function ProgramLimitSheet({
  visible,
  slots,
  language,
  onClose,
  onSeePro,
}: {
  visible: boolean;
  slots: ProgramSlots;
  language: AppLanguage;
  onClose: () => void;
  onSeePro: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Stops a tap inside the card from closing it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t(language, 'programLimit.title')}</Text>
          <Text style={styles.body}>{t(language, 'programLimit.body')}</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {t(language, 'programLimit.count', {
                used: slots.used,
                limit: slots.limit ?? slots.used,
              })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onSeePro}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>{t(language, 'programLimit.cta')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>{t(language, 'programLimit.later')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,24,40,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  card: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: theme.ink,
  },
  body: {
    marginTop: 10,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    color: theme.muted,
  },
  countPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: theme.purpleLight,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: theme.purple,
  },
  cta: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.85,
  },
  later: {
    marginTop: 6,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.muted,
  },
});

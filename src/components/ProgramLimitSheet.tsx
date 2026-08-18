import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CutButton } from './CutButton';
import { CutSurface } from './CutSurface';
import { t } from '../lib/i18n';
import { ProgramSlots } from '../lib/programSlots';
import { Theme, useTheme, useThemedStyles } from '../theming';
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
 *
 * A3: the card is the cut surface, the count is the cut chip, the CTA is the
 * cut button — the same three shapes Home is built from, so the paywall
 * moment reads as part of the app and not as a dialog dropped on top of it.
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
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Stops a tap inside the card from closing it. */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.card}>
            <Text style={styles.title}>{t(language, 'programLimit.title')}</Text>
            <Text style={styles.body}>{t(language, 'programLimit.body')}</Text>
            <CutSurface size="chip" fill={theme.purpleLight} style={styles.countPill}>
              <Text style={styles.countText}>
                {t(language, 'programLimit.count', {
                  used: slots.used,
                  limit: slots.limit ?? slots.used,
                })}
              </Text>
            </CutSurface>
            <View style={styles.actions}>
              <CutButton size="lg" label={t(language, 'programLimit.cta')} onPress={onSeePro} />
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={styles.later}>
                <Text style={styles.laterText}>{t(language, 'programLimit.later')}</Text>
              </Pressable>
            </View>
          </CutSurface>
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
  cardWrap: {
    width: '100%',
  },
  card: {
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
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: theme.purple,
  },
  actions: {
    marginTop: 20,
    gap: 6,
  },
  later: {
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

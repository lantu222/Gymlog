import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';

interface SupportScreenProps {
  profileName: string | null;
  onBack: () => void;
}

/** Swap for the official support address before store release. */
const SUPPORT_EMAIL = 'santeriylonen@gmail.com';

const CATEGORIES: Array<{ key: string; title: string; sub: string; icon: string }> = [
  { key: 'technical', title: 'Technical issue', sub: 'Something broke or looks wrong.', icon: 'gauge' },
  { key: 'billing', title: 'Subscription & billing', sub: 'Plans, promo codes, payments.', icon: 'card' },
  { key: 'feedback', title: 'Feedback', sub: 'An idea or something that bugs you.', icon: 'spark' },
  { key: 'other', title: 'Other', sub: 'Anything else on your mind.', icon: 'chat' },
];

const ICONS: Record<string, string> = {
  gauge: 'M12 14a9 9 0 019-4M12 14L8 8M3 14a9 9 0 019-9 9 9 0 019 9',
  card: 'M3 6h18v12H3zM3 10h18',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  chat: 'M4 5h16v11H9l-4 4V5z',
};

/**
 * Contact us — the light version: pick a topic and it opens an email draft
 * with the subject prefilled. No chat backend; email is the honest channel
 * that actually reaches the founder today.
 */
export function SupportScreen({ profileName, onBack }: SupportScreenProps) {
  const greetingName = profileName?.trim() ? profileName.trim().split(/\s+/)[0] : 'there';

  const openMail = (category: string) => {
    const subject = encodeURIComponent(`GAINER support — ${category}`);
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

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
        <Text style={styles.headerTitle}>Contact us</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.greeting}>Hi, {greetingName}</Text>
        <Text style={styles.greetingSub}>How can we help?</Text>

        <View style={[styles.card, styles.listCard]}>
          {CATEGORIES.map((category, index) => (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              onPress={() => openMail(category.title)}
              style={({ pressed }) => [
                styles.row,
                index !== CATEGORIES.length - 1 && styles.rowDivider,
                pressed && { opacity: 0.75 },
              ]}
            >
              <View style={styles.rowTile}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path
                    d={ICONS[category.icon]}
                    stroke={HG.purpleDark}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{category.title}</Text>
                <Text style={styles.rowSub}>{category.sub}</Text>
              </View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M9 6l6 6-6 6" stroke={HG.faint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>
          Opens your email app with the topic filled in. You usually get an answer right away — the founder jumps in
          when needed.
        </Text>
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
  greeting: {
    color: HG.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 10,
  },
  greetingSub: {
    color: HG.muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  listCard: {
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  rowTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: HG.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
    paddingHorizontal: 10,
  },
});

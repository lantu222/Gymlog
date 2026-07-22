import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';

interface PromoCodeScreenProps {
  /** ISO date until which a promo already keeps Pro on; null = none active. */
  promoProUntil: string | null;
  onBack: () => void;
  /** Called with the expiry date once a valid code is applied. */
  onRedeemed: (proUntilIso: string) => void;
}

/** The demo code — one free month of Pro. */
const DEMO_CODE = 'gainer_2026';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function PromoCodeScreen({ promoProUntil, onBack, onRedeemed }: PromoCodeScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const promoActive = promoProUntil !== null && new Date(promoProUntil).getTime() > Date.now();

  const handleApply = () => {
    if (code.trim().length === 0) {
      return;
    }
    if (code.trim().toLowerCase() === DEMO_CODE) {
      const until = new Date();
      until.setDate(until.getDate() + 30);
      setError(null);
      onRedeemed(until.toISOString());
    } else {
      setError("That code didn't match anything.");
    }
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
        <Text style={styles.headerTitle} pointerEvents="none">
          Promo code
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* hero */}
        <View style={styles.hero}>
          <View style={styles.heroTile}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 4h7l9 9-7 7-9-9zM8 8h.01"
                stroke={HG.purpleDark}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.heroTitle}>Promo code</Text>
          <Text style={styles.heroSub}>Redeem an offer or gift code.</Text>
        </View>

        {promoActive ? (
          <View style={[styles.card, styles.activeCard]}>
            <View style={styles.activeCheck}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12l5 5L19 7" stroke="#157A3A" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.activeTitle}>Pro is on</Text>
            <Text style={styles.activeSub}>Your promo keeps GAINER Pro unlocked until {formatDate(promoProUntil!)}.</Text>
          </View>
        ) : (
          <View style={[styles.card, styles.redeemCard]}>
            <TextInput
              value={code}
              onChangeText={(next) => {
                setCode(next);
                setError(null);
              }}
              placeholder="Promo or gift code"
              placeholderTextColor={HG.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: code.trim().length === 0 }}
              onPress={handleApply}
              style={({ pressed }) => [
                styles.applyButton,
                code.trim().length === 0 && styles.applyButtonDisabled,
                pressed && code.trim().length > 0 && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
          </View>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  hero: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  heroTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: HG.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: HG.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  heroSub: {
    color: HG.muted,
    fontSize: 13,
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
  redeemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F4F0FC',
    paddingHorizontal: 14,
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  applyButton: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#D8D2E6',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  errorText: {
    color: '#C0392B',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  activeCard: {
    alignItems: 'center',
    padding: 22,
  },
  activeCheck: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4F6EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
  },
  activeSub: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
  },
});

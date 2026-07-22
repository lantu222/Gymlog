import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW, SectionLabel } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';

interface SubscriptionScreenProps {
  /** ISO date the promo keeps Pro on until; null = no active Pro. */
  promoProUntil: string | null;
  onBack: () => void;
}

const GREEN = '#157A3A';
const GREEN_SOFT = '#E4F6EA';
const GREEN_DOT = '#1FA64E';
const RED = '#C0392B';
const RED_SOFT = '#FBEAE7';
const RED_BORDER = '#F3CFC9';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Manage subscription — demo build. There is no billing integration yet; the
 * status reflects the redeemed promo when one is active, and the plan cards
 * are a preview of the intended pricing. "Manage in Google Play" opens the
 * real store subscriptions page.
 */
export function SubscriptionScreen({ promoProUntil, onBack }: SubscriptionScreenProps) {
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');

  const promoActive = promoProUntil !== null && new Date(promoProUntil).getTime() > Date.now();
  const endsDate = promoActive ? new Date(promoProUntil!) : null;
  const activatedDate = endsDate ? new Date(endsDate.getTime() - 30 * 24 * 60 * 60 * 1000) : null;
  const daysLeft = endsDate ? Math.max(0, Math.ceil((endsDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  const endingSoon = promoActive && daysLeft <= 5;

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
        <Text style={styles.headerTitle}>Manage subscription</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* status */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusTopRow}>
            <View style={styles.shieldTile}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3l8 3v6c0 4.5-3.4 7.5-8 9-4.6-1.5-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-4.5"
                  stroke={GREEN}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.statusCopy}>
              <View style={styles.statusNameRow}>
                <Text style={styles.statusName}>GAINER Pro</Text>
                {promoActive ? (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialBadgeText}>Promo</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.statusSub}>{promoActive ? 'Promo unlock' : 'No active subscription'}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: promoActive ? GREEN_DOT : '#D8D2E6' }]} />
          </View>

          {promoActive ? (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Activated</Text>
                <Text style={styles.metaValue}>{formatDate(activatedDate!)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Ends</Text>
                <Text style={[styles.metaValue, endingSoon && { color: RED }]}>
                  {formatDate(endsDate!)} ({daysLeft} d)
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Auto-renew</Text>
                <Text style={[styles.metaValue, { color: RED }]}>Off</Text>
              </View>
              {endingSoon ? (
                <View style={styles.warnBanner}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 4L2 20h20L12 4zM12 10v5M12 17.5v.5"
                      stroke={RED}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.warnText}>Pro ends soon — plans arrive with the store release.</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.divider} />
              <Text style={styles.freeNote}>
                Everything in GAINER is free right now. Paid plans arrive with the store release — the pricing below is
                a preview.
              </Text>
            </>
          )}
        </View>

        {/* change plan */}
        <View style={styles.section}>
          <SectionLabel label="CHANGE PLAN" />
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlan('yearly')}
              style={[styles.planRow, plan === 'yearly' && styles.planRowCurrent]}
            >
              <View style={styles.planCopy}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>Yearly</Text>
                  {plan === 'yearly' ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>69.99 €/yr · 0.19 €/day</Text>
              </View>
              {plan === 'yearly' ? (
                <View style={styles.checkCircle}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              ) : (
                <View style={styles.switchPill}>
                  <Text style={styles.switchPillText}>Switch</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlan('monthly')}
              style={[styles.planRow, styles.planRowLast, plan === 'monthly' && styles.planRowCurrent]}
            >
              <View style={styles.planCopy}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>Monthly</Text>
                  {plan === 'monthly' ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>9.99 €/mo · 0.33 €/day</Text>
              </View>
              {plan === 'monthly' ? (
                <View style={styles.checkCircle}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              ) : (
                <View style={styles.switchPill}>
                  <Text style={styles.switchPillText}>Switch</Text>
                </View>
              )}
            </Pressable>
          </View>
          <Text style={styles.caption}>A plan change takes effect at the end of the current period.</Text>
        </View>

        {/* manage */}
        <View style={styles.section}>
          <SectionLabel label="MANAGE" />
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL('https://play.google.com/store/account/subscriptions')}
              style={({ pressed }) => [styles.manageRow, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.manageTile}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"
                    stroke={GREEN}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.manageCopy}>
                <Text style={styles.manageTitle}>Manage in Google Play</Text>
                <Text style={styles.manageSub}>Cancel or change the plan.</Text>
              </View>
            </Pressable>
            <View style={[styles.manageRow, styles.manageRowLast]}>
              <View style={styles.manageTile}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 11a8 8 0 10-1.8 5M20 4v6h-6"
                    stroke={GREEN}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.manageCopy}>
                <Text style={styles.manageTitle}>Restore purchases</Text>
                <Text style={styles.manageSub}>If a purchase does not show correctly.</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Billing is handled by the App Store or Google Play. Cancellation takes effect at the end of the current
          period.
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
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  shieldTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusName: {
    color: HG.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  trialBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: GREEN_SOFT,
  },
  trialBadgeText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  statusSub: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  divider: {
    height: 1,
    backgroundColor: HG.border,
    marginVertical: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  metaKey: {
    color: HG.muted,
    fontSize: 13.5,
    fontWeight: '600',
  },
  metaValue: {
    color: HG.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: RED_SOFT,
    borderWidth: 1,
    borderColor: RED_BORDER,
    borderRadius: 12,
    padding: 11,
    marginTop: 10,
  },
  warnText: {
    flex: 1,
    color: RED,
    fontSize: 12.5,
    fontWeight: '700',
  },
  freeNote: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  section: {
    marginTop: 22,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  planRowLast: {
    borderBottomWidth: 0,
  },
  planRowCurrent: {
    backgroundColor: '#F6F1FE',
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    color: HG.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  currentBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: HG.purpleLight,
  },
  currentBadgeText: {
    color: HG.purpleDark,
    fontSize: 11,
    fontWeight: '800',
  },
  planPrice: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 3,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: HG.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: HG.border,
  },
  switchPillText: {
    color: HG.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  caption: {
    color: HG.faint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 9,
    paddingHorizontal: 2,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: HG.border,
  },
  manageRowLast: {
    borderBottomWidth: 0,
  },
  manageTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageCopy: {
    flex: 1,
    minWidth: 0,
  },
  manageTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  manageSub: {
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
    marginTop: 22,
    paddingHorizontal: 8,
  },
});

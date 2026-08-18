import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel } from '../components/SettingsUi';
import { formatDate } from '../lib/format';
import { CutSurface } from '../components/CutSurface';
import { t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

interface SubscriptionScreenProps {
  /** ISO date the promo keeps Pro on until; null = no active Pro. */
  promoProUntil: string | null;
  language?: AppLanguage;
  onBack: () => void;
  /** Opens the what-you-lose screen. */
  onManageMembership: () => void;
}

const GREEN = '#157A3A';
const GREEN_SOFT = '#E4F6EA';
const GREEN_DOT = '#1FA64E';
const RED = '#C0392B';
const RED_SOFT = '#FBEAE7';
const RED_BORDER = '#F3CFC9';

/**
 * Manage subscription — demo build. There is no billing integration yet; the
 * status reflects the redeemed promo when one is active, and the plan cards
 * are a preview of the intended pricing. "Manage in Google Play" opens the
 * real store subscriptions page.
 */
export function SubscriptionScreen({
  promoProUntil,
  language = 'en',
  onBack,
  onManageMembership,
}: SubscriptionScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <CutSurface size="sm" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.backButton}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </CutSurface>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'subs.title')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* status */}
        <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={[styles.card, styles.statusCard]}>
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
                <Text style={styles.statusName}>Vinha Pro</Text>
                {promoActive ? (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialBadgeText}>{t(language, 'subs.promo')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.statusSub}>
                {t(language, promoActive ? 'subs.promoUnlock' : 'subs.none')}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: promoActive ? GREEN_DOT : '#D8D2E6' }]} />
          </View>

          {promoActive ? (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t(language, 'subs.activated')}</Text>
                <Text style={styles.metaValue}>{formatDate(activatedDate!.toISOString(), language)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t(language, 'subs.ends')}</Text>
                <Text style={[styles.metaValue, endingSoon && { color: RED }]}>
                  {t(language, 'subs.endsValue', {
                    date: formatDate(endsDate!.toISOString(), language),
                    days: daysLeft,
                  })}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>{t(language, 'subs.autoRenew')}</Text>
                <Text style={[styles.metaValue, { color: RED }]}>{t(language, 'subs.off')}</Text>
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
                  <Text style={styles.warnText}>{t(language, 'subs.endsSoon')}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.divider} />
              <Text style={styles.freeNote}>{t(language, 'subs.freeNote')}</Text>
            </>
          )}
        </CutSurface>

        {/* Prices, not a plan switcher. There is no subscription to switch, so
            a CURRENT badge and a SWITCH pill were describing an account that
            does not exist. Selecting a row is a preview of what it would cost,
            and the caption says so. */}
        <View style={styles.section}>
          <SectionLabel label={t(language, 'subs.pricing')} />
          <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlan('yearly')}
              style={[styles.planRow, plan === 'yearly' && styles.planRowCurrent]}
            >
              <View style={styles.planCopy}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{t(language, 'subs.yearly')}</Text>
                  {plan === 'yearly' ? (
                    <CutSurface size="chip" fill={theme.purpleLight} style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t(language, 'subs.bestValue')}</Text>
                    </CutSurface>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>{t(language, 'subs.yearlyPrice')}</Text>
              </View>
              {plan === 'yearly' ? (
                <View style={styles.checkCircle}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlan('monthly')}
              style={[styles.planRow, styles.planRowLast, plan === 'monthly' && styles.planRowCurrent]}
            >
              <View style={styles.planCopy}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{t(language, 'subs.monthly')}</Text>
                </View>
                <Text style={styles.planPrice}>{t(language, 'subs.monthlyPrice')}</Text>
              </View>
              {plan === 'monthly' ? (
                <View style={styles.checkCircle}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12l5 5L19 7" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </Pressable>
          </CutSurface>
          <Text style={styles.caption}>{t(language, 'subs.changeCaption')}</Text>
        </View>

        {/* manage */}
        <View style={styles.section}>
          <SectionLabel label={t(language, 'subs.manage')} />
          <CutSurface size="lg" fill={theme.surface} stroke={theme.border} strokeWidth={1} style={styles.card}>
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
                <Text style={styles.manageTitle}>{t(language, 'subs.googlePlay')}</Text>
                <Text style={styles.manageSub}>{t(language, 'subs.googlePlaySub')}</Text>
              </View>
            </Pressable>
            {/* Replaces an inert Restore row. Restore needs a store account to
                ask, and there is none — this goes somewhere and says something
                true either way. */}
            <Pressable
              accessibilityRole="button"
              onPress={onManageMembership}
              style={({ pressed }) => [styles.manageRow, styles.manageRowLast, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.manageTile}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3l8 3v6c0 4.5-3.4 7.5-8 9-4.6-1.5-8-4.5-8-9V6z"
                    stroke={GREEN}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.manageCopy}>
                <Text style={styles.manageTitle}>{t(language, 'subs.manageMembership')}</Text>
                <Text style={styles.manageSub}>{t(language, 'subs.manageMembershipSub')}</Text>
              </View>
            </Pressable>
          </CutSurface>
        </View>

        <Text style={styles.footer}>{t(language, 'subs.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
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
    color: theme.ink,
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
    color: theme.muted,
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
    backgroundColor: theme.border,
    marginVertical: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  metaKey: {
    color: theme.muted,
    fontSize: 13.5,
    fontWeight: '600',
  },
  metaValue: {
    color: theme.ink,
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
    color: theme.muted,
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
    borderBottomColor: theme.border,
  },
  planRowLast: {
    borderBottomWidth: 0,
  },
  // A literal light lilac here put theme.ink text on a near-white fill under
  // the dark theme: the selected plan's name went invisible and only its price
  // showed. Same shape of bug as every other copied hex in this app.
  // No fill on the chosen row: the first row sits under the cut, and a
  // filled row shows a square corner through it. The filled circle and the
  // badge already say which one is chosen.
  planRowCurrent: {},
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
    color: theme.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  currentBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  currentBadgeText: {
    color: theme.purpleDark,
    fontSize: 11,
    fontWeight: '800',
  },
  planPrice: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 3,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  caption: {
    color: theme.faint,
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
    borderBottomColor: theme.border,
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
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  manageSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    color: theme.faint,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 22,
    paddingHorizontal: 8,
  },
});

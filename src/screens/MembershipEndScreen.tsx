import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW } from '../components/SettingsUi';
import { formatDate } from '../lib/format';
import { t } from '../lib/i18n';
import { MembershipSource, PRO_LIVE_BENEFITS, resolveMembershipEndPlan } from '../lib/proBenefits';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { AppLanguage } from '../types/models';

interface MembershipEndScreenProps {
  source: MembershipSource;
  /** ISO date a promo runs out on; null when Pro is not promo-based. */
  promoUntil: string | null;
  language?: AppLanguage;
  onBack: () => void;
  /** Keeps Pro — goes back to the Pro page. */
  onKeep: () => void;
  /** Ends Pro immediately. Only offered when the app can actually do it. */
  onEndNow: () => void;
}

const RED = '#C0392B';
const RED_SOFT = '#FBEAE7';

/**
 * The moment before Pro goes away: everything it does, struck through.
 *
 * Borrowed from the pattern every subscription app uses at cancel time, and it
 * works because it is specific — not "you will lose Pro" but the nine things
 * that stop happening. The list comes from PRO_LIVE_BENEFITS rather than being
 * written here, so it cannot drift into threatening the loss of a feature the
 * code never gated.
 *
 * What this screen refuses to do is offer a cancel button with nothing behind
 * it. Pro from a promo cannot be cancelled — it lapses, and the screen says
 * when. Pro from the demo switch can be turned off, so that button appears.
 * Once billing exists, a third case sends the user to the store.
 */
export function MembershipEndScreen({
  source,
  promoUntil,
  language = 'en',
  onBack,
  onKeep,
  onEndNow,
}: MembershipEndScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const plan = resolveMembershipEndPlan(source, promoUntil);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'membership.end.header')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.title}>{t(language, 'membership.end.title')}</Text>
        <Text style={styles.lead}>
          {plan.lapsesOn
            ? t(language, 'membership.end.leadPromo', {
                date: formatDate(plan.lapsesOn, language),
              })
            : t(language, 'membership.end.lead')}
        </Text>

        {/* One card, one line each. The descriptions moved out on purpose: nine
            of them turned the list into a page you had to scroll, and a loss
            you have to scroll to see is not a loss you feel. Every title
            stands on its own — Smart rest timing, Dark theme — so the body
            copy was explaining what the label already said. */}
        <View style={styles.list}>
          {PRO_LIVE_BENEFITS.map((benefit, index) => (
            <View
              key={benefit.titleKey}
              style={[styles.row, index < PRO_LIVE_BENEFITS.length - 1 && styles.rowDivider]}
            >
              <View style={styles.crossTile}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={RED} strokeWidth={3} strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {t(language, benefit.titleKey)}
              </Text>
            </View>
          ))}
        </View>

        {/* The one thing that does NOT stop. It carries the reassurance now
            that the lead is a single sentence. */}
        <View style={styles.keepsRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12l5 5L19 7"
              stroke={theme.greenInk}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.keepsText}>{t(language, 'membership.end.keeps')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onKeep}
          style={({ pressed }) => [styles.keepButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.keepButtonText}>{t(language, 'membership.end.keepCta')}</Text>
        </Pressable>

        {plan.canEndNow ? (
          <Pressable
            accessibilityRole="button"
            onPress={onEndNow}
            style={({ pressed }) => [styles.endButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.endButtonText}>{t(language, 'membership.end.endCta')}</Text>
          </Pressable>
        ) : (
          // No button, because there is no action. A greyed-out "Cancel" here
          // would read as something the app is refusing to let you do.
          <Text style={styles.noActionNote}>
            {plan.lapsesOn
              ? t(language, 'membership.end.noActionPromo', {
                  date: formatDate(plan.lapsesOn, language),
                })
              : t(language, 'membership.end.noAction')}
          </Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Sized to land the whole list above the footer on a normal phone. The
    // ScrollView stays as a safety net for a large accessibility font, but on
    // the default one nothing here should need scrolling.
    body: {
      paddingHorizontal: 18,
      paddingTop: 4,
      paddingBottom: 14,
    },
    title: {
      color: theme.ink,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    lead: {
      color: theme.muted,
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 17,
      marginTop: 5,
      marginBottom: 13,
    },
    // One container with hairlines rather than nine floating cards: the gaps
    // between cards were costing more height than the rows themselves, and a
    // single block reads as one list instead of nine separate warnings.
    list: {
      backgroundColor: theme.surfaceSoft,
      borderRadius: 15,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 13,
      height: 43,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    crossTile: {
      width: 21,
      height: 21,
      borderRadius: 11,
      backgroundColor: RED_SOFT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The strike-through is the whole point: it reads as taken away rather
    // than as a list of features.
    rowTitle: {
      flex: 1,
      color: theme.muted,
      fontSize: 13,
      fontWeight: '700',
      textDecorationLine: 'line-through',
    },
    keepsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 2,
    },
    keepsText: {
      flex: 1,
      color: theme.faint,
      fontSize: 11.5,
      fontWeight: '600',
      lineHeight: 16,
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      ...CARD_SHADOW,
    },
    // highlight, not purple: the app's rule is orange = the thing to press,
    // violet = the brand. Purple resolves it in the light theme, orange in the
    // dark one, and onHighlight follows so the label stays legible on both —
    // a fixed #FFFFFF here would be white on orange.
    keepButton: {
      height: 50,
      borderRadius: 15,
      backgroundColor: theme.highlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keepButtonText: {
      color: theme.onHighlight,
      fontSize: 15.5,
      fontWeight: '800',
    },
    endButton: {
      height: 46,
      borderRadius: 15,
      backgroundColor: RED_SOFT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    endButtonText: {
      color: RED,
      fontSize: 15,
      fontWeight: '800',
    },
    noActionNote: {
      color: theme.faint,
      fontSize: 12.5,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 11,
    },
  });

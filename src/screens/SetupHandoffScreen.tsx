import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VinhaIcon } from '../components/VinhaIcon';
import { TrackChangeDialog } from '../components/TrackChangeDialog';
import { t } from '../lib/i18n';
import { countSetupHandoffOffers, type SetupHandoffPlan } from '../lib/setupHandoff';
import { radii, spacing } from '../theme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage, MeasurementKind } from '../types/models';

export interface SetupHandoffChoices {
  addWidget: boolean;
  pinTrackingCard: boolean;
  pinBodyweightCard: boolean;
  /** Start Google sign-in after the other choices land. Free and Pro alike. */
  signInForBackup: boolean;
  /**
   * Open the Pro page once everything else has landed.
   *
   * Not a row and not a page of its own any more (user, 2026-09-10). A page in
   * the middle of onboarding that described Pro was a summary of the page that
   * describes Pro; the reader now simply arrives at the real one, once, on the
   * way to Home. False for anybody who already has Pro.
   */
  showPro: boolean;
  /**
   * The measured sites the reader wants on Home, at most four.
   *
   * Replaces the two card rows (user, 2026-09-10): "track your chest" and
   * "track your weight" were two switches out of nine possible sites, chosen
   * for the reader by the questionnaire. The dialog asks the question once and
   * lets them answer it themselves — the card key IS the site's name, so this
   * list goes straight to Home's pinned keys.
   */
  trackedSites: MeasurementKind[];
}

interface SetupHandoffScreenProps {
  language: AppLanguage;
  plan: SetupHandoffPlan;
  /**
   * What the reader called it, already localised — "Glutes", not "hips". The tape
   * is how it gets measured; the focus is what they said they were training, and
   * that is the thing to repeat back to them.
   */
  focusLabel: string | null;
  onDone: (choices: SetupHandoffChoices) => void;
  onSkip: () => void;
  /**
   * Opens one of the two documents without leaving onboarding. The legal screen
   * lives on the Profile tab, and navigating there mid-flow would end the flow;
   * the shell renders it over this screen instead and comes back here.
   */
  onOpenLegal: (document: 'privacy' | 'terms') => void;
}

/**
 * The last step of onboarding, and the only one that is not a question.
 *
 * Onboarding used to end by dropping the reader on Home with everything switched
 * off. Two things they would otherwise have to go and find are offered here
 * instead — the widget, and a card that tracks the body part they just named.
 *
 * Both are pre-selected, and both are one tap to turn off. That is the honest
 * shape for an offer the reader did not ask for: opt-out, visible, and reversible
 * from Settings afterwards, which the copy says out loud.
 */
export function SetupHandoffScreen({
  language,
  plan,
  focusLabel,
  onDone,
  onSkip,
  onOpenLegal,
}: SetupHandoffScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [addWidget, setAddWidget] = useState(true);
  const [trackedSites, setTrackedSites] = useState<MeasurementKind[]>([]);
  // Also off by default, and for a stronger reason: an account is a bigger
  // ask than a widget, and the decision (2026-08-22) is that sign-in stands
  // beside the door, never in it.
  const [signInForBackup, setSignInForBackup] = useState(false);

  const trackingBody = useMemo(() => {
    if (!plan.tracking) {
      return '';
    }
    if (!plan.tracking.focus || !focusLabel) {
      return t(language, 'handoff.track.bodyweight');
    }
    return t(language, 'handoff.track.body', { focus: focusLabel });
  }, [focusLabel, language, plan.tracking]);

  // The heading counts what is on the screen. With the widget already placed
  // (any phone that has had the app before) only the card is offered, and
  // "Two things · both take one tap" was a promise the screen did not keep.
  const offerCount = countSetupHandoffOffers(plan);
  const titleKey = offerCount === 1 ? 'handoff.titleOne' : offerCount === 2 ? 'handoff.title' : 'handoff.titleMany';

  /**
   * Three pages where there used to be one list (user, 2026-09-10).
   *
   * Sign-in and Pro were rows among five, and both are decisions rather than
   * switches: one asks for an account, the other opens a price list. A row in
   * a list is the wrong shape for either, so each got the screen it needs and
   * the remaining switches keep the list.
   *
   * Built from the plan rather than fixed, so a reader who is already signed
   * in never sees a sign-in page and a reader who bought Pro never sees a Pro
   * page — the same rule the rows already followed.
   */
  const pages = [
    ...(plan.offerAccountBackup ? (['signin'] as const) : []),
    'tracking' as const,
    // Only when it has something on it. With sign-in, Pro and the sites all
    // moved to pages of their own, the widget is the last row left — and on a
    // launcher that cannot pin one, the reader met a page with a title, a
    // terms line and nothing between them (user, 2026-09-10).
    ...(plan.offerWidget ? (['offers'] as const) : []),
  ];
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  const finish = () =>
    onDone({
      addWidget: plan.offerWidget && addWidget,
      pinTrackingCard: false,
      pinBodyweightCard: false,
      trackedSites,
      signInForBackup: plan.offerAccountBackup && signInForBackup,
      showPro: plan.offerPro,
    });

  /**
   * Next page, or out — and the second half is the point.
   *
   * `advance` used to clamp to the last index, so on the last page it moved to
   * the page it was already on and nothing happened. With the widget row gone
   * from most phones, the tracking dialog IS the last page, and its Done
   * button was dead: tapped, nothing, no way forward (user, 2026-09-10).
   */
  const advance = () => {
    if (pageIndex >= pages.length - 1) {
      finish();
      return;
    }
    setPageIndex((current) => current + 1);
  };

  if (page === 'signin') {
    return (
      <View style={styles.screen}>
        <View style={[styles.pageBody, styles.pageBodyCentred]}>
          <View style={styles.pageGlyph}>
            <GoogleGlyph size={34} />
          </View>
          {/* No heading (user, 2026-09-10). The G says which sign-in this is
              and the sentence says what it buys; a title between them was a
              third way of saying the same thing. */}
          <Text style={[styles.pageText, styles.pageTextCentred]}>{t(language, 'handoff.signin.body')}</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, GESTURE_BAR_FLOOR) + spacing.md }]}>
          {/* The one page in onboarding where an account is asked for, so the
              terms live here rather than under a list of switches. */}
          <Text style={styles.legalLine}>{t(language, 'handoff.legal')}</Text>
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => onOpenLegal('terms')}>
              <Text style={styles.legalLink}>{t(language, 'settings.terms')}</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable accessibilityRole="link" onPress={() => onOpenLegal('privacy')}>
              <Text style={styles.legalLink}>{t(language, 'settings.privacy')}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSignInForBackup(true);
              advance();
            }}
            style={({ pressed }) => [styles.googleCta, pressed && styles.pressed]}
          >
            <GoogleGlyph size={18} />
            <Text style={styles.googleCtaText}>{t(language, 'handoff.signin.cta')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={advance} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.pageSkip}>{t(language, 'handoff.signin.skip')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Over the page rather than instead of it, which is how the reader met
          this shape on the way in: the theme question is a dialog on top of
          the screen behind it. */}
      <TrackChangeDialog
        visible={page === 'tracking'}
        language={language}
        selected={trackedSites}
        offered={plan.trackedSiteOptions}
        onChange={setTrackedSites}
        onDone={advance}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t(language, titleKey)}</Text>

      {plan.offerWidget ? (
        <OfferRow
          icon="clock"
          title={t(language, 'handoff.widget.title')}
          body={t(language, 'handoff.widget.body')}
          selected={addWidget}
          onToggle={() => setAddWidget((current) => !current)}
        />
      ) : null}


      </ScrollView>

      {/* Out of the scroll and against the foot of the screen, where every
          other done/proceed button in this app sits (user 2026-08-31). Inside
          the list it followed the last row, so with two offers it stopped
          halfway up the screen and the thumb had to go looking.

          No "Not now" (user, 2026-08-19): every row is its own on/off, so
          Done with everything off already is "not now", and a second exit
          under the first was a choice that did not exist. */}
      {/* The inset, read here rather than assumed: a footer pinned to the
          bottom of the screen sits under the gesture bar without it, and the
          button came out with its label sliced in half.

          With a floor under it, because reading it is not the same as getting
          it: on this screen it comes back 0, and the gesture pill was drawn
          on its bottom edge. Measured on the emulator 2026-09-08: the button
          ended at y=2368 of 2400 with 31px under it, and the pill is drawn at
          y=2364..2372. An inset that can be zero is not a clearance, so the
          larger of the two wins — 164px under the button now. */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, GESTURE_BAR_FLOOR) + spacing.md },
        ]}
      >
        {/* The one place onboarding names the documents. It sits here, on the
            last screen, for the same reason a shop puts the terms at the till
            rather than the door: this is the step where the reader can start
            the backup, which is the first thing that would leave the phone. A
            line, not a checkbox — nothing here is consented to by tapping
            Done, and the two features that do need a yes ask for it in their
            own moment. */}
        <Text style={styles.legalLine}>{t(language, 'handoff.legal')}</Text>
        <View style={styles.legalLinks}>
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenLegal('terms')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.legalLink}>{t(language, 'settings.terms')}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenLegal('privacy')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.legalLink}>{t(language, 'settings.privacy')}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>{t(language, 'handoff.done')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The four-colour Google G, for the sign-in offer row. */
function GoogleGlyph({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function OfferRow({
  icon,
  title,
  body,
  selected,
  onToggle,
}: {
  icon: 'clock' | 'progress' | 'scale' | 'google' | 'lightning';
  title: string;
  body: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        {icon === 'google' ? (
          <GoogleGlyph size={20} />
        ) : (
          <VinhaIcon name={icon} size={20} color={theme.highlight} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <VinhaIcon name="check" size={14} color={theme.onHighlight} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * What the gesture bar needs when the inset says nothing.
 *
 * Android reports 24dp for the gesture area on the devices that have one, and
 * this screen gets 0 — so the floor is that 24, not a number picked to make a
 * screenshot look right.
 */
const GESTURE_BAR_FLOOR = 24;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    // The scroll view carries the background too: its content is shorter than
    // the screen, and without this the card ended in a visible seam.
    screen: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: 72,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      backgroundColor: theme.surface,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -0.4,
    },
    body: {
      fontSize: 14.5,
      lineHeight: 21,
      color: theme.muted,
      marginBottom: spacing.sm,
    },
    // Each row is a decision, not a list item: the reader is meant to read
    // it and answer it. At 15.5/13 in medium padding they read as settings
    // someone had already dealt with (user 2026-08-31).
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
      paddingHorizontal: 18,
      paddingVertical: 20,
    },
    rowSelected: {
      borderColor: theme.accent,
    },
    rowIcon: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '800',
      color: theme.ink,
      letterSpacing: -0.2,
    },
    rowBody: {
      fontSize: 15,
      lineHeight: 20,
      color: theme.muted,
    },
    check: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: theme.surface,
    },
    /**
     * A page, not a row: one idea centred in the space a list would have used.
     * Both new pages share it, so the sign-in and the Pro page are the same
     * shape and only their words differ.
     */
    pageBody: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    pageGlyph: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pageTitle: {
      color: theme.ink,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    pageText: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
    },
    /** The sign-in page centres on its mark: one logo, one promise under it. */
    pageBodyCentred: {
      alignItems: 'center',
    },
    pageTitleCentred: {
      textAlign: 'center',
    },
    pageTextCentred: {
      textAlign: 'center',
    },
    /** The way past a page without taking what it offers. */
    pageSkip: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: spacing.sm,
    },
    googleCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    googleCtaText: {
      color: theme.ink,
      fontSize: 16,
      fontWeight: '800',
    },
    legalLine: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
    },
    legalLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    legalLink: {
      color: theme.purple,
      fontSize: 12,
      fontWeight: '700',
      // The tap target the 12pt label does not give on its own.
      paddingVertical: 6,
    },
    legalDot: {
      color: theme.faint,
      fontSize: 12,
    },
    /**
     * The shape every other screen in this flow ends on.
     *
     * This one was the A3 cut button at 50dp — a cut corner and a diagonal
     * sheen, on the last screen of a flow whose five previous footers are all
     * plain rounded rectangles at 56–62dp. It read as a different app arriving
     * for the final step (user 2026-09-08, "eri mallinen kuin muualla").
     *
     * The colour is the action accent rather than the brand violet, because
     * this screen already marks its chosen rows with it, and the screen the
     * button leads to starts its workouts with it.
     */
    done: {
      minHeight: 62,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    doneText: {
      color: theme.onHighlight,
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    skip: {
      alignSelf: 'center',
      marginTop: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    skipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.muted,
    },
    pressed: {
      opacity: 0.85,
    },
  });

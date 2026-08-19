import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CutButton } from '../components/CutButton';
import { VinhaIcon } from '../components/VinhaIcon';
import { t } from '../lib/i18n';
import { countSetupHandoffOffers, type SetupHandoffPlan } from '../lib/setupHandoff';
import { radii, spacing } from '../theme';
import { Theme, useTheme, useThemedStyles } from '../theming';
import type { AppLanguage } from '../types/models';

export interface SetupHandoffChoices {
  addWidget: boolean;
  pinTrackingCard: boolean;
  pinBodyweightCard: boolean;
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
}: SetupHandoffScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const [addWidget, setAddWidget] = useState(true);
  const [pinTrackingCard, setPinTrackingCard] = useState(true);
  // Off by default: the focus card is the one the questionnaire earned; this
  // one is offered, not assumed.
  const [pinBodyweightCard, setPinBodyweightCard] = useState(false);

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
  const bodyKey = offerCount === 1 ? 'handoff.bodyOne' : offerCount === 2 ? 'handoff.body' : 'handoff.bodyMany';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t(language, titleKey)}</Text>
      <Text style={styles.body}>{t(language, bodyKey)}</Text>

      {plan.offerWidget ? (
        <OfferRow
          icon="clock"
          title={t(language, 'handoff.widget.title')}
          body={t(language, 'handoff.widget.body')}
          selected={addWidget}
          onToggle={() => setAddWidget((current) => !current)}
        />
      ) : null}

      {plan.tracking ? (
        <OfferRow
          icon="progress"
          title={t(language, 'handoff.track.title')}
          body={trackingBody}
          selected={pinTrackingCard}
          onToggle={() => setPinTrackingCard((current) => !current)}
        />
      ) : null}

      {plan.offerBodyweight ? (
        <OfferRow
          icon="scale"
          title={t(language, 'handoff.weight.title')}
          body={t(language, 'handoff.track.bodyweight')}
          selected={pinBodyweightCard}
          onToggle={() => setPinBodyweightCard((current) => !current)}
        />
      ) : null}

      {/* No "Not now" (user, 2026-08-19): every row is its own on/off, so
          Done with everything off already is "not now", and a second exit under
          the first was a choice that did not exist. */}
      <CutButton
        label={t(language, 'handoff.done')}
        size="lg"
        stretch
        style={styles.done}
        onPress={() =>
          onDone({
            addWidget: plan.offerWidget && addWidget,
            pinTrackingCard: plan.tracking !== null && pinTrackingCard,
            pinBodyweightCard: plan.offerBodyweight && pinBodyweightCard,
          })
        }
      />
    </ScrollView>
  );
}

function OfferRow({
  icon,
  title,
  body,
  selected,
  onToggle,
}: {
  icon: 'clock' | 'progress' | 'scale';
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
        <VinhaIcon name={icon} size={20} color={theme.highlight} />
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surfaceSoft,
      padding: spacing.md,
    },
    rowSelected: {
      borderColor: theme.accent,
    },
    rowIcon: {
      width: 40,
      height: 40,
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
      fontSize: 15.5,
      fontWeight: '700',
      color: theme.ink,
    },
    rowBody: {
      fontSize: 13,
      color: theme.muted,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    done: {
      marginTop: spacing.md,
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

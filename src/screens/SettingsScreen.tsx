import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { t } from '../lib/i18n';
import { resolveProEntitlement } from '../lib/proEntitlement';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { appInfo, layout } from '../theme';
import { AppLanguage, AppPreferences } from '../types/models';

interface SettingsScreenProps {
  preferences: AppPreferences;
  /** ISO timestamp of the first completed session — the honest "member since". */
  firstSessionAt: string | null;
  onBack: () => void;
  onPreferencesChange: (patch: Partial<AppPreferences>) => void;
  onOpenMyData: () => void;
  onOpenEditProfile: () => void;
  /** Opens the paste-CSV sheet — the same importer the Programs tab uses. */
  onImportPlan: () => void;
  onExportPlan: () => void;
  /**
   * Null on devices that cannot pin a widget — the row is hidden rather than
   * shown as something that would do nothing.
   */
  homeWidget?: { added: boolean; onAdd: () => void } | null;
  onOpenNotifications: () => void;
  onOpenTrainingBreak: () => void;
  onOpenPromo: () => void;
  onOpenSubscription: () => void;
  /**
   * The ONE Pro page. Every place a reader shows interest in Pro — the
   * locked theme row, the subscription row before there is a subscription
   * — goes here, not to the management screen with its price rows.
   * Management is for people who already pay.
   */
  onOpenPremium: () => void;
  onOpenLegal: (document: 'privacy' | 'terms') => void;
  /** Opens the same rating sheet the finish flow shows. */
  onOpenRating: () => void;
  /**
   * Where the list was scrolled when a sub-screen was opened, so coming
   * back lands on the row that was tapped instead of the top (user,
   * 2026-08-22). The parent owns the value because this screen unmounts.
   */
  initialScrollOffset?: number;
  onScrollOffsetChange?: (offsetY: number) => void;
  onResetAllData: () => void;
  /**
   * Null in builds without a configured sign-in — the rows are hidden rather
   * than shown as buttons that would do nothing. Free and Pro alike.
   */
  account?: {
    signedIn: boolean;
    email: string | null;
    lastBackupAt: string | null;
    busy: boolean;
    onSignIn: () => void;
    onBackupNow: () => void;
    onSignOut: () => void;
    onDeleteRemote: () => void;
  } | null;
}

const RED = '#C0392B';
const RED_SOFT = '#FBEAE7';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function memberSinceLabel(firstSessionAt: string | null, language: AppLanguage) {
  if (!firstSessionAt) {
    return t(language, 'settings.newHere');
  }
  const date = new Date(firstSessionAt);
  if (Number.isNaN(date.getTime())) {
    return t(language, 'settings.newHere');
  }
  const dateLabel =
    language === 'fi' ? `${date.getMonth() + 1}/${date.getFullYear()}` : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return t(language, 'settings.memberSince', { date: dateLabel });
}

function getInitials(name: string | null) {
  if (!name?.trim()) {
    return 'V';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? 'V';
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

/* Prototype icon set (psuite-shared.jsx `Ic`): 24x24 strokes, 20px in the tile. */
const IC_PATHS: Record<string, string> = {
  gift: 'M4 11h16v9H4zM4 8h16v3H4zM12 8v12M12 8S9 3 6.5 5 8 8 12 8zM12 8s3-5 5.5-3S16 8 12 8',
  moon: 'M20 14a8 8 0 01-10-10 8 8 0 1010 10z',
  bell: 'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  chat: 'M4 5h16v11H9l-4 4V5z',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  heart: 'M12 20S4 14 4 9a4 4 0 017.5-2A4 4 0 0120 9c0 5-8 11-8 11z',
  pause: 'M4 12a8 8 0 1116 0M8 9v6M16 9v6',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.5 3.6-5.5 8-5.5s8 2 8 5.5',
  body: 'M12 4a1.6 1.6 0 100 .1M5 8h14M9 8v4l-1.5 8M15 8v4l1.5 8',
  tag: 'M4 4h7l9 9-7 7-9-9zM8 8h.01',
  card: 'M3 6h18v12H3zM3 10h18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  shield: 'M12 3l8 3v6c0 4.5-3.4 7.5-8 9-4.6-1.5-8-4.5-8-9V6z',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  analytics: 'M4 20V4M4 20h16M8 16l3-4 3 2 4-6',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 6l6 6-6 6',
  star: 'm12 3.5 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85z',
};

function Ic({ n, c, s = 20, sw = 2 }: { n: string; c?: string; s?: number; sw?: number }) {
  // A parameter default cannot reach a hook; resolve it in the body.
  const theme = useTheme();
  const stroke = c ?? theme.purpleDark;

  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d={IC_PATHS[n] ?? ''} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Prototype Seg: track #EEE8FA r12 pad3, active pill white r9, 13/800. */
function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.seg}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.key)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Prototype Row: 13px/15px padding, 36 tile r11, hairline divider inside a Card. */
/** "22.8.2026 14.32" — the date alone hid every same-day backup. */
function backupTimeLabel(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.toLocaleDateString()} ${hh}:${mm}`;
}

function Row({
  icon,
  iconColor,
  title,
  sub,
  subNode,
  value,
  control,
  chevron = false,
  danger = false,
  last = false,
  onPress,
}: {
  icon: string;
  iconColor?: string;
  title: string;
  sub?: string;
  /** Rich subtitle; wins over `sub` when both are given. */
  subNode?: React.ReactNode;
  value?: string;
  control?: React.ReactNode;
  chevron?: boolean;
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const styles = useThemedStyles(makeStyles);

  const inner = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={[styles.rowTile, danger && { backgroundColor: RED_SOFT }]}>
        <Ic n={icon} c={danger ? RED : iconColor ?? theme.purpleDark} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && { color: RED }]}>{title}</Text>
        {subNode ?? (sub ? <Text style={styles.rowSub}>{sub}</Text> : null)}
      </View>
      {value !== undefined ? <Text style={styles.rowValue}>{value}</Text> : null}
      {control}
      {chevron ? <Ic n="chevron" c={theme.faint} s={18} sw={2.2} /> : null}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

/**
 * Settings, pushed from the Profile gear. Mirrors psuite-screens1.jsx
 * SettingsMenu.
 *
 * Every row here either does something or states a fact. The two that asserted
 * an account the app does not have are gone, CSV import/export reach the real
 * importer and exporter, and the theme row became a live switch when the
 * engine landed (2026-08-01). If a row is added back without a handler, say
 * why in a comment.
 */
export function SettingsScreen({
  preferences,
  firstSessionAt,
  onBack,
  onPreferencesChange,
  onOpenMyData,
  onOpenEditProfile,
  onImportPlan,
  onExportPlan,
  homeWidget = null,
  onOpenNotifications,
  onOpenTrainingBreak,
  onOpenPromo,
  onOpenSubscription,
  onOpenPremium,
  onOpenLegal,
  onOpenRating,
  onResetAllData,
  account,
  initialScrollOffset = 0,
  onScrollOffsetChange,
}: SettingsScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [resetVisible, setResetVisible] = useState(false);
  const language = preferences.appLanguage;
  // A redeemed promo is Pro too, so the badge cannot read the preview switch.
  const proUnlocked = resolveProEntitlement(preferences).unlocked;
  const scrollRef = useRef<ScrollView>(null);
  const restoredRef = useRef(false);
  const displayName = preferences.profileName?.trim() ? preferences.profileName.trim() : t(language, 'profile.guestName');
  const soundAndHaptics = preferences.soundCuesEnabled || preferences.hapticsEnabled;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'settings.a11y.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ic n="back" c={theme.ink} s={20} sw={2.4} />
        </Pressable>
        <ScreenHeaderTitle title={t(language, 'settings.title')} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        scrollEventThrottle={64}
        onScroll={(event) => onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
        onContentSizeChange={() => {
          // contentOffset is iOS-only, so the restore is a one-time scrollTo
          // once the content is tall enough to hold the old position.
          if (!restoredRef.current && initialScrollOffset > 0) {
            restoredRef.current = true;
            scrollRef.current?.scrollTo({ y: initialScrollOffset, animated: false });
          }
        }}
      >
        {/* profile chip */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'settings.a11y.editProfile')}
          onPress={onOpenEditProfile}
          style={({ pressed }) => [styles.profileChip, pressed && styles.pressed]}
        >
          <View style={styles.profileChipAvatar}>
            <Svg width={52} height={52} viewBox="0 0 52 52" style={StyleSheet.absoluteFill as object}>
              <Defs>
                <LinearGradient id="chipAv" x1="0" y1="0" x2="0.6" y2="1">
                  <Stop offset="0" stopColor="#2A1B4E" />
                  <Stop offset="1" stopColor="#5B21B6" />
                </LinearGradient>
              </Defs>
              <Circle cx={26} cy={26} r={26} fill="url(#chipAv)" />
            </Svg>
            <Text style={styles.profileChipInitials}>{getInitials(preferences.profileName)}</Text>
          </View>
          <View style={styles.profileChipCopy}>
            <Text numberOfLines={1} style={styles.profileChipName}>
              {displayName}
            </Text>
            <Text style={styles.profileChipMeta}>{memberSinceLabel(firstSessionAt, language)}</Text>
            {proUnlocked ? (
              <View style={styles.proBadge}>
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path d={IC_PATHS.spark} fill={theme.purpleDark} />
                </Svg>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            ) : null}
          </View>
          <Ic n="chevron" c={theme.faint} s={18} sw={2.2} />
        </Pressable>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.app')} />
          <View style={styles.card}>
            {/* One switch, for everyone. This row had two states — a live
                switch for Pro and a PRO pill for everyone else — until the
                gate came off on 2026-08-23. Nothing here consults the
                entitlement any more, which is the point: a leftover lock is
                how a removed gate keeps haunting the app. */}
            <Row
              icon="moon"
              title={t(language, 'settings.darkTheme')}
              sub={t(language, 'settings.darkTheme.sub')}
              control={
                <ToggleSwitch
                  label={t(language, 'settings.darkTheme')}
                  value={preferences.darkThemeEnabled}
                  onChange={(next) => onPreferencesChange({ darkThemeEnabled: next })}
                />
              }
            />
            <Row
              icon="bell"
              title={t(language, 'settings.soundHaptics')}
              sub={t(language, 'settings.soundHaptics.sub')}
              control={
                <ToggleSwitch
                  label={t(language, 'settings.soundHaptics')}
                  value={soundAndHaptics}
                  onChange={(next) => onPreferencesChange({ soundCuesEnabled: next, hapticsEnabled: next })}
                />
              }
            />
            <Row
              icon="sun"
              title={t(language, 'settings.keepAwake')}
              sub={t(language, 'settings.keepAwake.sub')}
              control={
                <ToggleSwitch
                  label={t(language, 'settings.keepAwake')}
                  value={preferences.keepScreenAwakeDuringWorkout}
                  onChange={(next) => onPreferencesChange({ keepScreenAwakeDuringWorkout: next })}
                />
              }
            />
            <Row
              icon="chat"
              title={t(language, 'settings.language')}
              last
              control={
                <Seg
                  options={[
                    { key: 'fi', label: 'FIN' },
                    { key: 'en', label: 'ENG' },
                  ]}
                  value={preferences.appLanguage}
                  onChange={(next: AppLanguage) => onPreferencesChange({ appLanguage: next })}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.training')} />
          <View style={styles.card}>
            {/* Smart progression removed — returns later as a Pro feature. */}
            {/* Health Connect removed for v1 — returns in v2 as a workout
                export rather than a body-stats import. */}
            <Row
              icon="pause"
              title={t(language, 'settings.trainingBreak')}
              sub={t(language, 'settings.trainingBreak.sub')}
              chevron
              last
              onPress={onOpenTrainingBreak}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.account')} />
          <View style={styles.card}>
            {/* Edit profile row dropped — the profile chip above is the entry. */}
            <Row
              icon="bell"
              title={t(language, 'settings.notifications')}
              sub={t(language, 'settings.notifications.sub')}
              chevron
              onPress={onOpenNotifications}
            />
            <Row icon="body" title={t(language, 'settings.myData')} sub={t(language, 'settings.myData.sub')} chevron onPress={onOpenMyData} />
            <Row icon="tag" title={t(language, 'settings.promo')} chevron onPress={onOpenPromo} />
            {/* Before Pro the row is the way to Pro; after, it manages it. */}
            <Row
              icon="card"
              title={t(language, proUnlocked ? 'settings.subscription' : 'settings.pro')}
              chevron
              last
              onPress={proUnlocked ? onOpenSubscription : onOpenPremium}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.yourData')} />
          <View style={styles.card}>
            {/* Sign in and the data survives a new phone. Hidden when the build
                has no sign-in configured; free and Pro alike (2026-08-22). */}
            {account && !account.signedIn ? (
              <Row
                icon="shield"
                title={t(language, 'account.signIn')}
                sub={t(language, 'account.signIn.sub')}
                chevron
                onPress={account.busy ? undefined : account.onSignIn}
              />
            ) : null}
            {account && account.signedIn ? (
              <Row
                icon="shield"
                title={t(language, 'account.backupNow')}
                // Just the identity and, in green, when the cloud copy was
                // last written (user, 2026-08-22). Green only once a backup
                // exists — "never" is not a success state.
                subNode={
                  <Text style={styles.rowSub}>
                    {account.email ? `${account.email} · ` : ''}
                    {account.lastBackupAt ? (
                      <Text style={styles.rowSubOk}>{backupTimeLabel(account.lastBackupAt)}</Text>
                    ) : (
                      t(language, 'account.noBackupYet')
                    )}
                  </Text>
                }
                chevron
                onPress={account.busy ? undefined : account.onBackupNow}
              />
            ) : null}
            <Row
              icon="upload"
              title={t(language, 'settings.importCsv')}
              sub={t(language, 'settings.importCsv.sub')}
              chevron
              onPress={onImportPlan}
            />
            <Row
              icon="download"
              title={t(language, 'settings.exportCsv')}
              sub={t(language, 'settings.exportCsv.sub')}
              chevron
              last={!homeWidget}
              onPress={onExportPlan}
            />
            {/* Hidden entirely where pinning is unsupported. When the widget is
                already placed the row states that instead of offering again —
                Android will happily pin a second copy otherwise. */}
            {homeWidget ? (
              <Row
                icon="calendar"
                title={t(language, 'settings.widget')}
                sub={t(language, homeWidget.added ? 'settings.widget.added' : 'settings.widget.sub')}
                chevron={!homeWidget.added}
                last
                onPress={homeWidget.added ? undefined : homeWidget.onAdd}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.about')} />
          <View style={styles.card}>
            {/* The no-analytics fact moved into the privacy policy alone —
                a row restating one sentence of it was a sign explaining a
                sign (removed with the AI-info and support rows, 2026-08-22). */}
            {/* Hidden once rated, like the sheet — the reader has done it,
                and the app has nothing left to ask for (user 2026-08-24:
                "kerran kun suorittaa se lähtee kaikkialta"). */}
            {preferences.ratingPrompt.rated ? null : (
              <Row
                icon="star"
                title={t(language, 'settings.rate')}
                sub={t(language, 'settings.rate.sub')}
                chevron
                onPress={onOpenRating}
              />
            )}
            <Row
              icon="shield"
              title={t(language, 'settings.privacy')}
              chevron
              onPress={() => onOpenLegal('privacy')}
            />
            <Row icon="doc" title={t(language, 'settings.terms')} chevron last onPress={() => onOpenLegal('terms')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.dangerZone')} />
          <View style={styles.card}>
            {/* Everything that removes or detaches lives here in red — the
                cloud copy, the account, the data (user, 2026-08-22). The
                sign-in offer itself stays up in YOUR DATA, because signing
                in is not a danger. */}
            {account && account.signedIn ? (
              <>
                <Row
                  icon="trash"
                  title={t(language, 'account.deleteRemote')}
                  sub={t(language, 'account.deleteRemote.sub')}
                  danger
                  onPress={account.busy ? undefined : account.onDeleteRemote}
                />
                <Row
                  icon="body"
                  title={t(language, 'account.signOut')}
                  danger
                  onPress={account.busy ? undefined : account.onSignOut}
                />
              </>
            ) : null}
            <Row
              icon="trash"
              title={t(language, 'settings.resetData')}
              sub={t(language, 'settings.resetData.sub')}
              danger
              last
              onPress={() => setResetVisible(true)}
            />
          </View>
        </View>

        <Text style={styles.footer}>Vinha · v{appInfo.version}</Text>
      </ScrollView>

      <ConfirmDialog
        language={language}
        visible={resetVisible}
        title={t(language, 'settings.resetData')}
        message={t(language, 'settings.resetDialog.message')}
        confirmLabel={t(language, 'settings.resetDialog.confirm')}
        cancelLabel={t(language, 'common.cancel')}
        destructive
        onCancel={() => setResetVisible(false)}
        onConfirm={() => {
          setResetVisible(false);
          onResetAllData();
        }}
      />
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
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.75,
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: layout.bottomTabBarReserve,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  demoCardGap: {
    marginTop: 10,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
    ...CARD_SHADOW,
  },
  profileChipAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileChipInitials: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  profileChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileChipName: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  profileChipMeta: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    marginTop: 6,
  },
  proBadgeText: {
    color: theme.purpleDark,
    fontSize: 11.5,
    fontWeight: '800',
  },
  section: {
    marginTop: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowSub: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
  rowSubOk: {
    color: theme.greenInk,
    fontWeight: '700',
  },
  rowValue: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  seg: {
    flexDirection: 'row',
    // Was #EEE8FA — so close to the card that the control read as a ghost
    // (user, 2026-08-22). A firmer track makes the white active pill pop.
    backgroundColor: '#D9CCF2',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(80, 40, 160, 0.14)',
  },
  segText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  segTextActive: {
    color: theme.purpleDark,
  },
  connectPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.purpleLight,
  },
  connectPillText: {
    color: theme.purpleDark,
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
  },
});

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle';
import { CARD_SHADOW, SectionLabel, ToggleSwitch } from '../components/SettingsUi';
import { t } from '../lib/i18n';
import { isDemoBuild } from '../lib/demoMode';
import { resolveProEntitlement } from '../lib/proEntitlement';
import { resolveThemeRowState } from '../lib/themePreference';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { appInfo, layout } from '../theme';
import { AppLanguage, AppPreferences } from '../types/models';

interface SettingsScreenProps {
  /** Demo build only: create and adopt a one-session test programme. */
  onCreateDemoProgram?: () => void;
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
  onOpenSupport: () => void;
  onOpenFeatures: () => void;
  /** Temporary: the shelf for finished components that have no caller yet. */
  onOpenDesignDemo: () => void;
  onOpenAiInfo: () => void;
  onOpenLegal: (document: 'privacy' | 'terms') => void;
  onResetAllData: () => void;
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
function Row({
  icon,
  iconColor,
  title,
  sub,
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
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
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
  onOpenSupport,
  onOpenFeatures,
  onOpenDesignDemo,
  onOpenAiInfo,
  onOpenLegal,
  onResetAllData,
  onCreateDemoProgram,
}: SettingsScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [resetVisible, setResetVisible] = useState(false);
  const language = preferences.appLanguage;
  // A redeemed promo is Pro too, so the badge cannot read the preview switch.
  const entitlement = resolveProEntitlement(preferences);
  const proUnlocked = entitlement.unlocked;
  const demoBuild = isDemoBuild();
  const themeRow = resolveThemeRowState(preferences);
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
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
            {/* Theme choice is a Pro perk (user decision 2026-07-22). The row
                has two honest states and resolveThemeRowState picks between
                them: a live switch for Pro, and for everyone else a PRO pill
                that opens the Pro page rather than a switch that repaints
                nothing. It stopped saying "Soon" on 2026-08-01, when the
                engine landed. */}
            <Row
              icon="moon"
              title={t(language, 'settings.darkTheme')}
              // "A Pro perk" is a reason to upgrade, which is only useful to
              // someone who has not. Once Pro is on it is the one line on the
              // row that says nothing about what the switch does.
              sub={t(language, themeRow.locked ? 'settings.darkTheme.sub' : 'settings.darkTheme.subPro')}
              onPress={themeRow.locked ? onOpenSubscription : undefined}
              control={
                themeRow.locked ? (
                  <View
                    accessibilityLabel={t(language, 'settings.a11y.unlockDarkTheme')}
                    style={styles.themeProPill}
                  >
                    <Text style={styles.themeProPillText}>PRO</Text>
                  </View>
                ) : (
                  <ToggleSwitch
                    label={t(language, 'settings.darkTheme')}
                    value={themeRow.value}
                    onChange={(next) => onPreferencesChange({ darkThemeEnabled: next })}
                  />
                )
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
            <Row icon="card" title={t(language, 'settings.subscription')} chevron last onPress={onOpenSubscription} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.yourData')} />
          <View style={styles.card}>
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
          <SectionLabel label={t(language, 'settings.section.support')} />
          <View style={styles.card}>
            <Row icon="chat" title={t(language, 'settings.contact')} sub={t(language, 'settings.contact.sub')} chevron onPress={onOpenSupport} />
            <Row
              icon="spark"
              title={t(language, 'settings.features')}
              sub={t(language, 'settings.features.sub')}
              chevron
              onPress={onOpenFeatures}
            />
            {/* Temporary shelf — remove this row together with
                DesignDemoScreen once both components have real callers. */}
            <Row
              icon="spark"
              title={t(language, 'settings.designDemo')}
              sub={t(language, 'settings.designDemo.sub')}
              chevron
              last
              onPress={onOpenDesignDemo}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.about')} />
          <View style={styles.card}>
            <Row
              icon="spark"
              title={t(language, 'settings.aiInfo')}
              sub={t(language, 'settings.aiInfo.sub')}
              chevron
              onPress={onOpenAiInfo}
            />
            <Row
              icon="shield"
              title={t(language, 'settings.privacy')}
              chevron
              onPress={() => onOpenLegal('privacy')}
            />
            <Row icon="doc" title={t(language, 'settings.terms')} chevron onPress={() => onOpenLegal('terms')} />
            {/* Not a toggle. This app sends no analytics at all, so a switch
                here would have been a lie in both positions — and the privacy
                policy states the same fact. It is a statement, not a setting. */}
            <Row
              icon="analytics"
              title={t(language, 'settings.analytics')}
              sub={t(language, 'settings.analytics.sub')}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel label={t(language, 'settings.section.dangerZone')} />
          <View style={styles.card}>
            {/* No "Sign out" and no "Delete account". There is no account to
                sign out of or delete — the app is local-only and the privacy
                policy says so. Two chevrons asserting otherwise were the one
                place Settings contradicted it. Resetting the data is the real
                destructive action, and it is right here. */}
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

        {/* Demo only, and it disappears on its own: isDemoBuild reads the same
            app.json flag the release guard checks, so clearing that flag to ship
            takes this switch with it. No separate list to remember.

            It lives down here rather than on the Pro page because that is where
            it was, and it was in the way. Its job is to let you walk the app as
            Free and as Pro and see the difference — so it has to turn OFF as
            easily as it turns ON, which the Pro page's CTA never did. */}
        {demoBuild ? (
          <View style={styles.section}>
            <SectionLabel label={t(language, 'settings.section.demo')} />
            <View style={styles.card}>
              <Row
                icon="spark"
                title={t(language, 'settings.demoPro')}
                // Truthful about which source is granting Pro: a redeemed promo
                // outranks this switch, so flipping it off would not show Free
                // and the row says so instead of appearing broken.
                sub={
                  entitlement.source === 'promo'
                    ? t(language, 'settings.demoPro.promo')
                    : t(language, 'settings.demoPro.sub')
                }
                last
                control={
                  <ToggleSwitch
                    label={t(language, 'settings.demoPro')}
                    value={preferences.adaptiveCoachPremiumUnlocked}
                    onChange={(next) => onPreferencesChange({ adaptiveCoachPremiumUnlocked: next })}
                  />
                }
              />
            </View>
            {/* One real session, one real week: logging it once genuinely
                completes the plan, so the completion card can be walked on a
                device without faking a single number. */}
            {onCreateDemoProgram ? (
              <View style={[styles.card, styles.demoCardGap]}>
                <Row
                  icon="calendar"
                  title={t(language, 'settings.demoOneSession')}
                  sub={t(language, 'settings.demoOneSession.sub')}
                  last
                  onPress={onCreateDemoProgram}
                />
              </View>
            ) : null}
          </View>
        ) : null}

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
  themeProPill: {
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: theme.purpleLight,
    borderWidth: 1,
    borderColor: theme.purple,
  },
  themeProPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.purpleDark,
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
  rowValue: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: '#EEE8FA',
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

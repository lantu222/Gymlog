import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW } from '../components/SettingsUi';
import { I18nKey, t } from '../lib/i18n';
import { AppLanguage } from '../types/models';
import { HG } from '../lightTheme';
import { layout } from '../theme';

interface FeatureRequestsScreenProps {
  votedIds: string[];
  language?: AppLanguage;
  onBack: () => void;
  onToggleVote: (id: string) => void;
}

type RequestStatus = 'planned' | 'in_progress' | 'done';

interface FeatureRequest {
  id: string;
  titleKey: I18nKey;
  descriptionKey: I18nKey;
  categoryKey: I18nKey;
  status: RequestStatus;
  baseVotes: number;
}

/**
 * Seeded local board — votes live on this device only until a real backend
 * exists. The seed mirrors the design handoff's examples.
 */
const REQUESTS: FeatureRequest[] = [
  {
    id: 'other_activities',
    titleKey: 'requests.otherActivities',
    descriptionKey: 'requests.otherActivitiesDesc',
    categoryKey: 'requests.cat.other',
    status: 'in_progress',
    baseVotes: 22,
  },
  {
    id: 'shift_scheduling',
    titleKey: 'requests.shiftScheduling',
    descriptionKey: 'requests.shiftSchedulingDesc',
    categoryKey: 'requests.cat.ui',
    status: 'done',
    baseVotes: 17,
  },
  {
    id: 'garmin',
    titleKey: 'requests.garmin',
    descriptionKey: 'requests.garminDesc',
    categoryKey: 'requests.cat.integrations',
    status: 'in_progress',
    baseVotes: 10,
  },
  {
    id: 'warmup_blocks',
    titleKey: 'requests.warmupBlocks',
    descriptionKey: 'requests.warmupBlocksDesc',
    categoryKey: 'requests.cat.training',
    status: 'planned',
    baseVotes: 8,
  },
  {
    id: 'macro_tracking',
    titleKey: 'requests.macroTracking',
    descriptionKey: 'requests.macroTrackingDesc',
    categoryKey: 'requests.cat.nutrition',
    status: 'planned',
    baseVotes: 6,
  },
];

const STATUS_STYLES: Record<RequestStatus, { labelKey: I18nKey; fg: string; bg: string }> = {
  planned: { labelKey: 'requests.status.planned', fg: HG.purpleDark, bg: HG.purpleLight },
  in_progress: { labelKey: 'requests.status.inProgress', fg: '#B45309', bg: '#FBF0DD' },
  done: { labelKey: 'requests.status.done', fg: '#157A3A', bg: '#E4F6EA' },
};

export function FeatureRequestsScreen({ votedIds, language = 'en', onBack, onToggleVote }: FeatureRequestsScreenProps) {
  const items = [...REQUESTS]
    .map((request) => ({
      ...request,
      votes: request.baseVotes + (votedIds.includes(request.id) ? 1 : 0),
      voted: votedIds.includes(request.id),
    }))
    .sort((left, right) => right.votes - left.votes);

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
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'requests.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.intro}>{t(language, 'requests.intro')}</Text>

        {items.map((request) => {
          const status = STATUS_STYLES[request.status];
          return (
            <View key={request.id} style={[styles.card, styles.requestCard]}>
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle}>{t(language, request.titleKey)}</Text>
                <Text style={styles.requestDesc}>{t(language, request.descriptionKey)}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{t(language, request.categoryKey)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: status.fg }]}>{t(language, status.labelKey)}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: request.voted }}
                accessibilityLabel={t(language, 'requests.voteFor', { name: t(language, request.titleKey) })}
                onPress={() => onToggleVote(request.id)}
                style={({ pressed }) => [styles.voteButton, request.voted && styles.voteButtonActive, pressed && { opacity: 0.8 }]}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 19V5M6 11l6-6 6 6"
                    stroke={request.voted ? HG.purpleDark : HG.muted}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.voteCount, request.voted && { color: HG.purpleDark }]}>{request.votes}</Text>
              </Pressable>
            </View>
          );
        })}
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
  intro: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: HG.surface,
    borderWidth: 1,
    borderColor: HG.border,
    borderRadius: 18,
    ...CARD_SHADOW,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 15,
    marginBottom: 10,
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestTitle: {
    color: HG.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  requestDesc: {
    color: HG.muted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 9,
  },
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#F1EDFA',
  },
  categoryBadgeText: {
    color: HG.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  voteButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: HG.border,
    backgroundColor: HG.surface,
    gap: 2,
  },
  voteButtonActive: {
    backgroundColor: HG.purpleLight,
    borderColor: HG.purple,
  },
  voteCount: {
    color: HG.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});

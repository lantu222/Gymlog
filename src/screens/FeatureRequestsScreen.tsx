import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW } from '../components/SettingsUi';
import { HG } from '../lightTheme';
import { layout } from '../theme';

interface FeatureRequestsScreenProps {
  votedIds: string[];
  onBack: () => void;
  onToggleVote: (id: string) => void;
}

type RequestStatus = 'planned' | 'in_progress' | 'done';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
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
    title: 'Other activities in the weekly plan',
    description: 'Count climbing, swimming or a match toward the training week.',
    category: 'Other',
    status: 'in_progress',
    baseVotes: 22,
  },
  {
    id: 'shift_scheduling',
    title: 'Shift-worker scheduling',
    description: 'Training days that rotate with your shifts instead of fixed weekdays.',
    category: 'UI',
    status: 'done',
    baseVotes: 17,
  },
  {
    id: 'garmin',
    title: 'Garmin Connect',
    description: 'Sync sessions and bodyweight with Garmin.',
    category: 'Integrations',
    status: 'in_progress',
    baseVotes: 10,
  },
  {
    id: 'warmup_blocks',
    title: 'Warm-up & cool-down blocks',
    description: 'Editable warm-up and cool-down blocks per session.',
    category: 'Training',
    status: 'planned',
    baseVotes: 8,
  },
  {
    id: 'macro_tracking',
    title: 'Macro tracking',
    description: 'Log protein and calories next to your training.',
    category: 'Nutrition',
    status: 'planned',
    baseVotes: 6,
  },
];

const STATUS_STYLES: Record<RequestStatus, { label: string; fg: string; bg: string }> = {
  planned: { label: 'Planned', fg: HG.purpleDark, bg: HG.purpleLight },
  in_progress: { label: 'In progress', fg: '#B45309', bg: '#FBF0DD' },
  done: { label: 'Done', fg: '#157A3A', bg: '#E4F6EA' },
};

export function FeatureRequestsScreen({ votedIds, onBack, onToggleVote }: FeatureRequestsScreenProps) {
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
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={HG.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Feature requests</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.intro}>Vote on what we build next. Votes are stored on this device for now.</Text>

        {items.map((request) => {
          const status = STATUS_STYLES[request.status];
          return (
            <View key={request.id} style={[styles.card, styles.requestCard]}>
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestDesc}>{request.description}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{request.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: status.fg }]}>{status.label}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: request.voted }}
                accessibilityLabel={`Vote for ${request.title}`}
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

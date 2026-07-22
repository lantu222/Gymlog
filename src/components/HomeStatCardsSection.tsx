import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { formatHomeStatValue, HomeStatCard, HomeStatCardIcon } from '../lib/homeStatCards';
import { HG3 } from '../lightTheme';

/**
 * "Your cards" — pinned stat cards on Home. The user picks which stats appear;
 * nothing here is mandatory. A card shows the current and previous result with
 * no good/bad judgement — tapping it opens the matching tracking surface where
 * a new entry can be logged. Edit mode shows remove badges with a light jiggle.
 */

const RED = '#C0392B';

const SPARK_HEIGHT = 34;

interface HomeStatCardsSectionProps {
  /** One computed card per catalog item, in Add-sheet display order. */
  catalogCards: HomeStatCard[];
  pinnedKeys: string[];
  onChangePinnedKeys: (next: string[]) => void;
  /** Tap on a card outside edit mode — opens the card's tracking surface. */
  onOpenCard: (key: string) => void;
  reduceMotion: boolean;
}

function StatIcon({ icon, size = 20, color = HG3.purple }: { icon: HomeStatCardIcon; size?: number; color?: string }) {
  switch (icon) {
    case 'scale':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM8 8l4 4M8 8h4"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'drop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'tape':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 8h18a2 2 0 0 1 0 0v8H3V8zM7 8v4M11 8v4M15 8v4M19 8v4"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
        </Svg>
      );
  }
}

function Sparkline({ series }: { series: number[] }) {
  const [width, setWidth] = useState(0);

  if (series.length < 2) {
    // One point draws no line — an empty strip keeps card heights identical.
    return <View style={styles.sparkArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} />;
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min;
  const pad = 4;

  const points = series.map((value, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * Math.max(width - pad, 0) + pad / 2;
    const normalized = span === 0 ? 0.5 : (value - min) / span;
    const y = pad / 2 + (1 - normalized) * (SPARK_HEIGHT - pad);
    return { x, y };
  });

  // Neutral accent on purpose — the card reports the numbers and passes no
  // judgement on which direction is "good".
  const stroke = HG3.purpleBright;
  const last = points[points.length - 1];

  return (
    <View style={styles.sparkArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={SPARK_HEIGHT}>
          <Polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={last.x} cy={last.y} r={2.6} fill={stroke} />
        </Svg>
      ) : null}
    </View>
  );
}

export function HomeStatCardsSection({
  catalogCards,
  pinnedKeys,
  onChangePinnedKeys,
  onOpenCard,
  reduceMotion,
}: HomeStatCardsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  const cardByKey = useMemo(() => new Map(catalogCards.map((card) => [card.key, card])), [catalogCards]);
  const pinnedCards = pinnedKeys.map((key) => cardByKey.get(key)).filter((card): card is HomeStatCard => Boolean(card));
  const availableCards = catalogCards.filter((card) => !pinnedKeys.includes(card.key));

  // Shared jiggle driver; even and odd cards read it in opposite phase so the
  // grid wobbles organically instead of in lockstep.
  const jiggle = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!editing || reduceMotion) {
      jiggle.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jiggle, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(jiggle, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(jiggle, { toValue: 0.5, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [editing, jiggle, reduceMotion]);

  const evenRotate = jiggle.interpolate({ inputRange: [0, 1], outputRange: ['-0.55deg', '0.55deg'] });
  const oddRotate = jiggle.interpolate({ inputRange: [0, 1], outputRange: ['0.55deg', '-0.55deg'] });

  const removeCard = (key: string) => {
    onChangePinnedKeys(pinnedKeys.filter((pinned) => pinned !== key));
  };

  const addCard = (key: string) => {
    onChangePinnedKeys([...pinnedKeys, key]);
  };

  const addSheetSub = (card: HomeStatCard) => {
    if (card.value === null) {
      return 'No data yet';
    }
    return `${formatHomeStatValue(card.value)} ${card.unit}`;
  };

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Your cards</Text>
        <Pressable hitSlop={8} onPress={() => setEditing((current) => !current)}>
          <Text style={styles.sectionAction}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {pinnedCards.map((card, index) => (
          <Animated.View
            key={card.key}
            style={[
              styles.cardCell,
              editing && !reduceMotion && { transform: [{ rotate: index % 2 === 0 ? evenRotate : oddRotate }] },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${card.label}`}
              onPress={editing ? undefined : () => onOpenCard(card.key)}
              style={({ pressed }) => [styles.card, pressed && !editing && { opacity: 0.8 }]}
            >
              <Text numberOfLines={1} style={styles.cardLabel}>
                {card.label}
              </Text>
              {card.value !== null ? (
                <>
                  <View style={styles.valueRow}>
                    <Text style={styles.valueText}>{formatHomeStatValue(card.value)}</Text>
                    <Text style={styles.unitText}>
                      {card.unit}
                      {card.reps !== null ? ` · ×${card.reps}` : ''}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.previousText}>
                    {card.previous !== null
                      ? `Previous ${formatHomeStatValue(card.previous)} ${card.unit}`
                      : 'First entry'}
                  </Text>
                </>
              ) : (
                <View style={styles.valueRow}>
                  <Text style={styles.noDataText}>No data yet</Text>
                </View>
              )}
              <Sparkline series={card.series} />
            </Pressable>
            {editing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${card.label}`}
                onPress={() => removeCard(card.key)}
                hitSlop={8}
                style={styles.removeBadge}
              >
                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
                </Svg>
              </Pressable>
            ) : null}
          </Animated.View>
        ))}

        <View style={styles.cardCell}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add card"
            onPress={() => setAddSheetVisible(true)}
            style={({ pressed }) => [styles.addCard, pressed && { borderColor: HG3.purpleBright }]}
          >
            <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={HG3.purpleBright} strokeWidth={2.4} strokeLinecap="round" />
            </Svg>
            <Text style={styles.addCardText}>Add card</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={addSheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setAddSheetVisible(false)}
      >
        <View style={styles.sheetScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddSheetVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Add a card</Text>
            <Text style={styles.sheetSubtitle}>
              Pin the stats you care about to your home screen. Remove any anytime.
            </Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {availableCards.length > 0 ? (
                availableCards.map((card, index) => (
                  <View key={card.key} style={[styles.sheetRow, index > 0 && styles.sheetRowDivider]}>
                    <View style={styles.sheetIconTile}>
                      <StatIcon icon={card.icon} />
                    </View>
                    <View style={styles.sheetRowCopy}>
                      <Text numberOfLines={1} style={styles.sheetRowTitle}>
                        {card.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.sheetRowSub}>
                        {addSheetSub(card)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${card.label}`}
                      onPress={() => addCard(card.key)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.sheetAddButton, pressed && { opacity: 0.7 }]}
                    >
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
                      </Svg>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.sheetEmpty}>All cards added. Remove one to swap it out.</Text>
              )}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddSheetVisible(false)}
              style={({ pressed }) => [styles.sheetDone, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: HG3.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionAction: {
    color: HG3.purpleBright,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardCell: {
    flexBasis: '48%',
    flexGrow: 1,
    maxWidth: '48.6%',
  },
  card: {
    backgroundColor: HG3.surface,
    borderWidth: 1,
    borderColor: HG3.border,
    borderRadius: 16,
    paddingTop: 13,
    paddingHorizontal: 14,
    paddingBottom: 9,
    overflow: 'hidden',
  },
  cardLabel: {
    color: HG3.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  previousText: {
    color: HG3.faint,
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
    marginBottom: 4,
  },
  valueText: {
    color: HG3.ink,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unitText: {
    color: HG3.muted,
    fontSize: 12.5,
    fontWeight: '800',
  },
  noDataText: {
    color: HG3.faint,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
  },
  sparkArea: {
    height: SPARK_HEIGHT,
  },
  removeBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: RED,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    minHeight: 108,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B4A9CC',
    borderRadius: 16,
    backgroundColor: HG3.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addCardText: {
    color: HG3.purpleBright,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(16,10,32,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: HG3.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '72%',
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: HG3.border,
    marginBottom: 14,
  },
  sheetTitle: {
    color: HG3.ink,
    fontSize: 19,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: HG3.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 8,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetRowDivider: {
    borderTopWidth: 1,
    borderTopColor: HG3.border,
  },
  sheetIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HG3.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetRowTitle: {
    color: HG3.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },
  sheetRowSub: {
    color: HG3.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HG3.purpleBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmpty: {
    color: HG3.faint,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 26,
  },
  sheetDone: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  sheetDoneText: {
    color: HG3.purpleBright,
    fontSize: 14.5,
    fontWeight: '800',
  },
});

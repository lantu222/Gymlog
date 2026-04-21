import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ScreenHeader';
import { layout, radii, spacing } from '../theme';
import { ExerciseLibraryItem } from '../types/models';

interface ExerciseDetailScreenProps {
  item: ExerciseLibraryItem;
  onBack: () => void;
}

function toLabel(value: string) {
  return value
    .split(/[_\s/()-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function ExerciseImageCard({
  uri,
  compact = false,
}: {
  uri?: string | null;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[compact ? styles.thumbnailCard : styles.heroImageShell, styles.imageFallbackShell]}>
        <Text style={styles.imageFallbackText}>{compact ? 'No preview' : 'Preview not available yet'}</Text>
      </View>
    );
  }

  return compact ? (
    <View style={styles.thumbnailCard}>
      <Image
        source={{ uri }}
        style={styles.thumbnailImage}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  ) : (
    <View style={styles.heroImageShell}>
      <Image source={{ uri }} style={styles.heroImage} resizeMode="contain" onError={() => setFailed(true)} />
    </View>
  );
}

export function ExerciseDetailScreen({ item, onBack }: ExerciseDetailScreenProps) {
  const imageUrls = item.imageUrls?.filter(Boolean) ?? [];
  const primaryMuscles = item.primaryMuscles?.filter(Boolean) ?? [];
  const secondaryMuscles = item.secondaryMuscles?.filter(Boolean) ?? [];
  const instructions = item.instructions?.filter((step) => step.trim().length > 0) ?? [];

  return (
    <>
      <ScreenHeader title={item.name} onBack={onBack} tone="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metaCard}>
          <Text style={styles.cardLabel}>Overview</Text>
          <View style={styles.tagRow}>
            <Tag label={toLabel(item.bodyPart)} />
            <Tag label={toLabel(item.category)} />
            <Tag label={toLabel(item.equipment)} />
            {item.sourceLevel ? <Tag label={toLabel(item.sourceLevel)} /> : null}
          </View>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.cardLabel}>Instructions</Text>
          {instructions.length > 0 ? (
            <View style={styles.steps}>
              {instructions.map((step, index) => (
                <View key={`${item.id}_${index}`} style={styles.stepRow}>
                  <View style={styles.stepIndex}>
                    <Text style={styles.stepIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Instructions are not available for this movement yet.</Text>
          )}
        </View>

        <View style={styles.imageBlock}>
          <ExerciseImageCard uri={imageUrls[0] ?? null} />
          {imageUrls.length > 1 ? (
            <View style={styles.thumbnailRow}>
              {imageUrls.slice(1, 4).map((uri) => (
                <ExerciseImageCard key={uri} uri={uri} compact />
              ))}
            </View>
          ) : null}
        </View>

        {primaryMuscles.length > 0 ? (
          <View style={styles.metaCard}>
            <Text style={styles.cardLabel}>Primary muscles</Text>
            <View style={styles.tagRow}>
              {primaryMuscles.map((muscle) => (
                <Tag key={muscle} label={toLabel(muscle)} />
              ))}
            </View>
          </View>
        ) : null}

        {secondaryMuscles.length > 0 ? (
          <View style={styles.metaCard}>
            <Text style={styles.cardLabel}>Secondary muscles</Text>
            <View style={styles.tagRow}>
              {secondaryMuscles.map((muscle) => (
                <Tag key={muscle} label={toLabel(muscle)} />
              ))}
            </View>
          </View>
        ) : null}

        {item.sourceCategory || item.sourceEquipment || item.sourceMechanic ? (
          <View style={styles.metaCard}>
            <Text style={styles.cardLabel}>Dataset metadata</Text>
            <View style={styles.detailRows}>
              {item.sourceCategory ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>{toLabel(item.sourceCategory)}</Text>
                </View>
              ) : null}
              {item.sourceEquipment ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Equipment</Text>
                  <Text style={styles.detailValue}>{toLabel(item.sourceEquipment)}</Text>
                </View>
              ) : null}
              {item.sourceMechanic ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mechanic</Text>
                  <Text style={styles.detailValue}>{toLabel(item.sourceMechanic)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.bottomTabBarReserve,
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  imageBlock: {
    gap: spacing.sm,
  },
  heroImageShell: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E6E7EB',
  },
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#F7F8FA',
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbnailCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: radii.md,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E6E7EB',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  imageFallbackShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  metaCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#111111',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  steps: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FAE66',
    marginTop: 1,
  },
  stepIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#111111',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  detailRows: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  detailValue: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
});

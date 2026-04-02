import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.primaryButton, destructive && styles.destructiveButton]}
            >
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  dialog: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  primaryText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
});

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { t } from '../lib/i18n';
import { Theme, useTheme, useThemedStyles } from '../theming';
import { layout } from '../theme';
import { AppLanguage } from '../types/models';

const MAX_NAME_LENGTH = 30;

interface EditProfileScreenProps {
  initialName: string | null;
  language?: AppLanguage;
  onBack: () => void;
  onSave: (name: string | null) => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'G';
  }
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + second).toUpperCase();
}

/**
 * Screen 5 of the profile suite — deliberately minimal. Display name is the
 * only editable field: no username, bio, city, gym, socials or privacy
 * toggles, and no photo control until image picking actually exists.
 */
export function EditProfileScreen({ initialName, language = 'en', onBack, onSave }: EditProfileScreenProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(initialName ?? '');

  const trimmed = name.trim();
  const dirty = trimmed !== (initialName ?? '').trim();

  const handleSave = () => {
    if (!dirty) {
      return;
    }
    onSave(trimmed.length > 0 ? trimmed.slice(0, MAX_NAME_LENGTH) : null);
    onBack();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'common.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={theme.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t(language, 'editProfile.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty }}
          onPress={handleSave}
          hitSlop={8}
          style={styles.saveButton}
        >
          <Text style={[styles.saveText, !dirty && styles.saveTextDisabled]}>{t(language, 'editProfile.save')}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Svg width={96} height={96} viewBox="0 0 96 96">
            <Defs>
              <LinearGradient id="editRing" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#7C3AED" />
                <Stop offset="1" stopColor="#C4B0FF" />
              </LinearGradient>
              <LinearGradient id="editInner" x1="0" y1="0" x2="0.6" y2="1">
                <Stop offset="0" stopColor="#2A1B4E" />
                <Stop offset="1" stopColor="#5B21B6" />
              </LinearGradient>
            </Defs>
            <Circle cx={48} cy={48} r={48} fill="url(#editRing)" />
            <Circle cx={48} cy={48} r={44.5} fill="url(#editInner)" />
          </Svg>
          <View style={styles.avatarTextWrap} pointerEvents="none">
            <Text style={styles.avatarText}>{getInitials(trimmed.length > 0 ? trimmed : 'G')}</Text>
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>{t(language, 'editProfile.displayName')}</Text>
            <Text style={styles.fieldCounter}>
              {name.length}/{MAX_NAME_LENGTH}
            </Text>
          </View>
          <TextInput
            value={name}
            onChangeText={(next) => setName(next.slice(0, MAX_NAME_LENGTH))}
            placeholder={t(language, 'editProfile.namePlaceholder')}
            placeholderTextColor={theme.faint}
            maxLength={MAX_NAME_LENGTH}
            autoCapitalize="words"
            style={styles.input}
          />
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  saveButton: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  saveText: {
    color: theme.purple,
    fontSize: 15,
    fontWeight: '800',
  },
  saveTextDisabled: {
    color: theme.faint,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: layout.bottomTabBarReserve,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginTop: 18,
  },
  avatarTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fieldBlock: {
    marginTop: 28,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 9,
  },
  fieldLabel: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  fieldCounter: {
    color: theme.faint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    color: theme.ink,
    fontSize: 15.5,
    fontWeight: '700',
  },
});

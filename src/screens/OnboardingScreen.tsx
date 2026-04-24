import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { BadgePill, SurfaceAccent, SurfaceCard } from '../components/MainScreenPrimitives';
import { FitnessPhotoSurface } from '../components/FitnessPhotoSurface';
import { OnboardingOptionIcon, OnboardingOptionIconName } from '../components/OnboardingOptionIcon';
import { getWorkoutTemplateById } from '../features/workout/workoutCatalog';
import { getFitnessPhotoVariant } from '../assets/fitnessPhotos';
import { formatWorkoutDisplayLabel } from '../lib/displayLabel';
import { convertWeightToKg, formatWeight, formatWeightInputValue, parseNumberInput } from '../lib/format';
import {
  buildScheduleFitNote,
  buildFirstRunCustomProgramName,
  buildFirstRunHelperPrompt,
  buildFirstRunPromptSuggestions,
  buildFirstRunAiCoachContext,
  DEFAULT_FIRST_RUN_SELECTION,
  formatFocusAreaList,
  FirstRunSetupSelection,
  FirstRunStep,
  getFocusAreaDescription,
  getFocusAreaTitle,
  getGuidanceModeLabel,
  getRecommendedProgramName,
  getScheduleModeLabel,
  getSecondaryOutcomeTitle,
  getWeeklyMinuteOptions,
  getWeekdayShortLabel,
  resolveFirstRunRecommendationWithTailoring,
  resolveProjectedTrainingDays,
  getEffectiveWeeklyMinutes,
} from '../lib/firstRunSetup';
import { buildRecommendationTradeoffLabel } from '../lib/recommendationExplanation';
import { buildRecommendationOptionIds, getRecommendationConfidenceCopy } from '../lib/recommendationPresentation';
import { buildTailoringBadgeLabels, TailoringPreferencesInput } from '../lib/tailoringFit';
import { getReadyTemplatePresentation } from '../lib/templatePresentation';
import { requestAiCoachAdvice } from '../lib/valluClient';
import { colors, radii, spacing } from '../theme';
import {
  SetupDaysPerWeek,
  SetupAgeRange,
  SetupEquipment,
  SetupGender,
  SetupGoal,
  SetupGuidanceMode,
  SetupFocusArea,
  SetupLevel,
  SetupScheduleMode,
  SetupSecondaryOutcome,
  SetupWeekday,
  UnitPreference,
} from '../types/models';
import { AICoachAdvice } from '../types/vallu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingScreenProps {
  initialUnitPreference: UnitPreference;
  readyProgramCount: number;
  dismissedTipIds: string[];
  onDismissTip: (tipId: string) => void | Promise<void>;
  mode?: 'first_run' | 'edit';
  initialSelection?: FirstRunSetupSelection | null;
  initialStage?: SetupStage;
  tailoringPreferences?: TailoringPreferencesInput | null;
  onBackToEntry?: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onCompleteToStartingWeek: (selection: FirstRunSetupSelection, recommendedProgramId: string) => void | Promise<void>;
  onCompleteToProgramDetail: (selection: FirstRunSetupSelection, recommendedProgramId: string) => void | Promise<void>;
  onCompleteToCustom: (
    selection: FirstRunSetupSelection,
    recommendedProgramId: string | null,
    prefillName: string,
  ) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

type SetupStage =
  | 'location'
  | 'goal'
  | 'profile'
  | 'focus'
  | 'review'
  | 'gender'
  | 'planning'
  | 'about'
  | 'recommendation';
type HelperState = 'idle' | 'loading' | 'ready' | 'error';
type RecommendationRefinementPanel = 'schedule' | 'focus' | 'custom' | 'ai' | null;

const STAGES: SetupStage[] = ['location', 'goal', 'profile', 'planning', 'about', 'focus', 'review'];

const DEFAULT_BODYWEIGHT_KG = 70;
const DEFAULT_BODYWEIGHT_LB = 154;
const BODYWEIGHT_INTEGER_LIMITS: Record<UnitPreference, { min: number; max: number }> = {
  kg: { min: 35, max: 220 },
  lb: { min: 77, max: 485 },
};

function clampBodyweightInteger(value: number, unit: UnitPreference) {
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  return Math.min(Math.max(Math.round(value), limits.min), limits.max);
}

function getDefaultBodyweightForUnit(unit: UnitPreference) {
  return unit === 'kg' ? DEFAULT_BODYWEIGHT_KG : DEFAULT_BODYWEIGHT_LB;
}

function getStageIndex(stage?: SetupStage) {
  const index = stage ? STAGES.indexOf(stage) : -1;
  return index >= 0 ? index : 0;
}

function getDefaultLocationOptionId(equipment: SetupEquipment) {
  switch (equipment) {
    case 'home':
      return 'home_workout';
    case 'minimal':
      return 'outdoor_running';
    case 'gym':
    default:
      return 'full_gym';
  }
}

const GENDER_OPTIONS: Array<{
  gender: SetupGender;
  title: string;
  body: string;
}> = [
  {
    gender: 'male',
    title: 'Male',
    body: '',
  },
  {
    gender: 'female',
    title: 'Female',
    body: '',
  },
  {
    gender: 'unspecified',
    title: 'Prefer not to say',
    body: '',
  },
];

const GOAL_OPTIONS: Array<{
  goal: SetupGoal;
  title: string;
  body: string;
}> = [
  {
    goal: 'strength',
    title: 'Strength',
    body: 'Lift heavier. Main compounds first.',
  },
  {
    goal: 'muscle',
    title: 'Build muscle',
    body: 'More volume. More size.',
  },
  {
    goal: 'general',
    title: 'Lose weight',
    body: 'Lean down with steady training.',
  },
  {
    goal: 'run_mobility',
    title: 'Endurance / cardio',
    body: 'More engine and movement.',
  },
];

function getGoalBackgroundSource(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return require('../../assets/fitness/selected/strength-goal-card.png');
    case 'muscle':
      return require('../../assets/fitness/selected/build-muscle-goal-card.png');
    case 'general':
      return require('../../assets/fitness/selected/lose-weight-goal-card.png');
    case 'run_mobility':
      return require('../../assets/fitness/selected/endurance-cardio-goal-card.png');
    default:
      return undefined;
  }
}

function getFocusAreaBackgroundSource(area: SetupFocusArea) {
  switch (area) {
    case 'bodyweight':
      return require('../../assets/fitness/selected/focus-bodyweight-card.png');
    case 'glutes':
      return require('../../assets/fitness/selected/focus-glutes-card.png');
    case 'legs':
      return require('../../assets/fitness/selected/focus-legs-card.png');
    case 'chest':
      return require('../../assets/fitness/selected/focus-chest-card.png');
    case 'shoulders':
      return require('../../assets/fitness/selected/focus-shoulders-card.png');
    case 'back':
      return require('../../assets/fitness/selected/focus-back-card.png');
    case 'arms':
      return require('../../assets/fitness/selected/focus-arms-card.png');
    case 'core':
      return require('../../assets/fitness/selected/focus-core-card.png');
    case 'conditioning':
      return require('../../assets/fitness/selected/focus-conditioning-card.png');
    default:
      return undefined;
  }
}

const GUIDANCE_MODE_OPTIONS: Array<{
  mode: SetupGuidanceMode;
  title: string;
  body: string;
}> = [
  {
    mode: 'done_for_me',
    title: 'Keep it simple for me',
    body: 'One ready plan.',
  },
  {
    mode: 'guided_editable',
    title: 'Recommend, then edit',
    body: 'Start, then tweak.',
  },
  {
    mode: 'self_directed',
    title: 'I want to build it myself',
    body: 'Start from a base.',
  },
];

const SCHEDULE_MODE_OPTIONS: Array<{
  mode: SetupScheduleMode;
  title: string;
  body: string;
}> = [
  {
    mode: 'app_managed',
    title: 'Plan it for me',
    body: 'Gymlog places the week.',
  },
  {
    mode: 'self_managed',
    title: "I'll manage the days",
    body: 'You pick the days.',
  },
];

const FOCUS_AREA_OPTIONS: SetupFocusArea[] = [
  'glutes',
  'legs',
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'conditioning',
];
const WEEKDAY_OPTIONS: SetupWeekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const LOCATION_SELECTION_OPTIONS: Array<{
  id: string;
  equipment: SetupEquipment;
  label: string;
  subtitle: string;
  icon: OnboardingOptionIconName;
}> = [
  {
    id: 'full_gym',
    equipment: 'gym',
    label: 'Full Gym',
    subtitle: 'Train in a fully equipped gym',
    icon: 'barbell',
  },
  {
    id: 'home_workout',
    equipment: 'home',
    label: 'Home Workout',
    subtitle: 'Train at home with minimal equipment',
    icon: 'home',
  },
  {
    id: 'outdoor_running',
    equipment: 'minimal',
    label: 'Outdoor / Running',
    subtitle: 'Train outside or go for runs',
    icon: 'run',
  },
  {
    id: 'bodyweight',
    equipment: 'minimal',
    label: 'Bodyweight',
    subtitle: 'Use your body, no equipment',
    icon: 'person',
  },
];

const GOAL_SELECTION_OPTIONS: Array<{
  id: SetupGoal;
  label: string;
  subtitle: string;
  icon: OnboardingOptionIconName;
}> = GOAL_OPTIONS.map((option) => ({
  id: option.goal,
  label: option.title,
  subtitle: option.body,
  icon:
    option.goal === 'strength'
      ? 'barbell'
      : option.goal === 'muscle'
        ? 'barbell'
        : option.goal === 'general'
          ? 'person'
          : 'run',
}));

function ChoiceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LocationChoiceCard({
  label,
  subtitle,
  icon,
  active,
  onPress,
  compact = false,
  hideIcon = false,
  leadingRadio = false,
  tall = false,
}: {
  label: string;
  subtitle?: string;
  icon: OnboardingOptionIconName;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
  hideIcon?: boolean;
  leadingRadio?: boolean;
  tall?: boolean;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const animatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
    ],
  };
  const radio = (
    <View
      style={[
        styles.locationChoiceRadio,
        leadingRadio && styles.locationChoiceRadioLeading,
        active && styles.locationChoiceRadioActive,
      ]}
    >
      {active ? <View style={styles.locationChoiceRadioInner} /> : null}
    </View>
  );

  return (
    <Pressable onPress={onPress} style={styles.locationChoicePressable}>
      <Animated.View
        style={[
          styles.locationChoiceCard,
          compact && styles.locationChoiceCardCompact,
          tall && styles.locationChoiceCardTall,
          active && styles.locationChoiceCardActive,
          animatedStyle,
        ]}
      >
        <View style={styles.locationChoiceRow}>
          {leadingRadio ? radio : null}
          {hideIcon ? null : <OnboardingOptionIcon name={icon} />}
          <View style={[styles.locationChoiceCopy, hideIcon && styles.locationChoiceCopyNoIcon]}>
            <Text style={[styles.locationChoiceLabel, active && styles.locationChoiceLabelActive]}>{label}</Text>
            {subtitle ? (
              <Text style={[styles.locationChoiceSubtitle, active && styles.locationChoiceSubtitleActive]}>{subtitle}</Text>
            ) : null}
          </View>
          {leadingRadio ? null : radio}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function PhotoSelectionCard({
  title,
  body,
  meta,
  active,
  variantLabel,
  tagLabel,
  plain = false,
  backgroundSource,
  onPress,
  photo,
}: {
  title: string;
  body: string;
  meta: string;
  active: boolean;
  variantLabel?: string;
  tagLabel?: string;
  plain?: boolean;
  backgroundSource?: number;
  onPress: () => void;
  photo: 'strength' | 'recovery' | 'running';
}) {
  const scale = useRef(new Animated.Value(active ? 1.02 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.02 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: active ? 8 : 4,
    }).start();
  }, [active, scale]);

  function handlePress() {
    scale.stopAnimation();
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.986,
        duration: 85,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.03,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
    ]).start();
    onPress();
  }

  const content = (
    <View style={[styles.photoSelectionContent, plain && styles.photoSelectionContentPlain]}>
      {!plain ? (
        <View style={styles.photoSelectionTopRow}>
          <BadgePill accent="neutral" label={tagLabel ?? title} />
          {active ? <BadgePill accent="neutral" label="Selected" /> : null}
        </View>
      ) : null}
      <View style={styles.photoSelectionCopy}>
        <Text
          style={[
            styles.photoSelectionTitle,
            plain && styles.photoSelectionTitlePlain,
            plain && backgroundSource ? styles.photoSelectionTitleOnImage : undefined,
          ]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            style={[
              styles.photoSelectionBody,
              plain && styles.photoSelectionBodyPlain,
              plain && backgroundSource ? styles.photoSelectionBodyOnImage : undefined,
            ]}
          >
            {body}
          </Text>
        ) : null}
        {meta ? (
          <Text
            style={[
              styles.photoSelectionMeta,
              plain && styles.photoSelectionMetaPlain,
              plain && backgroundSource ? styles.photoSelectionMetaOnImage : undefined,
            ]}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const splitContent = (
    <View style={[styles.splitSelectionCard, active && styles.splitSelectionCardActive]}>
      <View style={[styles.splitSelectionFrame, active && styles.splitSelectionFrameActive]} />
      <View style={styles.splitSelectionDarkPane} />
      <View style={[styles.splitSelectionBottomLeftPane, active && styles.splitSelectionBottomLeftPaneActive]} />
      <View style={[styles.splitSelectionLightPane, active && styles.splitSelectionLightPaneActive]} />
      <View style={[styles.splitSelectionDiagonal, active && styles.splitSelectionDiagonalActive]} />
      <View style={[styles.splitSelectionDiagonalOffset, active && styles.splitSelectionDiagonalOffsetActive]} />
      <View style={[styles.splitSelectionCornerAccent, styles.splitSelectionCornerAccentTopRight, active && styles.splitSelectionCornerAccentActive]} />
      <View style={[styles.splitSelectionCornerAccent, styles.splitSelectionCornerAccentBottomLeft, active && styles.splitSelectionCornerAccentActive]} />

      <View style={styles.splitSelectionContent}>
        {variantLabel ? (
          <View style={styles.splitSelectionVariantBadge}>
            <Text style={styles.splitSelectionVariantBadgeText}>{variantLabel}</Text>
          </View>
        ) : null}
        <View style={styles.splitSelectionPrimary}>
        </View>

        <View style={styles.splitSelectionSecondary}>
          {body ? <Text style={styles.splitSelectionBody}>{body}</Text> : null}
          {meta ? <Text style={styles.splitSelectionMeta}>{meta}</Text> : null}
        </View>
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.photoSelectionCard,
        active && styles.photoSelectionCardActive,
        plain && styles.photoSelectionCardPlain,
        plain && active && styles.photoSelectionCardPlainActive,
      ]}
    >
      <Animated.View
        style={[
          styles.photoSelectionAnimatedWrap,
          active && styles.photoSelectionAnimatedWrapPlainActive,
          { transform: [{ scale }] },
        ]}
      >
        {plain ? (
          splitContent
        ) : plain && backgroundSource ? (
          <View style={styles.photoSelectionSurfacePlainImage}>
            <Image source={backgroundSource} resizeMode="cover" style={styles.photoSelectionSurfacePlainAsset} />
            <View style={styles.photoSelectionPlainShade} />
            {content}
          </View>
        ) : (
          <FitnessPhotoSurface variant={photo} compact style={styles.photoSelectionSurface}>
            {content}
          </FitnessPhotoSurface>
        )}
      </Animated.View>
    </Pressable>
  );
}

function SelectionCard({
  title,
  body,
  meta,
  active,
  onPress,
}: {
  title: string;
  body: string;
  meta: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.selectionCard, active && styles.selectionCardActive]}>
      <View style={styles.selectionCardCopy}>
        <Text style={[styles.selectionCardTitle, active && styles.selectionCardTitleActive]}>{title}</Text>
        <Text style={styles.selectionCardBody}>{body}</Text>
      </View>
      <Text style={[styles.selectionCardMeta, active && styles.selectionCardMetaActive]}>{meta}</Text>
    </Pressable>
  );
}

function SetupOptionCard({
  title,
  body,
  active,
  backgroundSource,
  imageMode = 'background',
  compact = false,
  onPress,
}: {
  title: string;
  body: string;
  active: boolean;
  backgroundSource?: number;
  imageMode?: 'background' | 'icon';
  compact?: boolean;
  onPress: () => void;
}) {
  const hasBackground = Boolean(backgroundSource);
  const iconImage = hasBackground && imageMode === 'icon';
  const activeAnimation = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnimation, {
      toValue: active ? 1 : 0,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [active, activeAnimation]);

  const cardAnimatedStyle = iconImage
    ? {
        transform: [
          {
            scale: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.02],
            }),
          },
        ],
      }
    : undefined;
  const thumbAnimatedStyle = iconImage
    ? {
        transform: [
          {
            scale: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.04],
            }),
          },
        ],
      }
    : undefined;
  const copyAnimatedStyle = iconImage
    ? {
        transform: [
          {
            translateY: activeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -2],
            }),
          },
        ],
      }
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.setupOptionCard,
        compact && styles.setupOptionCardCompact,
        hasBackground && !iconImage && styles.setupOptionCardImage,
        iconImage && styles.setupOptionCardIcon,
        active && styles.setupOptionCardActive,
        hasBackground && !iconImage && active && styles.setupOptionCardImageActive,
        iconImage && active && styles.setupOptionCardIconActive,
      ]}
    >
      {iconImage ? (
        <Animated.View style={[styles.setupOptionCardIconContent, cardAnimatedStyle]}>
          <Animated.View style={[styles.setupOptionCardIconCopy, copyAnimatedStyle]}>
            <Text style={[styles.setupOptionCardTitle, styles.setupOptionCardTitleOnImage]}>{title}</Text>
            <Text style={[styles.setupOptionCardBody, styles.setupOptionCardBodyOnImage]}>{body}</Text>
          </Animated.View>
          <View style={[styles.setupOptionCardIconThumb, active && styles.setupOptionCardIconThumbActive]}>
            <Animated.Image
              source={backgroundSource}
              resizeMode="cover"
              style={[
                styles.setupOptionCardIconImage,
                thumbAnimatedStyle,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.84, 1],
                  }),
                },
              ]}
            />
            <View style={styles.setupOptionCardIconShade} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconGlow,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.28],
                  }),
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconPaint,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.2],
                  }),
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardIconRing,
                {
                  opacity: activeAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.setupOptionCardSelectionBadge,
                {
                  opacity: activeAnimation,
                  transform: [
                    {
                      scale: activeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.setupOptionCardSelectionCheck}>
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkShort]} />
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkLong]} />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      ) : hasBackground ? (
        <View style={[styles.setupOptionCardImageSurface, compact && styles.setupOptionCardImageSurfaceCompact]}>
          <Image
            source={backgroundSource}
            resizeMode="cover"
            style={styles.setupOptionCardImageAsset}
          />
          <View style={styles.setupOptionCardImageShade} />
          <View style={[styles.setupOptionCardContent, compact && styles.setupOptionCardContentCompact]}>
            <Text
              style={[
                styles.setupOptionCardTitle,
                compact && styles.setupOptionCardTitleCompact,
                styles.setupOptionCardTitleOnImage,
                active && styles.setupOptionCardTitleActive,
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.setupOptionCardBody,
                compact && styles.setupOptionCardBodyCompact,
                styles.setupOptionCardBodyOnImage,
                active && styles.setupOptionCardBodyActive,
              ]}
              numberOfLines={2}
            >
              {body}
            </Text>
          </View>
          {compact && active ? (
            <View style={styles.setupOptionCardSelectionBadge}>
              <View style={styles.setupOptionCardSelectionCheck}>
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkShort]} />
                <View style={[styles.setupOptionCardSelectionCheckMark, styles.setupOptionCardSelectionCheckMarkLong]} />
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={[styles.setupOptionCardTitle, active && styles.setupOptionCardTitleActive]}>{title}</Text>
          <Text style={[styles.setupOptionCardBody, active && styles.setupOptionCardBodyActive]}>{body}</Text>
        </>
      )}
    </Pressable>
  );
}

function ProfileCheckRow({
  title,
  body,
  badge,
  dotCount,
  compactMeta = false,
  active,
  onPress,
}: {
  title: string;
  body?: string;
  badge?: string;
  dotCount?: number;
  compactMeta?: boolean;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.profileCheckRow, active && styles.profileCheckRowActive]}>
      <View style={[styles.profileCheckBox, active && styles.profileCheckBoxActive]}>
        {active ? (
          <>
            <View style={[styles.profileCheckMark, styles.profileCheckMarkShort]} />
            <View style={[styles.profileCheckMark, styles.profileCheckMarkLong]} />
          </>
        ) : null}
      </View>
      <View style={styles.profileCheckCopy}>
        <View style={styles.profileCheckTitleRow}>
          <Text style={[styles.profileCheckTitle, active && styles.profileCheckTitleActive]}>{title}</Text>
          {dotCount && !compactMeta ? (
            <View style={styles.profileCheckDotRow}>
              {Array.from({ length: dotCount }).map((_, index) => (
                <View
                  key={`${title}-dot-${index}`}
                  style={[styles.profileCheckDot, active && styles.profileCheckDotActive]}
                />
              ))}
            </View>
          ) : null}
          {badge && !compactMeta ? (
            <View style={[styles.profileCheckBadge, active && styles.profileCheckBadgeActive]}>
              <Text style={[styles.profileCheckBadgeText, active && styles.profileCheckBadgeTextActive]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {compactMeta && (dotCount || badge) ? (
          <View style={styles.profileCheckMetaRow}>
            {dotCount ? (
              <View style={styles.profileCheckDotRow}>
                {Array.from({ length: dotCount }).map((_, index) => (
                  <View
                    key={`${title}-meta-dot-${index}`}
                    style={[styles.profileCheckDot, active && styles.profileCheckDotActive]}
                  />
                ))}
              </View>
            ) : null}
            {badge ? (
              <View style={[styles.profileCheckBadge, active && styles.profileCheckBadgeActive]}>
                <Text style={[styles.profileCheckBadgeText, active && styles.profileCheckBadgeTextActive]}>{badge}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {body ? <Text style={[styles.profileCheckBody, active && styles.profileCheckBodyActive]}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

function clampSetupAge(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAgeFromRange(ageRange?: SetupAgeRange | null) {
  switch (ageRange) {
    case '18':
      return 18;
    case '26_30':
      return 28;
    case '31_40':
      return 35;
    case '41_plus':
      return 45;
    case '19_25':
    case 'unspecified':
    default:
      return 25;
  }
}

function getAgeRangeFromAge(age: number): SetupAgeRange {
  if (age <= 18) {
    return '18';
  }
  if (age <= 25) {
    return '19_25';
  }
  if (age <= 30) {
    return '26_30';
  }
  if (age <= 40) {
    return '31_40';
  }
  return '41_plus';
}

function AgeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const trackWidthRef = useRef(1);
  const ageMarks = [0, 25, 50, 75, 100];
  const progress = clampSetupAge(value);

  function updateFromTrackPosition(locationX: number) {
    const trackWidth = Math.max(1, trackWidthRef.current);
    onChange(clampSetupAge((locationX / trackWidth) * 100));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => updateFromTrackPosition(event.nativeEvent.locationX),
      onPanResponderMove: (event) => updateFromTrackPosition(event.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View style={styles.ageSliderCard}>
      <View style={styles.ageSliderHeader}>
        <Text style={styles.ageSliderEyebrow}>Selected age</Text>
        <Text style={styles.ageSliderValue}>{value}</Text>
      </View>

      <View
        style={styles.ageSliderTrackArea}
        onLayout={(event) => {
          trackWidthRef.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.ageSliderTrack} />
        <View style={[styles.ageSliderTrackFill, { width: `${progress}%` }]} />
        <View style={[styles.ageSliderThumb, { left: `${progress}%` }]} />
      </View>

      <View style={styles.ageSliderLabelRow}>
        {ageMarks.map((ageMark) => {
          const active = value === ageMark;
          return (
            <Pressable key={ageMark} onPress={() => onChange(ageMark)} style={styles.ageSliderLabelPress}>
              <Text style={[styles.ageSliderLabel, active && styles.ageSliderLabelActive]}>{ageMark}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PreviewGlyph({ dayCount }: { dayCount: number }) {
  const bars = dayCount >= 4 ? [20, 30, 24, 30] : dayCount === 2 ? [18, 28, 0, 22] : [18, 28, 18, 26];
  return (
    <View style={styles.previewGlyph}>
      {bars.map((height, index) =>
        height ? <View key={`bar-${index}`} style={[styles.previewGlyphBar, { height }]} /> : <View key={`gap-${index}`} style={styles.previewGlyphGap} />,
      )}
    </View>
  );
}

function WeightPickerColumn({
  values,
  selectedValue,
  onSelect,
  compact = false,
}: {
  values: number[];
  selectedValue: number;
  onSelect: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.weightPickerColumn, compact && styles.weightPickerColumnCompact]}>
      {values.map((value) => {
        const active = value === selectedValue;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.weightPickerValueButton, active && styles.weightPickerValueButtonActive]}
          >
            <Text style={[styles.weightPickerValueText, active && styles.weightPickerValueTextActive]}>
              {compact ? value : `${value}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BodyweightPicker({
  value,
  unit,
  onChange,
  onUnitChange,
}: {
  value: number;
  unit: UnitPreference;
  onChange: (value: number) => void;
  onUnitChange: (unit: UnitPreference) => void;
}) {
  const clampedValue = Number.isFinite(value) ? value : getDefaultBodyweightForUnit(unit);
  const integerPart = clampBodyweightInteger(Math.floor(clampedValue), unit);
  const decimalPart = Math.round((clampedValue - integerPart) * 10);
  const limits = BODYWEIGHT_INTEGER_LIMITS[unit];
  const integerValues = Array.from({ length: 5 }, (_, index) =>
    Math.min(Math.max(integerPart - 2 + index, limits.min), limits.max),
  ).filter((candidate, index, array) => array.indexOf(candidate) === index);
  const decimalValues = Array.from({ length: 5 }, (_, index) => (decimalPart - 2 + index + 10) % 10);

  function updateWeight(nextInteger: number, nextDecimal: number, nextUnit = unit) {
    onChange(nextInteger + nextDecimal / 10);
    if (nextUnit !== unit) {
      onUnitChange(nextUnit);
    }
  }

  return (
    <View style={styles.bodyweightPickerCard}>
      <View style={styles.bodyweightValueCard}>
        <Text style={styles.bodyweightValueText}>{`${clampedValue.toFixed(1)} ${unit}`}</Text>
      </View>

      <View style={styles.bodyweightPickerRow}>
        <WeightPickerColumn
          values={integerValues}
          selectedValue={integerPart}
          onSelect={(nextInteger) => updateWeight(nextInteger, decimalPart)}
        />

        <View style={styles.bodyweightDecimalWrap}>
          <Text style={styles.bodyweightSeparator}>.</Text>
        </View>

        <WeightPickerColumn
          values={decimalValues}
          selectedValue={decimalPart}
          onSelect={(nextDecimal) => updateWeight(integerPart, nextDecimal)}
          compact
        />

        <View style={styles.bodyweightUnitColumn}>
          {(['kg', 'lb'] as UnitPreference[]).map((option) => {
            const active = unit === option;
            return (
              <Pressable
                key={option}
                onPress={() => onUnitChange(option)}
                style={[styles.bodyweightUnitPill, active && styles.bodyweightUnitPillActive]}
              >
                <Text style={[styles.bodyweightUnitText, active && styles.bodyweightUnitTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function StepDots({ index, light = false }: { index: number; light?: boolean }) {
  return (
    <View style={styles.pagination}>
      {STAGES.map((stage, stageIndex) => (
        <View
          key={stage}
          style={[
            styles.dot,
            light && styles.dotLight,
            stageIndex <= index && styles.dotActive,
            light && stageIndex <= index && styles.dotActiveLight,
          ]}
        />
      ))}
    </View>
  );
}

function getLocationLabel(equipment: SetupEquipment) {
  switch (equipment) {
    case 'gym':
      return 'Full gym';
    case 'home':
      return 'Home setup';
    case 'minimal':
      return 'Running / outdoors';
    default:
      return 'Your setup';
  }
}

function getGoalLabel(goal: SetupGoal) {
  switch (goal) {
    case 'strength':
      return 'Strength';
    case 'muscle':
      return 'Build muscle';
    case 'general':
      return 'Lose weight';
    case 'run_mobility':
      return 'Endurance / cardio';
    default:
      return 'Training';
  }
}

function formatGoalList(goals: SetupGoal[]) {
  if (goals.length === 0) {
    return 'Not set';
  }

  return goals.map((goal) => getGoalLabel(goal)).join(', ');
}

function getGenderLabel(gender: SetupGender) {
  switch (gender) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    case 'unspecified':
      return 'Prefer not to say';
    default:
      return 'Not set';
  }
}

function getAgeRangeLabel(ageRange: SetupAgeRange) {
  switch (ageRange) {
    case '18':
      return '18';
    case '19_25':
      return '19-25';
    case '26_30':
      return '26-30';
    case '31_40':
      return '31-40';
    case '41_plus':
      return '41+';
    case 'unspecified':
      return 'Prefer not to say';
    default:
      return 'Not set';
  }
}

function getLevelLabel(level: SetupLevel) {
  return level === 'beginner' ? 'Beginner' : 'Intermediate';
}

export function OnboardingScreen({
  initialUnitPreference,
  readyProgramCount,
  mode = 'first_run',
  initialSelection,
  initialStage,
  tailoringPreferences = null,
  onBackToEntry,
  onSkip,
  onCompleteToStartingWeek,
  onCompleteToProgramDetail,
  onCompleteToCustom,
  onCancel,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const setupSeed = initialSelection ?? DEFAULT_FIRST_RUN_SELECTION;
  const editMode = mode === 'edit';
  const BUILDING_PLAN_TOTAL_MS = 10000;
  const previousUnitPreferenceRef = useRef(initialUnitPreference);
  const [stageIndex, setStageIndex] = useState(() =>
    getStageIndex(initialStage ?? (editMode ? 'review' : 'location')),
  );
  const [isBuildingPlan, setIsBuildingPlan] = useState(false);
  const [showBuildingPlanThinking, setShowBuildingPlanThinking] = useState(false);
  const [buildingPlanPhaseIndex, setBuildingPlanPhaseIndex] = useState(0);
  const [buildingPlanPercent, setBuildingPlanPercent] = useState(0);
  const buildingPlanScreenOpacity = useRef(new Animated.Value(1)).current;
  const buildingPlanEntryOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanTopTranslate = useRef(new Animated.Value(-36)).current;
  const buildingPlanBottomTranslate = useRef(new Animated.Value(36)).current;
  const buildingPlanLogoOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanLogoScale = useRef(new Animated.Value(0.95)).current;
  const buildingPlanThinkingOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanCaptionOpacity = useRef(new Animated.Value(0)).current;
  const buildingPlanPulse = useRef(new Animated.Value(0)).current;
  const [gender, setGender] = useState<SetupGender>(setupSeed.gender);
  const [age, setAge] = useState(() =>
    typeof setupSeed.age === 'number' && Number.isFinite(setupSeed.age)
      ? clampSetupAge(setupSeed.age)
      : getAgeFromRange(setupSeed.ageRange),
  );
  const ageRange = useMemo(() => getAgeRangeFromAge(age), [age]);
  const [goal, setGoal] = useState<SetupGoal>(setupSeed.goal);
  const [goals, setGoals] = useState<SetupGoal[]>(setupSeed.goals?.length ? setupSeed.goals : [setupSeed.goal]);
  const [level, setLevel] = useState<SetupLevel>(setupSeed.level);
  const [daysPerWeek, setDaysPerWeek] = useState<SetupDaysPerWeek>(setupSeed.daysPerWeek);
  const [equipment, setEquipment] = useState<SetupEquipment>(setupSeed.equipment);
  const [selectedLocationOptionId, setSelectedLocationOptionId] = useState<string | null>(() =>
    initialSelection || editMode ? getDefaultLocationOptionId(setupSeed.equipment) : null,
  );
  const [secondaryOutcomes, setSecondaryOutcomes] = useState<SetupSecondaryOutcome[]>(
    setupSeed.secondaryOutcomes,
  );
  const [focusAreas, setFocusAreas] = useState<SetupFocusArea[]>(setupSeed.focusAreas);
  const [guidanceMode, setGuidanceMode] = useState<SetupGuidanceMode>(setupSeed.guidanceMode);
  const [scheduleMode, setScheduleMode] = useState<SetupScheduleMode>(setupSeed.scheduleMode);
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(setupSeed.weeklyMinutes ?? null);
  const [availableDays, setAvailableDays] = useState<SetupWeekday[]>(setupSeed.availableDays);
  const [unitPreference, setUnitPreference] = useState<UnitPreference>(initialUnitPreference);
  const [currentWeightDraft, setCurrentWeightDraft] = useState(
    formatWeightInputValue(setupSeed.currentWeightKg, initialUnitPreference),
  );
  const [targetWeightDraft, setTargetWeightDraft] = useState(
    formatWeightInputValue(setupSeed.targetWeightKg, initialUnitPreference),
  );
  const [bodyweightPickerValue, setBodyweightPickerValue] = useState(() => {
    const seedValue = parseNumberInput(formatWeightInputValue(setupSeed.currentWeightKg, initialUnitPreference));
    return seedValue ?? getDefaultBodyweightForUnit(initialUnitPreference);
  });
  const [busy, setBusy] = useState(false);
  const [activeRecommendationRefinement, setActiveRecommendationRefinement] =
    useState<RecommendationRefinementPanel>(null);
  const [selectedRecommendationProgramId, setSelectedRecommendationProgramId] = useState<string | null>(null);
  const [helperVisible, setHelperVisible] = useState(false);
  const [helperDraft, setHelperDraft] = useState('');
  const [helperState, setHelperState] = useState<HelperState>('idle');
  const [helperAnswer, setHelperAnswer] = useState<AICoachAdvice | null>(null);
  const [helperNote, setHelperNote] = useState('');
  const [helperSource, setHelperSource] = useState<'live' | 'preview'>('preview');
  const [helperError, setHelperError] = useState('');

  const stage = STAGES[stageIndex];
  const buildingPlanPhases = useMemo(
    () => ['Building your plan...', 'Thinking through your answers...', 'Almost ready...'],
    [],
  );
  const currentWeightValue = useMemo(() => parseNumberInput(currentWeightDraft), [currentWeightDraft]);
  const targetWeightValue = useMemo(() => parseNumberInput(targetWeightDraft), [targetWeightDraft]);
  const selection = useMemo<FirstRunSetupSelection>(
    () => ({
      gender,
      age,
      ageRange,
      goal,
      goals,
      level,
      daysPerWeek,
      equipment,
      secondaryOutcomes,
      focusAreas,
      guidanceMode,
      scheduleMode,
      weeklyMinutes,
      availableDays,
      currentWeightKg: currentWeightValue === null ? null : convertWeightToKg(currentWeightValue, unitPreference),
      targetWeightKg: targetWeightValue === null ? null : convertWeightToKg(targetWeightValue, unitPreference),
      unitPreference,
    }),
    [
      availableDays,
      age,
      ageRange,
      currentWeightValue,
      daysPerWeek,
      equipment,
      focusAreas,
      gender,
      goal,
      goals,
      guidanceMode,
      level,
      scheduleMode,
      secondaryOutcomes,
      targetWeightValue,
      unitPreference,
      weeklyMinutes,
    ],
  );
  const recommendationTailoringPreferences = useMemo<TailoringPreferencesInput>(
    () => ({
      setupEquipment: selection.equipment,
      setupFreeWeightsPreference: tailoringPreferences?.setupFreeWeightsPreference ?? 'neutral',
      setupBodyweightPreference: tailoringPreferences?.setupBodyweightPreference ?? 'neutral',
      setupMachinesPreference: tailoringPreferences?.setupMachinesPreference ?? 'neutral',
      setupShoulderFriendlySwaps: tailoringPreferences?.setupShoulderFriendlySwaps ?? 'neutral',
      setupElbowFriendlySwaps: tailoringPreferences?.setupElbowFriendlySwaps ?? 'neutral',
      setupKneeFriendlySwaps: tailoringPreferences?.setupKneeFriendlySwaps ?? 'neutral',
    }),
    [selection.equipment, tailoringPreferences],
  );
  const recommendation = useMemo(
    () => resolveFirstRunRecommendationWithTailoring(selection, recommendationTailoringPreferences),
    [recommendationTailoringPreferences, selection],
  );
  const recommendationOptionIds = useMemo(
    () => buildRecommendationOptionIds(recommendation),
    [recommendation.alternativeProgramIds, recommendation.featuredProgramId, recommendation.secondaryProgramId],
  );
  const activeRecommendedProgramId = useMemo(() => {
    if (selectedRecommendationProgramId && recommendationOptionIds.includes(selectedRecommendationProgramId)) {
      return selectedRecommendationProgramId;
    }

    return recommendation.featuredProgramId;
  }, [recommendation.featuredProgramId, recommendationOptionIds, selectedRecommendationProgramId]);
  const recommendedProgram = useMemo(
    () => getWorkoutTemplateById(activeRecommendedProgramId),
    [activeRecommendedProgramId],
  );
  const recommendedProgramPresentation = useMemo(
    () => (recommendedProgram ? getReadyTemplatePresentation(recommendedProgram) : null),
    [recommendedProgram],
  );
  const activeRecommendationCandidate = useMemo(
    () => recommendation.scoredCandidates.find((candidate) => candidate.programId === activeRecommendedProgramId) ?? null,
    [activeRecommendedProgramId, recommendation.scoredCandidates],
  );
  const alternativeRecommendationPrograms = useMemo(
    () =>
      recommendationOptionIds
        .filter((programId) => programId !== activeRecommendedProgramId)
        .map((programId) => {
          const template = getWorkoutTemplateById(programId);
          const candidate = recommendation.scoredCandidates.find((entry) => entry.programId === programId) ?? null;
          if (!template) {
            return null;
          }

          return {
            id: programId,
            template,
            presentation: getReadyTemplatePresentation(template),
            tradeoffNote:
              activeRecommendationCandidate && candidate
                ? buildRecommendationTradeoffLabel(activeRecommendationCandidate, candidate)
                : null,
          };
        })
        .filter(
          (
            option,
          ): option is {
            id: string;
            template: NonNullable<ReturnType<typeof getWorkoutTemplateById>>;
            presentation: ReturnType<typeof getReadyTemplatePresentation>;
            tradeoffNote: string | null;
          } => option !== null,
        )
        .slice(0, 2),
    [activeRecommendationCandidate, activeRecommendedProgramId, recommendation.scoredCandidates, recommendationOptionIds],
  );
  const recommendationConfidenceCopy = useMemo(
    () => getRecommendationConfidenceCopy(recommendation.confidence),
    [recommendation.confidence],
  );
  const activeRecommendationMismatchNote =
    activeRecommendedProgramId === recommendation.featuredProgramId ? recommendation.mismatchNote : null;
  const recommendedProgramTags = useMemo(
    () => recommendedProgramPresentation?.tags.slice(0, 3) ?? [],
    [recommendedProgramPresentation],
  );
  const helperSuggestions = useMemo(
    () => buildFirstRunPromptSuggestions(selection, getRecommendedProgramName(activeRecommendedProgramId)),
    [activeRecommendedProgramId, selection],
  );
  const helperPrompt = useMemo(
    () => buildFirstRunHelperPrompt(stage as FirstRunStep, selection, recommendedProgram?.name ?? null),
    [recommendedProgram?.name, selection, stage],
  );
  const locationLabel = useMemo(() => getLocationLabel(equipment), [equipment]);
  const goalLabel = useMemo(() => formatGoalList(goals), [goals]);
  const levelLabel = useMemo(() => getLevelLabel(level), [level]);
  const secondaryOutcomeLabels = useMemo(
    () => secondaryOutcomes.map((outcome) => getSecondaryOutcomeTitle(outcome)),
    [secondaryOutcomes],
  );
  const focusAreaLabels = useMemo(() => focusAreas.map((area) => getFocusAreaTitle(area)), [focusAreas]);
  const focusAreaSummary = useMemo(() => formatFocusAreaList(focusAreas), [focusAreas]);
  const guidanceModeLabel = useMemo(() => getGuidanceModeLabel(guidanceMode), [guidanceMode]);
  const scheduleModeLabel = useMemo(() => getScheduleModeLabel(scheduleMode), [scheduleMode]);
  const projectedDaysPerWeek = recommendedProgram?.daysPerWeek ?? daysPerWeek;
  const projectedRhythm = useMemo(() => {
    return resolveProjectedTrainingDays(selection, projectedDaysPerWeek).map((day) => getWeekdayShortLabel(day));
  }, [projectedDaysPerWeek, selection]);
  const weeklyMinuteOptions = useMemo(
    () => getWeeklyMinuteOptions(projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration],
  );
  const effectiveWeeklyMinutes = useMemo(
    () => getEffectiveWeeklyMinutes(selection, projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration, selection],
  );
  const scheduleFitNote = useMemo(
    () => buildScheduleFitNote(selection, projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration ?? null),
    [projectedDaysPerWeek, recommendedProgram?.estimatedSessionDuration, selection],
  );

  function toggleGoal(nextGoal: SetupGoal) {
    setGoals((current) => {
      if (current.includes(nextGoal)) {
        if (current.length === 1) {
          return current;
        }
        const nextGoals = current.filter((item) => item !== nextGoal);
        setGoal((previousPrimary) => {
          if (nextGoals.length === 0) {
            return previousPrimary;
          }
          return previousPrimary === nextGoal ? nextGoals[0] : previousPrimary;
        });
        return nextGoals;
      }

      const nextGoals = [...current, nextGoal];
      setGoal(nextGoal);
      return nextGoals;
    });
  }
  const availableDayLabels = useMemo(
    () => availableDays.map((day) => getWeekdayShortLabel(day)),
    [availableDays],
  );
  const projectedSessions = useMemo(
    () =>
      recommendedProgram
        ? [...recommendedProgram.sessions]
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .slice(0, 3)
            .map((session) => ({
              id: session.id,
              name: session.name,
              body: `${session.exercises.length} exercises`,
            }))
        : [],
    [recommendedProgram],
  );
  const reviewScheduleItems = useMemo(
    () =>
      projectedSessions.slice(0, Math.max(projectedDaysPerWeek, 1)).map((session, index) => ({
        id: session.id,
        day: projectedRhythm[index] ?? `Day ${index + 1}`,
        title: formatWorkoutDisplayLabel(session.name, 'Workout'),
        body: session.body,
      })),
    [projectedDaysPerWeek, projectedRhythm, projectedSessions],
  );
  const reviewMainLifts = useMemo(() => {
    if (!recommendedProgram) {
      return [];
    }

    const seen = new Set<string>();
    return [...recommendedProgram.sessions]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .flatMap((session) => session.exercises)
      .filter((exercise) => exercise.role === 'primary' || exercise.role === 'secondary')
      .map((exercise) => exercise.exerciseName)
      .filter((exerciseName) => {
        if (seen.has(exerciseName)) {
          return false;
        }
        seen.add(exerciseName);
        return true;
      })
      .slice(0, 3);
  }, [recommendedProgram]);
  const tailoringBadgeLabels = useMemo(
    () => buildTailoringBadgeLabels(recommendationTailoringPreferences).slice(0, 3),
    [recommendationTailoringPreferences],
  );

  useEffect(() => {
    setUnitPreference(initialUnitPreference);
  }, [initialUnitPreference]);

  useEffect(() => {
    if (stage !== 'recommendation' && activeRecommendationRefinement !== null) {
      setActiveRecommendationRefinement(null);
    }
  }, [activeRecommendationRefinement, stage]);

  useEffect(() => {
    if (selectedRecommendationProgramId && !recommendationOptionIds.includes(selectedRecommendationProgramId)) {
      setSelectedRecommendationProgramId(null);
    }
  }, [recommendationOptionIds, selectedRecommendationProgramId]);

  useEffect(() => {
    const previousUnit = previousUnitPreferenceRef.current;
    if (previousUnit === unitPreference) {
      return;
    }

    setCurrentWeightDraft((current) => {
      const parsed = parseNumberInput(current);
      if (parsed === null) {
        return '';
      }

      return formatWeightInputValue(convertWeightToKg(parsed, previousUnit), unitPreference);
    });
    setTargetWeightDraft((current) => {
      const parsed = parseNumberInput(current);
      if (parsed === null) {
        return '';
      }

      return formatWeightInputValue(convertWeightToKg(parsed, previousUnit), unitPreference);
    });
    previousUnitPreferenceRef.current = unitPreference;
  }, [unitPreference]);

  useEffect(() => {
    const parsed = parseNumberInput(currentWeightDraft);
    if (parsed === null) {
      setBodyweightPickerValue(getDefaultBodyweightForUnit(unitPreference));
      return;
    }

    setBodyweightPickerValue(parsed);
  }, [currentWeightDraft, unitPreference]);

  useEffect(() => {
    if (!isBuildingPlan) {
      buildingPlanScreenOpacity.setValue(1);
      buildingPlanEntryOpacity.setValue(0);
      buildingPlanTopTranslate.setValue(-36);
      buildingPlanBottomTranslate.setValue(36);
      buildingPlanLogoOpacity.setValue(0);
      buildingPlanLogoScale.setValue(0.95);
      buildingPlanThinkingOpacity.setValue(0);
      buildingPlanCaptionOpacity.setValue(0);
      setShowBuildingPlanThinking(false);
      setBuildingPlanPercent(0);
      buildingPlanPulse.stopAnimation();
      buildingPlanPulse.setValue(0);
      return;
    }

    setBuildingPlanPhaseIndex(0);
    setShowBuildingPlanThinking(false);
    setBuildingPlanPercent(0);
    buildingPlanScreenOpacity.setValue(1);
    buildingPlanEntryOpacity.setValue(0);
    buildingPlanTopTranslate.setValue(-36);
    buildingPlanBottomTranslate.setValue(36);
    buildingPlanLogoOpacity.setValue(0);
    buildingPlanLogoScale.setValue(0.95);
    buildingPlanThinkingOpacity.setValue(0);
    buildingPlanCaptionOpacity.setValue(0);
    buildingPlanPulse.setValue(0);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const startedAt = Date.now();
    const percentIntervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const percent = Math.min(100, Math.round((elapsed / BUILDING_PLAN_TOTAL_MS) * 100));
      setBuildingPlanPercent(percent);
    }, 80);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(buildingPlanPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buildingPlanPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.parallel([
      Animated.timing(buildingPlanEntryOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanTopTranslate, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanBottomTranslate, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanLogoOpacity, {
        toValue: 1,
        duration: 500,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buildingPlanLogoScale, {
        toValue: 1,
        duration: 500,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    timeouts.push(
      setTimeout(() => {
        setShowBuildingPlanThinking(true);
        Animated.timing(buildingPlanThinkingOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        pulseLoop.start();
      }, 1300),
    );

    const fadeCaption = (index: number) => {
      setBuildingPlanPhaseIndex(index);
      buildingPlanCaptionOpacity.setValue(0);
      Animated.timing(buildingPlanCaptionOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    timeouts.push(setTimeout(() => fadeCaption(0), 1800));
    timeouts.push(setTimeout(() => fadeCaption(1), 4600));
    timeouts.push(setTimeout(() => fadeCaption(2), 7400));

    timeouts.push(
      setTimeout(() => {
        setBuildingPlanPercent(100);
        pulseLoop.stop();
        Animated.timing(buildingPlanScreenOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            return;
          }
          setIsBuildingPlan(false);
          setShowBuildingPlanThinking(false);
          setStageIndex(getStageIndex('review'));
        });
      }, BUILDING_PLAN_TOTAL_MS - 500),
    );

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      clearInterval(percentIntervalId);
      pulseLoop.stop();
      buildingPlanScreenOpacity.stopAnimation();
      buildingPlanEntryOpacity.stopAnimation();
      buildingPlanTopTranslate.stopAnimation();
      buildingPlanBottomTranslate.stopAnimation();
      buildingPlanLogoOpacity.stopAnimation();
      buildingPlanLogoScale.stopAnimation();
      buildingPlanThinkingOpacity.stopAnimation();
      buildingPlanCaptionOpacity.stopAnimation();
      buildingPlanPulse.stopAnimation();
      buildingPlanScreenOpacity.setValue(1);
      buildingPlanEntryOpacity.setValue(0);
      buildingPlanTopTranslate.setValue(-36);
      buildingPlanBottomTranslate.setValue(36);
      buildingPlanLogoOpacity.setValue(0);
      buildingPlanLogoScale.setValue(0.95);
      buildingPlanThinkingOpacity.setValue(0);
      buildingPlanCaptionOpacity.setValue(0);
      setShowBuildingPlanThinking(false);
      setBuildingPlanPercent(0);
      buildingPlanPulse.setValue(0);
    };
  }, [
    BUILDING_PLAN_TOTAL_MS,
    buildingPlanBottomTranslate,
    buildingPlanCaptionOpacity,
    buildingPlanEntryOpacity,
    buildingPlanLogoOpacity,
    buildingPlanLogoScale,
    buildingPlanPulse,
    buildingPlanScreenOpacity,
    buildingPlanThinkingOpacity,
    buildingPlanTopTranslate,
    isBuildingPlan,
  ]);

  function openHelper(prefill?: string) {
    setHelperDraft(prefill ?? helperPrompt);
    setHelperVisible(true);
    setHelperState('idle');
    setHelperAnswer(null);
    setHelperNote('');
    setHelperError('');
  }

  async function runAction(action: () => Promise<void> | void) {
    if (busy) {
      return;
    }

    try {
      setBusy(true);
      await action();
    } finally {
      setBusy(false);
    }
  }

  function toggleSecondaryOutcome(outcome: SetupSecondaryOutcome) {
    setSecondaryOutcomes((current) =>
      current.includes(outcome) ? current.filter((item) => item !== outcome) : [...current, outcome],
    );
  }

  function toggleFocusArea(area: SetupFocusArea) {
    setFocusAreas((current) => {
      if (current.includes(area)) {
        return current.filter((item) => item !== area);
      }

      return [...current, area];
    });
  }

  function toggleAvailableDay(day: SetupWeekday) {
    setAvailableDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function toggleRecommendationRefinement(panel: Exclude<RecommendationRefinementPanel, null>) {
    setActiveRecommendationRefinement((current) => (current === panel ? null : panel));
  }

  function setCurrentBodyweight(value: number) {
    const nextValue = Math.max(0, Math.round(value * 10) / 10);
    setBodyweightPickerValue(nextValue);
    setCurrentWeightDraft(nextValue.toFixed(1));
  }

  async function askAiCoach() {
    const prompt = helperDraft.trim();
    if (!prompt) {
      return;
    }

    setHelperState('loading');
    setHelperAnswer(null);
    setHelperNote('');
    setHelperError('');

    try {
      const result = await requestAiCoachAdvice({
        prompt,
        context: buildFirstRunAiCoachContext(selection, readyProgramCount),
      });

      setHelperAnswer(result.answer);
      setHelperNote(result.note ?? '');
      setHelperSource(result.source);
      setHelperState('ready');
    } catch {
      setHelperState('error');
      setHelperError('Ask one clear question.');
    }
  }

  function renderProjectedPreview() {
    const previewTitle = formatWorkoutDisplayLabel(
      projectedSessions[0]?.name ?? recommendedProgram?.sessions?.[0]?.name ?? recommendedProgram?.name ?? 'Start here',
      'Workout',
    );
    const previewDuration = recommendedProgram?.estimatedSessionDuration
      ? `${recommendedProgram.estimatedSessionDuration} min`
      : null;
    const topBadges = [locationLabel, goalLabel, levelLabel, `${projectedDaysPerWeek} days`];
    const extraBadges = [...secondaryOutcomeLabels, ...focusAreaLabels].slice(0, 3);

    return (
      <SurfaceCard accent="neutral" emphasis="standard" style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderCopy}>
            <Text style={styles.previewKicker}>Start with</Text>
            <Text style={styles.previewTitle}>{previewTitle}</Text>
            {previewDuration ? <Text style={styles.previewBody}>⏱ {previewDuration}</Text> : null}
          </View>
          <View style={styles.previewHeaderAside}>
            <PreviewGlyph dayCount={projectedDaysPerWeek} />
            {recommendedProgram ? (
              <BadgePill label={formatWorkoutDisplayLabel(recommendedProgram.name, 'Program')} accent="neutral" />
            ) : null}
          </View>
        </View>

        <View style={styles.previewBadgeRow}>
          {topBadges.map((label) => (
            <BadgePill key={label} label={label} accent="neutral" />
          ))}
        </View>

        {extraBadges.length ? (
          <View style={styles.previewSectionBlock}>
            <View style={styles.previewBadgeRow}>
              {extraBadges.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.previewSectionBlock}>
          <View style={styles.previewBadgeRow}>
            <BadgePill label={guidanceModeLabel} accent="neutral" />
            <BadgePill label={scheduleModeLabel} accent="neutral" />
            <BadgePill label={`~${effectiveWeeklyMinutes} min`} accent="neutral" />
          </View>
        </View>

        {stage === 'recommendation' ||
        selection.scheduleMode !== DEFAULT_FIRST_RUN_SELECTION.scheduleMode ||
        typeof selection.weeklyMinutes === 'number' ||
        selection.availableDays.length ? (
          <View style={styles.previewSectionBlock}>
            {selection.scheduleMode === 'self_managed' && availableDayLabels.length ? (
              <View style={styles.previewBadgeRow}>
                {availableDayLabels.map((label) => (
                  <BadgePill key={label} label={label} accent="neutral" />
                ))}
              </View>
            ) : null}
            <Text style={styles.previewSupportText}>{scheduleFitNote}</Text>
          </View>
        ) : null}

        {selection.currentWeightKg || selection.targetWeightKg ? (
          <View style={styles.previewSectionBlock}>
            <View style={styles.previewBadgeRow}>
              {selection.currentWeightKg ? (
                <BadgePill
                  label={`Current ${formatWeight(selection.currentWeightKg, unitPreference)}`}
                  accent="neutral"
                />
              ) : null}
              {selection.targetWeightKg ? (
                <BadgePill
                  label={`Target ${formatWeight(selection.targetWeightKg, unitPreference)}`}
                  accent="neutral"
                />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.previewSectionBlock}>
          <Text style={styles.previewSectionLabel}>This week</Text>
          <View style={styles.previewRhythmRow}>
            {projectedRhythm.map((day) => (
              <View key={day} style={styles.previewDayPill}>
                <Text style={styles.previewDayText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {projectedSessions.length ? (
          <View style={styles.previewSectionBlock}>
            <Text style={styles.previewSectionLabel}>Coming up</Text>
            <View style={styles.previewSessionList}>
              {projectedSessions.map((session) => (
                <View key={session.id} style={styles.previewSessionRow}>
                  <Text style={styles.previewSessionName}>{session.name}</Text>
                  <Text style={styles.previewSessionBody}>{session.body}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {activeRecommendationMismatchNote ? <Text style={styles.previewNote}>{activeRecommendationMismatchNote}</Text> : null}
      </SurfaceCard>
    );
  }

  function renderLocation() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 1',
      titleLines: ['WHERE DO YOU', 'TRAIN'],
      subtitle: 'Pick one or more.',
      options: LOCATION_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        subtitle: option.subtitle,
        icon: option.icon,
        active: selectedLocationOptionId === option.id,
        onPress: () => {
          setSelectedLocationOptionId(option.id);
          setEquipment(option.equipment);
        },
      })),
      optionsContainerStyle: styles.locationStepOneOptionsShift,
    });
  }

  function renderSplitSelectionStage({
    stepLabel,
    titleLines,
    subtitle,
    options,
    beforeOptions,
    afterOptions,
    grid = false,
    compactCards = false,
    hideIcons = false,
    leadingRadio = false,
    tightBottom = false,
    largeTitle = false,
    solidStepLabel = false,
    compactTop = false,
    tallCards = false,
    optionsContainerStyle,
    topCopyStyle,
  }: {
    stepLabel: string;
    titleLines: string[];
    subtitle?: string;
    beforeOptions?: React.ReactNode;
    afterOptions?: React.ReactNode;
    grid?: boolean;
    compactCards?: boolean;
    hideIcons?: boolean;
    leadingRadio?: boolean;
    tightBottom?: boolean;
    largeTitle?: boolean;
    solidStepLabel?: boolean;
    compactTop?: boolean;
    tallCards?: boolean;
    optionsContainerStyle?: ViewStyle;
    topCopyStyle?: ViewStyle;
    options: Array<{
      id: string;
      label: string;
      subtitle?: string;
      icon: OnboardingOptionIconName;
      active: boolean;
      onPress: () => void;
    }>;
  }) {
    const locationStageHeight = Math.max(640, Dimensions.get('window').height - insets.top - insets.bottom - 150);
    const locationTopHeight = compactTop
      ? Math.min(300, Math.round(locationStageHeight * 0.31) + 24)
      : Math.min(380, Math.round(locationStageHeight * 0.38) + 40);

    return (
      <View style={[styles.locationStageShell, { minHeight: locationStageHeight }]}>
        <View style={[styles.locationTopPane, compactTop && styles.locationTopPaneCompact, { height: locationTopHeight }]}>
          <View style={styles.locationTopSlope} />
          <View style={[styles.locationTopCopy, compactTop && styles.locationTopCopyCompact, topCopyStyle]}>
            <View style={styles.locationPaginationWrap}>
              <StepDots index={stageIndex} />
            </View>
            <Text style={[styles.locationStepLabel, solidStepLabel && styles.locationStepLabelSolid]}>{stepLabel}</Text>
            {titleLines.map((line) => (
              <Text key={line} style={[styles.locationHeadline, largeTitle && styles.locationHeadlineLarge]}>{line}</Text>
            ))}
            {subtitle ? <Text style={styles.locationSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={[styles.locationBottomPane, tightBottom && styles.locationBottomPaneTight]}>
          {beforeOptions}
          {grid ? (
            <View style={[styles.locationCardGrid, optionsContainerStyle]}>
              {options.map((option) => (
                <View key={option.id} style={styles.locationCardGridItem}>
                  <LocationChoiceCard
                    label={option.label}
                    subtitle={option.subtitle}
                    icon={option.icon}
                    active={option.active}
                    onPress={option.onPress}
                    compact={compactCards}
                    hideIcon={hideIcons}
                    leadingRadio={leadingRadio}
                    tall={tallCards}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.locationCardList, compactCards && styles.locationCardListCompact, optionsContainerStyle]}>
              {options.map((option) => (
                <LocationChoiceCard
                  key={option.id}
                  label={option.label}
                  subtitle={option.subtitle}
                  icon={option.icon}
                  active={option.active}
                  onPress={option.onPress}
                  compact={compactCards}
                  hideIcon={hideIcons}
                  leadingRadio={leadingRadio}
                  tall={tallCards}
                />
              ))}
            </View>
          )}
          {afterOptions}
        </View>
      </View>
    );
  }

  function renderGender() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Step 2</Text>
          <Text style={styles.title}>What is your gender?</Text>
          <Text style={styles.body}>Only if you want the setup framed that way.</Text>
        </View>

        <FitnessPhotoSurface variant="strength" compact style={styles.stageSurface}>
          <View style={styles.stageSurfaceContent}>
            <BadgePill accent="neutral" label="Your start" />
            <Text style={styles.stageSurfaceTitle}>Keep the setup simple and honest</Text>
          </View>
        </FitnessPhotoSurface>

        <View style={styles.selectionList}>
          {GENDER_OPTIONS.map((option) => (
            <SelectionCard
              key={option.gender}
              title={option.title}
              body={option.body}
              meta={gender === option.gender ? 'Selected' : 'Tap to continue'}
              active={gender === option.gender}
              onPress={() => setGender(option.gender)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderGoal() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 2',
      titleLines: ['WHAT IS YOUR', 'MAIN GOAL?'],
      subtitle: 'Pick one or more.',
      options: GOAL_SELECTION_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        subtitle: option.subtitle,
        icon: option.icon,
        active: goals.includes(option.id),
        onPress: () => toggleGoal(option.id),
      })),
      optionsContainerStyle: styles.locationStepOneOptionsShift,
    });
  }

  function renderProfile() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 3',
      titleLines: ['YOUR', 'PROFILE'],
      subtitle: 'Set the basics once.',
      compactCards: true,
      hideIcons: true,
      leadingRadio: true,
      largeTitle: true,
      topCopyStyle: styles.locationTopCopyProfile,
      beforeOptions: <Text style={[styles.locationSectionLabel, styles.optionLabelLight]}>Gender</Text>,
      options: GENDER_OPTIONS.map((option) => ({
        id: option.gender,
        label: option.title,
        icon: 'person',
        active: gender === option.gender,
        onPress: () => setGender(option.gender),
      })),
      afterOptions: (
        <View style={[styles.locationAfterBlock, styles.locationAfterBlockProfile]}>
          <Text style={[styles.locationSectionLabel, styles.optionLabelLight]}>Age</Text>
          <AgeSlider value={age} onChange={setAge} />
        </View>
      ),
    });
  }

  function renderFocus() {
    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={[styles.kicker, styles.kickerLight]}>Step 6</Text>
          <Text style={[styles.title, styles.titleLight]}>What do you want to focus the most?</Text>
          <Text style={[styles.body, styles.bodyLight]}>Pick one or more.</Text>
        </View>

        <View style={styles.setupOptionGrid}>
          {FOCUS_AREA_OPTIONS.map((area) => (
            <View key={area} style={styles.setupOptionGridItem}>
              <SetupOptionCard
                title={getFocusAreaTitle(area)}
                body={getFocusAreaDescription(area)}
                backgroundSource={getFocusAreaBackgroundSource(area)}
                imageMode="icon"
                active={focusAreas.includes(area)}
                onPress={() => toggleFocusArea(area)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderReview() {
    const programTitle = recommendedProgramPresentation?.title
      ?? (recommendedProgram ? formatWorkoutDisplayLabel(recommendedProgram.name, 'Program') : 'Starter plan');
    const programSubtitle = recommendedProgramPresentation?.subtitle ?? null;
    const primaryRecommendationKicker =
      activeRecommendedProgramId === recommendation.featuredProgramId ? 'Your start' : 'Your selected start';
    const sessionDurationLabel = recommendedProgram?.estimatedSessionDuration
      ? `${recommendedProgram.estimatedSessionDuration} min`
      : '~50 min';
    const weeklyMinutesLabel =
      effectiveWeeklyMinutes && effectiveWeeklyMinutes > 0 ? `~${effectiveWeeklyMinutes} min / week` : null;
    const focusLabel = focusAreas.length ? formatFocusAreaList(focusAreas) : 'Balanced';
    const scheduleSummary = scheduleMode === 'self_managed' && availableDayLabels.length ? availableDayLabels.join(' · ') : null;

    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={[styles.kicker, styles.kickerLight]}>Step 7</Text>
          <Text style={[styles.title, styles.titleLight]}>Does everything look right?</Text>
          <Text style={[styles.body, styles.bodyLight]}>Check the setup before Gymlog builds the week.</Text>
        </View>

        <View style={styles.reviewProgramCard}>
          <Text style={styles.reviewProgramKicker}>{primaryRecommendationKicker}</Text>
          <Text style={styles.reviewProgramTitle}>{programTitle}</Text>
          {programSubtitle ? <Text style={styles.reviewProgramSubtitle}>{programSubtitle}</Text> : null}
          <View style={styles.reviewProgramMetaRow}>
            <View style={styles.reviewProgramMetaPill}>
              <Text style={styles.reviewProgramMetaText}>{`${projectedDaysPerWeek} days`}</Text>
            </View>
            <View style={styles.reviewProgramMetaPill}>
              <Text style={styles.reviewProgramMetaText}>{sessionDurationLabel}</Text>
            </View>
            {recommendedProgramTags.map((tag) => (
              <View key={tag} style={styles.reviewProgramMetaPill}>
                <Text style={styles.reviewProgramMetaText}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.reviewProgramDataGrid}>
            <View style={styles.reviewProgramDataItem}>
              <Text style={styles.reviewProgramDataLabel}>Goal</Text>
              <Text style={styles.reviewProgramDataValue}>{goalLabel}</Text>
            </View>
            <View style={styles.reviewProgramDataItem}>
              <Text style={styles.reviewProgramDataLabel}>Focus</Text>
              <Text style={styles.reviewProgramDataValue}>{focusLabel}</Text>
            </View>
            <View style={styles.reviewProgramDataItem}>
              <Text style={styles.reviewProgramDataLabel}>Setup</Text>
              <Text style={styles.reviewProgramDataValue}>{locationLabel}</Text>
            </View>
            <View style={styles.reviewProgramDataItem}>
              <Text style={styles.reviewProgramDataLabel}>Level</Text>
              <Text style={styles.reviewProgramDataValue}>{levelLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.reviewSummaryCard}>
          <View style={styles.reviewSectionHeader}>
            <Text style={styles.reviewSummaryLabel}>Recommendation fit</Text>
            <Text style={styles.reviewInlineMeta}>{recommendationConfidenceCopy.title}</Text>
          </View>
          <Text style={styles.reviewInsightBody}>{recommendationConfidenceCopy.body}</Text>
          {activeRecommendationMismatchNote ? (
            <Text style={styles.reviewScheduleNote}>{activeRecommendationMismatchNote}</Text>
          ) : null}
        </View>

        {alternativeRecommendationPrograms.length ? (
          <View style={styles.reviewSummaryCard}>
            <View style={styles.reviewSectionHeader}>
              <Text style={styles.reviewSummaryLabel}>Other good options</Text>
              <Text style={styles.reviewInlineMeta}>Pick if it fits better</Text>
            </View>
            <View style={styles.reviewAlternativeList}>
              {alternativeRecommendationPrograms.map((option) => (
                <View key={option.id} style={styles.reviewAlternativeCard}>
                  <View style={styles.reviewAlternativeCopy}>
                    <Text style={styles.reviewAlternativeTitle}>{option.presentation.title}</Text>
                    <Text style={styles.reviewAlternativeBody}>{option.presentation.subtitle}</Text>
                    {option.tradeoffNote ? (
                      <Text style={styles.reviewAlternativeNote}>{option.tradeoffNote}</Text>
                    ) : null}
                    <View style={styles.reviewAlternativeTagRow}>
                      {option.presentation.tags.map((tag) => (
                        <View key={tag} style={styles.reviewAlternativeTag}>
                          <Text style={styles.reviewAlternativeTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setSelectedRecommendationProgramId(option.id)}
                    style={styles.reviewAlternativeButton}
                  >
                    <Text style={styles.reviewAlternativeButtonText}>Use this instead</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.reviewSummaryCard}>
          <View style={styles.reviewSectionHeader}>
            <Text style={styles.reviewSummaryLabel}>Week rhythm</Text>
            {weeklyMinutesLabel ? <Text style={styles.reviewInlineMeta}>{weeklyMinutesLabel}</Text> : null}
          </View>
          <View style={styles.reviewScheduleList}>
            {reviewScheduleItems.map((item) => (
              <View key={item.id} style={styles.reviewScheduleRow}>
                <View style={styles.reviewScheduleDayPill}>
                  <Text style={styles.reviewScheduleDayText}>{item.day}</Text>
                </View>
                <View style={styles.reviewScheduleCopy}>
                  <Text style={styles.reviewScheduleTitle}>{item.title}</Text>
                  <Text style={styles.reviewScheduleBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
          {scheduleSummary ? <Text style={styles.reviewScheduleNote}>{`Selected days: ${scheduleSummary}`}</Text> : null}
        </View>

        {reviewMainLifts.length ? (
          <View style={styles.reviewSummaryCard}>
            <View style={styles.reviewSectionHeader}>
              <Text style={styles.reviewSummaryLabel}>Main lifts</Text>
              <Text style={styles.reviewInlineMeta}>First look</Text>
            </View>
            <View style={styles.reviewLiftChipRow}>
              {reviewMainLifts.map((lift) => (
                <View key={lift} style={styles.reviewLiftChip}>
                  <Text style={styles.reviewLiftChipText}>{lift}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  function renderPlanning() {
    return renderSplitSelectionStage({
      stepLabel: 'STEP 4',
      titleLines: ['TRAINING', 'DAYS'],
      subtitle: 'Pick your weekly rhythm.',
      grid: true,
      hideIcons: true,
      tallCards: true,
      options: ([2, 3, 4, 5] as SetupDaysPerWeek[]).map((value) => ({
        id: `${value}`,
        label: `${value} days`,
        icon: 'barbell',
        active: daysPerWeek === value,
        onPress: () => setDaysPerWeek(value),
      })),
    });
  }

  function renderAbout() {
    return (
      <View style={[styles.locationStageShell, styles.bodyweightStageShell]}>
        <View style={[styles.locationTopPane, styles.bodyweightTopPane]}>
          <View style={styles.locationTopSlope} />
          <View style={styles.locationTopCopy}>
            <View style={styles.locationPaginationWrap}>
              <StepDots index={stageIndex} />
            </View>
            <Text style={styles.locationStepLabel}>STEP 5</Text>
            <Text style={styles.locationHeadline}>HOW MUCH</Text>
            <Text style={styles.locationHeadline}>DO YOU WEIGH?</Text>
            <Text style={styles.locationSubtitle}>Add your current bodyweight.</Text>
          </View>
        </View>

        <View style={styles.locationBottomPane}>
          <View style={styles.bodyweightStageContent}>
            <BodyweightPicker
              value={bodyweightPickerValue}
              unit={unitPreference}
              onChange={setCurrentBodyweight}
              onUnitChange={setUnitPreference}
            />

            <Text style={[styles.bodyweightSupportText, styles.bodyweightStageSupportText]}>
              Used for a better starting point.{'\n'}You can change it later.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function renderRecommendation() {
    const recommendationPrimaryLabel = 'Open week';
    const recommendationSecondaryLabel = 'Open plan';
    const recommendationHeroTitle = formatWorkoutDisplayLabel(
      projectedSessions[0]?.name ?? recommendedProgram?.sessions?.[0]?.name ?? recommendedProgram?.name ?? 'Start here',
      'Workout',
    );
    const recommendationPlanLabel = recommendedProgram
      ? formatWorkoutDisplayLabel(recommendedProgram.name, 'Program')
      : '';
    const recommendationDurationLabel = recommendedProgram ? `${recommendedProgram.estimatedSessionDuration} min` : '';
    const recommendationPhoto = getFitnessPhotoVariant({
      title: recommendationHeroTitle,
      goal: selection.goal,
    });
    const visibleFitBadges = [
      ...tailoringBadgeLabels.slice(0, 2),
      ...secondaryOutcomeLabels.slice(0, 1),
      ...focusAreaLabels.slice(0, 1),
    ].slice(0, 3);
    const recommendationFlowItems = projectedSessions.slice(0, 3).map((session, index) => ({
      id: session.id,
      day: projectedRhythm[index] ?? `Day ${index + 1}`,
      title: formatWorkoutDisplayLabel(session.name, 'Workout'),
      label: index === 0 ? 'Start here' : index === projectedSessions.slice(0, 3).length - 1 ? 'Finish' : 'Then',
    }));

    function renderRecommendationRefinementPanel() {
      if (activeRecommendationRefinement === 'schedule') {
        return (
          <View style={styles.refinementPanel}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleHeaderCopy}>
                <Text style={styles.scheduleTitle}>Week setup</Text>
                <Text style={styles.scheduleBody}>Only if needed.</Text>
              </View>
              <PreviewGlyph dayCount={projectedDaysPerWeek} />
            </View>

            <View style={styles.scheduleMiniRow}>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>Current rhythm</Text>
                <View style={styles.recommendationRhythmRow}>
                  {projectedRhythm.map((day) => (
                    <View key={day} style={styles.recommendationDayPill}>
                      <Text style={styles.recommendationDayText}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.scheduleMiniCard}>
                <Text style={styles.scheduleMiniLabel}>Time</Text>
                <Text style={styles.scheduleMiniValue}>~{effectiveWeeklyMinutes} min</Text>
                <Text style={styles.scheduleMiniMeta}>{scheduleModeLabel}</Text>
              </View>
            </View>

            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Schedule style</Text>
              <View style={styles.choiceRow}>
                {SCHEDULE_MODE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.mode}
                    label={option.title}
                    active={scheduleMode === option.mode}
                    onPress={() => {
                      setScheduleMode(option.mode);
                      if (option.mode === 'app_managed') {
                        setAvailableDays([]);
                      }
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Weekly time</Text>
              <View style={styles.choiceRow}>
                {weeklyMinuteOptions.map((minutes) => (
                  <ChoiceChip
                    key={minutes}
                    label={`${minutes} min`}
                    active={effectiveWeeklyMinutes === minutes}
                    onPress={() => setWeeklyMinutes(minutes)}
                  />
                ))}
              </View>
            </View>

            {scheduleMode === 'self_managed' ? (
              <View style={styles.optionBlock}>
                <Text style={styles.optionLabel}>Which days work?</Text>
                <View style={styles.choiceRow}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <ChoiceChip
                      key={day}
                      label={getWeekdayShortLabel(day)}
                      active={availableDays.includes(day)}
                      onPress={() => toggleAvailableDay(day)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={styles.personalizationHint}>{scheduleFitNote}</Text>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'focus') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>Extra focus</Text>
            <Text style={styles.personalizationBody}>Pick what matters most.</Text>
            <View style={styles.personalizationGrid}>
              {FOCUS_AREA_OPTIONS.map((area) => {
                const active = focusAreas.includes(area);
                return (
                  <Pressable
                    key={area}
                    onPress={() => toggleFocusArea(area)}
                    style={[
                      styles.personalizationOption,
                      active && styles.personalizationOptionActive,
                    ]}
                  >
                    <Text style={[styles.personalizationOptionTitle, active && styles.personalizationOptionTitleActive]}>
                      {getFocusAreaTitle(area)}
                    </Text>
                    <Text style={styles.personalizationOptionBody}>{getFocusAreaDescription(area)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.personalizationHint}>
              {focusAreaSummary
                ? `Now: ${focusAreaSummary}`
                : 'Leave empty for default.'}
            </Text>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'custom') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.buildOwnKicker}>Custom</Text>
            <Text style={styles.buildOwnTitle}>{guidanceMode === 'self_directed' ? 'Use this as your base?' : 'Build your own?'}</Text>
            <Text style={styles.buildOwnBody}>{guidanceMode === 'self_directed' ? 'Open this as your base.' : 'Open a custom version.'}</Text>
            <Pressable
              onPress={() =>
                runAction(() =>
                  onCompleteToCustom(
                    selection,
                    activeRecommendedProgramId,
                    buildFirstRunCustomProgramName(selection),
                  ),
                )
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Build my own</Text>
            </Pressable>
          </View>
        );
      }

      if (activeRecommendationRefinement === 'ai') {
        return (
          <View style={styles.refinementPanel}>
            <Text style={styles.personalizationTitle}>Ask AI Coach</Text>
            <Text style={styles.personalizationBody}>Ask about this exact fit.</Text>
            <Pressable
              onPress={() => openHelper(helperSuggestions[1] ?? helperSuggestions[0] ?? helperPrompt)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open AI</Text>
            </Pressable>
          </View>
        );
      }

      return null;
    }

    return (
      <View style={styles.stageBody}>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>{editMode ? 'Setup' : 'Ready'}</Text>
          <Text style={styles.title}>Start with this week</Text>
          <Text style={styles.body}>Train first. Tweak later.</Text>
        </View>

        {recommendedProgram ? (
          <View style={styles.recommendationCard}>
            <FitnessPhotoSurface variant={recommendationPhoto} style={styles.recommendationHeroSurface}>
              <View style={styles.recommendationHeroContent}>
                <View style={styles.recommendationBadgeCluster}>
                  <BadgePill label={levelLabel} accent="neutral" />
                  <BadgePill label={`${recommendedProgram.daysPerWeek} days`} accent="neutral" />
                </View>

                <View style={styles.recommendationHeroCopy}>
                  {recommendationPlanLabel ? <Text style={styles.recommendationHeroEyebrow}>{recommendationPlanLabel}</Text> : null}
                  <Text style={styles.recommendationHeroTitle}>{recommendationHeroTitle}</Text>
                  {recommendationDurationLabel ? <Text style={styles.recommendationHeroMeta}>⏱ {recommendationDurationLabel}</Text> : null}
                </View>
              </View>
            </FitnessPhotoSurface>

            <View style={styles.recommendationActions}>
              <Pressable
                onPress={() => runAction(() => onCompleteToStartingWeek(selection, activeRecommendedProgramId))}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{recommendationPrimaryLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction(() => onCompleteToProgramDetail(selection, activeRecommendedProgramId))}
                style={styles.recommendationSecondaryButton}
              >
                <Text style={styles.recommendationSecondaryButtonText}>{recommendationSecondaryLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.recommendationTokenRow}>
              {visibleFitBadges.map((label) => (
                <BadgePill key={label} label={label} accent="neutral" />
              ))}
              <BadgePill label={`${effectiveWeeklyMinutes} min`} accent="neutral" />
            </View>

            {recommendationFlowItems.length ? (
              <View style={styles.recommendationFlowBlock}>
                <Text style={styles.recommendationSectionLabel}>Coming up</Text>
                <View style={styles.recommendationSessionGrid}>
                  {recommendationFlowItems.map((session, index) => (
                    <React.Fragment key={session.id}>
                      <View style={styles.recommendationSessionCard}>
                        <View style={styles.recommendationSessionTopRow}>
                          <View style={styles.recommendationSessionDayPill}>
                            <Text style={styles.recommendationSessionDayText}>{session.day}</Text>
                          </View>
                          <Text style={styles.recommendationSessionLabel}>{session.label}</Text>
                        </View>
                        <Text style={styles.recommendationSessionTitle}>{session.title}</Text>
                      </View>
                      {index < recommendationFlowItems.length - 1 ? <Text style={styles.recommendationFlowConnector}>↓</Text> : null}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <SurfaceCard accent="neutral" emphasis="flat" style={styles.personalizationCard}>
          <Text style={styles.personalizationKicker}>Tune</Text>
          <Text style={styles.personalizationTitle}>Change only what needs it</Text>
          <Text style={styles.personalizationBody}>Leave closed if this fits.</Text>
          <View style={styles.choiceRow}>
            <ChoiceChip
              label="Week"
              active={activeRecommendationRefinement === 'schedule'}
              onPress={() => toggleRecommendationRefinement('schedule')}
            />
            <ChoiceChip
              label="Focus"
              active={activeRecommendationRefinement === 'focus'}
              onPress={() => toggleRecommendationRefinement('focus')}
            />
            <ChoiceChip
              label="Build my own"
              active={activeRecommendationRefinement === 'custom'}
              onPress={() => toggleRecommendationRefinement('custom')}
            />
            <ChoiceChip
              label="AI Coach"
              active={activeRecommendationRefinement === 'ai'}
              onPress={() => toggleRecommendationRefinement('ai')}
            />
          </View>
          {activeRecommendationRefinement ? renderRecommendationRefinementPanel() : null}
        </SurfaceCard>

        <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))} style={styles.recommendationBackButton}>
          <Text style={styles.secondaryText}>Back to setup</Text>
        </Pressable>
      </View>
    );
  }

  function renderBuildingPlan() {
    const phase = buildingPlanPhases[Math.min(buildingPlanPhaseIndex, buildingPlanPhases.length - 1)] ?? '';
    const pulseScale = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });
    const pulseOpacity = buildingPlanPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.14, 0.32],
    });

    return (
      <Animated.View style={[styles.buildingPlanScreen, { opacity: buildingPlanScreenOpacity }]}>
        <View style={styles.buildingPlanLogoScene}>
          <Animated.View
            style={[
              styles.buildingPlanTopHalf,
              {
                opacity: buildingPlanEntryOpacity,
                transform: [{ translateY: buildingPlanTopTranslate }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.buildingPlanBottomHalf,
              {
                opacity: buildingPlanEntryOpacity,
                transform: [{ translateY: buildingPlanBottomTranslate }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.buildingPlanLogoStack,
              {
                opacity: buildingPlanLogoOpacity,
                transform: [{ scale: buildingPlanLogoScale }],
              },
            ]}
          >
            <Text style={styles.buildingPlanGymText}>GYM</Text>
            <Text style={styles.buildingPlanLogText}>LOG</Text>
          </Animated.View>
        </View>

        {showBuildingPlanThinking ? (
          <Animated.View style={[styles.buildingPlanThinkingScene, { opacity: buildingPlanThinkingOpacity }]}>
            <View style={styles.buildingPlanThinkingCenter}>
              <View style={styles.buildingPlanRingStack}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.buildingPlanRingPulse,
                    {
                      opacity: pulseOpacity,
                      transform: [{ scale: pulseScale }],
                    },
                  ]}
                />
                <View style={styles.buildingPlanRing}>
                  <Text style={styles.buildingPlanRingText}>G</Text>
                  <Text style={styles.buildingPlanPercentText}>{`${buildingPlanPercent}%`}</Text>
                </View>
              </View>
              <Animated.Text style={[styles.buildingPlanThinkingText, { opacity: buildingPlanCaptionOpacity }]}>
                {phase}
              </Animated.Text>
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  }

  const canContinue =
    stage === 'location'
      ? selectedLocationOptionId !== null
      : stage === 'goal'
      ? goals.length > 0
      : true;
  const locationStageActive =
    stage === 'location' ||
    stage === 'goal' ||
    stage === 'profile' ||
    stage === 'planning' ||
    stage === 'about';
  const footerPrimaryLabel = stage === 'review' ? 'Looks right' : 'Continue';
  const footerVisible = true;
  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      {
        paddingTop: locationStageActive ? 0 : spacing.xxl,
        paddingBottom: (footerVisible ? spacing.xxl : spacing.xl) + insets.bottom,
      },
    ],
    [footerVisible, insets.bottom, locationStageActive],
  );

  if (isBuildingPlan) {
    return renderBuildingPlan();
  }

  return (
    <View style={[styles.root, styles.rootLight]}>
      {locationStageActive ? <View pointerEvents="none" style={[styles.locationTopSafeArea, { height: insets.top }]} /> : null}
      <ScrollView
        style={[styles.scrollView, styles.scrollViewLight]}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {locationStageActive ? null : <StepDots index={stageIndex} light />}

        {stage === 'location' ? renderLocation() : null}
        {stage === 'goal' ? renderGoal() : null}
        {stage === 'profile' ? renderProfile() : null}
        {stage === 'planning' ? renderPlanning() : null}
        {stage === 'about' ? renderAbout() : null}
        {stage === 'focus' ? renderFocus() : null}
        {stage === 'review' ? renderReview() : null}
      </ScrollView>

      {footerVisible ? (
        <View
          style={[
            styles.footer,
            styles.footerLight,
            locationStageActive && styles.locationFooter,
            {
              paddingBottom: locationStageActive
                ? insets.bottom + spacing.lg + spacing.xl
                : spacing.md + insets.bottom,
            },
          ]}
        >
          <>
            <Pressable
              onPress={() => {
                if (!canContinue) {
                  return;
                }

                if (stage === 'review') {
                  void runAction(() => onCompleteToStartingWeek(selection, activeRecommendedProgramId));
                  return;
                }

                if (stage === 'focus') {
                  setIsBuildingPlan(true);
                  return;
                }

                setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
              }}
              style={[
                styles.primaryButton,
                styles.primaryButtonDark,
                locationStageActive && styles.locationPrimaryButton,
                !canContinue && (locationStageActive ? styles.locationPrimaryButtonDisabled : styles.buttonDisabled),
              ]}
              disabled={!canContinue}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  styles.primaryButtonTextLight,
                  !canContinue && locationStageActive && styles.locationPrimaryButtonTextDisabled,
                ]}
              >
                {footerPrimaryLabel}
              </Text>
            </Pressable>

            {stage === 'location' ? (
              editMode ? (
                <Pressable onPress={() => runAction(() => onCancel?.())} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => runAction(onBackToEntry ?? onSkip)} disabled={busy}>
                  <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Back</Text>
                </Pressable>
              )
            ) : (
              <Pressable onPress={() => setStageIndex((current) => Math.max(0, current - 1))}>
                <Text style={[styles.secondaryText, styles.secondaryTextDark]}>Back</Text>
              </Pressable>
            )}
          </>
          {busy ? <ActivityIndicator color="#06080B" size="small" /> : null}
        </View>
      ) : null}

      <Modal visible={helperVisible} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setHelperVisible(false)} />
          </View>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetKicker}>AI Coach</Text>
        <Text style={styles.sheetTitle}>Ask AI Coach</Text>
              </View>
              <Pressable onPress={() => setHelperVisible(false)}>
                <Text style={styles.sheetClose}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetBody}>Ask one clear question.</Text>

            <TextInput
              value={helperDraft}
              onChangeText={setHelperDraft}
              placeholder="Best first plan?"
              placeholderTextColor={colors.textMuted}
              selectionColor="#F3F7FF"
              multiline
              textAlignVertical="top"
              style={styles.sheetInput}
            />

            <View style={styles.sheetSuggestionRow}>
              {helperSuggestions.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setHelperDraft(suggestion)} style={styles.sheetSuggestionChip}>
                  <Text style={styles.sheetSuggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={askAiCoach} style={[styles.primaryButton, !helperDraft.trim() && styles.buttonDisabled]}>
          <Text style={styles.primaryButtonText}>Ask AI</Text>
            </Pressable>

            {helperState === 'loading' ? (
              <View style={styles.helperStatusBlock}>
                <ActivityIndicator color="#F3F7FF" size="small" />
                <Text style={styles.helperStatusText}>AI Coach is answering.</Text>
              </View>
            ) : null}

            {helperState === 'error' ? <Text style={styles.helperErrorText}>{helperError}</Text> : null}

            {helperState === 'ready' && helperAnswer ? (
              <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerContent} showsVerticalScrollIndicator={false}>
                <View style={styles.answerHeaderRow}>
                  <Text style={styles.answerSection}>Answer</Text>
                  <BadgePill label={helperSource === 'live' ? 'Live' : 'Preview'} accent="neutral" />
                </View>
                {helperNote ? <Text style={styles.answerNote}>{helperNote}</Text> : null}

                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Answer</Text>
                  <Text style={styles.answerText}>{helperAnswer.takeaway}</Text>
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Why</Text>
                  {helperAnswer.why.map((item) => (
                    <Text key={item} style={styles.answerBullet}>- {item}</Text>
                  ))}
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerTitle}>Do next</Text>
                  {helperAnswer.nextSteps.map((item) => (
                    <Text key={item} style={styles.answerBullet}>- {item}</Text>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootLight: {
    backgroundColor: '#FFFFFF',
  },
  rootDark: {
    backgroundColor: '#06080B',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewLight: {
    backgroundColor: '#FFFFFF',
  },
  scrollViewDark: {
    backgroundColor: '#06080B',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  pagination: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  locationPaginationWrap: {
    marginBottom: spacing.lg,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dotLight: {
    backgroundColor: 'rgba(6,8,11,0.10)',
  },
  dotActive: {
    backgroundColor: '#F3F7FF',
  },
  dotActiveLight: {
    backgroundColor: '#06080B',
  },
  stageBody: {
    gap: spacing.lg,
  },
  locationStageShell: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
  },
  locationTopSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  locationTopPane: {
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg * 2,
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: 36,
    overflow: 'visible',
    position: 'relative',
  },
  locationTopPaneCompact: {
    paddingBottom: 28,
  },
  locationTopSlope: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: -36,
    height: 72,
    backgroundColor: '#F5F5F5',
    transform: [{ rotate: '-4deg' }],
  },
  locationTopCopy: {
    gap: 4,
    zIndex: 1,
    paddingBottom: 10,
  },
  locationTopCopyCompact: {
    paddingBottom: 12,
  },
  locationTopCopyProfile: {
    paddingTop: 14,
  },
  locationStepLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  locationStepLabelSolid: {
    color: '#FFFFFF',
  },
  locationHeadline: {
    color: '#FFFFFF',
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  locationHeadlineLarge: {
    fontSize: 42,
    lineHeight: 46,
    maxWidth: 180,
  },
  locationSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  locationBottomPane: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: spacing.lg * 2 - 10,
    paddingTop: 24,
  },
  locationBottomPaneTight: {
    paddingTop: 6,
  },
  locationCardList: {
    gap: 12,
  },
  locationCardListCompact: {
    gap: 8,
  },
  locationStepOneOptionsShift: {
    transform: [{ translateY: -10 }],
  },
  locationCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  locationCardGridItem: {
    width: '47.6%',
  },
  locationSectionLabel: {
    color: 'rgba(6,8,11,0.56)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  locationAfterBlock: {
    marginTop: 6,
    gap: 8,
  },
  locationAfterBlockProfile: {
    paddingBottom: 20,
  },
  locationChoicePressable: {
    width: '100%',
  },
  locationChoiceCard: {
    minHeight: 82,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#070707',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  locationChoiceCardCompact: {
    minHeight: 54,
    paddingVertical: 7,
  },
  locationChoiceCardTall: {
    minHeight: 142,
    paddingVertical: 22,
  },
  locationChoiceCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  locationChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationChoiceCopy: {
    flex: 1,
    gap: 4,
    marginLeft: 16,
  },
  locationChoiceCopyNoIcon: {
    marginLeft: 12,
  },
  locationChoiceLabel: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  locationChoiceLabelActive: {
    color: '#000000',
  },
  locationChoiceSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  locationChoiceSubtitleActive: {
    color: 'rgba(0,0,0,0.62)',
  },
  locationChoiceRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  locationChoiceRadioLeading: {
    marginLeft: 0,
    marginRight: 0,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  locationChoiceRadioActive: {
    borderColor: '#111111',
  },
  locationChoiceRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111111',
  },
  locationStageBody: {
    gap: spacing.md,
  },
  profileStageBody: {
    gap: spacing.sm + 2,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  locationHeroBlock: {
    gap: 2,
  },
  profileHeroBlock: {
    gap: 3,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  kickerLight: {
    color: 'rgba(6,8,11,0.52)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  titleLight: {
    color: '#06080B',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bodyLight: {
    color: 'rgba(6,8,11,0.72)',
  },
  selectionList: {
    gap: spacing.xs + 2,
  },
  locationSelectionList: {
    gap: spacing.xs,
  },
  locationOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  locationOptionCell: {
    width: '48.5%',
  },
  setupOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  goalGridItem: {
    width: '48.4%',
  },
  setupOptionGridItem: {
    width: '47.8%',
  },
  profileCheckList: {
    gap: spacing.xs,
  },
  profileCheckGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  profileCheckGridItem: {
    width: '48.8%',
  },
  profileCheckRow: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileCheckRowActive: {
    borderColor: '#06080B',
    backgroundColor: '#F7F8FA',
  },
  profileCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.24)',
    backgroundColor: '#FFFFFF',
  },
  profileCheckBoxActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  profileCheckMark: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  profileCheckMarkShort: {
    width: 7,
    left: 5,
    top: 12,
    transform: [{ rotate: '45deg' }],
  },
  profileCheckMarkLong: {
    width: 12,
    left: 10,
    top: 10,
    transform: [{ rotate: '-45deg' }],
  },
  profileCheckCopy: {
    flex: 1,
    gap: 4,
  },
  profileCheckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  profileCheckTitle: {
    flexShrink: 1,
    color: '#06080B',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  profileCheckTitleActive: {
    color: '#06080B',
  },
  profileCheckDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  profileCheckMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileCheckDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(6,8,11,0.22)',
  },
  profileCheckDotActive: {
    backgroundColor: '#06080B',
  },
  profileCheckBadge: {
    minHeight: 20,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  profileCheckBadgeActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  profileCheckBadgeText: {
    color: 'rgba(6,8,11,0.62)',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileCheckBadgeTextActive: {
    color: '#FFFFFF',
  },
  profileCheckBody: {
    color: 'rgba(6,8,11,0.56)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  profileCheckBodyActive: {
    color: 'rgba(6,8,11,0.66)',
  },
  ageSliderCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  ageSliderHeader: {
    gap: 2,
  },
  ageSliderEyebrow: {
    color: 'rgba(6,8,11,0.48)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ageSliderValue: {
    color: '#06080B',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  ageSliderTrackArea: {
    height: 22,
    justifyContent: 'center',
  },
  ageSliderTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(6,8,11,0.10)',
  },
  ageSliderTrackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: '#06080B',
  },
  ageSliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: '#06080B',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  ageSliderTickRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ageSliderTickPress: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageSliderTick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(6,8,11,0.24)',
  },
  ageSliderTickActive: {
    backgroundColor: '#06080B',
  },
  ageSliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  ageSliderLabelPress: {
    minHeight: 22,
    justifyContent: 'center',
  },
  ageSliderLabel: {
    color: 'rgba(6,8,11,0.50)',
    fontSize: 11,
    fontWeight: '800',
  },
  ageSliderLabelActive: {
    color: '#06080B',
  },
  bodyweightPickerCard: {
    gap: spacing.lg,
  },
  bodyweightValueCard: {
    minHeight: 92,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bodyweightValueText: {
    color: '#06080B',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  bodyweightPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bodyweightDecimalWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 18,
  },
  bodyweightSeparator: {
    color: '#06080B',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900',
  },
  weightPickerColumn: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  weightPickerColumnCompact: {
    width: 52,
  },
  weightPickerValueButton: {
    width: '100%',
    minHeight: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  weightPickerValueButtonActive: {
    backgroundColor: '#F5F7FA',
  },
  weightPickerValueText: {
    color: 'rgba(6,8,11,0.32)',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
  },
  weightPickerValueTextActive: {
    color: '#06080B',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  bodyweightUnitColumn: {
    gap: spacing.xs,
  },
  bodyweightUnitPill: {
    minWidth: 54,
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  bodyweightUnitPillActive: {
    borderColor: '#06080B',
    backgroundColor: '#06080B',
  },
  bodyweightUnitText: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyweightUnitTextActive: {
    color: '#FFFFFF',
  },
  bodyweightSupportText: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  bodyweightStageShell: {
    backgroundColor: '#F5F5F5',
  },
  bodyweightTopPane: {
    minHeight: 280,
  },
  bodyweightStageContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  bodyweightStageSupportText: {
    marginTop: 8,
  },
  buildingPlanScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  buildingPlanLogoScene: {
    ...StyleSheet.absoluteFillObject,
  },
  buildingPlanTopHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#000000',
  },
  buildingPlanBottomHalf: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#FFFFFF',
  },
  buildingPlanLogoStack: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -78,
  },
  buildingPlanGymText: {
    color: '#FFFFFF',
    fontSize: 84,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanLogText: {
    color: '#000000',
    fontSize: 84,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanThinkingScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg * 2,
  },
  buildingPlanThinkingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  buildingPlanRingStack: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingPlanRingPulse: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buildingPlanRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  buildingPlanRingText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanPercentText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buildingPlanThinkingText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 26,
  },
  photoSelectionCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 26, 35, 0.74)',
  },
  photoSelectionCardActive: {
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  photoSelectionSurface: {
    minHeight: 156,
    borderRadius: radii.lg,
  },
  photoSelectionContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  photoSelectionContentPlain: {
    minHeight: 152,
    paddingVertical: spacing.md + 6,
  },
  photoSelectionAnimatedWrap: {
    width: '100%',
  },
  photoSelectionAnimatedWrapPlainActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  photoSelectionSurfacePlainImage: {
    overflow: 'hidden',
    position: 'relative',
    minHeight: 152,
    justifyContent: 'flex-end',
  },
  photoSelectionSurfacePlainAsset: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  photoSelectionPlainShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,11,0.34)',
  },
  photoSelectionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoSelectionCopy: {
    gap: 3,
  },
  photoSelectionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
    maxWidth: '82%',
  },
  photoSelectionTitlePlain: {
    color: '#06080B',
  },
  photoSelectionTitleOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionBody: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    maxWidth: '82%',
  },
  photoSelectionBodyPlain: {
    color: 'rgba(6,8,11,0.84)',
  },
  photoSelectionBodyOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionMeta: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    maxWidth: '78%',
  },
  photoSelectionMetaPlain: {
    color: 'rgba(6,8,11,0.54)',
  },
  photoSelectionMetaOnImage: {
    color: '#FFFFFF',
  },
  photoSelectionCardPlain: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  photoSelectionCardPlainActive: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ translateY: -4 }],
  },
  splitSelectionCard: {
    minHeight: 158,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#131519',
    backgroundColor: '#050607',
    overflow: 'hidden',
    position: 'relative',
  },
  splitSelectionCardActive: {
    borderColor: '#2A2F36',
    backgroundColor: '#0C0F12',
  },
  splitSelectionFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    opacity: 0.85,
  },
  splitSelectionFrameActive: {
    borderColor: 'rgba(255,255,255,0.22)',
  },
  splitSelectionDarkPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050607',
  },
  splitSelectionBottomLeftPane: {
    position: 'absolute',
    left: -88,
    bottom: -28,
    width: '118%',
    height: 88,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '26deg' }],
  },
  splitSelectionBottomLeftPaneActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  splitSelectionLightPane: {
    position: 'absolute',
    top: -18,
    right: -90,
    width: '110%',
    height: 74,
    backgroundColor: 'rgba(11, 54, 56, 0.42)',
    transform: [{ rotate: '26deg' }],
  },
  splitSelectionLightPaneActive: {
    backgroundColor: 'rgba(22, 94, 97, 0.52)',
  },
  splitSelectionDiagonal: {
    position: 'absolute',
    width: '170%',
    left: '-35%',
    top: '49%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionDiagonalActive: {
    backgroundColor: '#FFFFFF',
  },
  splitSelectionDiagonalOffset: {
    position: 'absolute',
    width: '170%',
    left: '-33%',
    top: '49%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.58)',
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionDiagonalOffsetActive: {
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  splitSelectionCornerAccent: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  splitSelectionCornerAccentTopRight: {
    top: 4,
    right: 4,
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionCornerAccentBottomLeft: {
    bottom: 4,
    left: 4,
    transform: [{ rotate: '-26deg' }],
  },
  splitSelectionCornerAccentActive: {
    backgroundColor: '#FFFFFF',
  },
  splitSelectionContent: {
    minHeight: 158,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  splitSelectionVariantBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  splitSelectionVariantBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  splitSelectionPrimary: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 0,
  },
  splitSelectionSecondary: {
    display: 'none',
  },
  splitSelectionTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    maxWidth: '84%',
  },
  splitSelectionBody: {
    color: '#06080B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  splitSelectionMeta: {
    color: 'rgba(6,8,11,0.72)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  splitSelectionActiveBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  splitSelectionActiveMarkShort: {
    position: 'absolute',
    width: 7,
    height: 2,
    left: 6,
    top: 14,
    borderRadius: 2,
    backgroundColor: '#06080B',
    transform: [{ rotate: '45deg' }],
  },
  splitSelectionActiveMarkLong: {
    position: 'absolute',
    width: 12,
    height: 2,
    left: 10,
    top: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  stageSurface: {
    minHeight: 148,
    borderRadius: radii.lg,
  },
  stageSurfaceContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  stageSurfaceBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stageSurfaceTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
    maxWidth: '82%',
  },
  selectionCard: {
    minHeight: 98,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 26, 35, 0.74)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  selectionCardActive: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  selectionCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectionCardCopy: {
    flex: 1,
    gap: 4,
  },
  selectionCardTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  selectionCardTitleActive: {
    color: '#FFFFFF',
  },
  selectionCardBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  selectionCardMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectionCardMetaActive: {
    color: colors.textPrimary,
  },
  selectionVisual: {
    width: 116,
    minHeight: 74,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectionVisualChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectionVisualChip: {
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  selectionVisualChipText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  selectionVisualBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 32,
  },
  selectionVisualBar: {
    flex: 1,
    borderRadius: radii.pill,
  },
  optionBlock: {
    gap: spacing.sm,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionLabelLight: {
    color: 'rgba(6,8,11,0.56)',
  },
  setupOptionCard: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  setupOptionCardCompact: {
    minHeight: 164,
  },
  setupOptionCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  setupOptionCardContentCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 4,
    justifyContent: 'flex-end',
  },
  setupOptionCardActive: {
    backgroundColor: '#06080B',
    borderColor: '#06080B',
  },
  setupOptionCardImage: {
    overflow: 'hidden',
    borderColor: 'rgba(6,8,11,0.18)',
    backgroundColor: '#06080B',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIcon: {
    minHeight: 188,
    overflow: 'hidden',
    borderColor: 'rgba(6,8,11,0.18)',
    backgroundColor: '#06080B',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 0,
  },
  setupOptionCardIconActive: {
    borderColor: '#F3F7FF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  setupOptionCardIconContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  setupOptionCardIconCopy: {
    gap: spacing.xs,
  },
  setupOptionCardIconThumb: {
    position: 'relative',
    marginTop: spacing.xs,
    width: '100%',
    height: 110,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupOptionCardIconThumbActive: {
    borderColor: 'rgba(243,247,255,0.92)',
    backgroundColor: '#050505',
  },
  setupOptionCardIconImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  setupOptionCardIconShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  setupOptionCardIconGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243,247,255,0.16)',
  },
  setupOptionCardIconPaint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(243,247,255,0.12)',
  },
  setupOptionCardIconRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(243,247,255,0.78)',
  },
  setupOptionCardSelectionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#16A34A',
    borderWidth: 1,
    borderColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  setupOptionCardSelectionCheck: {
    width: 12,
    height: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupOptionCardSelectionCheckMark: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#06080B',
  },
  setupOptionCardSelectionCheckMarkShort: {
    width: 5,
    left: 1,
    top: 7,
    transform: [{ rotate: '45deg' }],
  },
  setupOptionCardSelectionCheckMarkLong: {
    width: 9,
    left: 3,
    top: 5,
    transform: [{ rotate: '-45deg' }],
  },
  focusSelectionHint: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  setupOptionCardImageActive: {
    borderColor: '#06080B',
  },
  setupOptionCardImageSurface: {
    overflow: 'hidden',
    position: 'relative',
    minHeight: 112,
    justifyContent: 'flex-end',
  },
  setupOptionCardImageAsset: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  setupOptionCardImageSurfaceCompact: {
    minHeight: 164,
  },
  setupOptionCardImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,11,0.34)',
  },
  setupOptionCardTitle: {
    color: '#06080B',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  setupOptionCardTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  setupOptionCardTitleActive: {
    color: '#FFFFFF',
  },
  setupOptionCardTitleOnImage: {
    color: '#FFFFFF',
  },
  setupOptionCardBody: {
    color: 'rgba(6,8,11,0.68)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  setupOptionCardBodyCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  setupOptionCardBodyActive: {
    color: '#FFFFFF',
  },
  setupOptionCardBodyOnImage: {
    color: '#FFFFFF',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 24, 33, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  choiceChipActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  choiceChipTextActive: {
    color: colors.textPrimary,
  },
  previewCard: {
    gap: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  previewHeaderAside: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  previewHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  previewKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  previewBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  previewGlyph: {
    width: 78,
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  previewGlyphBar: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: '#F3F7FF',
  },
  previewGlyphGap: {
    flex: 1,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewSectionBlock: {
    gap: spacing.sm,
  },
  previewSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewRhythmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewDayPill: {
    minWidth: 54,
    minHeight: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewDayText: {
    color: '#F4FAFF',
    fontSize: 12,
    fontWeight: '900',
  },
  previewSessionList: {
    gap: spacing.sm,
  },
  previewSessionRow: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  previewSessionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  previewSessionBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  previewNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  previewSupportText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  reviewProgramCard: {
    borderRadius: radii.lg,
    backgroundColor: '#06080B',
    borderWidth: 1,
    borderColor: '#06080B',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  reviewProgramKicker: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewProgramTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  reviewProgramSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  reviewProgramMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  reviewProgramMetaPill: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  reviewProgramMetaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  reviewProgramDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewProgramDataItem: {
    width: '47%',
    gap: 2,
  },
  reviewProgramDataLabel: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  reviewProgramDataValue: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  reviewSummaryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reviewSummaryLabel: {
    color: 'rgba(6,8,11,0.48)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewInlineMeta: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewScheduleList: {
    gap: spacing.sm,
  },
  reviewScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reviewScheduleDayPill: {
    minWidth: 52,
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  reviewScheduleDayText: {
    color: '#06080B',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewScheduleCopy: {
    flex: 1,
    gap: 2,
  },
  reviewScheduleTitle: {
    color: '#06080B',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  reviewScheduleBody: {
    color: 'rgba(6,8,11,0.60)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  reviewScheduleNote: {
    color: 'rgba(6,8,11,0.54)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  reviewInsightBody: {
    color: 'rgba(6,8,11,0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  reviewAlternativeList: {
    gap: spacing.sm,
  },
  reviewAlternativeCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.08)',
    backgroundColor: '#F7F8FA',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  reviewAlternativeCopy: {
    gap: spacing.xs,
  },
  reviewAlternativeTitle: {
    color: '#06080B',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  reviewAlternativeBody: {
    color: 'rgba(6,8,11,0.62)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  reviewAlternativeNote: {
    color: 'rgba(6,8,11,0.56)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  reviewAlternativeTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  reviewAlternativeTag: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  reviewAlternativeTagText: {
    color: '#06080B',
    fontSize: 11,
    fontWeight: '800',
  },
  reviewAlternativeButton: {
    minHeight: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06080B',
    paddingHorizontal: spacing.md,
  },
  reviewAlternativeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewLiftChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewLiftChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(6,8,11,0.10)',
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
  },
  reviewLiftChipText: {
    color: '#06080B',
    fontSize: 12,
    fontWeight: '800',
  },
  snapshotCard: {
    gap: spacing.sm,
  },
  snapshotKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  helperStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  helperStripCopy: {
    flex: 1,
    gap: 2,
  },
  helperStripTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  helperStripBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  helperStripButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  helperStripButtonText: {
    color: '#05070A',
    fontSize: 12,
    fontWeight: '900',
  },
  metricCard: {
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metricCopy: {
    flex: 1,
    gap: 3,
  },
  metricTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  metricBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  metricInputWrap: {
    width: 96,
    gap: 6,
    alignItems: 'center',
  },
  metricInput: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  metricUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recommendationCard: {
    gap: spacing.sm,
  },
  recommendationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recommendationBadgeCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationTokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationHeroSurface: {
    minHeight: 284,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recommendationHeroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  recommendationHeroCopy: {
    gap: spacing.sm,
  },
  recommendationHeroEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationHeroTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.3,
    maxWidth: '82%',
  },
  recommendationHeroMeta: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    opacity: 0.92,
  },
  recommendationSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationFlowBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  recommendationRhythmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendationDayPill: {
    minWidth: 44,
    minHeight: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recommendationDayText: {
    color: '#F4FAFF',
    fontSize: 11,
    fontWeight: '900',
  },
  recommendationSessionGrid: {
    gap: spacing.sm,
  },
  recommendationSessionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(15, 18, 23, 0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  recommendationSessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recommendationSessionDayPill: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  recommendationSessionDayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  recommendationSessionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationSessionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  recommendationFlowConnector: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  recommendationActions: {
    gap: spacing.sm,
  },
  scheduleCard: {
    gap: spacing.sm,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scheduleHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  scheduleTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scheduleBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  scheduleMiniRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scheduleMiniCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  scheduleMiniLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  scheduleMiniValue: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scheduleMiniMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  personalizationCard: {
    gap: spacing.sm,
  },
  refinementPanel: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  personalizationKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  personalizationTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  personalizationBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  personalizationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  personalizationOption: {
    width: '48%',
    minHeight: 94,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 14, 19, 0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  personalizationOptionActive: {
    borderColor: '#F4FAFF',
    backgroundColor: '#F4FAFF',
  },
  personalizationOptionDisabled: {
    opacity: 0.45,
  },
  personalizationOptionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  personalizationOptionTitleActive: {
    color: '#0B0F14',
  },
  personalizationOptionBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  personalizationHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  buildOwnCard: {
    gap: spacing.sm,
  },
  buildOwnKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buildOwnTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  buildOwnBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: 'rgba(6,8,11,0.08)',
  },
  locationFooter: {
    paddingTop: 0,
    transform: [{ translateY: -10 }],
    alignItems: 'center',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  footerDarkStage: {
    backgroundColor: '#06080B',
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryButtonDark: {
    backgroundColor: '#06080B',
    borderColor: '#06080B',
  },
  locationPrimaryButton: {
    minHeight: 54,
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  locationPrimaryButtonDisabled: {
    opacity: 1,
  },
  locationPrimaryButtonTextDisabled: {
    color: 'rgba(255,255,255,0.42)',
  },
  primaryButtonText: {
    color: '#06080B',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  primaryButtonTextLight: {
    color: '#FFFFFF',
  },
  recommendationSecondaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    paddingHorizontal: spacing.md,
  },
  recommendationSecondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryTextDark: {
    color: 'rgba(6,8,11,0.68)',
  },
  secondaryTextLight: {
    color: 'rgba(243,247,255,0.78)',
  },
  recommendationBackButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    margin: spacing.lg,
    maxHeight: '82%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12, 16, 21, 0.97)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sheetKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  sheetClose: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  sheetBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  sheetInput: {
    minHeight: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 13, 19, 0.42)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  sheetSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sheetSuggestionChip: {
    minHeight: 30,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sheetSuggestionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  helperStatusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  helperStatusText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  helperErrorText: {
    color: '#FFD9C8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  answerScroll: {
    maxHeight: 320,
  },
  answerContent: {
    gap: spacing.sm,
  },
  answerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  answerSection: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  answerNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  answerBlock: {
    gap: 4,
  },
  answerTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  answerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  answerBullet: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});

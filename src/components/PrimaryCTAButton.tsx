import React from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

// Flat light-theme CTA from the redesign handoff (onb-shared CTA spec):
// 56px solid purple pill, 17/800 label, soft purple drop shadow.
const CTA_PURPLE = '#7C3AED';
const CTA_DISABLED_BG = '#E3DAF5';
const CTA_DISABLED_TEXT = '#9A93AC';

interface PrimaryCTAButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryCTAButton({
  title,
  onPress,
  disabled = false,
  style,
}: PrimaryCTAButtonProps) {
  const pressProgress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (disabled) {
      pressProgress.setValue(0);
    }
  }, [disabled, pressProgress]);

  const animatePress = (toValue: number) => {
    Animated.timing(pressProgress, {
      toValue,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const animatedScale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });
  const animatedOpacity = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  return (
    <Animated.View
      style={[
        styles.button,
        disabled && styles.buttonDisabled,
        !disabled && {
          opacity: animatedOpacity,
          transform: [{ scale: animatedScale }],
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animatePress(1)}
        onPressOut={() => animatePress(0)}
        style={styles.pressable}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    backgroundColor: CTA_PURPLE,
    shadowColor: CTA_PURPLE,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  buttonDisabled: {
    backgroundColor: CTA_DISABLED_BG,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressable: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0.17,
    textAlign: 'center',
  },
  labelDisabled: {
    color: CTA_DISABLED_TEXT,
  },
});

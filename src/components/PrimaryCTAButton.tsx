import React from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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
        {({ pressed }) => (
          <View style={styles.surface}>
            <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 360 64" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="primaryCtaGradient" x1="0" y1="32" x2="360" y2="32" gradientUnits="userSpaceOnUse">
                  {(pressed && !disabled ? pressedGradientStops : gradientStops).map((stop) => (
                    <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                  ))}
              </LinearGradient>
              <LinearGradient id="primaryCtaBloom" x1="180" y1="64" x2="180" y2="24" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
                <Stop offset="0.44" stopColor="#d06cff" stopOpacity="0.07" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="360" height="64" rx="32" fill="url(#primaryCtaGradient)" />
            <Rect x="90" y="36" width="180" height="28" rx="14" fill="url(#primaryCtaBloom)" />
          </Svg>
          <View pointerEvents="none" style={styles.innerHighlight} />
          <View pointerEvents="none" style={styles.topEdgeHighlight} />
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
            {title.toUpperCase()}
          </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const gradientStops = [
  { offset: '0', color: '#5F4EE8' },
  { offset: '0.52', color: '#8B5CF6' },
  { offset: '1', color: '#D06CFF' },
] as const;

const pressedGradientStops = [
  { offset: '0', color: '#5545d0' },
  { offset: '0.52', color: '#7c52dd' },
  { offset: '1', color: '#ba60e6' },
] as const;

const styles = StyleSheet.create({
  button: {
    width: '90%',
    alignSelf: 'center',
    height: 64,
    borderRadius: 32,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressable: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  surface: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#8B5CF6',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topEdgeHighlight: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    opacity: 0.3,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});

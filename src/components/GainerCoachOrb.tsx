import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type GainerCoachOrbVariant = 'idle' | 'thinking' | 'success' | 'streak' | 'pr';

interface GainerCoachOrbProps {
  variant?: GainerCoachOrbVariant;
  style?: ViewStyle;
}

export function GainerCoachOrb({ variant = 'idle', style }: GainerCoachOrbProps) {
  const entry = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const flame = useRef(new Animated.Value(0)).current;
  const win = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, [entry, float]);

  useEffect(() => {
    spin.stopAnimation();
    flame.stopAnimation();
    win.stopAnimation();
    spin.setValue(0);
    flame.setValue(0);
    win.setValue(0);

    let loop: Animated.CompositeAnimation | null = null;

    if (variant === 'thinking') {
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 980, useNativeDriver: true }));
    }

    if (variant === 'streak') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(flame, { toValue: 1, duration: 520, useNativeDriver: true }),
          Animated.timing(flame, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
      );
    }

    if (variant === 'pr') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(win, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(win, { toValue: 0, duration: 760, useNativeDriver: true }),
        ]),
      );
    }

    loop?.start();
    return () => loop?.stop();
  }, [flame, spin, variant, win]);

  const config = useMemo(() => getOrbConfig(variant), [variant]);
  const entryScale = entry.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const flameScale = flame.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const winScale = win.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View
      style={[
        styles.root,
        config.rootStyle,
        style,
        { opacity: entry, transform: [{ scale: entryScale }, { translateY }] },
      ]}
    >
      <View style={styles.floorGlow} />
      {variant === 'success' ? <View style={styles.successRadialGlow} /> : null}
      {variant === 'thinking' ? <ThinkingRing rotate={rotate} /> : null}
      {variant === 'streak' ? <FlameAura scale={flameScale} /> : null}
      <Animated.View style={[styles.orbWrap, variant === 'pr' && { transform: [{ scale: winScale }] }]}>
        <View style={styles.orb}>
          <View style={styles.orbGloss} />
          <Text style={[styles.gLetter, variant === 'success' && styles.gLetterSuccess]}>G</Text>
          <OrbExpression variant={variant} />
        </View>
      </Animated.View>
      {variant === 'success' ? <ThumbsUpGesture /> : null}
      {variant === 'pr' ? <WinArm /> : null}
    </Animated.View>
  );
}

function getOrbConfig(variant: GainerCoachOrbVariant) {
  return {
    rootStyle: variant === 'streak' ? styles.rootStreak : styles.rootPremium,
  };
}

function OrbExpression({ variant }: { variant: GainerCoachOrbVariant }) {
  if (variant === 'thinking') {
    return (
      <>
        <View style={[styles.eyeCalm, styles.eyeLeft]} />
        <View style={[styles.eyeCalm, styles.eyeRight]} />
      </>
    );
  }

  if (variant === 'pr') {
    return (
      <>
        <View style={[styles.eyeLine, styles.eyeLeft, styles.eyeWinkLeft]} />
        <View style={[styles.eyeLine, styles.eyeRight, styles.eyeWinkRight]} />
      </>
    );
  }

  return (
    <>
      <View style={[styles.eyeSmile, styles.eyeLeft]} />
      <View style={[styles.eyeSmile, styles.eyeRight]} />
    </>
  );
}

function ThumbsUpGesture() {
  return (
    <View style={styles.thumbGesture}>
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <Path d="M8.8 20.3h8.7c1.2 0 2.1-.8 2.3-2l.8-5.1c.2-1.2-.7-2.3-1.9-2.3h-5.1l.7-3.2c.2-.9-.1-1.8-.8-2.4l-.8-.7-4.4 6.1v9.6Z" fill="#F5F0FF" />
        <Path d="M3.6 11.2h3.1v9.1H3.6z" fill="#C9B8FF" />
      </Svg>
    </View>
  );
}

function ThinkingRing({ rotate }: { rotate: Animated.AnimatedInterpolation<string> }) {
  return (
    <Animated.View style={[styles.thinkingRing, { transform: [{ rotate }] }]}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View
          key={index}
          style={[
            styles.thinkingDot,
            {
              opacity: 0.35 + index * 0.1,
              transform: [{ rotate: `${index * 60}deg` }, { translateY: -20 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function FlameAura({ scale }: { scale: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View style={[styles.flameAura, { transform: [{ scale }] }]}>
      <Svg width={94} height={94} viewBox="0 0 94 94" fill="none">
        <Path d="M47 6c11 12 20 23 19 38 8-5 13-3 16 5-2 22-17 36-35 36S14 72 12 50c4-8 10-10 17-5C27 30 36 18 47 6Z" fill="rgba(139,92,246,0.42)" />
        <Path d="M48 22c7 9 12 18 11 28 5-3 8-2 10 3-2 14-10 22-22 22S27 67 25 53c2-5 6-6 10-3-1-10 5-19 13-28Z" fill="rgba(168,85,247,0.54)" />
      </Svg>
    </Animated.View>
  );
}

function WinArm() {
  return (
    <View style={styles.winArm}>
      <Svg width={36} height={44} viewBox="0 0 36 44" fill="none">
        <Path d="M7 34c8-3 10-9 12-18l5 2c-1 8-4 16-13 21L7 34Z" fill="#2A204F" stroke="#A98BFF" strokeWidth={1.2} />
        <Circle cx={25} cy={13} r={7} fill="#2A204F" stroke="#A98BFF" strokeWidth={1.2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootPremium: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.44,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  rootStreak: {
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 11,
  },
  floorGlow: {
    position: 'absolute',
    bottom: 8,
    width: 84,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.32)',
    transform: [{ scaleX: 1.42 }],
  },
  successRadialGlow: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 18,
    borderColor: 'rgba(139,92,246,0.035)',
  },
  orbWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090817',
    borderWidth: 1,
    borderColor: 'rgba(169,139,255,0.62)',
    overflow: 'hidden',
  },
  orbGloss: {
    position: 'absolute',
    top: 7,
    left: 10,
    width: 46,
    height: 29,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ rotate: '-18deg' }],
  },
  gLetter: {
    color: '#F4F0FF',
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    textShadowColor: '#8B5CF6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  gLetterSuccess: {
    fontSize: 34,
    lineHeight: 38,
    marginTop: -2,
  },
  eyeSmile: {
    position: 'absolute',
    bottom: 25,
    width: 15,
    height: 8,
    borderBottomWidth: 2.5,
    borderColor: '#DCCBFF',
    borderRadius: 999,
  },
  eyeCalm: {
    position: 'absolute',
    bottom: 24,
    width: 12,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#DCCBFF',
  },
  eyeLine: {
    position: 'absolute',
    bottom: 27,
    width: 13,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#DCCBFF',
  },
  eyeLeft: {
    left: 14,
    transform: [{ rotate: '10deg' }],
  },
  eyeRight: {
    right: 14,
    transform: [{ rotate: '-10deg' }],
  },
  eyeWinkLeft: {
    transform: [{ rotate: '0deg' }],
  },
  eyeWinkRight: {
    transform: [{ rotate: '-24deg' }],
  },
  thumbGesture: {
    position: 'absolute',
    right: -4,
    top: 36,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4D3FDA',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  thinkingRing: {
    position: 'absolute',
    top: 2,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinkingDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8B5CF6',
  },
  flameAura: {
    position: 'absolute',
    top: 5,
  },
  winArm: {
    position: 'absolute',
    right: -6,
    top: 28,
  },
});

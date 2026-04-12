import React from 'react';
import {
  ImageBackground,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { fitnessPhotos, FitnessPhotoKey } from '../assets/fitnessPhotos';
import { radii } from '../theme';

interface FitnessPhotoSurfaceProps {
  variant: FitnessPhotoKey;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
  compact?: boolean;
}

export function FitnessPhotoSurface({
  variant,
  style,
  imageStyle,
  children,
  compact = false,
}: FitnessPhotoSurfaceProps) {
  return (
    <ImageBackground
      source={fitnessPhotos[variant]}
      style={[styles.frame, compact && styles.frameCompact, style]}
      imageStyle={[styles.image, compact && styles.imageCompact, imageStyle]}
    >
      <View pointerEvents="none" style={styles.overlay} />
      <View pointerEvents="none" style={styles.glow} />
      <View pointerEvents="none" style={styles.floor} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    minHeight: 180,
    justifyContent: 'flex-end',
  },
  frameCompact: {
    minHeight: 130,
    borderRadius: radii.md,
  },
  image: {
    borderRadius: radii.lg,
  },
  imageCompact: {
    borderRadius: radii.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 14, 0.24)',
  },
  glow: {
    position: 'absolute',
    top: -42,
    left: -24,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(206, 229, 255, 0.12)',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
    backgroundColor: 'rgba(7, 10, 14, 0.58)',
  },
});

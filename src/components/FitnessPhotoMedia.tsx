import React from 'react';
import { ImageBackground, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { getFitnessPhotoByKey, FitnessPhotoKey } from '../assets/fitnessPhotos';
import { radii } from '../theme';

interface FitnessPhotoMediaProps {
  photoKey: FitnessPhotoKey;
  style?: StyleProp<ViewStyle>;
  source?: ImageSourcePropType;
  children?: React.ReactNode;
}

export function FitnessPhotoMedia({ photoKey, source, style, children }: FitnessPhotoMediaProps) {
  return (
    <ImageBackground
      source={source ?? getFitnessPhotoByKey(photoKey)}
      resizeMode="cover"
      imageStyle={styles.image}
      style={[styles.frame, style]}
    >
      <View style={styles.topLight} />
      <View style={styles.bottomShade} />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    justifyContent: 'flex-end',
    backgroundColor: '#0E1217',
  },
  image: {
    borderRadius: radii.lg,
  },
  topLight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bottomShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 11, 0.34)',
    borderRadius: radii.lg,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(6, 8, 11, 0.18)',
  },
});

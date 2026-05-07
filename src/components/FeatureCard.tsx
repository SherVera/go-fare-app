import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

interface FeatureCardProps {
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor?: string;
  style?: ViewStyle;
}

export const FeatureCard = ({
  title,
  description,
  iconName,
  iconBgColor,
  iconColor = tokens.colors.surface,
  style,
}: FeatureCardProps) => {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons
          name={iconName}
          size={tokens.typography.sizes.lg}
          color={iconColor}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing.lg,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.textDark,
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.bold,
    marginBottom: tokens.spacing.xs,
  },
  description: {
    color: tokens.colors.textGray,
    fontSize: tokens.typography.sizes.xs,
    fontFamily: tokens.typography.fontFamily.regular,
    lineHeight: 18,
  },
});

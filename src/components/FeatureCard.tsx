import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { FeatureCardProps } from '@/interfaces';
import { tokens } from '../theme/tokens';

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

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
  style?: any;
  color?: string;
}

export const ActionCard = ({ title, subtitle, icon, onPress, style, color }: ActionCardProps) => {
  const primaryColor = color || tokens.colors.primary;
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: primaryColor + '15' }]}>
        <MaterialCommunityIcons name={icon} size={28} color={primaryColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
    lineHeight: 15,
  },
});

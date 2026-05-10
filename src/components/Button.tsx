import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { tokens } from '../theme/tokens';
import type { ButtonProps } from '@/interfaces';

export const Button = ({
  title,
  onPress,
  style,
  textStyle,
  iconRight,
  disabled,
}: ButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
      {iconRight && (
        <Ionicons
          name={iconRight}
          size={tokens.typography.sizes.lg}
          color={tokens.colors.surface}
          style={styles.icon}
        />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radii.full,
    paddingVertical: 18,
    paddingHorizontal: tokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12, // For Android shadow
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: tokens.colors.surface,
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    letterSpacing: 0.2,
  },
  icon: {
    marginLeft: tokens.spacing.sm,
  },
});

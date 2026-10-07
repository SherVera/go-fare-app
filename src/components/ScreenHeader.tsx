import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScreenHeaderProps } from '@/interfaces';
import { tokens } from '@/theme/tokens';

export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  onMenu,
  rightAction,
}: ScreenHeaderProps) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {onMenu ? (
        <Pressable
          onPress={onMenu}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="menu" size={24} color={tokens.colors.primary} />
        </Pressable>
      ) : (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.colors.primary} />
        </Pressable>
      )}
      <View style={styles.titleWrapper}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.rightSlot}>
        {rightAction || <View style={styles.spacer} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },
  rightSlot: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScreenHeaderProps } from '@/interfaces';
import { tokens } from '@/theme/tokens';

export const ScreenHeader = ({ title, onBack, onMenu }: ScreenHeaderProps) => {
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
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
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
    width: 28,
  },
  title: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#18243E',
    textAlign: 'center',
    flex: 1,
  },
  spacer: {
    width: 28, // mismo ancho que backBtn para centrar el título
  },
});

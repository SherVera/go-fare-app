import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';

export const HeaderLogo = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.header, { paddingTop: insets.top + tokens.spacing.xs }]}
    >
      <MaterialIcons name="near-me" size={32} color={tokens.colors.primary} />
      <Text style={styles.logoText}>GoFare</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: tokens.spacing.sm,
  },
  logoText: {
    fontSize: 28, // specifically enlarged per user request
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    marginLeft: tokens.spacing.sm,
  },
});

import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';

export default function TicketDetailScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ticket Detail</Text>
      <Text style={styles.subtitle}>
        Detalles de tu pase estarán aquí pronto.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: tokens.typography.sizes.xl,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.md,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
  },
});

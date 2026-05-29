import { useNavigation } from '@react-navigation/native';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FeatureCard } from '../components/FeatureCard';
import { HeaderLogo } from '../components/HeaderLogo';
import { ImageHero } from '../components/ImageHero';
import { tokens } from '../theme/tokens';

export default function HomeScreen() {
  const navigation = useNavigation<any>();

  const handleLogin = () => {
    navigation.navigate('TicketDetail');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Header Logo */}
        <HeaderLogo />

        {/* Hero Image */}
        <View style={styles.heroWrapper}>
          <ImageHero />
        </View>

        {/* Bottom Sheet */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetContent}>
            <Text style={styles.title}>
              Muévete{'\n'}
              libremente por <Text style={styles.titleHighlight}>tu</Text>
              {'\n'}
              <Text style={styles.titleHighlight}>ciudad.</Text>
            </Text>
            <Text style={styles.subtitle}>
              Vive la próxima generación de{'\n'}
              movilidad urbana en Caracas. Rápida,{'\n'}
              sin contacto y estrictamente segura.
            </Text>

            <View style={styles.featuresRow}>
              <FeatureCard
                title="Pago Rápido"
                description="Recargas al instante y pagos vía NFC."
                iconName="wallet-outline"
                iconBgColor={tokens.colors.primary}
                iconColor={tokens.colors.surface}
                style={{ marginRight: tokens.spacing.md }}
              />
              <FeatureCard
                title="Seguro"
                description="Rastreo de rutas en vivo y seguridad con IA."
                iconName="shield-checkmark-outline"
                iconBgColor={tokens.colors.iconGreen}
                iconColor={tokens.colors.surface}
              />
            </View>

            <Button
              title="Iniciar Sesión"
              onPress={handleLogin}
              iconRight="arrow-forward"
              style={styles.button}
            />

            <Text style={styles.footerText}>
              IMPULSADO POR CARACAS MOBILITY TRUST © 2024
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  heroWrapper: {
    alignItems: 'center',
    paddingBottom: tokens.spacing.xxl,
  },
  bottomSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.sheet,
    borderTopRightRadius: tokens.radii.sheet,
    flex: 1,
    paddingTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetContent: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.sizes.xl,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  titleHighlight: {
    color: tokens.colors.primary,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textGray,
    fontFamily: tokens.typography.fontFamily.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.sm,
  },
  featuresRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.xxl,
  },
  button: {
    marginBottom: tokens.spacing.xl,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: tokens.typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

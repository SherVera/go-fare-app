import { useRouter } from 'expo-router';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { FeatureCard } from '@/components/FeatureCard';
import { HeaderLogo } from '@/components/HeaderLogo';
import { ImageHero } from '@/components/ImageHero';
import { tokens } from '@/theme/tokens';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const handleLogin = () => {
    router.push('/phone-login' as any);
  };

  // Ajustes responsivos dinámicos según el alto y ancho del dispositivo
  const isSmallScreen = height < 720;
  const isMediumScreen = height >= 720 && height < 820;
  const isTablet = height >= 900 || width >= 600;

  const heroSize = isSmallScreen
    ? 190
    : isMediumScreen
      ? 230
      : isTablet
        ? 420
        : 280;
  const heroPaddingTop = isSmallScreen
    ? tokens.spacing.md
    : isTablet
      ? tokens.spacing.xxl
      : tokens.spacing.xl;
  const heroPaddingBottom = isSmallScreen
    ? tokens.spacing.lg
    : isTablet
      ? tokens.spacing.xxl
      : tokens.spacing.xl;
  const subtitleMarginBottom = isSmallScreen
    ? tokens.spacing.md
    : tokens.spacing.lg;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Header Logo */}
        <HeaderLogo />

        {/* Hero Image */}
        <View
          style={[
            styles.heroWrapper,
            { paddingTop: heroPaddingTop, paddingBottom: heroPaddingBottom },
          ]}
        >
          <ImageHero size={heroSize} />
        </View>

        {/* Bottom Sheet */}
        <View
          style={[
            styles.bottomSheet,
            { paddingBottom: insets.bottom + tokens.spacing.xl },
          ]}
        >
          <View
            style={[styles.sheetContent, isTablet && styles.sheetContentTablet]}
          >
            <View style={styles.textContainer}>
              <Text style={[styles.title, isTablet && styles.titleTablet]}>
                Muévete{'\n'}
                libremente por <Text style={styles.titleHighlight}>tu</Text>
                {'\n'}
                <Text style={styles.titleHighlight}>ciudad.</Text>
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  isTablet && styles.subtitleTablet,
                  { marginBottom: subtitleMarginBottom },
                ]}
              >
                Vive la próxima generación de{'\n'}
                movilidad urbana en Caracas. Rápida,{'\n'}
                sin contacto y strictly segura.
              </Text>
            </View>

            {/* Tarjetas de Características para Tablets / Pantallas Grandes */}
            {isTablet && (
              <View style={styles.featuresRowTablet}>
                <FeatureCard
                  title="Pago Rápido"
                  description="Recargas al instante y validación de pasaje sin contacto."
                  iconName="wallet-outline"
                  iconBgColor={tokens.colors.primary}
                  iconColor={tokens.colors.surface}
                  style={{ marginRight: tokens.spacing.md }}
                />
                <FeatureCard
                  title="Seguridad en Rutas"
                  description="Rastreo en tiempo real y verificación de pase digital."
                  iconName="shield-checkmark-outline"
                  iconBgColor={tokens.colors.iconGreen}
                  iconColor={tokens.colors.surface}
                />
              </View>
            )}

            <View style={styles.actionsContainer}>
              <Button
                title="Iniciar Sesión"
                onPress={handleLogin}
                iconRight="arrow-forward"
                style={[
                  styles.button,
                  isTablet && styles.buttonTablet,
                  { marginBottom: tokens.spacing.md },
                ]}
              />

              {/* Fila de registro para usuarios sin cuenta */}
              <View style={styles.registerContainer}>
                <Text
                  style={[
                    styles.registerText,
                    isTablet && styles.registerTextTablet,
                  ]}
                >
                  ¿No tienes una cuenta?{' '}
                  <Text
                    style={[
                      styles.registerLink,
                      isTablet && styles.registerLinkTablet,
                    ]}
                    onPress={() => router.push('/register' as any)}
                  >
                    Regístrate
                  </Text>
                </Text>
              </View>

              {/* Fila de registro para dueños de vehículo */}
              <View
                style={[
                  styles.registerContainer,
                  { marginTop: 0, marginBottom: tokens.spacing.xs },
                ]}
              >
                <Text
                  style={[
                    styles.registerText,
                    isTablet && styles.registerTextTablet,
                    { textAlign: 'center' },
                  ]}
                >
                  ¿Eres dueño de vehículo?{' '}
                  <Text
                    style={[
                      styles.registerLink,
                      isTablet && styles.registerLinkTablet,
                    ]}
                    onPress={() =>
                      router.push('/register-vehicle-owner' as any)
                    }
                  >
                    Envía tu solicitud aquí
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    width: '100%',
  },
  heroWrapper: {
    alignItems: 'center',
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxl,
    width: '100%',
  },
  bottomSheet: {
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radii.sheet,
    borderTopRightRadius: tokens.radii.sheet,
    flex: 1,
    paddingTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetContent: {
    flex: 1,
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  sheetContentTablet: {
    maxWidth: 680,
    paddingVertical: tokens.spacing.lg,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: tokens.typography.sizes.xl,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.textDark,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  titleTablet: {
    fontSize: 34,
    lineHeight: 44,
    marginBottom: tokens.spacing.md,
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
  subtitleTablet: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: tokens.spacing.xl,
  },
  featuresRowTablet: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: tokens.spacing.lg,
  },
  featuresRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.xxl,
  },
  button: {
    marginBottom: tokens.spacing.xl,
  },
  buttonTablet: {
    height: 56,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  registerText: {
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.medium,
    color: tokens.colors.textGray,
  },
  registerTextTablet: {
    fontSize: 16,
  },
  registerLink: {
    fontSize: tokens.typography.sizes.sm,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
  },
  registerLinkTablet: {
    fontSize: 16,
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

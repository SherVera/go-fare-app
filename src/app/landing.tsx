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
import { HeaderLogo } from '@/components/HeaderLogo';
import { ImageHero } from '@/components/ImageHero';
import { tokens } from '@/theme/tokens';

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const handleLogin = () => {
    router.push('/login' as any);
  };

  // Ajustes responsivos dinámicos según el alto de la pantalla del dispositivo
  const isSmallScreen = height < 720;
  const isMediumScreen = height >= 720 && height < 820;

  const heroSize = isSmallScreen ? 190 : isMediumScreen ? 240 : 290;
  const heroPaddingTop = isSmallScreen ? tokens.spacing.md : tokens.spacing.xl;
  const heroPaddingBottom = isSmallScreen
    ? tokens.spacing.lg
    : tokens.spacing.xxl;
  const subtitleMarginBottom = isSmallScreen
    ? tokens.spacing.lg
    : tokens.spacing.xl;
  const buttonMarginBottom = isSmallScreen
    ? tokens.spacing.lg
    : tokens.spacing.xl;

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
          <View style={styles.sheetContent}>
            <Text style={styles.title}>
              Muévete{'\n'}
              libremente por <Text style={styles.titleHighlight}>tu</Text>
              {'\n'}
              <Text style={styles.titleHighlight}>ciudad.</Text>
            </Text>
            <Text
              style={[styles.subtitle, { marginBottom: subtitleMarginBottom }]}
            >
              Vive la próxima generación de{'\n'}
              movilidad urbana en Caracas. Rápida,{'\n'}
              sin contacto y estrictamente segura.
            </Text>

            <Button
              title="Iniciar Sesión"
              onPress={handleLogin}
              iconRight="arrow-forward"
              style={[styles.button, { marginBottom: buttonMarginBottom }]}
            />

            <Text style={styles.footerText}>
              IMPULSADO POR CARACAS MOBILITY TRUST © 2024
            </Text>
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
  },
  heroWrapper: {
    alignItems: 'center',
    paddingTop: tokens.spacing.xl,
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

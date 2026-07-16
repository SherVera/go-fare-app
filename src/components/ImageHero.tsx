import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

interface ImageHeroProps {
  style?: ViewStyle;
  size?: number;
}

export const ImageHero = ({ style, size }: ImageHeroProps) => {
  const imageStyle = size
    ? [styles.image, { width: size, height: size }]
    : styles.image;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/images/fondo-bus.png')}
        style={imageStyle}
        contentFit="cover"
        transition={1000}
      />
      <View style={styles.badgeContainer}>
        <View style={styles.badgeIconBg}>
          <Ionicons
            name="qr-code-outline"
            size={16}
            color={tokens.colors.iconGreen}
          />
        </View>
        <View>
          <Text style={styles.badgeTitle}>PASE DIGITAL</Text>
          <Text style={styles.badgeSubtitle}>Verificación Segura</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  image: {
    width: 290,
    height: 290,
    borderRadius: tokens.radii.xl,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -10, // To overlap slightly with the bottom of the image
    backgroundColor: '#E5E7EB', // specific light gray from image
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  badgeIconBg: {
    backgroundColor: '#99F6E4', // bright cyan from image
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.full,
    marginRight: tokens.spacing.md,
  },
  badgeTitle: {
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textGray,
    textTransform: 'uppercase',
  },
  badgeSubtitle: {
    fontSize: tokens.typography.sizes.xs,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
});

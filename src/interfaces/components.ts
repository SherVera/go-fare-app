// ─── Interfaces de Props de Componentes de UI ──────────────────────────────

import type { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { LocationObject } from 'expo-location';
import type { TextStyle, ViewStyle } from 'react-native';
import type { Route } from './route';
import type { UserProfile } from './user';

/** Props para el componente Button */
export interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

/** Props para el encabezado de pantalla ScreenHeader */
export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
}

/** Props para tarjetas de características FeatureCard */
export interface FeatureCardProps {
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor?: string;
  style?: ViewStyle;
}

/** Props para las tarjetas de acción rápidas en el Home */
export interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
  style?: ViewStyle;
  color?: string;
}

/** Props para el ítem de ruta en la lista */
export interface RouteItemProps extends Route {}

/** Props para la tarjeta de balance del usuario */
export interface BalanceCardProps {
  balance: UserProfile['balance'];
  carnetId: UserProfile['carnetId'];
}

/** Props para el componente de mapa nativo */
export interface NativeMapProps {
  location: LocationObject;
}

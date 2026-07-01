import fs from 'node:fs';
import path from 'node:path';
import type { ExpoConfig } from 'expo/config';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[app.config] Missing required env var "${key}". ` +
        `Copy .env.example to .env and fill it in (or set it in EAS env / CI).`,
    );
  }
  return value;
};

const optionalEnv = (key: string): string | undefined =>
  process.env[key] || undefined;

const projectRoot = process.cwd();

function assertFirebaseClientFilesPresent(): void {
  const iosPlist = path.join(projectRoot, 'GoogleService-Info.plist');
  const androidJson = path.join(projectRoot, 'google-services.json');
  const missing: string[] = [];
  if (!fs.existsSync(iosPlist)) missing.push('GoogleService-Info.plist');
  if (!fs.existsSync(androidJson)) missing.push('google-services.json');
  if (missing.length === 0) return;
  throw new Error(
    `[app.config] Missing Firebase file(s) in project root: ${missing.join(', ')}.\n` +
      'Download them from Firebase Console → Project settings → Your apps (iOS / Android). ' +
      'These files are git-ignored; see .env.example.',
  );
}

assertFirebaseClientFilesPresent();

const googleMapsIosApiKey = optionalEnv('GOOGLE_MAPS_IOS_API_KEY');

const config: ExpoConfig = {
  name: 'GoFare',
  slug: 'GoFare',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gofare',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  platforms: ['ios', 'android'],
  ios: {
    bundleIdentifier: 'com.gofare.app',
    supportsTablet: true,
    googleServicesFile: './GoogleService-Info.plist',
    // Google Maps iOS SDK — Expo inyecta esto en el nativo en el prebuild.
    // Misma consola que Android, pero API y restricciones distintas (ver docs).
    ...(googleMapsIosApiKey
      ? { config: { googleMapsApiKey: googleMapsIosApiKey } }
      : {}),
    // Push Notifications capability + background delivery for FCM data-only
    // messages and silent push (also required for Phone Auth APNs flow).
    entitlements: {
      'aps-environment': 'production',
    },
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'fetch'],
      NSFaceIDUsageDescription:
        'Habilita FaceID para ingresar rápidamente a tu cuenta.',
    },
  },
  android: {
    package: 'com.gofare.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    googleServicesFile: './google-services.json',
    config: {
      googleMaps: {
        apiKey: requireEnv('GOOGLE_MAPS_ANDROID_API_KEY'),
      },
    },
  },
  plugins: [
    [
      'expo-build-properties',
      {
        ios: {
          // Required for @react-native-firebase on iOS (Swift pods + static linkage).
          useFrameworks: 'static',
        },
      },
    ],
    './plugins/withPodfileIosAllowNonModularIncludes',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { backgroundColor: '#000000' },
      },
    ],
    'expo-font',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/messaging',
    '@react-native-google-signin/google-signin',
    'expo-dev-client',
    'expo-secure-store',
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Habilita FaceID para ingresar rápidamente a tu cuenta.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId:
        optionalEnv('EAS_PROJECT_ID') ?? '1e738e60-7dd4-48be-b8f6-dd713dee3b67',
    },
  },
};

export default config;

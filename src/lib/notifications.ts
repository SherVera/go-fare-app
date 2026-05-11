import {
  AuthorizationStatus,
  FirebaseMessagingTypes,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

const messaging = getMessaging();

export interface RemoteMessage extends FirebaseMessagingTypes.RemoteMessage {}

const isAuthorized = (status: FirebaseMessagingTypes.AuthorizationStatus) =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL;

/**
 * Asks the OS for permission to display notifications.
 * On Android 13+ this triggers the runtime POST_NOTIFICATIONS prompt.
 * On iOS this triggers the standard alert/badge/sound prompt.
 *
 * Safe to call on every cold start — Firebase caches the answer.
 */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  const status = await requestPermission(messaging, {
    sound: true,
    badge: true,
    alert: true,
  });
  return isAuthorized(status);
};

/**
 * Returns the current FCM registration token for this device.
 * Returns null if the user denied notifications or if APNs is not yet
 * available on iOS (e.g. simulator without push capability).
 */
export const getFcmToken = async (): Promise<string | null> => {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return null;
    return await getToken(messaging);
  } catch (err) {
    if (__DEV__) {
      console.warn('[notifications] getFcmToken failed', err);
    }
    return null;
  }
};

interface NotificationHandlers {
  /** Triggered when a remote message arrives while the app is foregrounded. */
  onForegroundMessage?: (message: RemoteMessage) => void;
  /** Triggered when the user taps a notification that opened the app from background. */
  onOpened?: (message: RemoteMessage) => void;
  /** Triggered whenever FCM rotates the device token (app upgrade, restore, etc.). */
  onTokenChange?: (token: string) => void;
}

/**
 * Wires up FCM listeners. Returns an unsubscribe function that detaches
 * every listener — call it from the cleanup of the effect that registered
 * them.
 */
export const registerNotificationHandlers = ({
  onForegroundMessage,
  onOpened,
  onTokenChange,
}: NotificationHandlers): (() => void) => {
  const unsubForeground = onMessage(messaging, async (message) => {
    onForegroundMessage?.(message);
  });

  const unsubOpened = onNotificationOpenedApp(messaging, (message) => {
    if (message) onOpened?.(message);
  });

  const unsubToken = onTokenRefresh(messaging, (token) => {
    onTokenChange?.(token);
  });

  return () => {
    unsubForeground();
    unsubOpened();
    unsubToken();
  };
};

/**
 * Returns the message that opened the app from a fully-killed state, if any.
 * Call once after the user is authenticated to handle deep-link style
 * notifications (e.g. "open this trip").
 */
export const getInitialNotification =
  async (): Promise<RemoteMessage | null> => {
    const message = await messaging.getInitialNotification();
    return message ?? null;
  };

/** True on platforms where FCM works at all. */
export const supportsPushNotifications =
  Platform.OS === 'ios' || Platform.OS === 'android';

import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

/**
 * FCM **background** message handler.
 *
 * Per RN Firebase docs, this must be registered **before** the React tree
 * mounts and at the top of the app's entry. Importing this file from the
 * very top of `app/_layout.tsx` (which is loaded by `expo-router/entry`)
 * satisfies that requirement.
 *
 * The handler receives data-only messages while the app is in the
 * background or terminated. It runs in a headless JS context — keep it
 * small and side-effect free (no UI, no navigation).
 */
setBackgroundMessageHandler(getMessaging(), async (message) => {
  if (__DEV__) {
    console.log('[fcm:background]', message?.messageId, message?.data);
  }
});

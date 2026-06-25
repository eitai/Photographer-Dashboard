import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiClient } from '@koral/api';

// ---------------------------------------------------------------------------
// Foreground notification behaviour — show a banner while the app is open
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Requests push-notification permission, obtains the Expo push token, and
 * registers it with the backend (POST /api/auth/push-token).
 *
 * Also sets up:
 *  - foreground listener: shows an Alert when a selection is submitted while
 *    the app is in the foreground
 *  - tap listener: navigates to the relevant selections screen when the
 *    photographer taps the notification
 *
 * Must only be called inside a protected layout (i.e. when the user is
 * already authenticated) so that the API call has a valid JWT token.
 */
export function usePushNotifications(): PushNotificationState {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  const foregroundSubscription = useRef<Notifications.EventSubscription | null>(null);
  const tapSubscription = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // -----------------------------------------------------------------------
    // 1. Register for push notifications and obtain the Expo push token
    // -----------------------------------------------------------------------
    registerForPushNotificationsAsync()
      .then(async (token) => {
        if (!token) return;
        setExpoPushToken(token);

        // 2. Persist the token on the backend so the server can send pushes
        try {
          await apiClient.post('/api/auth/push-token', { token });
        } catch (err) {
          // Non-fatal — the app works fine without push notifications
          console.warn('[usePushNotifications] Failed to register token with backend:', err);
        }
      })
      .catch((err) => {
        console.warn('[usePushNotifications] Could not get push token:', err);
      });

    // -----------------------------------------------------------------------
    // 3. Foreground listener — app is open when the notification arrives
    // -----------------------------------------------------------------------
    foregroundSubscription.current = Notifications.addNotificationReceivedListener((incoming) => {
      setNotification(incoming);

      const title = incoming.request.content.title ?? 'New notification';
      const body = incoming.request.content.body ?? '';

      Alert.alert(title, body, [
        { text: 'View', onPress: () => handleNotificationTap(incoming, router) },
        { text: 'Dismiss', style: 'cancel' },
      ]);
    });

    // -----------------------------------------------------------------------
    // 4. Tap listener — photographer taps the notification from outside the app
    // -----------------------------------------------------------------------
    tapSubscription.current = Notifications.addNotificationResponseReceivedListener((response) => {
      setNotification(response.notification);
      handleNotificationTap(response.notification, router);
    });

    return () => {
      foregroundSubscription.current?.remove();
      tapSubscription.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { expoPushToken, notification };
}

// ---------------------------------------------------------------------------
// Navigate to the relevant selection when the notification is tapped
// ---------------------------------------------------------------------------

function handleNotificationTap(
  notification: Notifications.Notification,
  router: ReturnType<typeof useRouter>,
): void {
  const data = notification.request.content.data as Record<string, unknown> | null;
  const galleryId = data?.galleryId as string | undefined;

  if (galleryId) {
    // Navigate directly to the gallery's selections detail if a route exists
    router.push('/(app)/selections' as Parameters<typeof router.push>[0]);
  } else {
    router.push('/(app)/selections' as Parameters<typeof router.push>[0]);
  }
}

// ---------------------------------------------------------------------------
// Permission request + token acquisition
// ---------------------------------------------------------------------------

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications are not available in the iOS/Android simulators for
  // Expo Go without a physical device — log a warning and bail out gracefully.
  if (!Device.isDevice) {
    console.warn(
      '[usePushNotifications] Push notifications only work on physical devices. ' +
        'Token registration skipped.',
    );
    return null;
  }

  // Android requires an explicit notification channel before requesting permission
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('selections', {
      name: 'Gallery Selections',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E7B8B5', // Blush design token
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // Photographer declined — not a hard failure
    console.warn('[usePushNotifications] Push notification permission was not granted.');
    return null;
  }

  // getExpoPushTokenAsync requires the projectId from app.json extra.eas
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

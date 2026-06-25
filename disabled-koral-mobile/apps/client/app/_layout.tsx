// react-native-gesture-handler must be the very first import in the root layout
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@koral/i18n';

// ---------------------------------------------------------------------------
// QueryClient
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,    // 2 minutes — re-fetch in the background after this
      gcTime: 10 * 60 * 1000,       // 10 minutes — keep unused gallery data in cache
      retry: 1,
      retryDelay: 1000,
      networkMode: 'offlineFirst',  // show cached photos immediately when offline
    },
    mutations: {
      retry: 0,                     // never retry mutations — selection submits must be explicit
      networkMode: 'always',        // mutations always attempt the network (fail fast offline)
    },
  },
});

// ---------------------------------------------------------------------------
// Deep-link handler
// ---------------------------------------------------------------------------

/**
 * Extracts the gallery token from a deep link URL.
 * Matches both:
 *   koral-client://gallery/<token>
 *   https://koral.app/gallery/<token>  (universal links)
 */
function extractToken(url: string): string | null {
  const match = url.match(/gallery\/([^/?#]+)/);
  return match ? match[1] : null;
}

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle cold-start deep links
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const token = extractToken(url);
      if (token) router.replace(`/gallery/${token}`);
    });

    // Handle warm-start / foreground deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = extractToken(url);
      if (token) router.push(`/gallery/${token}`);
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DeepLinkHandler />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="gallery/[token]"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

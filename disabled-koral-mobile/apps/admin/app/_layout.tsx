import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@koral/i18n';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,    // 2 minutes — re-fetch in the background after this
      gcTime: 10 * 60 * 1000,       // 10 minutes — keep unused data in cache this long
      retry: 1,
      retryDelay: 1000,
      networkMode: 'offlineFirst',  // render cached data immediately; fetch in background
    },
    mutations: {
      retry: 0,                     // never retry mutations automatically — surface errors
      networkMode: 'always',        // mutations always attempt the network (fail fast offline)
    },
  },
});

/**
 * Root layout — wraps the whole app in QueryClientProvider and LanguageProvider.
 * Initialises auth state from expo-secure-store on first mount.
 * Shows a full-screen spinner while the async read is in flight so no
 * child route renders against an uninitialised store.
 */
export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <View style={styles.webRoot}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        </View>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webRoot: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
  },
});

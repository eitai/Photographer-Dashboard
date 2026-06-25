import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { SidebarProvider } from '../../context/SidebarContext';
import { Sidebar } from '../../components/ui/Sidebar';

/**
 * Protected stack layout — any route inside (app)/ requires a valid token.
 * Role rules (mirrors web ProtectedRoute):
 *   superadmin → can ONLY access /users; all other screens redirect there
 *   admin      → can access everything EXCEPT /users; redirected to /dashboard
 */
export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  const admin = useAuthStore((s) => s.admin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pathname = usePathname(); // e.g. '/(app)/users', '/(app)/dashboard'

  usePushNotifications();

  if (!token) {
    return <Redirect href='/(auth)/login' />;
  }

  // Wait until admin profile is hydrated before enforcing role rules
  if (!isLoading && admin) {
    const isUsersScreen = pathname.includes('/users');
    if (admin.role === 'superadmin' && !isUsersScreen) {
      return <Redirect href='/(app)/users' />;
    }
    if (admin.role !== 'superadmin' && isUsersScreen) {
      return <Redirect href='/(app)/dashboard' />;
    }
  }

  return (
    <SidebarProvider>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="clients" />
          <Stack.Screen name="galleries" />
          <Stack.Screen name="selections" />
          <Stack.Screen name="blog" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="users" />
          {/* showcase is reachable via settings row, not a nav item */}
          <Stack.Screen name="showcase" />
        </Stack>

        {/* Sidebar overlays all screens — rendered at layout level */}
        <Sidebar />
      </View>
    </SidebarProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

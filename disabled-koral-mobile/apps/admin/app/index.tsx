import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Entry point — redirects based on auth state.
 * The root _layout ensures this only renders after initialize() has completed,
 * so the token check here reflects the persisted value from secure-store.
 */
export default function Index() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

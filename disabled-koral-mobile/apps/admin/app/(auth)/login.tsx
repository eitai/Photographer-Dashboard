import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

// Inline translations — replace with @koral/i18n once it is built out
const T = {
  he: {
    title: 'כניסה לסטודיו',
    emailPlaceholder: 'אימייל',
    passwordPlaceholder: 'סיסמה',
    submit: 'כניסה',
    errorGeneric: 'האימייל או הסיסמה שגויים. נסה שוב.',
    errorNetwork: 'שגיאת רשת. בדוק את החיבור ונסה שוב.',
  },
  en: {
    title: 'Studio Sign In',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    submit: 'Sign In',
    errorGeneric: 'Incorrect email or password. Please try again.',
    errorNetwork: 'Network error. Check your connection and try again.',
  },
} as const;

// Simple locale detection — extend with @koral/i18n when available
const locale: 'he' | 'en' = 'he';
const t = T[locale];

export default function LoginScreen() {
  const loginStore = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await loginStore(email.trim(), password);
      router.replace('/(app)/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 400) {
        setError(t.errorGeneric);
      } else {
        setError(t.errorNetwork);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {/* Logo / title */}
        <Text style={styles.title}>{t.title}</Text>
        <View style={styles.accentBar} />

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder={t.emailPlaceholder}
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          editable={!isSubmitting}
          accessibilityLabel={t.emailPlaceholder}
        />

        {/* Password */}
        <TextInput
          style={styles.input}
          placeholder={t.passwordPlaceholder}
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!isSubmitting}
          accessibilityLabel={t.passwordPlaceholder}
        />

        {/* Error message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Submit button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isSubmitting && styles.buttonDisabled,
            pressed && !isSubmitting && styles.buttonPressed,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t.submit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t.submit}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2d2d2d',
    textAlign: 'center',
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  accentBar: {
    width: 48,
    height: 3,
    backgroundColor: '#E7B8B5',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0ddd8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2d2d2d',
    marginBottom: 14,
    backgroundColor: '#FAFAF9',
    textAlign: locale === 'he' ? 'right' : 'left',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#E7B8B5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

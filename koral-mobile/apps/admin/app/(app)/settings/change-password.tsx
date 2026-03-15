import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '@koral/api';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ChangePasswordScreen() {
  const { t } = useLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [currentError, setCurrentError] = useState('');
  const [newError, setNewError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const changeMutation = useMutation({
    mutationFn: () =>
      changePassword({ current: currentPassword, next: newPassword }),
    onSuccess: () => {
      Alert.alert('', t('admin.settings.password_updated'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      setCurrentError(t('admin.settings.password_failed'));
    },
  });

  function validate(): boolean {
    let valid = true;
    setCurrentError('');
    setNewError('');
    setConfirmError('');

    if (!currentPassword) {
      setCurrentError(t('admin.common.required'));
      valid = false;
    }

    if (!newPassword) {
      setNewError(t('admin.common.required'));
      valid = false;
    } else if (newPassword.length < 8) {
      setNewError(t('admin.settings.password_min'));
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmError(t('admin.common.required'));
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmError(t('admin.settings.passwords_mismatch'));
      valid = false;
    }

    return valid;
  }

  function handleSubmit() {
    if (!validate()) return;
    changeMutation.mutate();
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.settings.change_pw_title')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.settings.current_password')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            error={currentError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <Input
            label={t('admin.settings.new_password')}
            value={newPassword}
            onChangeText={setNewPassword}
            error={newError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Input
            label={t('admin.settings.confirm_password')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={confirmError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </View>

        <Button
          title={
            changeMutation.isPending
              ? t('admin.settings.updating')
              : t('admin.settings.update_password')
          }
          onPress={handleSubmit}
          loading={changeMutation.isPending}
          style={styles.submitBtn}
        />
      </Card>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  backText: {
    fontSize: typography.md,
    color: colors.text,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {},
  formGap: {
    gap: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});

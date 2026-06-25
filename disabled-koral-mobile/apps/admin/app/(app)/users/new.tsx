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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAdmin } from '@koral/api';
import type { CreateAdminPayload, AdminUser } from '@koral/api';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

// ---------------------------------------------------------------------------
// Role selector
// ---------------------------------------------------------------------------

type AdminRole = 'admin' | 'superadmin';

interface RoleSelectorProps {
  value: AdminRole;
  onChange: (role: AdminRole) => void;
}

function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const { t } = useLanguage();
  const roles: AdminRole[] = ['admin', 'superadmin'];

  const labels: Record<AdminRole, string> = {
    admin: t('admin.users.role_select_admin'),
    superadmin: t('admin.users.role_select_superadmin'),
  };

  return (
    <View>
      <Text style={styles.roleLabel}>{t('admin.users.role')}</Text>
      <View style={styles.rolePicker}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role}
            onPress={() => onChange(role)}
            style={[
              styles.roleOption,
              value === role && styles.roleOptionActive,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === role }}
            accessibilityLabel={labels[role]}
          >
            <Text
              style={[
                styles.roleOptionText,
                value === role && styles.roleOptionTextActive,
              ]}
            >
              {labels[role]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NewUserScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [studioName, setStudioName] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: CreateAdminPayload) => createAdmin(data),
    onSuccess: (_user: AdminUser) => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      router.replace('/(app)/users');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t('admin.users.create_error');
      Alert.alert('', message);
    },
  });

  function validate(): boolean {
    let valid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');

    if (!name.trim()) {
      setNameError(t('admin.common.required'));
      valid = false;
    }
    if (!email.trim()) {
      setEmailError(t('admin.common.required'));
      valid = false;
    }
    if (!password) {
      setPasswordError(t('admin.common.required'));
      valid = false;
    } else if (password.length < 8) {
      setPasswordError(t('admin.settings.password_min'));
      valid = false;
    }
    return valid;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      username: username.trim() || undefined,
      studioName: studioName.trim() || undefined,
    });
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.users.create')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.common.name')}
            value={name}
            onChangeText={setName}
            error={nameError}
            autoCapitalize="words"
            autoFocus
          />
          <Input
            label={t('admin.common.email')}
            value={email}
            onChangeText={setEmail}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label={t('admin.users.password')}
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label={t('admin.users.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('admin.users.studio_name')}
            value={studioName}
            onChangeText={setStudioName}
            autoCapitalize="words"
          />
          <RoleSelector value={role} onChange={setRole} />
        </View>

        <Button
          title={
            createMutation.isPending
              ? t('admin.common.creating')
              : t('admin.users.create')
          }
          onPress={handleSubmit}
          loading={createMutation.isPending}
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
  roleLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rolePicker: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  roleOptionText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  roleOptionTextActive: {
    color: colors.text,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});

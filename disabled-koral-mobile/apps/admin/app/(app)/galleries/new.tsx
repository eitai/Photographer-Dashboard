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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createGallery, getClients } from '@koral/api';
import type { Client, Gallery } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const QUERY_KEYS = {
  clients: ['clients'] as const,
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NewGalleryScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [headerMessage, setHeaderMessage] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');
  const [clientError, setClientError] = useState('');

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Gallery>) => createGallery(data),
    onSuccess: (newGallery) => {
      qc.invalidateQueries({ queryKey: ['galleries'] });
      router.replace(`/(app)/galleries/${newGallery._id}`);
    },
  });

  function validate(): boolean {
    let valid = true;
    setTitleError('');
    setClientError('');
    if (!title.trim()) {
      setTitleError(t('admin.common.required'));
      valid = false;
    }
    if (!selectedClientId) {
      setClientError(t('admin.common.required'));
      valid = false;
    }
    return valid;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMutation.mutate({
      title: title.trim(),
      clientId: selectedClientId!,
      headerMessage: headerMessage.trim() || undefined,
    });
  }

  function showClientPicker() {
    if (clients.length === 0) {
      Alert.alert('', t('admin.clients.no_clients'));
      return;
    }
    Alert.alert(
      t('admin.common.select_client'),
      undefined,
      [
        ...clients.map((c) => ({
          text: c.name,
          onPress: () => setSelectedClientId(c._id),
        })),
        { text: t('admin.common.cancel'), style: 'cancel' as const },
      ],
    );
  }

  const selectedClient = clients.find((c) => c._id === selectedClientId);

  return (
    <View style={styles.container}>
      <Header title={t('admin.galleries.new')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.galleries.title_label')}
            value={title}
            onChangeText={setTitle}
            error={titleError}
            autoFocus
          />

          {/* Client picker */}
          <View>
            <Text style={styles.fieldLabel}>{t('admin.galleries.client_label')}</Text>
            <TouchableOpacity
              onPress={showClientPicker}
              style={[
                styles.pickerBtn,
                !!clientError && styles.pickerBtnError,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('admin.galleries.client_label')}
            >
              <Text
                style={[
                  styles.pickerText,
                  !selectedClient && styles.pickerPlaceholder,
                ]}
              >
                {selectedClient?.name ?? t('admin.galleries.select_client')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {!!clientError && (
              <Text style={styles.fieldError}>{clientError}</Text>
            )}
          </View>

          <Input
            label={t('admin.galleries.header_msg')}
            value={headerMessage}
            onChangeText={setHeaderMessage}
            multiline
            numberOfLines={2}
          />
        </View>

        {createMutation.isError && (
          <Text style={styles.serverError}>{t('admin.galleries.error')}</Text>
        )}

        <Button
          title={
            createMutation.isPending
              ? t('admin.common.creating')
              : t('admin.galleries.create')
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
  card: {
    gap: spacing.md,
  },
  formGap: {
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 4,
    minHeight: 44,
  },
  pickerBtnError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  pickerText: {
    fontSize: typography.md,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
  },
  fieldError: {
    fontSize: typography.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  serverError: {
    fontSize: typography.sm,
    color: colors.error,
    textAlign: 'center',
  },
});

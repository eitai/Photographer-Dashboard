import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBlogPost } from '@koral/api';
import type { BlogPost } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NewBlogPostScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [titleError, setTitleError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: Partial<BlogPost>) => createBlogPost(data),
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ['blog'] });
      // Navigate to the new post's detail screen
      router.replace(`/(app)/blog/${post._id}`);
    },
  });

  function validate(): boolean {
    setTitleError('');
    if (!title.trim()) {
      setTitleError(t('admin.common.required'));
      return false;
    }
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMutation.mutate({
      title: title.trim(),
      content: content.trim() || undefined,
      publishedAt: isPublished ? new Date().toISOString() : undefined,
    });
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.blog.create')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.common.title')}
            value={title}
            onChangeText={setTitle}
            error={titleError}
            autoCapitalize="sentences"
            autoFocus
          />

          <Input
            label={t('admin.blog.content_label')}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            style={styles.contentInput}
          />

          {/* Published toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {t('admin.blog.published_toggle')}
            </Text>
            <Switch
              value={isPublished}
              onValueChange={setIsPublished}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
              accessibilityLabel={t('admin.blog.published_toggle')}
            />
          </View>
        </View>

        {createMutation.isError && (
          <Text style={styles.serverError}>
            {t('admin.blog.create_error')}
          </Text>
        )}

        <Button
          title={
            createMutation.isPending
              ? t('admin.common.creating')
              : t('admin.blog.create')
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
  contentInput: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    fontSize: typography.md,
    color: colors.text,
    fontWeight: typography.medium,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  serverError: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

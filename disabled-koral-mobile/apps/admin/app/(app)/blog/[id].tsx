import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlogPost, updateBlogPost, deleteBlogPost } from '@koral/api';
import type { BlogPost } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const QUERY_KEYS = {
  post: (id: string) => ['blog', id] as const,
  posts: ['blog'] as const,
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BlogPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [titleError, setTitleError] = useState('');

  const {
    data: post,
    isLoading,
    isError,
    refetch,
  } = useQuery<BlogPost>({
    queryKey: QUERY_KEYS.post(id),
    queryFn: () => getBlogPost(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content ?? '');
      setIsPublished(!!post.publishedAt);
    }
  }, [post]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<BlogPost>) => updateBlogPost(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.post(id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.posts });
      Alert.alert('', t('admin.blog.save_success'));
    },
    onError: () => {
      Alert.alert('', t('admin.blog.save_error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBlogPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.posts });
      router.replace('/(app)/blog');
    },
    onError: () => {
      Alert.alert('', t('admin.blog.delete_error'));
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

  function handleSave() {
    if (!validate()) return;
    updateMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      publishedAt: isPublished
        ? (post?.publishedAt ?? new Date().toISOString())
        : undefined,
    });
  }

  function handleDelete() {
    Alert.alert(
      t('admin.blog.delete_confirm'),
      t('admin.blog.delete_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.blog.error_detail')}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={post.title} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Edit form */}
      <Card style={styles.section}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.common.title')}
            value={title}
            onChangeText={setTitle}
            error={titleError}
            autoCapitalize="sentences"
          />

          <Input
            label={t('admin.blog.content_label')}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
            style={styles.contentInput}
          />

          {/* Rich-text note */}
          <View style={styles.noteBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.info}
            />
            <Text style={styles.noteText}>{t('admin.blog.rich_text_note')}</Text>
          </View>

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

        <Button
          title={
            updateMutation.isPending
              ? t('admin.common.saving')
              : t('admin.common.save')
          }
          onPress={handleSave}
          loading={updateMutation.isPending}
          style={styles.saveBtn}
        />
      </Card>

      {/* Delete */}
      <Button
        title={
          deleteMutation.isPending
            ? t('admin.common.deleting')
            : t('admin.common.delete')
        }
        variant="ghost"
        onPress={handleDelete}
        loading={deleteMutation.isPending}
        style={styles.deleteBtn}
      />
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
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
  section: {
    marginBottom: spacing.lg,
  },
  formGap: {
    gap: spacing.md,
  },
  contentInput: {
    minHeight: 180,
    textAlignVertical: 'top',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.infoSurface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.info,
    lineHeight: typography.sm * typography.normal,
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
  saveBtn: {
    marginTop: spacing.lg,
  },
  deleteBtn: {
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.md,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: typography.md,
    color: colors.textOnPrimary,
    fontWeight: typography.semibold,
  },
});

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlogPosts, updateBlogPost } from '@koral/api';
import type { BlogPost } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header } from '../../../components/ui';
import { colors, spacing, typography, radius, shadows } from '../../../theme';

const QUERY_KEYS = {
  posts: ['blog'] as const,
};

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface BlogRowProps {
  post: BlogPost;
  onTogglePublished: (post: BlogPost) => void;
  isToggling: boolean;
}

function BlogRow({ post, onTogglePublished, isToggling }: BlogRowProps) {
  const { t } = useLanguage();

  const isPublished = !!post.publishedAt;

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString()
    : new Date(post.createdAt).toLocaleDateString();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/blog/${post._id}`)}
      accessibilityRole="button"
      accessibilityLabel={post.title}
    >
      <Card style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <View style={styles.metaLeft}>
            <View
              style={[
                styles.badge,
                isPublished ? styles.badgePublished : styles.badgeDraft,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isPublished ? styles.badgeTextPublished : styles.badgeTextDraft,
                ]}
              >
                {isPublished
                  ? t('admin.blog.published_badge')
                  : t('admin.blog.draft_badge')}
              </Text>
            </View>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          <Switch
            value={isPublished}
            onValueChange={() => onTogglePublished(post)}
            disabled={isToggling}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            accessibilityLabel={
              isPublished
                ? t('admin.blog.published_badge')
                : t('admin.blog.draft_badge')
            }
          />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BlogScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const {
    data: posts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<BlogPost[]>({
    queryKey: QUERY_KEYS.posts,
    queryFn: getBlogPosts,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, publishedAt }: { id: string; publishedAt: string | null }) =>
      updateBlogPost(id, {
        published: publishedAt !== null,
        publishedAt: publishedAt ?? undefined,
      }),
    onMutate: ({ id }) => setTogglingId(id),
    onSettled: () => {
      setTogglingId(null);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.posts });
    },
  });

  function handleTogglePublished(post: BlogPost) {
    const nowPublished = !!post.publishedAt;
    // Toggle: if currently published → clear publishedAt (draft); if draft → set to now
    const newPublishedAt = nowPublished ? null : new Date().toISOString();
    toggleMutation.mutate({ id: post._id, publishedAt: newPublishedAt });
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isError) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.tab.blog')} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('admin.blog.error')}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.tab.blog')} />

      {/* List */}
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <BlogRow
              post={item}
              onTogglePublished={handleTogglePublished}
              isToggling={togglingId === item._id}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('admin.blog.no_posts')}</Text>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/blog/new')}
        accessibilityRole="button"
        accessibilityLabel={t('admin.blog.new_post')}
      >
        <Ionicons name="add" size={28} color={colors.textOnPrimary} />
      </TouchableOpacity>
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
  loader: {
    marginTop: spacing.xxl,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  row: {
    marginBottom: 0,
  },
  rowTop: {
    marginBottom: spacing.sm,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  postTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgePublished: {
    backgroundColor: colors.successSurface,
  },
  badgeDraft: {
    backgroundColor: colors.warningSurface,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  badgeTextPublished: {
    color: colors.success,
  },
  badgeTextDraft: {
    color: colors.warning,
  },
  dateText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  separator: {
    height: spacing.sm,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});

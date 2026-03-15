import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getClients, getGalleries, getBlogPosts } from '@koral/api';
import type { Client, Gallery, BlogPost } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { useAuthStore } from '../../store/authStore';
import { Card, Header, StatusBadge } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const QUERY_KEYS = {
  clients: ['clients'] as const,
  galleries: ['galleries'] as const,
  blog: ['blog'] as const,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  loading: boolean;
}

function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <Card style={styles.statCard}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

interface RecentClientRowProps {
  client: Client;
  galleries: Gallery[];
}

function RecentClientRow({ client, galleries }: RecentClientRowProps) {
  const clientGallery = galleries.find((g) => g.clientId === client._id);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/clients/${client._id}`)}
      accessibilityRole="button"
      accessibilityLabel={client.name}
    >
      <Card style={styles.clientRow}>
        <View style={styles.clientRowContent}>
          <View style={styles.clientRowInfo}>
            <Text style={styles.clientName} numberOfLines={1}>
              {client.name}
            </Text>
            <Text style={styles.clientEmail} numberOfLines={1}>
              {client.email}
            </Text>
          </View>
          {clientGallery && (
            <StatusBadge status={clientGallery.status} />
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  const { t } = useLanguage();
  const admin = useAuthStore((s) => s.admin);

  const {
    data: clients = [],
    isLoading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  const {
    data: galleries = [],
    isLoading: galleriesLoading,
    error: galleriesError,
    refetch: refetchGalleries,
  } = useQuery<Gallery[]>({
    queryKey: QUERY_KEYS.galleries,
    queryFn: getGalleries,
  });

  const {
    data: blogPosts = [],
    isLoading: blogLoading,
    refetch: refetchBlog,
  } = useQuery<BlogPost[]>({
    queryKey: QUERY_KEYS.blog,
    queryFn: getBlogPosts,
  });

  const isLoading = clientsLoading || galleriesLoading || blogLoading;
  const isError = !!clientsError || !!galleriesError;

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchClients(), refetchGalleries(), refetchBlog()]);
    setRefreshing(false);
  }, [refetchClients, refetchGalleries, refetchBlog]);

  const pendingSelections = galleries.filter(
    (g) => g.status === 'selection_submitted',
  ).length;

  const delivered = galleries.filter((g) => g.status === 'delivered').length;

  const recentClients = [...clients]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (isError) {
    return (
      <View style={styles.flex}>
        <Header title={t('admin.tab.dashboard')} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('admin.dashboard.stats_error')}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Header title={t('admin.tab.dashboard')} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {t('admin.dashboard.hello')}, {admin?.name ?? ''}
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label={t('admin.dashboard.clients')}
            value={clients.length}
            loading={isLoading}
          />
          <StatCard
            label={t('admin.dashboard.galleries')}
            value={galleries.length}
            loading={isLoading}
          />
          <StatCard
            label={t('admin.dashboard.pending')}
            value={pendingSelections}
            loading={isLoading}
          />
          <StatCard
            label={t('admin.dashboard.delivered')}
            value={delivered}
            loading={isLoading}
          />
          <StatCard
            label={t('admin.dashboard.blog_posts')}
            value={blogPosts.length}
            loading={isLoading}
          />
        </View>

        {/* Recent Clients */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('admin.dashboard.recent_clients')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(app)/clients')}>
            <Text style={styles.viewAllText}>{t('admin.dashboard.view_all')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.listLoader}
          />
        ) : recentClients.length === 0 ? (
          <Text style={styles.emptyText}>{t('admin.dashboard.no_clients')}</Text>
        ) : (
          <FlatList
            data={recentClients}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <RecentClientRow client={item} galleries={galleries} />
            )}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  header: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  greeting: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.primary,
    lineHeight: Math.round(typography.xxxl * typography.tight),
  },
  statLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  viewAllText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  clientRow: {
    marginBottom: 0,
  },
  clientRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientRowInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  clientName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
  },
  clientEmail: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  separator: {
    height: spacing.sm,
  },
  listLoader: {
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
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
    borderRadius: 8,
  },
  retryText: {
    fontSize: typography.md,
    color: colors.textOnPrimary,
    fontWeight: typography.semibold,
  },
});

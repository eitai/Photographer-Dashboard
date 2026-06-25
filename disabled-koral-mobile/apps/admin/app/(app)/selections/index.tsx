import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getGalleries, getClients } from '@koral/api';
import type { Gallery, Client } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const QUERY_KEYS = {
  galleries: ['galleries'] as const,
  clients: ['clients'] as const,
};

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface SelectionRowProps {
  gallery: Gallery;
  clientName: string;
}

function SelectionRow({ gallery, clientName }: SelectionRowProps) {
  const { t } = useLanguage();
  const submittedDate = new Date(gallery.createdAt).toLocaleDateString();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/selections/${gallery._id}`)}
      accessibilityRole="button"
      accessibilityLabel={gallery.title}
    >
      <Card style={styles.row}>
        <View style={styles.rowContent}>
          <View style={styles.rowInfo}>
            <Text style={styles.galleryTitle} numberOfLines={1}>
              {gallery.title}
            </Text>
            <Text style={styles.clientName} numberOfLines={1}>
              {clientName}
            </Text>
            <Text style={styles.date}>
              {t('admin.selections.submitted')}: {submittedDate}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SelectionsScreen() {
  const { t } = useLanguage();

  const {
    data: galleries = [],
    isLoading: galleriesLoading,
    isError,
    refetch: refetchGalleries,
  } = useQuery<Gallery[]>({
    queryKey: QUERY_KEYS.galleries,
    queryFn: getGalleries,
  });

  const { data: clients = [], refetch: refetchClients } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGalleries(), refetchClients()]);
    setRefreshing(false);
  };

  const pendingSelections = galleries.filter(
    (g) => g.status === 'selection_submitted',
  );

  const clientMap: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c._id, c.name]),
  );

  if (isError) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.tab.selections')} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('admin.selections.error')}</Text>
          <TouchableOpacity onPress={() => refetchGalleries()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.tab.selections')} />

      {galleriesLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={pendingSelections}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <SelectionRow
              gallery={item}
              clientName={clientMap[item.clientId] ?? '—'}
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
            <Text style={styles.emptyText}>
              {t('admin.selections.no_galleries')}
            </Text>
          }
        />
      )}
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
    paddingBottom: spacing.xxl,
  },
  row: {
    marginBottom: 0,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  galleryTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: 2,
  },
  clientName: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  date: {
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
});

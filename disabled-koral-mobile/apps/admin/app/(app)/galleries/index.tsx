import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getClients, getGalleries } from '@koral/api';
import type { Client, Gallery } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header, Input, StatusBadge } from '../../../components/ui';
import { colors, spacing, typography, radius, shadows } from '../../../theme';

const QUERY_KEYS = {
  galleries: ['galleries'] as const,
  clients: ['clients'] as const,
};

interface GalleryRowProps {
  gallery: Gallery;
  clientName: string;
}

function GalleryRow({ gallery, clientName }: GalleryRowProps) {
  const { t } = useLanguage();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/galleries/${gallery._id}`)}
      accessibilityRole='button'
      accessibilityLabel={gallery.title}
    >
      <Card style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.galleryTitle} numberOfLines={1}>
            {gallery.title}
          </Text>
          <StatusBadge status={gallery.status} />
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName}
          </Text>
          <Text style={styles.imageCount}>
            {gallery.images.length} {t('admin.galleries.images')}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GalleriesScreen() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

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

  const clientMap = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(clients.map((c) => [c._id, c.name]));
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return galleries;
    return galleries.filter((g) => g.title.toLowerCase().includes(q) || (clientMap[g.clientId] ?? '').toLowerCase().includes(q));
  }, [galleries, search, clientMap]);

  if (isError) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.tab.galleries')} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('admin.galleries.error')}</Text>
          <TouchableOpacity onPress={() => refetchGalleries()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.tab.galleries')} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Input placeholder={t('admin.clients.search')} value={search} onChangeText={setSearch} accessibilityLabel='Search galleries' />
      </View>

      {/* List */}
      {galleriesLoading ? (
        <ActivityIndicator size='large' color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <GalleryRow gallery={item} clientName={clientMap[item.clientId] ?? '—'} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('admin.galleries.no_galleries')}</Text>}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/galleries/new')}
        accessibilityRole='button'
        accessibilityLabel={t('admin.galleries.new')}
      >
        <Ionicons name='add' size={28} color={colors.textOnPrimary} />
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
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  clientName: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  imageCount: {
    fontSize: typography.sm,
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

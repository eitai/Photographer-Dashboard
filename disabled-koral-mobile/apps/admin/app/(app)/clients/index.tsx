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
  clients: ['clients'] as const,
  galleries: ['galleries'] as const,
};

// ---------------------------------------------------------------------------
// Gallery pill row inside client card
// ---------------------------------------------------------------------------

function GalleryPill({ gallery }: { gallery: Gallery }) {
  return (
    <TouchableOpacity
      style={styles.galleryPill}
      onPress={() => router.push(`/(app)/galleries/${gallery._id}`)}
      accessibilityRole='button'
      accessibilityLabel={gallery.title}
    >
      <Ionicons name='images-outline' size={14} color={colors.textMuted} style={styles.galleryPillIcon} />
      <Text style={styles.galleryPillTitle} numberOfLines={1}>
        {gallery.title}
      </Text>
      <StatusBadge status={gallery.status} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Client row with inline galleries
// ---------------------------------------------------------------------------

function ClientRow({ client, galleries }: { client: Client; galleries: Gallery[] }) {
  const { t } = useLanguage();

  return (
    <Card style={styles.row}>
      {/* Client header — tap to edit */}
      <TouchableOpacity
        style={styles.rowHeader}
        onPress={() => router.push(`/(app)/clients/${client._id}`)}
        accessibilityRole='button'
        accessibilityLabel={client.name}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.clientName} numberOfLines={1}>
            {client.name}
          </Text>
          <Text style={styles.clientEmail} numberOfLines={1}>
            {client.email}
          </Text>
        </View>
        <Ionicons name='create-outline' size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Galleries list */}
      {galleries.length > 0 ? (
        <View style={styles.galleriesList}>
          {galleries.map((g) => (
            <GalleryPill key={g._id} gallery={g} />
          ))}
        </View>
      ) : (
        <Text style={styles.noGalleries}>{t('admin.client.no_galleries')}</Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ClientsScreen() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const {
    data: clients = [],
    isLoading: clientsLoading,
    isError,
    refetch: refetchClients,
  } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  const { data: galleries = [], refetch: refetchGalleries } = useQuery<Gallery[]>({
    queryKey: QUERY_KEYS.galleries,
    queryFn: getGalleries,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchClients(), refetchGalleries()]);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [clients, search]);

  const galleriesByClient = useMemo(() => {
    const map: Record<string, Gallery[]> = {};
    for (const g of galleries) {
      if (!map[g.clientId]) map[g.clientId] = [];
      map[g.clientId].push(g);
    }
    return map;
  }, [galleries]);

  if (isError) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.tab.clients')} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('admin.clients.error')}</Text>
          <TouchableOpacity onPress={() => refetchClients()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.tab.clients')} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Input
          placeholder={t('admin.clients.search')}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel={t('admin.clients.search')}
        />
      </View>

      {/* List */}
      {clientsLoading ? (
        <ActivityIndicator size='large' color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ClientRow client={item} galleries={galleriesByClient[item._id] ?? []} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('admin.clients.no_clients')}</Text>}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/clients/new')}
        accessibilityRole='button'
        accessibilityLabel={t('admin.clients.new')}
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
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  rowInfo: {
    flex: 1,
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
  galleriesList: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  galleryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  galleryPillIcon: {
    marginRight: spacing.xs,
  },
  galleryPillTitle: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.text,
    marginRight: spacing.xs,
  },
  noGalleries: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
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

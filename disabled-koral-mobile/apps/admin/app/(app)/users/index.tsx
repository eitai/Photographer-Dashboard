import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdmins, deleteAdmin } from '@koral/api';
import type { AdminUser } from '@koral/api';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header } from '../../../components/ui';
import { colors, spacing, typography, radius, shadows } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';

const QUERY_KEYS = {
  admins: ['admins'] as const,
};

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: 'admin' | 'superadmin' }) {
  const { t } = useLanguage();
  const isSuperAdmin = role === 'superadmin';
  return (
    <View style={[styles.badge, isSuperAdmin ? styles.badgeSuperAdmin : styles.badgeAdmin]}>
      <Text style={[styles.badgeText, isSuperAdmin ? styles.badgeTextSuperAdmin : styles.badgeTextAdmin]}>
        {isSuperAdmin ? t('admin.users.role_superadmin') : t('admin.users.role_admin')}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface UserRowProps {
  user: AdminUser;
  currentAdminEmail?: string;
  onDelete: (user: AdminUser) => void;
}

function UserRow({ user, currentAdminEmail, onDelete }: UserRowProps) {
  const isSelf = user.email === currentAdminEmail;

  return (
    <Card style={styles.row}>
      <View style={styles.rowContent}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
            <RoleBadge role={user.role} />
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
          {user.studioName ? (
            <Text style={styles.studioName} numberOfLines={1}>
              {user.studioName}
            </Text>
          ) : null}
        </View>
        {!isSelf && (
          <TouchableOpacity
            onPress={() => onDelete(user)}
            accessibilityRole="button"
            accessibilityLabel="Delete user"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function UsersScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const currentAdmin = useAuthStore((s) => s.admin);
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<AdminUser[]>({
    queryKey: QUERY_KEYS.admins,
    queryFn: getAdmins,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdmin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.admins });
    },
    onError: () => {
      Alert.alert('', t('admin.users.delete_error'));
    },
  });

  function handleDelete(user: AdminUser) {
    Alert.alert(
      t('admin.users.delete_confirm'),
      t('admin.users.delete_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(user._id),
        },
      ],
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.users.error')}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.users.title')} />

      {/* List */}
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              currentAdminEmail={currentAdmin?.email}
              onDelete={handleDelete}
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
            <Text style={styles.emptyText}>{t('admin.users.no_users')}</Text>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/users/new')}
        accessibilityRole="button"
        accessibilityLabel={t('admin.users.new')}
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
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  userName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
    flex: 1,
  },
  userEmail: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  studioName: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  badgeAdmin: {
    backgroundColor: colors.infoSurface,
  },
  badgeSuperAdmin: {
    backgroundColor: colors.warningSurface,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  badgeTextAdmin: {
    color: colors.info,
  },
  badgeTextSuperAdmin: {
    color: colors.warning,
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

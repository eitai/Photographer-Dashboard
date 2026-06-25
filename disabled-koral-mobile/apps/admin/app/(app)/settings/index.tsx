import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@koral/i18n';
import { useAuthStore } from '../../../store/authStore';
import { Card, Header } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_VERSION = '1.0.0';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? '';

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

// ---------------------------------------------------------------------------
// Info row (label + value, read-only)
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Link row — shows a URL with copy + open actions
// ---------------------------------------------------------------------------

interface LinkRowProps {
  label: string;
  url: string;
  copyLabel: string;
}

function LinkRow({ label, url, copyLabel }: LinkRowProps) {
  if (!url) {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>—</Text>
      </View>
    );
  }
  return (
    <View style={styles.linkRow}>
      <View style={styles.linkRowTop}>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.linkUrl} numberOfLines={1}>{url}</Text>
      <View style={styles.linkActions}>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => {
            Clipboard.setStringAsync(url);
            Alert.alert('', copyLabel);
          }}
          accessibilityRole="button"
        >
          <Ionicons name="copy-outline" size={15} color={colors.primary} />
          <Text style={styles.linkBtnText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => Linking.openURL(url).catch(() => {})}
          accessibilityRole="button"
        >
          <Ionicons name="open-outline" size={15} color={colors.primary} />
          <Text style={styles.linkBtnText}>Open</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Navigation row (tappable, with chevron)
// ---------------------------------------------------------------------------

interface NavRowProps {
  label: string;
  onPress: () => void;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
}

function NavRow({ label, onPress, iconName, destructive = false }: NavRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.navRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {iconName && (
        <Ionicons
          name={iconName}
          size={20}
          color={destructive ? colors.error : colors.text}
          style={styles.navRowIcon}
        />
      )}
      <Text
        style={[
          styles.navRowLabel,
          destructive && styles.navRowLabelDestructive,
        ]}
      >
        {label}
      </Text>
      {!destructive && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { t } = useLanguage();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);

  const isSuperAdmin = admin?.role === 'superadmin';

  function handleSignOut() {
    Alert.alert(
      t('admin.settings.sign_out_confirm'),
      t('admin.settings.sign_out_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.settings.sign_out'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  }

  return (
    <View style={styles.flex}>
      <Header title={t('admin.tab.settings')} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

      {/* Studio Info */}
      <SectionHeader label={t('admin.settings.studio_section')} />
      <Card style={styles.card}>
        <InfoRow
          label={t('admin.settings.studio_name')}
          value={admin?.studioName ?? ''}
        />
        <View style={styles.divider} />
        <InfoRow
          label={t('admin.common.name')}
          value={admin?.name ?? ''}
        />
        {!!admin?.username && (
          <>
            <View style={styles.divider} />
            <LinkRow
              label={t('admin.settings.public_page')}
              url={SITE_URL ? `${SITE_URL}/${admin.username}` : ''}
              copyLabel={t('admin.settings.public_url_copied')}
            />
          </>
        )}
      </Card>

      {/* Account */}
      <SectionHeader label={t('admin.settings.account_section')} />
      <Card style={styles.card}>
        <InfoRow label={t('admin.common.email')} value={admin?.email ?? ''} />
        <View style={styles.divider} />
        <NavRow
          label={t('admin.settings.change_password')}
          onPress={() => router.push('/(app)/settings/change-password')}
          iconName="lock-closed-outline"
        />
      </Card>

      {/* Features */}
      <SectionHeader label={t('admin.settings.features_section')} />
      <Card style={styles.card}>
        <NavRow
          label={t('admin.settings.showcase')}
          onPress={() => router.push('/(app)/showcase')}
          iconName="images-outline"
        />
        {isSuperAdmin && (
          <>
            <View style={styles.divider} />
            <NavRow
              label={t('admin.settings.users')}
              onPress={() => router.push('/(app)/users')}
              iconName="shield-outline"
            />
          </>
        )}
      </Card>

      {/* App Info */}
      <SectionHeader label={t('admin.settings.app_section')} />
      <Card style={styles.card}>
        <InfoRow label={t('admin.settings.app_version')} value={APP_VERSION} />
        <View style={styles.divider} />
        <InfoRow label={t('admin.settings.api_url')} value={API_URL} />
      </Card>

      {/* Sign Out */}
      <Card style={styles.card}>
        <NavRow
          label={t('admin.settings.sign_out')}
          onPress={handleSignOut}
          iconName="log-out-outline"
          destructive
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
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: 0,
    padding: 0,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  infoLabel: {
    fontSize: typography.md,
    color: colors.text,
    flex: 1,
  },
  infoValue: {
    fontSize: typography.md,
    color: colors.textMuted,
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navRowIcon: {
    marginRight: spacing.sm,
  },
  navRowLabel: {
    flex: 1,
    fontSize: typography.md,
    color: colors.text,
  },
  navRowLabelDestructive: {
    color: colors.error,
  },
  linkRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  linkRowTop: {
    marginBottom: 2,
  },
  linkUrl: {
    fontSize: typography.sm,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  linkActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkBtnText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@koral/i18n';
import { useAuthStore } from '../../store/authStore';
import { useSidebar } from '../../context/SidebarContext';
import { colors, spacing, typography, shadows } from '../../theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH = Platform.OS === 'web' ? 260 : 280;
const ANIMATION_DURATION = 250;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: IoniconName;
  superadminOnly?: boolean;
}

// ---------------------------------------------------------------------------
// NavRow sub-component
// ---------------------------------------------------------------------------

interface NavRowProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}

function NavRow({ item, isActive, onPress }: NavRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.navRow, isActive && styles.navRowActive]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isActive }}
    >
      {/* Active left-border indicator */}
      <View style={[styles.activeBar, isActive && styles.activeBarVisible]} />

      <Ionicons
        name={item.icon}
        size={22}
        color={isActive ? colors.primary : colors.textMuted}
        style={styles.navIcon}
      />
      <Text
        style={[
          styles.navLabel,
          isActive && styles.navLabelActive,
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

/**
 * Sliding sidebar drawer that animates in from the left edge.
 *
 * Rendered at the (app) layout level so it overlays all child screens.
 * Open/close state lives in SidebarContext. The dark overlay behind the
 * drawer closes the sidebar on tap.
 *
 * Uses only React Native's built-in Animated API — no reanimated.
 */
export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const { t, locale, setLocale } = useLanguage();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const pathname = usePathname();

  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Track mounted state to gate pointer events before first open
  const hasOpenedOnce = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasOpenedOnce.current = true;
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, translateX, overlayOpacity]);

  function navigate(href: string) {
    close();
    // Small delay so the close animation can start before navigation
    setTimeout(() => {
      router.push(href as any);
    }, 50);
  }

  function handleSignOut() {
    close();
    setTimeout(() => logout(), 50);
  }

  const isSuperAdmin = admin?.role === 'superadmin';

  const navItems: NavItem[] = [
    {
      label: t('admin.tab.dashboard'),
      href: '/(app)/dashboard',
      icon: 'home-outline',
    },
    {
      label: t('admin.tab.clients'),
      href: '/(app)/clients',
      icon: 'people-outline',
    },
    {
      label: t('admin.tab.galleries'),
      href: '/(app)/galleries',
      icon: 'images-outline',
    },
    {
      label: t('admin.tab.selections'),
      href: '/(app)/selections',
      icon: 'checkmark-circle-outline',
    },
    {
      label: t('admin.tab.blog'),
      href: '/(app)/blog',
      icon: 'document-text-outline',
    },
    {
      label: t('admin.tab.settings'),
      href: '/(app)/settings',
      icon: 'settings-outline',
    },
    {
      label: t('admin.tab.users'),
      href: '/(app)/users',
      icon: 'shield-outline',
      superadminOnly: true,
    },
  ];

  const visibleItems = isSuperAdmin
    ? navItems.filter((item) => item.superadminOnly)   // superadmin sees ONLY users
    : navItems.filter((item) => !item.superadminOnly); // admin sees everything else

  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  // Don't render anything to the DOM until the sidebar has been opened once,
  // to avoid layout interference with screen content.
  if (!hasOpenedOnce.current && !isOpen) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity, pointerEvents: isOpen ? 'auto' : 'none' }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close navigation menu"
          activeOpacity={1}
        />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { width: SIDEBAR_WIDTH, transform: [{ translateX }] },
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: statusBarHeight + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Branding */}
          <View style={styles.brandSection}>
            <Text style={styles.brandName} numberOfLines={1}>
              {admin?.studioName ?? 'Koral'}
            </Text>
            {admin?.name ? (
              <Text style={styles.studioName} numberOfLines={1}>
                {admin.name}
              </Text>
            ) : null}
          </View>

          {/* Nav items */}
          <View style={styles.navSection}>
            {visibleItems.map((item) => {
              // Match active route: exact match or starts with href for nested routes
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + '/');

              return (
                <NavRow
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  onPress={() => navigate(item.href)}
                />
              );
            })}
          </View>
        </ScrollView>

        {/* Bottom: language toggle + sign out */}
        <View style={styles.bottomSection}>
          <View style={styles.divider} />

          {/* Language toggle */}
          <TouchableOpacity
            onPress={() => setLocale(locale === 'he' ? 'en' : 'he')}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel="Toggle language"
          >
            <Ionicons name="language-outline" size={20} color={colors.textMuted} style={styles.navIcon} />
            <Text style={styles.langLabel}>
              {locale === 'he' ? 'English' : 'עברית'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutBtn}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={colors.error}
              style={styles.navIcon}
            />
            <Text style={styles.signOutLabel}>
              {t('admin.settings.sign_out')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    ...shadows.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
  brandSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.primary,
    letterSpacing: 1,
  },
  studioName: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  navSection: {
    paddingTop: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingRight: spacing.md,
    marginVertical: 2,
  },
  navRowActive: {
    backgroundColor: `${colors.primary}18`, // blush tint ~10% opacity
  },
  activeBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    marginRight: spacing.sm,
    borderRadius: 2,
  },
  activeBarVisible: {
    backgroundColor: colors.primary,
  },
  navIcon: {
    marginRight: spacing.sm,
  },
  navLabel: {
    flex: 1,
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  navLabelActive: {
    color: colors.text,
    fontWeight: typography.semibold,
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: spacing.md + 4,
    paddingRight: spacing.md,
  },
  langLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingLeft: spacing.md + 4, // align with nav items (4px = activeBar width)
    paddingRight: spacing.md,
  },
  signOutLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.error,
  },
});

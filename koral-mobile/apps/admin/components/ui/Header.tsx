import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useSidebar } from '../../context/SidebarContext';
import { colors, spacing, typography, shadows } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeaderProps {
  /** Screen title displayed in the center of the header. */
  title: string;
  /** Optional right-side slot for action buttons. */
  rightSlot?: React.ReactNode;
  /**
   * When provided, replaces the hamburger menu with a back arrow button.
   * Pass `true` (or just `onBack` with no value) to navigate back using
   * React Navigation's goBack(). Pass a function for custom back logic.
   */
  onBack?: boolean | (() => void);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Top header bar rendered on every (app) screen.
 * Contains the hamburger menu button (left), screen title (center),
 * and an optional right-side actions slot.
 *
 * Pass `onBack` to replace the hamburger with a back arrow (for detail/new pages).
 */
export function Header({ title, rightSlot, onBack }: HeaderProps) {
  const { toggle } = useSidebar();
  const navigation = useNavigation();

  // On Android, account for the translucent status bar height so the header
  // content is not occluded.
  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  function handleLeftPress() {
    if (onBack === true) {
      if (navigation.canGoBack()) navigation.goBack();
    } else if (typeof onBack === 'function') {
      onBack();
    } else {
      toggle();
    }
  }

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.inner}>
        {/* Back arrow or hamburger */}
        <TouchableOpacity
          onPress={handleLeftPress}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={onBack ? 'Go back' : 'Open navigation menu'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={onBack ? 'arrow-back' : 'menu-outline'}
            size={onBack ? 24 : 26}
            color={colors.primary}
          />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>

        {/* Right slot — renders empty View to keep title centered when absent */}
        <View style={styles.rightSlot}>
          {rightSlot ?? null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  inner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.xs,
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

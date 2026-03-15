/**
 * Button — Koral Admin UI
 *
 * Variants:
 *   primary   — Blush background, Charcoal text. Used for the main action on a screen.
 *   secondary — Transparent background with a Blush border. Used for supporting actions.
 *   ghost     — No background or border. Used for low-emphasis actions (e.g. cancel).
 *
 * States:
 *   default / hover(press) / loading / disabled
 *
 * Accessibility:
 *   - accessibilityRole="button" is set automatically by TouchableOpacity.
 *   - Passes accessibilityLabel from props; falls back to `title`.
 *   - Disabled state sets accessibilityState={{ disabled: true }}.
 *   - Loading state sets accessibilityLabel to "Loading" and disables interaction.
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View, type TouchableOpacityProps } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Optional style override for the outer TouchableOpacity container. */
  style?: TouchableOpacityProps['style'];
  /** Button label text */
  title: string;
  /** Visual style variant. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Size of the button. Defaults to "md". */
  size?: ButtonSize;
  /** Shows an ActivityIndicator and disables interaction while true. */
  loading?: boolean;
  /** Leading icon element (rendered before title). */
  iconLeft?: React.ReactNode;
  /** Trailing icon element (rendered after title). */
  iconRight?: React.ReactNode;
  /** Accessible label override. Falls back to `title` if omitted. */
  accessibilityLabel?: string;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  accessibilityLabel,
  onPress,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={loading ? 'Loading' : (accessibilityLabel ?? title)}
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.base, styles[`size_${size}`], styles[`variant_${variant}`], isDisabled && styles.disabled]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size='small' color={variant === 'primary' ? colors.charcoal : colors.primary} accessibilityElementsHidden />
      ) : (
        <View style={styles.content}>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text style={[styles.label, styles[`labelSize_${size}`], styles[`labelVariant_${variant}`]]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ---- Base ----------------------------------------------------------------
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  // ---- Size ----------------------------------------------------------------
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.sm + 2, // 10
    paddingHorizontal: spacing.md,
    minHeight: 44, // WCAG touch target minimum
  },
  size_lg: {
    paddingVertical: spacing.md - 2, // 14
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },

  // ---- Variant background / border ----------------------------------------
  variant_primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },

  // ---- Disabled state (applied on top of variant styles) ------------------
  disabled: {
    opacity: 0.45,
  },

  // ---- Inner content row --------------------------------------------------
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },

  // ---- Label ---------------------------------------------------------------
  label: {
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
  },
  labelSize_sm: {
    fontSize: typography.sm,
    lineHeight: Math.round(typography.sm * typography.normal),
  },
  labelSize_md: {
    fontSize: typography.md,
    lineHeight: Math.round(typography.md * typography.normal),
  },
  labelSize_lg: {
    fontSize: typography.lg,
    lineHeight: Math.round(typography.lg * typography.normal),
  },
  labelVariant_primary: {
    color: colors.textOnPrimary,
  },
  labelVariant_secondary: {
    color: colors.primary,
  },
  labelVariant_ghost: {
    color: colors.primary,
  },
});

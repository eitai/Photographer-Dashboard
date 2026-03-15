/**
 * Card — Koral Admin UI
 *
 * A white surface container with a medium drop shadow and large border radius.
 * Use this as the standard content wrapper for dashboard panels, list items,
 * form sections, and modal sheets.
 *
 * Design decisions:
 *   - surface color (#FFFFFF) intentionally differs from the app background
 *     (#FAF8F4 ivory) to create depth without heavy shadows.
 *   - `radius.lg` (16) keeps the aesthetic soft and photographic — consistent
 *     with the brand's clean, minimal feel.
 *   - `shadows.md` is the default; callers can override via `style` if a
 *     lighter (sm) or more prominent (lg) elevation is needed.
 *
 * Accessibility:
 *   - Renders as a plain <View>. If the card is pressable, wrap it in a
 *     <TouchableOpacity> at the call site and add accessibilityRole="button".
 *   - Pass `accessible` and `accessibilityLabel` when the card's content does
 *     not contain its own labelled children (e.g. purely visual image cards).
 */

import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme';

export interface CardProps extends ViewProps {
  /** Inner content. */
  children?: React.ReactNode;
  /** Remove default padding when you need to bleed content to the card edge. */
  noPadding?: boolean;
}

export function Card({ children, noPadding = false, style, ...rest }: CardProps) {
  return (
    <View
      style={[styles.card, !noPadding && styles.padding, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.md,
  },
  padding: {
    padding: spacing.md,
  },
});

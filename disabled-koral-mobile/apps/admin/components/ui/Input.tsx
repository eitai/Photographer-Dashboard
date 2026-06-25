/**
 * Input — Koral Admin UI
 *
 * A styled text input field with optional label and inline error message.
 *
 * Visual states:
 *   default  — Ivory background, Beige border (1.5px)
 *   focused  — Blush border (1.5px), subtle blush tint on background
 *   error    — Error red border, error message below field
 *   disabled — Reduced opacity, no focus behaviour
 *
 * Design rationale:
 *   - Border-based focus indicator (not just color fill) ensures the focus
 *     state is distinguishable even for users with color vision deficiencies.
 *   - Minimum touch target height of 44dp satisfies WCAG 2.5.5 (Target Size).
 *   - Error text is placed below the field (not inside) so it is always
 *     visible regardless of input content length.
 *
 * Accessibility:
 *   - `label` is rendered as a <Text> above the field; it is NOT a placeholder
 *     substitute. Set accessibilityLabel on the TextInput to match the label
 *     value so screen readers announce it correctly.
 *   - When `error` is present the accessibilityHint is set to the error string
 *     so VoiceOver / TalkBack surfaces it without the user needing to focus
 *     the error text element.
 *   - `accessibilityLabel` defaults to the `label` prop if not supplied.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface InputProps extends TextInputProps {
  /** Field label displayed above the input. */
  label?: string;
  /** Inline error message displayed below the input. Also triggers red border. */
  error?: string;
  /** Accessible label — defaults to `label` if omitted. */
  accessibilityLabel?: string;
}

export function Input({
  label,
  error,
  editable = true,
  style,
  accessibilityLabel,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {!!label && (
        <Text style={[styles.label, !editable && styles.labelDisabled]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          !editable && styles.inputDisabled,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        onFocus={(e) => {
          setIsFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          rest.onBlur?.(e);
        }}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error ?? undefined}
        accessibilityState={{ disabled: !editable }}
        {...rest}
      />

      {error && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },

  // ---- Label ---------------------------------------------------------------
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    lineHeight: Math.round(typography.sm * typography.normal),
  },
  labelDisabled: {
    color: colors.textMuted,
  },

  // ---- Input field ---------------------------------------------------------
  input: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,   // 10
    paddingHorizontal: spacing.md - 4, // 12
    fontSize: typography.md,
    fontWeight: typography.regular,
    color: colors.text,
    lineHeight: Math.round(typography.md * typography.normal),
    minHeight: 44,                     // WCAG touch target minimum
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: '#FDF6F5',        // ivory with a faint blush tint
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  inputDisabled: {
    opacity: 0.5,
  },

  // ---- Error message -------------------------------------------------------
  errorText: {
    fontSize: typography.xs,
    fontWeight: typography.regular,
    color: colors.error,
    lineHeight: Math.round(typography.xs * typography.normal),
  },
});

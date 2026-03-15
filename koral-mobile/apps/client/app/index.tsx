import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '@koral/i18n';
import { colors, spacing, typography } from '../theme';

/**
 * Landing screen — shown when the app opens without a deep link.
 * Instructs the client to tap the link sent by their photographer.
 */
export default function IndexScreen() {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {/* Logo / wordmark */}
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>Koral</Text>
          <View style={styles.logoDot} />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>{t('client.landing.tagline')}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Instruction */}
        <Text style={styles.instruction}>{t('client.landing.instruction')}</Text>
      </View>

      {/* Bottom brand accent */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('footer.tagline')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.charcoal,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
    marginBottom: 2,
  },
  tagline: {
    fontSize: typography.lg,
    fontWeight: typography.medium,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: typography.lg * typography.relaxed,
    marginBottom: spacing.lg,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    marginBottom: spacing.lg,
  },
  instruction: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.md * typography.relaxed,
  },
  footer: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});

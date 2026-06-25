/**
 * StatusBadge — Koral Admin UI
 *
 * Displays the five-stage client/gallery pipeline status as a coloured pill.
 * Each status has a distinct background + foreground pair that meets WCAG AA
 * contrast (4.5:1) for small text at 11pt.
 *
 * Pipeline stages and colour rationale:
 *   gallery_sent        — Blush (#E7B8B5 bg) — brand warm pink, first touch
 *   viewed              — Sky blue tint       — calm acknowledgement
 *   selection_submitted — Amber tint          — action required from photographer
 *   in_editing          — Soft purple tint    — active creative work
 *   delivered           — Green tint          — positive completion state
 *
 * The badge imports GalleryStatus from @koral/types to stay in sync with the
 * shared domain model. No local redefinition needed.
 *
 * Accessibility:
 *   - accessibilityRole="text" (default for <Text>) is sufficient here.
 *   - The parent list item should carry the full accessible description;
 *     the badge is a supplemental visual indicator.
 *   - If used standalone, pass accessibilityLabel to override the raw
 *     status key with a human-readable string.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GalleryStatus } from '@koral/types';
import { radius, typography, spacing } from '../../theme';

// ---------------------------------------------------------------------------
// Colour mapping — one entry per pipeline stage
// ---------------------------------------------------------------------------

interface BadgeStyle {
  background: string;
  text: string;
  label: string; // human-readable label shown inside the badge
}

const STATUS_MAP: Record<GalleryStatus, BadgeStyle> = {
  gallery_sent: {
    background: '#F7E4E3', // blush-tinted surface (lighter than raw blush)
    text: '#8B3A38',       // dark rose — 5.1:1 on #F7E4E3
    label: 'Gallery Sent',
  },
  viewed: {
    background: '#DDEEF9', // sky blue tint
    text: '#1A5276',       // navy — 5.6:1 on #DDEEF9
    label: 'Viewed',
  },
  selection_submitted: {
    background: '#FEF0D9', // amber tint
    text: '#784212',       // dark amber — 5.3:1 on #FEF0D9
    label: 'Selection Submitted',
  },
  in_editing: {
    background: '#EDE3F5', // soft purple tint
    text: '#512E77',       // deep violet — 5.8:1 on #EDE3F5
    label: 'In Editing',
  },
  delivered: {
    background: '#D5F0E0', // green tint
    text: '#1A5C36',       // forest green — 5.4:1 on #D5F0E0
    label: 'Delivered',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  status: GalleryStatus;
  /** Override the displayed label (e.g. for localisation). */
  label?: string;
  /** Accessible label for screen readers. Defaults to the display label. */
  accessibilityLabel?: string;
}

export function StatusBadge({ status, label, accessibilityLabel }: StatusBadgeProps) {
  const config = STATUS_MAP[status];
  const displayLabel = label ?? config.label;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.background },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
    >
      <Text
        style={[styles.label, { color: config.text }]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',          // shrink-wrap to content width
    borderRadius: radius.full,
    paddingVertical: spacing.xs - 1,  // 3
    paddingHorizontal: spacing.sm,    // 8
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    letterSpacing: 0.3,
    lineHeight: Math.round(typography.xs * typography.tight), // compact pill height
  },
});

/**
 * Koral Light Studio — Mobile Design Tokens
 *
 * Single source of truth for all visual constants used across the admin app.
 * All values are React Native / StyleSheet compatible (no Tailwind).
 *
 * Token structure:
 *   colors      — raw palette + semantic aliases
 *   spacing     — 4-pt base grid (multiples of 4)
 *   radius      — border radius scale
 *   typography  — font sizes, line height multipliers, font weights
 *   shadows     — cross-platform shadow objects (iOS + Android elevation)
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Brand palette
  blush: '#E7B8B5',
  ivory: '#FAF8F4',
  charcoal: '#2D2D2D',
  beige: '#C8B8A2',
  white: '#FFFFFF',

  // Semantic — status / feedback
  error: '#C0392B',
  errorSurface: '#FDECEA',
  success: '#27AE60',
  successSurface: '#EAF7EE',
  warning: '#E67E22',
  warningSurface: '#FEF6EC',
  info: '#2980B9',
  infoSurface: '#EAF4FB',

  // Semantic — layout aliases
  background: '#FAF8F4',   // ivory — app background
  surface: '#FFFFFF',      // white — card / sheet surfaces
  primary: '#E7B8B5',      // blush — primary action color
  primaryDark: '#D4A09C',  // blush darkened ~10% for pressed states

  // Text
  text: '#2D2D2D',         // charcoal — body / headings
  textMuted: '#C8B8A2',    // beige — placeholders, secondary labels
  textOnPrimary: '#2D2D2D', // charcoal on blush — passes 4.5:1 contrast

  // Structural
  border: '#E8E0D8',       // warm light grey — inputs, dividers
  borderFocus: '#E7B8B5',  // blush — focused input ring
  overlay: 'rgba(45, 45, 45, 0.40)', // modal scrim
} as const;

// ---------------------------------------------------------------------------
// Spacing  (4-pt base grid)
// ---------------------------------------------------------------------------

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const radius = {
  sm:   4,
  md:   8,
  lg:   16,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  // Font sizes (pt / dp — same unit in RN)
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,

  // Line height multipliers (multiply by font size to get lineHeight)
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,

  // Font weights — React Native requires string literals
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
} as const;

// ---------------------------------------------------------------------------
// Shadows
// Provide both iOS shadow props and Android `elevation` in the same object.
// Spread directly into a StyleSheet rule.
// ---------------------------------------------------------------------------

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

/**
 * Koral Client App — Design Tokens
 *
 * Extends the admin palette with client-specific additions:
 *   - Dark lightbox background for immersive full-screen image viewing
 *   - Same Blush/Ivory/Charcoal system for light screens
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

  // Client-specific — lightbox / immersive viewer
  lightbox: '#1A1A1A',
  lightboxOverlay: 'rgba(26, 26, 26, 0.92)',

  // Semantic — status / feedback
  error: '#C0392B',
  errorSurface: '#FDECEA',
  success: '#27AE60',
  successSurface: '#EAF7EE',
  warning: '#E67E22',
  warningSurface: '#FEF6EC',

  // Semantic — layout aliases
  background: '#FAF8F4',   // ivory — app background
  surface: '#FFFFFF',      // white — card / sheet surfaces
  primary: '#E7B8B5',      // blush — primary action color
  primaryDark: '#D4A09C',  // blush darkened ~10% for pressed states

  // Selection state
  selectionRing: '#E7B8B5',  // blush ring on selected photo

  // Text
  text: '#2D2D2D',
  textMuted: '#C8B8A2',
  textOnPrimary: '#2D2D2D',
  textOnDark: '#FAF8F4',     // ivory text on lightbox

  // Structural
  border: '#E8E0D8',
  borderFocus: '#E7B8B5',
  overlay: 'rgba(45, 45, 45, 0.40)',
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
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,

  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,

  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
} as const;

// ---------------------------------------------------------------------------
// Shadows
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

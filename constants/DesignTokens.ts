/**
 * Design Tokens — Single source of truth for the entire design system.
 * All values are based on an 8px grid.
 */

// ─── Spacing (8px grid) ──────────────────────────────────────────────────────
export const spacing = {
  0:   0,
  1:   4,   // 0.5 grid unit
  2:   8,   // 1 grid unit
  3:   12,  // 1.5 grid units
  4:   16,  // 2 grid units
  5:   20,
  6:   24,  // 3 grid units
  8:   32,  // 4 grid units
  10:  40,  // 5 grid units
  12:  48,  // 6 grid units
  16:  64,  // 8 grid units
  20:  80,
} as const;

// ─── Typography Scale ─────────────────────────────────────────────────────────
export const fontSize = {
  xs:    11,
  sm:    13,
  base:  15,
  md:    14,
  lg:    17,
  xl:    20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
} as const;

// خط النظام: IBM Plex Sans Arabic (خط منصات). يُحمَّل في الويب من +html.tsx.
export const fontFamily = {
  base: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
} as const;

export const fontWeight = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;

export const lineHeight = {
  tight:   1.25,
  normal:  1.5,
  relaxed: 1.75,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const radius = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl':20,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

// ─── Z-Index ──────────────────────────────────────────────────────────────────
export const zIndex = {
  base:    0,
  raised:  10,
  overlay: 100,
  modal:   200,
  toast:   300,
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────
export const duration = {
  fast:   150,
  normal: 250,
  slow:   400,
} as const;

// ─── Brand Palette ────────────────────────────────────────────────────────────
// مبني على نظام التصميم الموحّد "منصات" (هيئة الحكومة الرقمية):
// أخضر أساسي + رماديات محايدة + ألوان حالة واضحة. الهوية (الشعار) تبقى لـ DTG.
const green = {
  25:  '#F7FDF9',
  50:  '#F3FCF6',
  100: '#DFF6E7',
  200: '#B8EACB',
  300: '#88D8AD',
  400: '#54C08A',
  500: '#25935F',
  600: '#1B8354',   // primary
  700: '#166A45',   // hover
  800: '#14573A',
  900: '#104631',
  950: '#092A1E',
} as const;

const neutral = {
  25:  '#FCFCFD',
  50:  '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D2D6DB',
  400: '#9DA4AE',
  500: '#6C737F',
  600: '#4D5761',
  700: '#384250',
  800: '#1F2A37',
  900: '#111927',
  950: '#0D121C',
} as const;

const palette = {
  white:        '#FFFFFF',
  textDefault:  '#161616',

  success100: '#ECFDF3',
  success500: '#079455',
  success700: '#067647',

  warning100: '#FFFAEB',
  warning500: '#DC6803',
  warning700: '#B54708',

  danger100:  '#FEF3F2',
  danger500:  '#D92D20',
  danger700:  '#B42318',

  info100:    '#EFF8FF',
  info500:    '#1570EF',
  info700:    '#1849A9',

  purple100:  '#F4F3FF',
  purple500:  '#6938EF',
} as const;

/** ألوان النظام الخام — للاستخدام النادر حين لا يكفي الرمز الدلالي */
export const dga = { green, neutral, ...palette } as const;

// ─── Semantic Color Tokens (Theme-aware) ──────────────────────────────────────
export type ThemeColors = typeof lightColors;

export const lightColors = {
  primary:        green[600],
  primaryLight:   green[500],
  primarySubtle:  green[50],
  primaryHover:   green[700],
  primaryDeep:    green[800],

  // التوكيد = الأخضر نفسه (منصات تعتمد لوناً أساسياً واحداً)
  accent:         green[600],
  accentHover:    green[700],
  accentSubtle:   green[100],
  accentMuted:    green[300],

  secondary:      neutral[700],

  success:        palette.success700,
  successSubtle:  palette.success100,
  warning:        palette.warning700,
  warningSubtle:  palette.warning100,
  danger:         palette.danger500,
  dangerSubtle:   palette.danger100,
  info:           palette.info700,
  infoSubtle:     palette.info100,
  purple:         palette.purple500,
  purpleSubtle:   palette.purple100,

  background:     neutral[50],
  surface:        neutral[100],
  card:           palette.white,
  overlay:        'rgba(13,18,28,0.5)',

  border:         neutral[200],
  borderStrong:   neutral[300],

  text:           palette.textDefault,
  textSecondary:  neutral[700],
  textMuted:      neutral[500],
  textInverse:    palette.white,

  inputBg:        palette.white,
  inputBorder:    neutral[400],
  inputFocus:     green[600],

  tabBar:         palette.white,
  tabActive:      green[600],
  tabInactive:    neutral[500],

  filterActive:   green[600],
  filterInactive: neutral[200],
} as const;

export const darkColors = {
  primary:        green[400],
  primaryLight:   green[300],
  primarySubtle:  '#0E2A1D',
  primaryHover:   green[300],
  primaryDeep:    green[950],

  accent:         green[400],
  accentHover:    green[300],
  accentSubtle:   '#0E2A1D',
  accentMuted:    green[700],

  secondary:      neutral[300],

  success:        '#47CD89',
  successSubtle:  '#053321',
  warning:        '#FDB022',
  warningSubtle:  '#4E1D09',
  danger:         '#F97066',
  dangerSubtle:   '#55160C',
  info:           '#53B1FD',
  infoSubtle:     '#102A56',
  purple:         '#9B8AFB',
  purpleSubtle:   '#27115F',

  background:     neutral[950],
  surface:        neutral[900],
  card:           neutral[800],
  overlay:        'rgba(0,0,0,0.65)',

  border:         neutral[700],
  borderStrong:   neutral[600],

  text:           neutral[50],
  textSecondary:  neutral[300],
  textMuted:      neutral[400],
  textInverse:    neutral[950],

  inputBg:        neutral[900],
  inputBorder:    neutral[600],
  inputFocus:     green[400],

  tabBar:         neutral[900],
  tabActive:      green[400],
  tabInactive:    neutral[400],

  filterActive:   green[400],
  filterInactive: neutral[700],
} as const;

export const DesignTokens = {
  spacing,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  shadow,
  zIndex,
  duration,
  colors: { light: lightColors, dark: darkColors },
} as const;

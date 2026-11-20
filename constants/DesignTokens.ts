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

/** مقاس موحّد لعناوين الصفحات في كل الشاشات — لا يصغر ولا يكبر بين صفحة وأخرى */
export const PAGE_TITLE_SIZE = 18;

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
// تسلسل الزوايا حسب الأهمية: عناصر التحكم 8، الكروت 14، الواجهة الرئيسية 20
export const radius = {
  none: 0,
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  '2xl':20,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: '#071729',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#071729',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#071729',
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
// هوية DTG: كحلي الشعار + ذهبه، على أرضية رمادية باردة نظيفة.
// الكحلي للهيكل والإجراءات الأساسية، والذهبي للتوكيد فقط (العنصر النشط، المؤشرات).
const navy = {
  50:  '#EEF2F7',
  100: '#DCE4EE',
  200: '#B7C6D8',
  300: '#8AA1BC',
  400: '#5A7799',
  500: '#365A80',
  600: '#214670',
  700: '#183A60',
  800: '#0F2A47',   // primary
  900: '#0A2038',
  950: '#071729',   // sidebar / hero
} as const;

const gold = {
  50:  '#FAF6EE',
  100: '#F3ECDD',
  200: '#E7D8B8',
  300: '#D4BC8A',
  400: '#C3A56E',
  500: '#B08D4F',   // accent
  600: '#946F37',
  700: '#76572B',
} as const;

const neutral = {
  25:  '#FBFCFD',
  50:  '#F3F4F6',   // app background
  100: '#ECEEF1',
  200: '#E3E6EA',   // borders
  300: '#CDD2D9',
  400: '#9AA4B1',
  500: '#7A8797',
  600: '#5B6878',
  700: '#46566A',
  800: '#2A3746',
  900: '#13202F',   // text
} as const;

const palette = {
  white:      '#FFFFFF',
  success100: '#E6F4EE', success500: '#1A9468', success700: '#12805C',
  warning100: '#FDF1DE', warning500: '#D98A0B', warning700: '#B26B00',
  danger100:  '#FCEBE8', danger500:  '#D9432F', danger700:  '#C4321F',
  info100:    '#E8F0FB', info500:    '#3B7BD8', info700:    '#2763C4',
  purple100:  '#F0ECFA', purple500:  '#6B4FC8',
} as const;

/** ألوان الهوية الخام — للحالات النادرة التي لا يكفيها الرمز الدلالي */
export const dtg = { navy, gold, neutral, ...palette } as const;
/** @deprecated توافق مع الكود السابق */
export const dga = dtg;

// ─── Semantic Color Tokens (Theme-aware) ──────────────────────────────────────
export type ThemeColors = typeof lightColors;

export const lightColors = {
  primary:        navy[800],
  primaryLight:   navy[600],
  primarySubtle:  navy[50],
  primaryHover:   navy[700],
  primaryDeep:    navy[950],

  accent:         gold[500],
  accentHover:    gold[600],
  accentSubtle:   gold[100],
  accentMuted:    gold[300],

  secondary:      navy[600],

  success:        palette.success700,
  successSubtle:  palette.success100,
  warning:        palette.warning700,
  warningSubtle:  palette.warning100,
  danger:         palette.danger700,
  dangerSubtle:   palette.danger100,
  info:           palette.info700,
  infoSubtle:     palette.info100,
  purple:         palette.purple500,
  purpleSubtle:   palette.purple100,

  background:     neutral[50],
  surface:        neutral[100],
  card:           palette.white,
  overlay:        'rgba(7,23,41,0.55)',

  border:         neutral[200],
  borderStrong:   neutral[300],

  text:           neutral[900],
  textSecondary:  neutral[700],
  textMuted:      neutral[500],
  textInverse:    palette.white,

  inputBg:        palette.white,
  inputBorder:    neutral[300],
  inputFocus:     navy[600],

  tabBar:         palette.white,
  tabActive:      navy[800],
  tabInactive:    neutral[500],

  filterActive:   navy[800],
  filterInactive: neutral[100],

  // الهيكل الداكن (القائمة الجانبية والواجهة العلوية للرئيسية)
  chrome:         navy[950],
  chromeRaised:   navy[900],
  chromeBorder:   'rgba(255,255,255,0.08)',
  chromeText:     'rgba(255,255,255,0.92)',
  chromeMuted:    'rgba(255,255,255,0.56)',
} as const;

export const darkColors = {
  primary:        gold[300],
  primaryLight:   gold[200],
  primarySubtle:  'rgba(212,188,138,0.12)',
  primaryHover:   gold[200],
  primaryDeep:    '#050F1C',

  accent:         gold[300],
  accentHover:    gold[200],
  accentSubtle:   'rgba(212,188,138,0.14)',
  accentMuted:    gold[600],

  secondary:      navy[300],

  success:        '#4CC796',
  successSubtle:  'rgba(76,199,150,0.14)',
  warning:        '#F0B44C',
  warningSubtle:  'rgba(240,180,76,0.14)',
  danger:         '#F07A6A',
  dangerSubtle:   'rgba(240,122,106,0.14)',
  info:           '#7EAAF0',
  infoSubtle:     'rgba(126,170,240,0.14)',
  purple:         '#A894F0',
  purpleSubtle:   'rgba(168,148,240,0.14)',

  background:     '#08121F',
  surface:        '#0E1B2C',
  card:           '#112035',
  overlay:        'rgba(0,0,0,0.65)',

  border:         '#1C2D44',
  borderStrong:   '#29405E',

  text:           '#EEF2F7',
  textSecondary:  '#B7C6D8',
  textMuted:      '#7F92AA',
  textInverse:    navy[950],

  inputBg:        '#0E1B2C',
  inputBorder:    '#29405E',
  inputFocus:     gold[300],

  tabBar:         '#0E1B2C',
  tabActive:      gold[300],
  tabInactive:    '#7F92AA',

  filterActive:   gold[300],
  filterInactive: '#16263C',

  chrome:         '#050F1C',
  chromeRaised:   '#0A1828',
  chromeBorder:   'rgba(255,255,255,0.06)',
  chromeText:     'rgba(255,255,255,0.92)',
  chromeMuted:    'rgba(255,255,255,0.5)',
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

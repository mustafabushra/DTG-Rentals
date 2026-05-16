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
    shadowColor: '#03284C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#03284C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#03284C',
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
// مستوحى من شعار DTG: كحلي مخفف + ذهبي هادئ — قاعدة 60-30-10
const brand = {
  // Navy Scale — Muted (أقل تشبعاً لراحة العين)
  navy900: '#0E2035',   // أعمق كحلي — للتوكيد فقط
  navy700: '#1E3E5F',   // primary — هيدر وعناصر رئيسية (30%)
  navy500: '#2E5580',   // secondary — روابط وأيقونات نشطة
  navy300: '#7096B8',   // تلميحات وحدود ناعمة
  navy100: '#EBF0F6',   // خلفيات طفيفة (subtle tints)

  // Gold Scale — Desaturated (10% فقط للعناصر التفاعلية)
  gold700: '#8A7248',   // hover state
  gold500: '#A8895C',   // accent (مخفف من الذهبي الصارخ)
  gold300: '#CCB88A',   // مؤشرات وشارات
  gold100: '#F0E8D5',   // خلفيات الذهبي الطفيفة

  // Warm Off-White — خلفيات الـ 60%
  warm50:  '#FAF9F6',   // خلفية رئيسية (دافئة جداً — ليست بيضاء ناصعة)
  warm100: '#F2F0EB',   // خلفية ثانوية وsurface
  warm200: '#E8E4DC',   // حدود ناعمة وفواصل
} as const;

const palette = {
  // Success / Green — مخفف قليلاً
  success100: '#D8F4E6',
  success500: '#2A9D5C',   // أهدأ من #27AE60
  success700: '#1F7A46',

  // Warning / Amber — مخفف
  warning100: '#FDEFD5',
  warning500: '#D4880A',   // أهدأ من #F39C12
  warning700: '#A86A08',

  // Danger / Red — مخفف
  danger100:  '#FDEEED',
  danger500:  '#C94535',   // أهدأ من #E74C3C
  danger700:  '#A3392B',

  // Purple — مخفف
  purple100: '#EAE0F2',
  purple500: '#7B3FA0',

  // Neutral — دافئ بدل الرمادي البارد
  white:       '#FFFFFF',
  warmWhite:   '#FDFCFA',   // كارد دافئ
  warmGray50:  '#F6F4F0',
  warmGray100: '#EDE9E3',
  warmGray200: '#DDD8CF',
  warmGray300: '#C8C2B6',
  warmGray400: '#9E9587',   // textMuted
  warmGray500: '#716860',   // textSecondary
  warmGray600: '#4A4238',   // نص ثانوي داكن
  warmGray700: '#30281F',
  black:       '#000000',
} as const;

// ─── Dark Slate Text — ليس أسود بل رمادي داكن مائل للكحلي ──────────────────
const slate = {
  text:      '#2A3D52',   // نص رئيسي: كحلي-رمادي داكن (أريح من الأسود)
  secondary: '#5A6A7A',   // نص ثانوي: رمادي-كحلي متوسط
  muted:     '#8A97A5',   // نص ضامت: رمادي فاتح
} as const;

// ─── Semantic Color Tokens (Theme-aware) ──────────────────────────────────────
export type ThemeColors = typeof lightColors;

export const lightColors = {
  // 30% — Navy (مخفف) — الهيدر، العناصر النشطة، الروابط
  primary:        brand.navy700,   // #1E3E5F
  primaryLight:   brand.navy500,   // #2E5580
  primarySubtle:  brand.navy100,   // #EBF0F6

  // 10% — Gold (مخفف) — الأزرار التفاعلية والتوكيدات فقط
  accent:         brand.gold500,   // #A8895C
  accentHover:    brand.gold700,   // #8A7248
  accentSubtle:   brand.gold100,   // #F0E8D5
  accentMuted:    brand.gold300,   // #CCB88A

  secondary:      brand.navy500,

  // Semantic — مخففة
  success:        palette.success500,
  successSubtle:  palette.success100,
  warning:        palette.warning500,
  warningSubtle:  palette.warning100,
  danger:         palette.danger500,
  dangerSubtle:   palette.danger100,
  purple:         palette.purple500,
  purpleSubtle:   palette.purple100,

  // 60% — Warm Off-White Backgrounds
  background:     brand.warm50,    // #FAF9F6 — خلفية رئيسية دافئة
  surface:        brand.warm100,   // #F2F0EB — سطح ثانوي
  card:           palette.warmWhite, // #FDFCFA — بطاقات دافئة
  overlay:        'rgba(14,32,53,0.45)',

  // Borders — ناعمة ودافئة
  border:         brand.warm200,     // #E8E4DC — حدود خفيفة جداً
  borderStrong:   palette.warmGray200, // #DDD8CF

  // Text — Dark Slate (أريح من الكحلي الداكن والأسود)
  text:           slate.text,      // #2A3D52
  textSecondary:  slate.secondary, // #5A6A7A
  textMuted:      slate.muted,     // #8A97A5
  textInverse:    palette.white,

  // Input
  inputBg:        palette.warmWhite,
  inputBorder:    palette.warmGray200,
  inputFocus:     brand.navy700,

  // Tab bar
  tabBar:         palette.warmWhite,
  tabActive:      brand.navy700,
  tabInactive:    palette.warmGray400,

  // Filter pill
  filterActive:   brand.navy700,
  filterInactive: brand.warm200,
} as const;

export const darkColors = {
  // Dark mode — كحلي عميق مريح (ليس أسود)
  primary:        brand.gold300,   // #CCB88A — ذهبي هادئ في الداكن
  primaryLight:   brand.gold500,
  primarySubtle:  '#0A1E33',

  accent:         brand.gold500,
  accentHover:    brand.gold700,
  accentSubtle:   '#1A2818',
  accentMuted:    brand.gold700,

  secondary:      '#4A7FA8',

  success:        '#34B86A',
  successSubtle:  '#0C3320',
  warning:        '#E09620',
  warningSubtle:  '#332400',
  danger:         '#D44235',
  dangerSubtle:   '#361410',
  purple:         '#9660C0',
  purpleSubtle:   '#261040',

  // خلفيات الداكن — كحلي عميق (ليس أسود قاطع)
  background:     '#0C1B2E',   // أزرق-أسود دافئ
  surface:        '#122236',
  card:           '#182B42',
  overlay:        'rgba(0,0,0,0.65)',

  border:         '#1E3049',
  borderStrong:   '#2A4060',

  text:           '#E8EDF2',   // أبيض-رمادي مائل للبرود (مريح)
  textSecondary:  '#94A3B8',
  textMuted:      '#516070',
  textInverse:    brand.navy900,

  inputBg:        '#182B42',
  inputBorder:    '#1E3049',
  inputFocus:     brand.gold500,

  tabBar:         '#122236',
  tabActive:      brand.gold300,
  tabInactive:    '#4A5E72',

  filterActive:   brand.gold500,
  filterInactive: '#1E3049',
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

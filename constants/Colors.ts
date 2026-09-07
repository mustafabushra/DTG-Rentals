/**
 * Colors.ts — إعادة تصدير متوافقة مع الكود القائم من DesignTokens.
 * المصدر الوحيد للحقيقة = DesignTokens.ts
 *
 * تُشتق الآن بنشر رموز التصميم كاملةً ثم إعادة تسمية ما يحتاج توافقاً فقط.
 * قبل ذلك كانت قائمة يدوية تُدرَج فيها الرموز واحداً واحداً، فتخلّفت عن الرموز
 * المضافة لاحقاً (inputFocus, filterActive, filterInactive, tabActive,
 * tabInactive, borderStrong, accentHover). المكوّنات التي تستخدمها كانت تقرأ
 * undefined فتفقد لونها وقت التشغيل — بلا أي خطأ ظاهر.
 * أي رمز يُضاف إلى DesignTokens صار متاحاً هنا تلقائياً.
 */
import { lightColors, darkColors } from './DesignTokens';

export const Colors = {
  light: {
    ...lightColors,
    // ── أسماء متوافقة مع الكود القائم (تتجاوز الرمز الأصلي عمداً) ──
    secondary:       lightColors.primaryLight,
    tabBarBorder:    lightColors.border,
    headerBg:        lightColors.primary,
    headerText:      lightColors.textInverse,
    shadow:          '#03284C',
    accent:          lightColors.accentSubtle,
    accentGold:      lightColors.accent,
    accentSecondary: lightColors.accentMuted,
  },
  dark: {
    ...darkColors,
    secondary:       darkColors.primaryLight,
    tabBarBorder:    darkColors.border,
    headerBg:        darkColors.surface,
    headerText:      darkColors.text,
    shadow:          '#000000',
    accent:          darkColors.accentSubtle,
    accentGold:      darkColors.accent,
    accentSecondary: darkColors.accentMuted,
  },
} as const;

export type ColorScheme = typeof Colors.light;

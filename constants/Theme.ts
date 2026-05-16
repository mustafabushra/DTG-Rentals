/**
 * Theme.ts — Backward-compatible re-export from DesignTokens.
 * All screens that import Theme get the SAME values as DesignTokens.
 * Single source of truth = DesignTokens.ts
 */
import { spacing, radius, fontSize, fontWeight, shadow } from './DesignTokens';

export const Theme = {
  spacing: {
    xs:   spacing[1],   // 4
    sm:   spacing[2],   // 8
    md:   spacing[3],   // 12
    base: spacing[4],   // 16
    lg:   spacing[5],   // 20
    xl:   spacing[6],   // 24
    xxl:  spacing[8],   // 32
    xxxl: spacing[12],  // 48
  },
  radius: {
    sm:   radius.sm,    // 4
    md:   radius.md,    // 8
    lg:   radius.lg,    // 12
    xl:   radius.xl,    // 16
    full: radius.full,  // 9999
  },
  fontSize: {
    xs:   fontSize.xs,    // 11
    sm:   fontSize.sm,    // 13
    md:   fontSize.md,    // 14
    base: fontSize.base,  // 15
    lg:   fontSize.lg,    // 17
    xl:   fontSize.xl,    // 20
    xxl:  fontSize['2xl'],// 24
    xxxl: fontSize['3xl'],// 28
    huge: fontSize['4xl'],// 34
  },
  fontWeight: {
    regular:  fontWeight.regular,
    medium:   fontWeight.medium,
    semibold: fontWeight.semibold,
    bold:     fontWeight.bold,
    extrabold:fontWeight.extrabold,
  },
  shadow,
} as const;

/**
 * Colors.ts — Backward-compatible re-export from DesignTokens.
 * Single source of truth = DesignTokens.ts
 */
import { lightColors, darkColors } from './DesignTokens';

export const Colors = {
  light: {
    primary:         lightColors.primary,
    secondary:       lightColors.primaryLight,
    success:         lightColors.success,
    warning:         lightColors.warning,
    danger:          lightColors.danger,
    surface:         lightColors.surface,
    background:      lightColors.background,
    card:            lightColors.card,
    border:          lightColors.border,
    text:            lightColors.text,
    textSecondary:   lightColors.textSecondary,
    textMuted:       lightColors.textMuted,
    tabBar:          lightColors.tabBar,
    tabBarBorder:    lightColors.border,
    headerBg:        lightColors.primary,
    headerText:      lightColors.textInverse,
    inputBg:         lightColors.inputBg,
    inputBorder:     lightColors.inputBorder,
    overlay:         lightColors.overlay,
    shadow:          '#03284C',
    // Gold accent
    accent:          lightColors.accentSubtle,
    accentGold:      lightColors.accent,
    accentSecondary: lightColors.accentMuted,
    // Extended tokens
    primarySubtle:   lightColors.primarySubtle,
    successSubtle:   lightColors.successSubtle,
    warningSubtle:   lightColors.warningSubtle,
    dangerSubtle:    lightColors.dangerSubtle,
    purpleSubtle:    lightColors.purpleSubtle,
    purple:          lightColors.purple,
    textInverse:     lightColors.textInverse,
  },
  dark: {
    primary:         darkColors.primary,
    secondary:       darkColors.primaryLight,
    success:         darkColors.success,
    warning:         darkColors.warning,
    danger:          darkColors.danger,
    surface:         darkColors.surface,
    background:      darkColors.background,
    card:            darkColors.card,
    border:          darkColors.border,
    text:            darkColors.text,
    textSecondary:   darkColors.textSecondary,
    textMuted:       darkColors.textMuted,
    tabBar:          darkColors.tabBar,
    tabBarBorder:    darkColors.border,
    headerBg:        darkColors.surface,
    headerText:      darkColors.text,
    inputBg:         darkColors.inputBg,
    inputBorder:     darkColors.inputBorder,
    overlay:         darkColors.overlay,
    shadow:          '#000000',
    // Gold accent
    accent:          darkColors.accentSubtle,
    accentGold:      darkColors.accent,
    accentSecondary: darkColors.accentMuted,
    // Extended tokens
    primarySubtle:   darkColors.primarySubtle,
    successSubtle:   darkColors.successSubtle,
    warningSubtle:   darkColors.warningSubtle,
    dangerSubtle:    darkColors.dangerSubtle,
    purpleSubtle:    darkColors.purpleSubtle,
    purple:          darkColors.purple,
    textInverse:     darkColors.textInverse,
  },
} as const;

export type ColorScheme = typeof Colors.light;

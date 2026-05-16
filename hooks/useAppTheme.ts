import { useApp } from '../context/AppProvider';
import { Colors } from '../constants/Colors';
import { lightColors, darkColors } from '../constants/DesignTokens';

/**
 * Use this instead of useColorScheme() + Colors[scheme].
 * Reads the resolved scheme from AppProvider so theme switching works on all platforms.
 */
export function useAppTheme() {
  const { resolvedScheme } = useApp();
  return {
    scheme: resolvedScheme,
    colors: Colors[resolvedScheme],
    lightColors,
    darkColors,
    designColors: resolvedScheme === 'dark' ? darkColors : lightColors,
  };
}

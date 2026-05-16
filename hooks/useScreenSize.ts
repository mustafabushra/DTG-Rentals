import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { sm: 390, md: 768, lg: 1024, xl: 1280 } as const;
export const WEB_SIDEBAR_W  = 220;
export const CONTENT_MAX_W  = 960;

export function useScreenSize() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSmallPhone: width < BREAKPOINTS.sm,   // iPhone SE / mini (375pt)
    isMobile:     width < BREAKPOINTS.md,
    isTablet:     width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop:    width >= BREAKPOINTS.lg,
    isWide:       width >= BREAKPOINTS.md,
    cols2:        width >= BREAKPOINTS.md,
    cols3:        width >= BREAKPOINTS.lg,
    // Responsive horizontal padding: 12 on small phones, 16 otherwise
    hPad:         width < BREAKPOINTS.sm ? 12 : 16,
  };
}

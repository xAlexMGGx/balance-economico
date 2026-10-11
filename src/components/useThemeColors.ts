import { useEffect, useState } from 'react';

const TOKENS = {
  track: '--app-track',
  surface: '--app-surface',
} as const;

export type ThemeColors = Record<keyof typeof TOKENS, string>;

function readColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([name, variable]) => [name, style.getPropertyValue(variable).trim()]),
  ) as ThemeColors;
}

/**
 * Resolved values of the colour tokens, for SVG attributes in charts.
 * Updates when the system switches between light and dark mode.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(readColors());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return colors;
}

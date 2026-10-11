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
 * Updates when the theme changes (the `data-theme` attribute set in index.html).
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

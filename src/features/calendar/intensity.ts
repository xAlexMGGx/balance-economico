import type { CSSProperties } from 'react';
import { INTENSITY_LEVELS } from '../../domain/calendar';

/**
 * Background for a day by its intensity step (0 = nothing spent): the expense colour, one hue
 * from light to dark. The share of colour per step is a CSS token (`--app-heat-N`), because dark
 * mode needs stronger steps to stand out from its dark surface.
 */
export function intensityStyle(level: number): CSSProperties | undefined {
  if (level <= 0) return undefined;
  const step = Math.min(level, INTENSITY_LEVELS);
  return { backgroundColor: `color-mix(in oklab, var(--app-expense) var(--app-heat-${step}), transparent)` };
}

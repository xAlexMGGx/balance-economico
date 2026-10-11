/** Colours offered for accounts, groups and categories. */
export const PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#78716c',
] as const;

/** First palette colour not used yet, so new items start with a distinct colour. */
export function nextColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return PALETTE.find((c) => !taken.has(c)) ?? PALETTE[used.length % PALETTE.length];
}

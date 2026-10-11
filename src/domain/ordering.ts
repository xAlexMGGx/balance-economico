/** Moves `id` one position up (-1) or down (+1). Returns null when it cannot move. */
export function moveId(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const result = [...ids];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

export function byOrder<T extends { order: number; name: string }>(a: T, b: T): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'es');
}

/** Lowercase and without accents, for searching and comparing names: "Café " → "cafe". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Collapses inner whitespace and trims: "  Super   mercado " → "Super mercado". */
export function cleanName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

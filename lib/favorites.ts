export const FAVORITES_STORAGE_KEY = "radioglobe:favorites";

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
}

export function toggleFavorite(id: string): string[] {
  const current = readFavoriteIds();
  const set = new Set(current);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  const next = [...set];
  writeFavoriteIds(next);
  return next;
}

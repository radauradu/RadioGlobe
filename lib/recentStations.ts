export const RECENT_STORAGE_KEY = "radioglobe:recent";
export const RECENT_LIMIT = 10;

export function readRecentIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((item): item is string => typeof item === "string");
    if (ids.length <= RECENT_LIMIT) return ids;

    const trimmed = ids.slice(0, RECENT_LIMIT);
    writeRecentIds(trimmed);
    return trimmed;
  } catch {
    return [];
  }
}

export function writeRecentIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    RECENT_STORAGE_KEY,
    JSON.stringify(ids.slice(0, RECENT_LIMIT)),
  );
}

export function pushRecentId(id: string): string[] {
  const next = [id, ...readRecentIds().filter((item) => item !== id)].slice(
    0,
    RECENT_LIMIT,
  );
  writeRecentIds(next);
  return next;
}

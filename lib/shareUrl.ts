export const STATION_QUERY_KEY = "station";

export function readStationIdFromSearch(search: string) {
  const value = new URLSearchParams(search).get(STATION_QUERY_KEY)?.trim();
  if (!value || !/^[a-zA-Z0-9-]{8,64}$/.test(value)) return null;
  return value;
}

export function buildStationShareUrl(stationId: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = new URL("/", base);
  url.searchParams.set(STATION_QUERY_KEY, stationId);
  return url.toString();
}

export function syncStationInUrl(stationId: string | null) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (stationId) {
    url.searchParams.set(STATION_QUERY_KEY, stationId);
  } else {
    url.searchParams.delete(STATION_QUERY_KEY);
  }
  window.history.replaceState(null, "", url);
}

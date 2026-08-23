import { normalizeBroadcastText } from "./text";

export interface StationPlace {
  city: string;
  country: string;
  line: string;
}

function distinctParts(...values: (string | undefined)[]) {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const value of values) {
    const part = value?.trim();
    if (!part) continue;
    const key = part.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }
  return parts;
}

export function formatStationPlace(station: {
  city?: string;
  state?: string;
  country?: string;
}): StationPlace {
  const country = station.country?.trim() ?? "";
  const locality = station.city?.trim() || station.state?.trim() || "";
  const city =
    locality && locality.toLocaleLowerCase() !== country.toLocaleLowerCase()
      ? locality
      : "";

  return {
    city,
    country,
    line: distinctParts(city, country).join(" · ") || "Unknown location",
  };
}

export function cityFromGeocode(payload: {
  city?: string;
  locality?: string;
}) {
  return normalizeBroadcastText(payload.city || payload.locality || "");
}

const cityCache = new Map<string, string>();

export async function lookupCity(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cityCache.get(key);
  if (cached) return cached;

  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("localityLanguage", "en");
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RadioGlobe/1.0 (https://github.com/radauradu/RadioGlobe)",
      },
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return "";
    const city = cityFromGeocode(
      (await response.json()) as { city?: string; locality?: string },
    );
    if (city) cityCache.set(key, city);
    return city;
  } catch {
    return "";
  }
}

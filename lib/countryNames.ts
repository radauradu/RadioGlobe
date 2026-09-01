import { normalizeBroadcastText } from "./text";

function normalizeCountryKey(value: string) {
  return normalizeBroadcastText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NORTH_KOREA_API_NAME = "Korea, Democratic People's Republic of";

function isNorthKoreaName(value: string) {
  const key = normalizeCountryKey(value);
  if (!key) return false;
  if (key === "north korea" || key === "kp" || key === "dprk") return true;
  return (
    key.includes("democratic") &&
    key.includes("korea") &&
    key.includes("republic")
  );
}

export function displayCountryName(value: string) {
  const normalized = normalizeBroadcastText(value);
  if (!normalized) return normalized;
  return isNorthKoreaName(normalized) ? "North Korea" : normalized;
}

export function countryFilterQueryValue(value: string) {
  const normalized = normalizeBroadcastText(value);
  if (!normalized || normalized.toLowerCase() === "all") return normalized;
  return isNorthKoreaName(normalized) ? NORTH_KOREA_API_NAME : normalized;
}

export function stationMatchesCountryFilter(
  stationCountry: string,
  stationCountryCode: string,
  filter: string,
) {
  const normalizedFilter = normalizeCountryKey(filter);
  if (!normalizedFilter || normalizedFilter === "all") return true;

  if (isNorthKoreaName(filter)) {
    return (
      stationCountryCode.toUpperCase() === "KP" ||
      isNorthKoreaName(stationCountry)
    );
  }

  const stationCountryKey = normalizeCountryKey(stationCountry);
  const stationCodeKey = normalizeCountryKey(stationCountryCode);
  return (
    stationCountryKey.includes(normalizedFilter) ||
    stationCodeKey === normalizedFilter
  );
}

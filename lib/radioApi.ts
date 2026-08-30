import { feature as countryFeature } from "@rapideditor/country-coder";
import tzLookup from "tz-lookup";
import {
  getCuratedStationById,
  mergeCuratedSearchResults,
} from "./curatedStations";
import {
  genreSearchTags,
  normalizeGenreFacets,
} from "./genreCatalog";
import { lookupCity } from "./place";
import { regionCentroidForStation } from "./regionCentroids";
import { normalizeBroadcastText } from "./text";

export const RADIO_BROWSER_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
] as const;

export interface RadioBrowserStation {
  stationuuid?: string;
  name?: string;
  url?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  language?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  geo_lat?: number | string | null;
  geo_long?: number | string | null;
  votes?: number;
  clickcount?: number;
  lastcheckok?: number;
}

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  homepage: string;
  favicon: string;
  country: string;
  countryCode: string;
  state: string;
  city: string;
  language: string;
  tags: string[];
  codec: string;
  bitrate: number;
  lat: number;
  lng: number;
  votes: number;
  clickCount: number;
  timezone: string;
  approximate?: boolean;
}

export interface StationPoint {
  id: string;
  lat: number;
  lng: number;
  votes: number;
  clickCount: number;
  approximate?: boolean;
}

interface RadioBrowserFacet {
  name?: string;
  stationcount?: number;
}

const fetchOptions: RequestInit = {
  headers: {
    "User-Agent": "RadioGlobe/1.0 (https://github.com/radauradu/RadioGlobe)",
  },
  signal: undefined,
};

function finiteCoordinate(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

interface CoordinateResult {
  lat: number;
  lng: number;
  approximate: boolean;
}

const REGION_JITTER_DEGREES = 0.55;

function coordinateCountryCode(lng: number, lat: number) {
  return (
    countryFeature([lng, lat], { level: "country" })?.properties.iso1A2 ?? null
  );
}

function isUsableGeoCoordinate(lat: number, lng: number) {
  if (Math.abs(lat) < 0.05 && Math.abs(lng) < 0.05) return false;
  return coordinateCountryCode(lng, lat) !== null;
}

function jitterCoordinate(
  lat: number,
  lng: number,
  seed: string,
  spreadDegrees = REGION_JITTER_DEGREES,
) {
  const latOffset = (deterministicUnit(seed, 11) - 0.5) * spreadDegrees;
  const lngOffset =
    (deterministicUnit(seed, 12) - 0.5) *
    (spreadDegrees / Math.max(0.35, Math.cos((lat * Math.PI) / 180)));
  return {
    lat: Math.max(-90, Math.min(90, lat + latOffset)),
    lng: Math.max(-180, Math.min(180, lng + lngOffset)),
  };
}

function deterministicUnit(value: string, salt: number) {
  let hash = 2_166_136_261 ^ salt;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function reportedCountryCode(station: RadioBrowserStation) {
  const directCode = station.countrycode?.trim().toUpperCase();
  if (directCode) return directCode;
  const countryName = station.country
    ? normalizeBroadcastText(station.country)
    : "";
  const namedCode = countryName
    ? countryFeature(countryName, { level: "country" })?.properties.iso1A2
    : null;
  if (namedCode) return namedCode;

  for (const value of [station.homepage, station.url_resolved, station.url]) {
    if (!value) continue;
    try {
      const topLevelDomain = new URL(value).hostname.split(".").at(-1);
      if (topLevelDomain?.length === 2) {
        const domainCode = countryFeature(`.${topLevelDomain}`, {
          level: "country",
        })?.properties.iso1A2;
        if (domainCode) return domainCode;
      }
    } catch {
      // Ignore malformed station URLs when inferring a country.
    }
  }
  return null;
}

function approximateCoordinatesForStation(
  station: RadioBrowserStation,
  countryCode: string,
): CoordinateResult | null {
  if (!station.stationuuid) return null;

  const state = station.state ? normalizeBroadcastText(station.state) : "";
  const regionCentroid = regionCentroidForStation(countryCode, state);
  if (regionCentroid) {
    const jittered = jitterCoordinate(
      regionCentroid.lat,
      regionCentroid.lng,
      station.stationuuid,
    );
    return { ...jittered, approximate: true };
  }
  return null;
}

function coordinatesForStation(
  station: RadioBrowserStation,
): CoordinateResult | null {
  const lat = finiteCoordinate(station.geo_lat);
  const lng = finiteCoordinate(station.geo_long);
  const reportedCountry = reportedCountryCode(station);

  if (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    isUsableGeoCoordinate(lat, lng)
  ) {
    const geoCountry = coordinateCountryCode(lng, lat);
    if (
      reportedCountry &&
      geoCountry &&
      geoCountry !== reportedCountry &&
      regionCentroidForStation(
        reportedCountry,
        station.state ? normalizeBroadcastText(station.state) : undefined,
      )
    ) {
      return approximateCoordinatesForStation(station, reportedCountry);
    }

    return { lat, lng, approximate: false };
  }

  if (!reportedCountry) return null;
  return approximateCoordinatesForStation(station, reportedCountry);
}

export function normalizeStation(
  station: RadioBrowserStation,
): RadioStation | null {
  const coordinates = coordinatesForStation(station);
  const streamUrl = station.url_resolved?.trim() || station.url?.trim();
  const stationName = station.name
    ? normalizeBroadcastText(station.name)
    : "";

  if (
    !station.stationuuid ||
    !stationName ||
    !streamUrl ||
    !coordinates ||
    station.lastcheckok === 0
  ) {
    return null;
  }
  const { lat, lng, approximate } = coordinates;

  const coordinateCountry = countryFeature([lng, lat], {
    level: "country",
  })?.properties;
  const reportedCountryName = station.country
    ? normalizeBroadcastText(station.country)
    : "";
  let timezone = "UTC";
  try {
    timezone = tzLookup(lat, lng);
  } catch {
    // Coordinates outside timezone boundaries use UTC.
  }

  return {
    id: station.stationuuid,
    name: stationName,
    streamUrl,
    homepage: station.homepage?.trim() ?? "",
    favicon: station.favicon?.trim() ?? "",
    country:
      (approximate ? reportedCountryName : "") ||
      coordinateCountry?.nameEn ||
      reportedCountryName ||
      "Unknown",
    countryCode:
      (approximate
        ? station.countrycode?.trim().toUpperCase()
        : coordinateCountry?.iso1A2) ||
      station.countrycode?.trim().toUpperCase() ||
      "",
    state: station.state ? normalizeBroadcastText(station.state) : "",
    city: station.state ? normalizeBroadcastText(station.state) : "",
    language: station.language
      ? normalizeBroadcastText(station.language)
      : "",
    tags: (station.tags ?? "")
      .split(",")
      .map(normalizeBroadcastText)
      .filter(Boolean)
      .slice(0, 12),
    codec: station.codec?.trim().toUpperCase() ?? "",
    bitrate: Math.max(0, station.bitrate ?? 0),
    lat,
    lng,
    votes: Math.max(0, station.votes ?? 0),
    clickCount: Math.max(0, station.clickcount ?? 0),
    timezone,
    approximate,
  };
}

export function normalizeStationPoint(
  station: RadioBrowserStation,
): StationPoint | null {
  const coordinates = coordinatesForStation(station);
  if (
    !station.stationuuid ||
    !coordinates ||
    station.lastcheckok === 0
  ) {
    return null;
  }
  return {
    id: station.stationuuid,
    ...coordinates,
    votes: Math.max(0, station.votes ?? 0),
    clickCount: Math.max(0, station.clickcount ?? 0),
  };
}

async function fetchFromMirrors<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let lastError: unknown;

  for (const mirror of RADIO_BROWSER_MIRRORS) {
    try {
      const response = await fetch(`${mirror}${path}`, {
        ...fetchOptions,
        ...init,
        headers: { ...fetchOptions.headers, ...init.headers },
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        throw new Error(`Radio Browser returned ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Radio Browser mirrors failed");
}

export async function fetchStationPointPage(limit = 5_000, offset = 0) {
  const safeLimit = Math.min(Math.max(limit, 1), 5_000);
  const query = new URLSearchParams({
    limit: String(safeLimit),
    offset: String(Math.max(0, offset)),
    hidebroken: "true",
    order: "url",
    reverse: "false",
  });
  const raw = await fetchFromMirrors<RadioBrowserStation[]>(
    `/json/stations/search?${query}`,
    { cache: "no-store" },
  );

  return {
    points: raw
      .map(normalizeStationPoint)
      .filter((station): station is StationPoint => station !== null),
    rawCount: raw.length,
  };
}

export interface StationSearchOptions {
  query?: string;
  country?: string;
  genre?: string;
  language?: string;
  limit?: number;
}

export async function searchStations({
  query: searchQuery = "",
  country = "",
  genre = "",
  language = "",
  limit = 120,
}: StationSearchOptions = {}) {
  const trimmedGenre = genre.trim();
  if (trimmedGenre) {
    const tags = genreSearchTags(trimmedGenre);
    if (tags.length > 1) {
      const perTagLimit = Math.min(200, Math.max(limit, 80));
      const batches = await Promise.all(
        tags.slice(0, 6).map((tag) =>
          searchStationsByTag({
            query: searchQuery,
            country,
            genre: tag,
            language,
            limit: perTagLimit,
          }),
        ),
      );
      const merged = new Map<string, RadioStation>();
      for (const batch of batches) {
        for (const station of batch) {
          merged.set(station.id, station);
        }
      }
      return mergeCuratedSearchResults(
        [...merged.values()]
          .sort((left, right) => right.clickCount - left.clickCount)
          .slice(0, Math.min(Math.max(limit, 1), 200)),
        { query: searchQuery, country, genre: trimmedGenre, language },
      ).slice(0, Math.min(Math.max(limit, 1), 200));
    }

    return searchStationsByTag({
      query: searchQuery,
      country,
      genre: tags[0] ?? trimmedGenre,
      language,
      limit,
    });
  }

  return searchStationsByTag({
    query: searchQuery,
    country,
    genre: "",
    language,
    limit,
  });
}

async function searchStationsByTag({
  query: searchQuery = "",
  country = "",
  genre = "",
  language = "",
  limit = 120,
}: StationSearchOptions = {}) {
  const query = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 200)),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  if (searchQuery.trim()) query.set("name", searchQuery.trim());
  if (country.trim()) query.set("country", country.trim());
  if (genre.trim()) query.set("tag", genre.trim());
  if (language.trim()) query.set("language", language.trim());

  const raw = await fetchFromMirrors<RadioBrowserStation[]>(
    `/json/stations/search?${query}`,
    { cache: "no-store" },
  );
  const stations = raw
    .map(normalizeStation)
    .filter((station): station is RadioStation => station !== null);
  return mergeCuratedSearchResults(stations, {
    query: searchQuery,
    country,
    genre,
    language,
  }).slice(0, Math.min(Math.max(limit, 1), 200));
}

export async function fetchStationFacets() {
  const common = "hidebroken=true&order=stationcount&reverse=true";
  const [countries, genres, languages] = await Promise.all([
    fetchFromMirrors<RadioBrowserFacet[]>(
      `/json/countries?${common}&limit=250`,
      { cache: "no-store" },
    ),
    fetchFromMirrors<RadioBrowserFacet[]>(
      `/json/tags?${common}&limit=500`,
      { cache: "no-store" },
    ),
    fetchFromMirrors<RadioBrowserFacet[]>(
      `/json/languages?${common}&limit=120`,
      { cache: "no-store" },
    ),
  ]);

  const normalizeCountries = (facets: RadioBrowserFacet[]) =>
    facets
      .filter(
        (facet): facet is Required<RadioBrowserFacet> =>
          Boolean(facet.name?.trim()) && (facet.stationcount ?? 0) > 0,
      )
      .map(({ name }) => normalizeBroadcastText(name));

  const normalizeLanguages = (facets: RadioBrowserFacet[]) =>
    facets
      .filter(
        (facet): facet is Required<RadioBrowserFacet> =>
          Boolean(facet.name?.trim()) && (facet.stationcount ?? 0) > 0,
      )
      .map(({ name }) =>
        normalizeBroadcastText(name)
          .split(",")[0]
          ?.trim() ?? "",
      )
      .filter(Boolean);

  return {
    countries: [...new Set(normalizeCountries(countries))],
    genres: normalizeGenreFacets(
      genres.filter(
        (facet): facet is Required<RadioBrowserFacet> =>
          Boolean(facet.name?.trim()) && (facet.stationcount ?? 0) > 0,
      ),
    ),
    languages: [...new Set(normalizeLanguages(languages))].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

export async function fetchStations(limit = 120) {
  return searchStations({ limit });
}

export async function fetchStationById(stationId: string) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(stationId)) {
    return null;
  }

  const curated = getCuratedStationById(stationId);
  if (curated) return curated;

  const raw = await fetchFromMirrors<RadioBrowserStation[]>(
    `/json/stations/byuuid/${encodeURIComponent(stationId)}`,
    { cache: "no-store" },
  );

  const station = raw.length > 0 ? normalizeStation(raw[0]) : null;
  if (!station || station.approximate) return station;

  const city = await lookupCity(station.lat, station.lng);
  if (city) station.city = city;
  return station;
}

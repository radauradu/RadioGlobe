import type { RadioStation, StationPoint } from "./radioApi";
import { normalizeBroadcastText } from "./text";

export interface CuratedStationInput {
  id: string;
  name: string;
  streamUrl: string;
  homepage: string;
  favicon?: string;
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
  votes?: number;
  clickCount?: number;
  timezone: string;
}

const CURATED_STATION_INPUTS: CuratedStationInput[] = [
  {
    id: "39fda4c7-3667-4908-8aa4-bf7f05f6e2c7",
    name: "Q93",
    streamUrl: "https://stream.revma.ihrhls.com/zc1037",
    homepage: "https://q93.iheart.com/",
    favicon:
      "https://i.iheart.com/v3/re/assets.brands/5aea24caf353582cf23a0ad2?ops=new(),flood(%22white%22),swap(),merge(%22over%22),gravity(%22center%22),contain(167,167),quality(80),format(%22png%22)",
    country: "The United States Of America",
    countryCode: "US",
    state: "Louisiana",
    city: "New Orleans",
    language: "English",
    tags: ["urban contemporary", "hip hop", "rap", "r&b"],
    codec: "AAC",
    bitrate: 0,
    lat: 29.9511,
    lng: -90.0715,
    votes: 106,
    clickCount: 0,
    timezone: "America/Chicago",
  },
  {
    id: "3cddec1d-c69a-4ef9-82e1-539f34d5bfe5",
    name: "98.5 WYLD",
    streamUrl: "https://stream.revma.ihrhls.com/zc1053",
    homepage: "https://wyldfm.iheart.com/",
    favicon:
      "https://i.iheart.com/v3/re/assets.brands/5aea268408c82e0c34ad95f4?ops=gravity(%22center%22),contain(32,32),quality(65)",
    country: "The United States Of America",
    countryCode: "US",
    state: "Louisiana",
    city: "New Orleans",
    language: "English",
    tags: ["urban adult contemporary", "hip hop", "rap", "r&b", "old school"],
    codec: "AAC",
    bitrate: 0,
    lat: 29.9488,
    lng: -90.0682,
    votes: 107,
    clickCount: 0,
    timezone: "America/Chicago",
  },
  {
    id: "d81ab50a-0926-47df-9d8a-5ce0f1690daf",
    name: "Live504 Radio",
    streamUrl: "https://icy.cloudrad.io/b6e2c11b",
    homepage: "https://live504radio.univer.se/",
    country: "The United States Of America",
    countryCode: "US",
    state: "Louisiana",
    city: "New Orleans",
    language: "English",
    tags: ["hip hop", "rap", "r&b", "bounce"],
    codec: "MP3",
    bitrate: 128,
    lat: 29.9535,
    lng: -90.0748,
    votes: 0,
    clickCount: 2,
    timezone: "America/Chicago",
  },
  {
    id: "9621c976-0601-11e8-ae97-52543be04c81",
    name: "Old School 106.7",
    streamUrl: "https://18543.live.streamtheworld.com/KMEZFMAAC_SC",
    homepage: "https://www.oldschool1067.com/",
    favicon:
      "https://www.cumulusmedia.com/wp-content/uploads/2019/10/cropped-android-chrome-512x512-2-180x180.png",
    country: "The United States Of America",
    countryCode: "US",
    state: "Louisiana",
    city: "New Orleans",
    language: "English",
    tags: ["urban adult contemporary", "hip hop", "rap", "old school", "r&b"],
    codec: "AAC+",
    bitrate: 48,
    lat: 29.9465,
    lng: -90.0655,
    votes: 128,
    clickCount: 1,
    timezone: "America/Chicago",
  },
];

function toRadioStation(input: CuratedStationInput): RadioStation {
  return {
    id: input.id,
    name: normalizeBroadcastText(input.name),
    streamUrl: input.streamUrl,
    homepage: input.homepage,
    favicon: input.favicon ?? "",
    country: normalizeBroadcastText(input.country),
    countryCode: input.countryCode,
    state: normalizeBroadcastText(input.state),
    city: normalizeBroadcastText(input.city),
    language: normalizeBroadcastText(input.language),
    tags: input.tags.map(normalizeBroadcastText),
    codec: input.codec,
    bitrate: input.bitrate,
    lat: input.lat,
    lng: input.lng,
    votes: input.votes ?? 0,
    clickCount: input.clickCount ?? 0,
    timezone: input.timezone,
  };
}

function toStationPoint(station: RadioStation): StationPoint {
  return {
    id: station.id,
    lat: station.lat,
    lng: station.lng,
    votes: station.votes,
    clickCount: station.clickCount,
  };
}

const CURATED_STATIONS = CURATED_STATION_INPUTS.map(toRadioStation);
const CURATED_STATION_POINTS = CURATED_STATIONS.map(toStationPoint);
const CURATED_STATION_BY_ID = new Map(
  CURATED_STATIONS.map((station) => [station.id, station]),
);

function normalizeSearchValue(value: string) {
  return normalizeBroadcastText(value).toLowerCase();
}

function stationMatchesQuery(station: RadioStation, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const haystack = [
    station.name,
    station.city,
    station.state,
    station.country,
    ...station.tags,
  ]
    .map(normalizeSearchValue)
    .join(" ");

  return haystack.includes(normalizedQuery);
}

function stationMatchesCountry(station: RadioStation, country: string) {
  const normalizedCountry = normalizeSearchValue(country);
  if (!normalizedCountry || normalizedCountry === "all") return true;

  return (
    normalizeSearchValue(station.country).includes(normalizedCountry) ||
    normalizeSearchValue(station.countryCode) === normalizedCountry
  );
}

function stationMatchesGenre(station: RadioStation, genre: string) {
  const normalizedGenre = normalizeSearchValue(genre);
  if (!normalizedGenre || normalizedGenre === "all") return true;

  return station.tags.some((tag) => normalizeSearchValue(tag).includes(normalizedGenre));
}

function stationMatchesLanguage(station: RadioStation, language: string) {
  const normalizedLanguage = normalizeSearchValue(language);
  if (!normalizedLanguage || normalizedLanguage === "all") return true;

  return normalizeSearchValue(station.language).includes(normalizedLanguage);
}

export function curatedStations() {
  return CURATED_STATIONS;
}

export function curatedStationPoints() {
  return CURATED_STATION_POINTS;
}

export function getCuratedStationById(stationId: string) {
  return CURATED_STATION_BY_ID.get(stationId) ?? null;
}

export function searchCuratedStations({
  query = "",
  country = "",
  genre = "",
  language = "",
}: {
  query?: string;
  country?: string;
  genre?: string;
  language?: string;
} = {}) {
  return CURATED_STATIONS.filter(
    (station) =>
      stationMatchesQuery(station, query) &&
      stationMatchesCountry(station, country) &&
      stationMatchesGenre(station, genre) &&
      stationMatchesLanguage(station, language),
  );
}

export function mergeCuratedStationPoints(points: StationPoint[]) {
  const merged = new Map(points.map((point) => [point.id, point]));
  for (const point of CURATED_STATION_POINTS) {
    merged.set(point.id, point);
  }
  return [...merged.values()];
}

export function mergeCuratedSearchResults(
  stations: RadioStation[],
  options: {
    query?: string;
    country?: string;
    genre?: string;
    language?: string;
  } = {},
) {
  const curatedMatches = searchCuratedStations(options);
  const merged = new Map(stations.map((station) => [station.id, station]));

  for (const station of curatedMatches) {
    merged.set(station.id, station);
  }

  const curatedIds = new Set(curatedMatches.map((station) => station.id));
  return [...merged.values()].sort((left, right) => {
    const leftCurated = curatedIds.has(left.id) ? 1 : 0;
    const rightCurated = curatedIds.has(right.id) ? 1 : 0;
    if (leftCurated !== rightCurated) return rightCurated - leftCurated;
    return right.clickCount - left.clickCount;
  });
}

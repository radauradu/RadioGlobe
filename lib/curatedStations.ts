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
  {
    id: "a6381986-1c6e-400f-a57e-0bce3ccc1214",
    name: "Hot 97",
    streamUrl: "https://18313.live.streamtheworld.com/WQHTFMAAC.aac",
    homepage: "https://www.hot97.com/",
    favicon:
      "https://www.hot97.com/wp-content/uploads/sites/2/2024/03/cropped-hot97-site-icon.png",
    country: "The United States Of America",
    countryCode: "US",
    state: "New York",
    city: "New York",
    language: "English",
    tags: ["urban contemporary", "hip hop", "rap", "r&b"],
    codec: "AAC",
    bitrate: 64,
    lat: 40.754,
    lng: -73.987,
    votes: 0,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "d5f76b95-7507-487e-ad3f-48ba15cd3cce",
    name: "Power 105.1",
    streamUrl: "https://stream.revma.ihrhls.com/zc1481",
    homepage: "https://power1051.iheart.com/",
    favicon:
      "https://i.iheart.com/v3/re/assets.brands/595542fc52e033394f67a9eb?ops=new(),flood(%22white%22),swap(),merge(%22over%22),gravity(%22center%22),contain(167,167),quality(80),format(%22png%22)",
    country: "The United States Of America",
    countryCode: "US",
    state: "New York",
    city: "New York",
    language: "English",
    tags: ["urban contemporary", "hip hop", "rap", "r&b"],
    codec: "AAC",
    bitrate: 0,
    lat: 40.7512,
    lng: -73.9845,
    votes: 0,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "63c56fba-2e27-4983-a78e-5798aba8d73a",
    name: "TRAP RADIO",
    streamUrl: "https://trapradio.streamingmedia.it/play",
    homepage: "http://trap.radio/",
    country: "The United States Of America",
    countryCode: "US",
    state: "New York",
    city: "New York",
    language: "English",
    tags: ["trap", "hip hop", "rap"],
    codec: "MP3",
    bitrate: 128,
    lat: 40.7485,
    lng: -73.981,
    votes: 0,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "04a32213-9c45-400e-9539-0a5c9afba09b",
    name: "MARTINAIR",
    streamUrl: "https://stream.zeno.fm/p0wp29crmm0uv",
    homepage: "https://tunein.com/radio/MARTINAIR-s262692/",
    country: "The United States Of America",
    countryCode: "US",
    state: "New York",
    city: "New York",
    language: "English",
    tags: ["hip hop", "rap"],
    codec: "MP3",
    bitrate: 0,
    lat: 40.7458,
    lng: -73.9785,
    votes: 10,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "d43c5481-a365-4cdc-b914-2273ddff05eb",
    name: "96.1 The Beat",
    streamUrl: "https://stream.revma.ihrhls.com/zc741",
    homepage: "https://961thebeat.iheart.com/",
    favicon: "https://www.iheart.com/favicon.ico",
    country: "The United States Of America",
    countryCode: "US",
    state: "Georgia",
    city: "Atlanta",
    language: "English",
    tags: ["urban contemporary", "hip hop", "rap", "r&b"],
    codec: "AAC",
    bitrate: 0,
    lat: 33.749,
    lng: -84.388,
    votes: 65,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "1a107900-a000-4000-8000-010790000001",
    name: "Hot 107.9",
    streamUrl: "https://playerservices.streamtheworld.com/api/livestream-redirect/WHTAFMAAC.aac",
    homepage: "https://hot1079.iheart.com/",
    favicon:
      "https://i.iheart.com/v3/re/new_assets/60ad8bf5594a0d2d96cbf377",
    country: "The United States Of America",
    countryCode: "US",
    state: "Georgia",
    city: "Atlanta",
    language: "English",
    tags: ["hip hop", "rap", "urban contemporary"],
    codec: "AAC",
    bitrate: 0,
    lat: 33.7515,
    lng: -84.3855,
    votes: 0,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "1a010300-a000-4000-8000-010300000001",
    name: "V-103",
    streamUrl: "https://live.amperwave.net/direct/audacy-wveefmaac-imc",
    homepage: "https://www.audacy.com/v103",
    country: "The United States Of America",
    countryCode: "US",
    state: "Georgia",
    city: "Atlanta",
    language: "English",
    tags: ["urban contemporary", "hip hop", "rap", "r&b"],
    codec: "AAC",
    bitrate: 0,
    lat: 33.7465,
    lng: -84.3905,
    votes: 0,
    clickCount: 0,
    timezone: "America/New_York",
  },
  {
    id: "9640da09-0601-11e8-ae97-52543be04c81",
    name: "OG 97.9",
    streamUrl: "https://18153.live.streamtheworld.com/WWWQH3_SC",
    homepage: "https://www.og979.com/",
    country: "The United States Of America",
    countryCode: "US",
    state: "Georgia",
    city: "Atlanta",
    language: "English",
    tags: ["hip hop", "rap", "old school", "r&b"],
    codec: "MP3",
    bitrate: 80,
    lat: 33.744,
    lng: -84.393,
    votes: 93,
    clickCount: 1,
    timezone: "America/New_York",
  },
  {
    id: "6dcb8eb0-9f72-45db-87d1-31c3441d508d",
    name: "Evosonic Radio",
    streamUrl: "https://stream4.themediasite.co.uk/stream/evosonic",
    homepage: "https://www.evosonic.de/",
    favicon: "https://www.evosonic.de/favicon.ico",
    country: "Germany",
    countryCode: "DE",
    state: "Berlin",
    city: "Berlin",
    language: "German",
    tags: ["acid", "techno", "house", "electronic", "underground", "rave"],
    codec: "MP3",
    bitrate: 128,
    lat: 52.521,
    lng: 13.405,
    votes: 334,
    clickCount: 3,
    timezone: "Europe/Berlin",
  },
  {
    id: "67a7f497-afe6-46bf-a097-0bb74d6dbe44",
    name: "Pure FM",
    streamUrl: "http://stream.laut.fm/purefm",
    homepage: "https://pure-fm.de/",
    favicon:
      "https://pure-fm.de/wp-content/uploads/logo-pure-BLN-ukw-106-8-dab-claim-weiss.png",
    country: "Germany",
    countryCode: "DE",
    state: "Berlin",
    city: "Berlin",
    language: "German",
    tags: ["electronic", "house", "techno", "underground"],
    codec: "MP3",
    bitrate: 128,
    lat: 52.518,
    lng: 13.402,
    votes: 10,
    clickCount: 1,
    timezone: "Europe/Berlin",
  },
  {
    id: "964583e7-0601-11e8-ae97-52543be04c81",
    name: "FluxFM - Techno Underground",
    streamUrl:
      "https://fluxmusic.api.radiosphere.io/channels/techno-underground/stream.mp3?quality=1",
    homepage: "https://www.fluxfm.de/",
    favicon: "https://www.fluxfm.de/assets/favicons/apple-icon-120x120.png",
    country: "Germany",
    countryCode: "DE",
    state: "Berlin",
    city: "Berlin",
    language: "German",
    tags: ["techno", "underground", "electronic", "rave"],
    codec: "MP3",
    bitrate: 128,
    lat: 52.524,
    lng: 13.408,
    votes: 623,
    clickCount: 1,
    timezone: "Europe/Berlin",
  },
  {
    id: "552e2533-3680-4b21-9898-a1026fc79c4b",
    name: "Refuge Worldwide",
    streamUrl: "https://streaming.radio.co/s3699c5e49/listen",
    homepage: "https://refugeworldwide.com/radio",
    favicon: "https://f4.bcbits.com/img/0040799791_10.jpg",
    country: "Germany",
    countryCode: "DE",
    state: "Berlin",
    city: "Berlin",
    language: "English",
    tags: ["electronic", "underground", "house", "ambient"],
    codec: "MP3",
    bitrate: 192,
    lat: 52.516,
    lng: 13.4,
    votes: 8,
    clickCount: 1,
    timezone: "Europe/Berlin",
  },
  {
    id: "5e32f2f4-eeeb-4417-8add-7dbe87ae7ba0",
    name: "Techno Revival",
    streamUrl: "http://stream.laut.fm/techno-revival",
    homepage: "https://laut.fm/techno-revival",
    country: "Germany",
    countryCode: "DE",
    state: "Berlin",
    city: "Berlin",
    language: "German",
    tags: ["techno", "rave", "underground", "90s"],
    codec: "MP3",
    bitrate: 128,
    lat: 52.522,
    lng: 13.412,
    votes: 334,
    clickCount: 3,
    timezone: "Europe/Berlin",
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

function streamIdentityKey(streamUrl: string) {
  try {
    const parsed = new URL(streamUrl.trim());
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return streamUrl.trim().toLowerCase();
  }
}

function streamOutletTokens(streamUrl: string) {
  const tokens = new Set<string>();
  const lower = streamUrl.toLowerCase();

  for (const match of lower.matchAll(
    /evosonic|zc\d+|wqht|whtafm|wveefm|wwwwqh|kmezfmaac|purefm-bln|laut\.fm\/purefm|laut\.fm\/techno-revival|techno-underground|technoug|radio\.co\/s3699c5e49|cloudrad\.io\/b6e2c11b|trapradio\.streamingmedia|zeno\.fm\/p0wp29crmm0uv/g,
  )) {
    tokens.add(match[0]);
  }

  return tokens;
}

function streamsShareOutlet(leftUrl: string, rightUrl: string) {
  const leftTokens = streamOutletTokens(leftUrl);
  if (leftTokens.size === 0) return false;

  for (const token of streamOutletTokens(rightUrl)) {
    if (leftTokens.has(token)) return true;
  }

  return false;
}

const UNIQUE_CURATED_NAMES = new Set(
  CURATED_STATION_INPUTS.filter(
    (station, index, stations) =>
      stations.filter(
        (candidate) =>
          normalizeSearchValue(candidate.name) === normalizeSearchValue(station.name) &&
          candidate.countryCode === station.countryCode,
      ).length === 1,
  ).map((station) => normalizeSearchValue(station.name)),
);

function stationRepresentsDuplicateListing(
  candidate: RadioStation,
  canonical: RadioStation,
) {
  if (candidate.id === canonical.id) return false;

  const candidateStream = streamIdentityKey(candidate.streamUrl);
  const canonicalStream = streamIdentityKey(canonical.streamUrl);
  if (candidateStream && candidateStream === canonicalStream) return true;
  if (streamsShareOutlet(candidate.streamUrl, canonical.streamUrl)) return true;

  const candidateName = normalizeSearchValue(candidate.name);
  const canonicalName = normalizeSearchValue(canonical.name);
  if (candidate.countryCode !== canonical.countryCode) return false;

  const namesMatch =
    candidateName === canonicalName ||
    (candidateName.includes(canonicalName) && canonicalName.length >= 6) ||
    (canonicalName.includes(candidateName) && candidateName.length >= 6);
  if (!namesMatch) return false;

  const candidateCity = normalizeSearchValue(candidate.city);
  const canonicalCity = normalizeSearchValue(canonical.city);
  const candidateState = normalizeSearchValue(candidate.state);
  const canonicalState = normalizeSearchValue(canonical.state);

  if (canonicalCity && candidateCity && candidateCity === canonicalCity) return true;
  if (canonicalState && candidateState && candidateState === canonicalState) {
    return true;
  }

  if (
    candidateName === canonicalName &&
    !candidateCity &&
    !candidateState &&
    canonicalCity &&
    UNIQUE_CURATED_NAMES.has(canonicalName)
  ) {
    return true;
  }

  return false;
}

function filterDuplicateCuratedListings(stations: RadioStation[]) {
  return stations.filter(
    (station) =>
      !CURATED_STATIONS.some((curated) =>
        stationRepresentsDuplicateListing(station, curated),
      ),
  );
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
  const merged = new Map(
    filterDuplicateCuratedListings(stations).map((station) => [station.id, station]),
  );

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

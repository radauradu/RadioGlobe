import type { RadioStation } from "./radioApi";
import { safeStreamFetch, validatePublicStreamUrl } from "./streamSecurity";
import { normalizeBroadcastText } from "./text";

export type MetadataSource =
  | "icy"
  | "radio.co"
  | "azuracast"
  | "icecast"
  | "shoutcast";

export interface NowPlayingMetadata {
  streamTitle: string;
  source: MetadataSource;
}

const MAX_METADATA_BYTES = 256 * 1_024;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = normalizeBroadcastText(value);
  return normalized || null;
}

function combineArtistTitle(artist: unknown, title: unknown) {
  const artistText = textValue(artist);
  const titleText = textValue(title);
  if (artistText && titleText) return `${artistText} - ${titleText}`;
  return titleText ?? artistText;
}

async function readLimitedJson(response: Response) {
  if (!response.body) return null;
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_METADATA_BYTES) {
    await response.body.cancel();
    return null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total <= MAX_METADATA_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_METADATA_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return null;
  }
}

async function requestPublicJson(url: URL) {
  await validatePublicStreamUrl(url.toString());
  const response = await safeStreamFetch(url, {
    headers: {
      Accept: "application/json,text/json,*/*;q=0.2",
      "User-Agent": "RadioGlobe/1.0",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  return readLimitedJson(response);
}

export function parseRadioCo(payload: unknown) {
  const root = objectValue(payload);
  const currentTrack = objectValue(root?.current_track);
  return textValue(currentTrack?.title);
}

function azuraTitle(entry: unknown) {
  const root = objectValue(entry);
  const nowPlaying = objectValue(root?.now_playing);
  const song = objectValue(nowPlaying?.song);
  return (
    textValue(song?.text) ??
    combineArtistTitle(song?.artist, song?.title) ??
    textValue(nowPlaying?.text)
  );
}

export function parseAzuraCast(payload: unknown, station: RadioStation) {
  const entries = Array.isArray(payload) ? payload : [payload];
  const normalizedName = station.name.toLocaleLowerCase();
  const matchingEntry = entries.find((entry) => {
    const root = objectValue(entry);
    const stationData = objectValue(root?.station);
    const providerName = textValue(stationData?.name)?.toLocaleLowerCase();
    const listenUrl = textValue(stationData?.listen_url);
    return (
      providerName === normalizedName ||
      providerName?.includes(normalizedName) ||
      (listenUrl !== null && listenUrl === station.streamUrl)
    );
  });

  if (matchingEntry) return azuraTitle(matchingEntry);
  return entries.length === 1 ? azuraTitle(entries[0]) : null;
}

function icecastSources(payload: unknown) {
  const root = objectValue(payload);
  const stats = objectValue(root?.icestats);
  const source = stats?.source;
  return Array.isArray(source) ? source : source ? [source] : [];
}

function icecastTitle(source: unknown) {
  const data = objectValue(source);
  return (
    combineArtistTitle(data?.artist, data?.title) ??
    textValue(data?.yp_currently_playing) ??
    textValue(data?.streamtitle)
  );
}

function normalizedChannelName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/\b(opus|ogg|aac|mp3|flac)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseIcecast(payload: unknown, station: RadioStation) {
  const sources = icecastSources(payload);
  const streamPath = new URL(station.streamUrl).pathname;
  const matchingSource =
    sources.find((source) => {
      const data = objectValue(source);
      const listenUrl = textValue(data?.listenurl);
      if (!listenUrl) return false;
      try {
        return new URL(listenUrl).pathname === streamPath;
      } catch {
        return false;
      }
    }) ?? (sources.length === 1 ? sources[0] : null);
  const exactTitle = icecastTitle(matchingSource);
  if (exactTitle) return exactTitle;

  const channelName = normalizedChannelName(station.name);
  const relatedSource = sources.find((source) => {
    const data = objectValue(source);
    const serverName = textValue(data?.server_name);
    return (
      serverName !== null &&
      normalizedChannelName(serverName) === channelName &&
      icecastTitle(source) !== null
    );
  });
  return icecastTitle(relatedSource);
}

export function parseShoutcast(payload: unknown) {
  const root = objectValue(payload);
  const streams = Array.isArray(root?.streams) ? root.streams : [];
  const firstStream = objectValue(streams[0]);
  return (
    textValue(root?.songtitle) ??
    textValue(firstStream?.songtitle) ??
    textValue(root?.currentsong)
  );
}

function radioCoId(station: RadioStation) {
  const values = [station.streamUrl, station.homepage];
  for (const value of values) {
    const match = value.match(/\b(s[a-f0-9]{8,})\b/i);
    if (match) return match[1];
  }
  return null;
}

async function providerRequest(
  url: URL,
  source: Exclude<MetadataSource, "icy">,
  parse: (payload: unknown) => string | null,
): Promise<NowPlayingMetadata> {
  const payload = await requestPublicJson(url);
  const streamTitle = parse(payload);
  if (!streamTitle) throw new Error(`${source} returned no track`);
  return { streamTitle, source };
}

export async function fetchProviderMetadata(
  station: RadioStation,
): Promise<NowPlayingMetadata | null> {
  const streamUrl = await validatePublicStreamUrl(station.streamUrl);
  const origin = streamUrl.origin;
  const requests: Promise<NowPlayingMetadata>[] = [
    providerRequest(
      new URL("/status-json.xsl", origin),
      "icecast",
      (payload) => parseIcecast(payload, station),
    ),
    providerRequest(
      new URL("/stats?sid=1&json=1", origin),
      "shoutcast",
      parseShoutcast,
    ),
    providerRequest(
      new URL("/api/nowplaying", origin),
      "azuracast",
      (payload) => parseAzuraCast(payload, station),
    ),
  ];

  const stationId = radioCoId(station);
  if (stationId) {
    requests.unshift(
      providerRequest(
        new URL(
          `/api/v2/${encodeURIComponent(stationId)}/track/current`,
          "https://public.radio.co",
        ),
        "radio.co",
        parseRadioCo,
      ),
    );
  }

  try {
    return await Promise.any(requests);
  } catch {
    return null;
  }
}

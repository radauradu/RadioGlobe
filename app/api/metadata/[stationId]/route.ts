import {
  resolveStationStream,
  safeStreamFetch,
  StreamSecurityError,
} from "@/lib/streamSecurity";
import {
  fetchProviderMetadata,
  type NowPlayingMetadata,
} from "@/lib/metadataProviders";
import type { RadioStation } from "@/lib/radioApi";
import { normalizeBroadcastText } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ stationId: string }>;
}

const MAX_PROBE_BYTES = 1_048_576;
const CACHE_TTL_MS = 15_000;
const metadataCache = new Map<
  string,
  { value: NowPlayingMetadata | null; expiresAt: number }
>();

function parseStreamTitle(metadata: Uint8Array) {
  const text = new TextDecoder("latin1")
    .decode(metadata)
    .replace(/\0+$/g, "");
  const match = text.match(/StreamTitle='([^']*)';?/i);
  return match?.[1] ? normalizeBroadcastText(match[1]) || null : null;
}

async function probeIcyMetadata(url: URL): Promise<NowPlayingMetadata | null> {
  const upstream = await safeStreamFetch(url, {
    headers: {
      Accept: "audio/*",
      "Icy-MetaData": "1",
      "User-Agent": "RadioGlobe/1.0",
    },
  });
  const interval = Number(upstream.headers.get("icy-metaint"));

  if (
    !upstream.ok ||
    !upstream.body ||
    !Number.isFinite(interval) ||
    interval <= 0
  ) {
    await upstream.body?.cancel();
    return null;
  }
  if (interval + 4_081 > MAX_PROBE_BYTES) {
    await upstream.body.cancel();
    throw new StreamSecurityError("Metadata interval is too large.", 422);
  }

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const neededForLength = interval + 1;

  while (total < neededForLength) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
    if (total > MAX_PROBE_BYTES) break;
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (combined.byteLength <= interval) {
    await reader.cancel();
    return null;
  }

  const metadataLength = combined[interval] * 16;
  const targetLength = interval + 1 + metadataLength;
  while (total < targetLength && total < MAX_PROBE_BYTES) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel();

  const full = new Uint8Array(total);
  offset = 0;
  for (const chunk of chunks) {
    full.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const metadata = full.slice(interval + 1, targetLength);
  const streamTitle = parseStreamTitle(metadata);
  return streamTitle ? { streamTitle, source: "icy" } : null;
}

async function resolveMetadata(station: RadioStation, url: URL) {
  try {
    const icy = await probeIcyMetadata(url);
    if (icy) return icy;
  } catch {
    // A station website API may still work when its audio endpoint does not.
  }
  return fetchProviderMetadata(station);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { stationId } = await context.params;
    const cached = metadataCache.get(stationId);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(
        {
          streamTitle: cached.value?.streamTitle ?? null,
          source: cached.value?.source ?? null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const { station, url } = await resolveStationStream(stationId);
    const metadata = await resolveMetadata(station, url);
    metadataCache.set(stationId, {
      value: metadata,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return Response.json(
      {
        streamTitle: metadata?.streamTitle ?? null,
        source: metadata?.source ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof StreamSecurityError ? error.status : 502;
    return Response.json(
      { streamTitle: null, error: "Metadata is unavailable." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

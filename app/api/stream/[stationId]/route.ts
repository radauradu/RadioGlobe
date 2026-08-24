import { icyNameForStation } from "@/lib/mediaSession";
import {
  encodeStreamResource,
  resolveStationStream,
  safeStreamFetch,
  StreamSecurityError,
} from "@/lib/streamSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ stationId: string }>;
}

function relayPath(stationId: string, resourceUrl: string) {
  return `/api/stream/${encodeURIComponent(stationId)}?resource=${encodeURIComponent(
    encodeStreamResource(resourceUrl),
  )}`;
}

function rewriteHlsPlaylist(
  playlist: string,
  baseUrl: string,
  stationId: string,
) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith("#")) {
        return relayPath(stationId, new URL(trimmed, baseUrl).toString());
      }

      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        const absolute = new URL(uri, baseUrl).toString();
        return `URI="${relayPath(stationId, absolute)}"`;
      });
    })
    .join("\n");
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { stationId } = await context.params;
    const resource = new URL(request.url).searchParams.get("resource");
    const { station, url } = await resolveStationStream(stationId, resource);
    const upstream = await safeStreamFetch(url, {
      signal: request.signal,
      headers: {
        Accept: "audio/*,application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
        "User-Agent": "RadioGlobe/1.0",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: `The station returned ${upstream.status}.` },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
    const isHls =
      contentType.includes("mpegurl") ||
      url.pathname.toLocaleLowerCase().endsWith(".m3u8");

    if (isHls) {
      const length = Number(upstream.headers.get("content-length") ?? 0);
      if (length > 2_000_000) {
        throw new StreamSecurityError("Playlist is too large.", 413);
      }
      const playlist = await upstream.text();
      return new Response(
        rewriteHlsPlaylist(playlist, upstream.url || url.toString(), stationId),
        {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "Icy-Name": icyNameForStation(station),
          },
        },
      );
    }

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Icy-Name": icyNameForStation(station),
      "Icy-Genre": "Live Radio",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

    return new Response(upstream.body, { headers });
  } catch (error) {
    const status = error instanceof StreamSecurityError ? error.status : 502;
    console.error("Stream relay error", error);
    return Response.json(
      {
        error:
          error instanceof StreamSecurityError
            ? error.message
            : "Unable to reach this station.",
      },
      { status },
    );
  }
}

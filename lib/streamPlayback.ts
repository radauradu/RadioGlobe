export const STALL_RECONNECT_MS = 2_500;
export const MAX_STALL_RECONNECTS = 12;
export const DIRECT_READY_TIMEOUT_MS = 20_000;
export const DIRECT_READY_SLOW_TIMEOUT_MS = 35_000;
export const MAX_DIRECT_ATTEMPTS_BEFORE_RELAY = 2;
/** Re-open the Vercel relay before the 300s function limit. */
export const RELAY_ROTATE_MS = 4 * 60 * 1000;

export function canReconnectLiveStream({
  wantsPlayback,
  hasStarted,
  reconnectAttempts,
}: {
  wantsPlayback: boolean;
  hasStarted: boolean;
  reconnectAttempts: number;
}) {
  return (
    wantsPlayback &&
    hasStarted &&
    reconnectAttempts < MAX_STALL_RECONNECTS
  );
}

export function directPlaybackUrl(
  streamUrl: string,
  pageProtocol = "https:",
) {
  try {
    const url = new URL(streamUrl);
    if (url.protocol === "http:" && pageProtocol === "https:") {
      url.protocol = "https:";
    }
    if (
      url.hostname.includes("streamtheworld.com") &&
      url.pathname.endsWith("_SC")
    ) {
      url.pathname = `${url.pathname.slice(0, -3)}.aac`;
    }
    return url.toString();
  } catch {
    return streamUrl;
  }
}

export function relayPlaybackUrl(stationId: string, session = Date.now()) {
  return `/api/stream/${encodeURIComponent(stationId)}?session=${session}`;
}

export function isRelayPlaybackUrl(url: string) {
  try {
    const parsed = new URL(url, "https://example.com");
    return parsed.pathname.startsWith("/api/stream/");
  } catch {
    return url.includes("/api/stream/");
  }
}

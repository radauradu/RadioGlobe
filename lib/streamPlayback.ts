export const STALL_RECONNECT_MS = 2_500;
export const MAX_STALL_RECONNECTS = 12;

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
    return url.toString();
  } catch {
    return streamUrl;
  }
}

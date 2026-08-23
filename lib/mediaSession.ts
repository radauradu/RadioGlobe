import type { RadioStation } from "@/lib/radioApi";
import { formatStationPlace } from "@/lib/place";
import { parseNowPlaying } from "@/lib/text";

function artworkForStation(station: RadioStation) {
  if (!station.favicon?.trim()) return [];
  try {
    const src = new URL(station.favicon, window.location.href).href;
    return [{ src, sizes: "512x512", type: "image/png" }];
  } catch {
    return [];
  }
}

export function mediaMetadataForStation(
  station: RadioStation,
  streamTitle: string | null,
) {
  const place = formatStationPlace(station);
  const { artist, song } = parseNowPlaying(streamTitle);
  const nowPlaying =
    song && artist ? `${artist} — ${song}` : song ?? artist ?? null;

  return new MediaMetadata({
    title: station.name,
    artist: nowPlaying ?? place.line,
    album: "Radio Globe",
    artwork: artworkForStation(station),
  });
}

export function syncNowPlayingMetadata(
  station: RadioStation | null,
  streamTitle: string | null,
) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }

  if (!station) {
    navigator.mediaSession.metadata = null;
    return;
  }

  navigator.mediaSession.metadata = null;
  navigator.mediaSession.metadata = mediaMetadataForStation(station, streamTitle);
}

export function syncMediaSessionPlaybackState(
  status: "playing" | "paused",
) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }
  navigator.mediaSession.playbackState = status;
}

export function configurePlatformAudioSession() {
  if (typeof navigator === "undefined") return;

  const audioSession = (
    navigator as Navigator & {
      audioSession?: { type: string };
    }
  ).audioSession;

  if (audioSession) {
    try {
      audioSession.type = "playback";
    } catch {
      // Safari versions without playback type support.
    }
  }
}

export function useDirectAudioOutput() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS;
}

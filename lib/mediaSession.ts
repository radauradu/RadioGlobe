import type { RadioStation } from "@/lib/radioApi";
import { APP_NAME } from "@/lib/brand";
import { formatStationPlace } from "@/lib/place";
import { parseNowPlaying } from "@/lib/text";

const SAME_ORIGIN_ARTWORK = [
  { src: "/apple-icon", sizes: "180x180", type: "image/png" },
];

function headerSafeName(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120);
}

export function icyNameForStation(station: RadioStation) {
  return headerSafeName(station.name) || APP_NAME;
}

export function mediaMetadataForStation(
  station: RadioStation,
  streamTitle: string | null,
) {
  const place = formatStationPlace(station);
  const { artist, song } = parseNowPlaying(streamTitle);

  return new MediaMetadata({
    title: song ?? station.name,
    artist: artist ?? (song ? station.name : place.line),
    album: station.name,
    artwork: SAME_ORIGIN_ARTWORK,
  });
}

export function syncNowPlayingMetadata(
  station: RadioStation | null,
  streamTitle: string | null,
  audio?: HTMLAudioElement | null,
) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }

  if (!station) {
    navigator.mediaSession.metadata = null;
    if (typeof document !== "undefined") {
      document.title = APP_NAME;
    }
    return;
  }

  if (audio) {
    audio.title = station.name;
    audio.setAttribute("title", station.name);
  }

  if (typeof document !== "undefined") {
    document.title = `${station.name} · ${APP_NAME}`;
  }

  // Never clear metadata first. iOS keeps the previous Now Playing item
  // if the next MediaMetadata fails (common with remote favicon artwork).
  navigator.mediaSession.metadata = mediaMetadataForStation(
    station,
    streamTitle,
  );
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
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { RadioStation } from "@/lib/radioApi";
import { formatStationPlace } from "@/lib/place";
import { parseNowPlaying } from "@/lib/text";

interface UseMediaSessionOptions {
  player: ReturnType<typeof useAudioPlayer>;
  station: RadioStation | null;
  onRandomize: () => void;
  onPlayPrevious: () => void;
}

function artworkForStation(station: RadioStation) {
  if (!station.favicon?.trim()) return [];
  try {
    const src = new URL(station.favicon, window.location.href).href;
    return [{ src, sizes: "512x512", type: "image/png" }];
  } catch {
    return [];
  }
}

function mediaMetadataForStation(
  station: RadioStation,
  streamTitle: string | null,
) {
  const place = formatStationPlace(station);
  const { artist, song } = parseNowPlaying(streamTitle);
  const nowPlaying =
    song && artist
      ? `${artist} — ${song}`
      : song ?? artist ?? null;

  return new MediaMetadata({
    title: station.name,
    artist: nowPlaying ?? place.line,
    album: "Radio Globe",
    artwork: artworkForStation(station),
  });
}

export function useMediaSession({
  player,
  station,
  onRandomize,
  onPlayPrevious,
}: UseMediaSessionOptions) {
  const { status, pausePlayback, resumePlayback, streamTitle } = player;

  const pausePlaybackRef = useRef(pausePlayback);
  const resumePlaybackRef = useRef(resumePlayback);
  const onRandomizeRef = useRef(onRandomize);
  const onPlayPreviousRef = useRef(onPlayPrevious);

  useEffect(() => {
    pausePlaybackRef.current = pausePlayback;
    resumePlaybackRef.current = resumePlayback;
    onRandomizeRef.current = onRandomize;
    onPlayPreviousRef.current = onPlayPrevious;
  }, [pausePlayback, resumePlayback, onRandomize, onPlayPrevious]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const mediaSession = navigator.mediaSession;

    mediaSession.setActionHandler("play", () => {
      void resumePlaybackRef.current();
    });
    mediaSession.setActionHandler("pause", () => {
      pausePlaybackRef.current();
    });
    mediaSession.setActionHandler("nexttrack", () => {
      onRandomizeRef.current();
    });
    mediaSession.setActionHandler("previoustrack", () => {
      onPlayPreviousRef.current();
    });

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("nexttrack", null);
      mediaSession.setActionHandler("previoustrack", null);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState =
      status === "playing" ? "playing" : "paused";
  }, [status]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    if (!station) {
      navigator.mediaSession.metadata = null;
      return;
    }

    // iOS only refreshes Now Playing when metadata is cleared first.
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.metadata = mediaMetadataForStation(station, streamTitle);
  }, [station?.id, station?.name, station?.favicon, streamTitle]);
}

"use client";

import { useEffect } from "react";
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

export function useMediaSession({
  player,
  station,
  onRandomize,
  onPlayPrevious,
}: UseMediaSessionOptions) {
  const { status, isPlaying, streamTitle, togglePlayback } = player;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const mediaSession = navigator.mediaSession;

    const handlePlay = () => {
      if (!isPlaying) void togglePlayback();
    };
    const handlePause = () => {
      if (isPlaying) void togglePlayback();
    };

    mediaSession.setActionHandler("play", handlePlay);
    mediaSession.setActionHandler("pause", handlePause);
    mediaSession.setActionHandler("nexttrack", onRandomize);
    mediaSession.setActionHandler("previoustrack", onPlayPrevious);

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("nexttrack", null);
      mediaSession.setActionHandler("previoustrack", null);
    };
  }, [isPlaying, onPlayPrevious, onRandomize, togglePlayback]);

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

    const { artist, song } = parseNowPlaying(streamTitle);
    const place = formatStationPlace(station);
    const artwork = station.favicon
      ? [
          {
            src: station.favicon,
            sizes: "512x512",
            type: "image/png",
          },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song ?? station.name,
      artist: artist ?? place.line,
      album: "Radio Globe",
      artwork,
    });
  }, [station, streamTitle]);
}

"use client";

import { useEffect, useRef } from "react";
import type { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { RadioStation } from "@/lib/radioApi";
import {
  syncMediaSessionPlaybackState,
  syncNowPlayingMetadata,
  useDirectAudioOutput,
} from "@/lib/mediaSession";

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

    const handlePlay = () => {
      void resumePlaybackRef.current();
    };
    const handlePause = () => {
      pausePlaybackRef.current();
    };

    try {
      mediaSession.setActionHandler("play", handlePlay);
      mediaSession.setActionHandler("pause", handlePause);
      mediaSession.setActionHandler("nexttrack", () => {
        onRandomizeRef.current();
      });
      mediaSession.setActionHandler("previoustrack", () => {
        onPlayPreviousRef.current();
      });
    } catch {
      // Some Safari versions reject optional handlers.
    }

    return () => {
      try {
        mediaSession.setActionHandler("play", null);
        mediaSession.setActionHandler("pause", null);
        mediaSession.setActionHandler("nexttrack", null);
        mediaSession.setActionHandler("previoustrack", null);
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, []);

  useEffect(() => {
    syncMediaSessionPlaybackState(status === "playing" ? "playing" : "paused");
  }, [status]);

  useEffect(() => {
    syncNowPlayingMetadata(station, streamTitle);
  }, [station?.id, station?.name, station?.favicon, streamTitle]);

  useEffect(() => {
    if (!useDirectAudioOutput() || !station || status !== "playing") return;

    const interval = window.setInterval(() => {
      syncNowPlayingMetadata(station, streamTitle);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [station, streamTitle, status]);
}

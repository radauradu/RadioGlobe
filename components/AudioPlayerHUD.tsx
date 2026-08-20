"use client";

import { Heart, Pause, Play, Share2, Shuffle, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import LiquidGlass from "@/components/LiquidGlass";
import MarqueeText from "@/components/MarqueeText";
import StationArt from "@/components/StationArt";
import type { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { shareStationLink } from "@/lib/shareStation";
import { parseNowPlaying } from "@/lib/text";

interface AudioPlayerHUDProps {
  player: ReturnType<typeof useAudioPlayer>;
  onRandomize: () => void;
  canRandomize: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
}

export default function AudioPlayerHUD({
  player,
  onRandomize,
  canRandomize,
  isFavorite = false,
  onToggleFavorite,
}: AudioPlayerHUDProps) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const {
    station,
    status,
    isPlaying,
    awaitingUnmute,
    volume,
    muted,
    streamTitle,
    error,
    togglePlayback,
    setVolume,
    toggleMute,
  } = player;

  const { artist, song } = parseNowPlaying(streamTitle);
  const statusLine =
    error ??
    (awaitingUnmute ? "Tap anywhere for sound" : null) ??
    (status === "loading" ? "Connecting…" : null) ??
    (station && status === "paused" ? "Paused" : null);
  const title = song ?? statusLine ?? "Turn the globe to find a station";
  const subtitle = artist ?? (statusLine && song ? statusLine : null);

  async function handleShare() {
    if (!station) return;
    const result = await shareStationLink(station.id, station.name);
    if (result === "copied") {
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    }
  }

  return (
    <LiquidGlass className="player-shell w-full" pill bezel={14}>
      <div className="player-hud" aria-label="Now playing">
        <button
          type="button"
          className="play"
          onClick={() => void togglePlayback()}
          disabled={!station}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="play-icon" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play
              className="play-icon play-icon-off"
              fill="currentColor"
              strokeWidth={0}
            />
          )}
        </button>

        {station ? (
          <StationArt
            favicon={station.favicon}
            name={station.name}
            className="player-art"
          />
        ) : null}

        <div className="player-copy">
          <MarqueeText
            text={title}
            className="player-title"
            scrollAfter={28}
          />
          <MarqueeText
            text={subtitle ?? "\u00a0"}
            className="player-artist"
            scrollAfter={32}
          />
          <MarqueeText
            text={station?.name ?? "No station"}
            className="player-station"
            scrollAfter={34}
          />
        </div>

        <div className="player-controls">
          {station ? (
            <button
              type="button"
              className="control-icon control player-share"
              onClick={() => void handleShare()}
              aria-label={
                shareState === "copied" ? "Link copied" : "Share station"
              }
            >
              <Share2 className="control-glyph" strokeWidth={1.75} />
            </button>
          ) : null}

          {onToggleFavorite ? (
            <button
              type="button"
              className={`control-icon control ${isFavorite ? "control-icon-favorite" : ""}`}
              onClick={() => station && onToggleFavorite(station.id)}
              disabled={!station}
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
              aria-pressed={isFavorite}
            >
              <Heart
                className={`control-glyph ${
                  isFavorite ? "fill-current text-[#ff6b6b]" : ""
                }`}
                strokeWidth={1.75}
              />
            </button>
          ) : null}

          <button
            type="button"
            className="control-icon control player-shuffle"
            onClick={onRandomize}
            disabled={!canRandomize}
            aria-label="Play a random station"
          >
            <Shuffle className="control-glyph" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="control-icon control"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <VolumeX className="control-glyph" strokeWidth={1.75} />
            ) : (
              <Volume2 className="control-glyph" strokeWidth={1.75} />
            )}
          </button>

          <input
            className="slider player-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
      </div>
    </LiquidGlass>
  );
}

"use client";

import {
  ChevronUp,
  Heart,
  LocateFixed,
  Pause,
  Play,
  Share2,
  Shuffle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from "react";
import LiquidGlass from "@/components/LiquidGlass";
import MarqueeText from "@/components/MarqueeText";
import StationArt from "@/components/StationArt";
import StationDetailsBody from "@/components/StationDetailsBody";
import type { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { shareStationLink } from "@/lib/shareStation";
import { parseNowPlaying } from "@/lib/text";

const GLASS_BEZEL = 14;
const INFO_RADIUS = 34;

interface AudioPlayerHUDProps {
  player: ReturnType<typeof useAudioPlayer>;
  onRandomize: () => void;
  canRandomize: boolean;
  onNearMe?: () => void;
  statusOverride?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
}

export default function AudioPlayerHUD({
  player,
  onRandomize,
  canRandomize,
  onNearMe,
  statusOverride = null,
  isFavorite = false,
  onToggleFavorite,
}: AudioPlayerHUDProps) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [expanded, setExpanded] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const {
    station,
    status,
    isPlaying,
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
    statusOverride ??
    error ??
    (status === "loading" ? "Connecting…" : null) ??
    (station && status === "paused" ? "Paused" : null);
  const title =
    song ??
    statusLine ??
    (station
      ? "No artist and song info are available"
      : "Turn the globe to find a station");
  const subtitle = artist ?? (statusLine && song ? statusLine : null);

  useEffect(() => {
    setExpanded(false);
    setPanelMounted(false);
    closingRef.current = false;
  }, [station?.id]);

  useEffect(() => {
    if (!expanded) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!panelMounted || !node) {
      setPanelHeight(0);
      return;
    }
    setPanelHeight(node.offsetHeight);
  }, [panelMounted, station?.id]);

  useEffect(() => {
    if (!panelMounted || panelHeight === 0 || expanded) return;
    if (closingRef.current) return;
    const frame = window.requestAnimationFrame(() => setExpanded(true));
    return () => window.cancelAnimationFrame(frame);
  }, [panelMounted, panelHeight, expanded]);

  useEffect(() => {
    if (expanded || !panelMounted || !closingRef.current) return;
    const timeout = window.setTimeout(() => {
      setPanelMounted(false);
      closingRef.current = false;
    }, 520);
    return () => window.clearTimeout(timeout);
  }, [expanded, panelMounted]);

  async function handleShare() {
    if (!station) return;
    const result = await shareStationLink(station.id, station.name);
    if (result === "copied") {
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    }
  }

  function closePanel() {
    closingRef.current = true;
    setExpanded(false);
  }

  function toggleExpanded() {
    if (!station) return;
    if (expanded || panelMounted) {
      closePanel();
      return;
    }
    closingRef.current = false;
    setPanelMounted(true);
  }

  function handlePanelTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "height") return;
    if (!expanded) setPanelMounted(false);
  }

  return (
    <div className="player-stack">
      {panelMounted && station ? (
        <div
          className="player-details"
          style={{ height: expanded ? panelHeight : 0 }}
          onTransitionEnd={handlePanelTransitionEnd}
        >
          <div className="player-details-anchor" ref={panelRef}>
            <LiquidGlass
              className="player-details-shell"
              radius={INFO_RADIUS}
              bezel={GLASS_BEZEL}
              aria-label="Station details"
            >
              <div className="player-details-body">
                <StationDetailsBody
                  station={station}
                  isPlaying={isPlaying}
                  isFavorite={isFavorite}
                  onToggleFavorite={onToggleFavorite}
                  surface="glass"
                  hideQuickActions
                  streamTitle={song ?? null}
                  streamSubtitle={artist ?? null}
                />
                <div className="player-details-actions">
                  <button
                    type="button"
                    className="control-icon control player-shuffle"
                    onClick={onRandomize}
                    disabled={!canRandomize}
                    aria-label="Play a random station"
                  >
                    <Shuffle className="control-glyph" strokeWidth={1.75} />
                  </button>

                  {onNearMe ? (
                    <button
                      type="button"
                      className="control-icon control player-near-me"
                      onClick={onNearMe}
                      aria-label="Tune nearest station to my location"
                    >
                      <LocateFixed className="control-glyph" strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              </div>
            </LiquidGlass>
          </div>
        </div>
      ) : null}

      <LiquidGlass
        className="player-shell w-full"
        pill
        bezel={GLASS_BEZEL}
        aria-label="Now playing"
      >
        <div className="player-hud">
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

          <button
            type="button"
            className="player-tap-target"
            onClick={toggleExpanded}
            disabled={!station}
            aria-expanded={expanded}
            aria-label={
              expanded ? "Hide station details" : "Show station details"
            }
          >
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

            {station ? (
              <ChevronUp
                className={`player-expand-chevron ${expanded ? "player-expand-chevron-open" : ""}`}
                strokeWidth={1.75}
              />
            ) : null}
          </button>

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
    </div>
  );
}

"use client";

import { ChevronRight, Heart, Share } from "lucide-react";
import StationArt from "@/components/StationArt";
import { useClock } from "@/hooks/useClock";
import type { RadioStation } from "@/lib/radioApi";
import { formatStationPlace } from "@/lib/place";
import { shareStationLink } from "@/lib/shareStation";
import { formatStationTime } from "@/lib/time";

interface StationDetailsBodyProps {
  station: RadioStation;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
  surface?: "panel" | "glass";
  hideQuickActions?: boolean;
  streamTitle?: string | null;
  streamSubtitle?: string | null;
}

function safeWebsite(homepage: string) {
  if (!homepage) return null;
  try {
    const value = homepage.trim();
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
    );
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export default function StationDetailsBody({
  station,
  isPlaying = false,
  isFavorite = false,
  onToggleFavorite,
  surface = "panel",
  hideQuickActions = false,
  streamTitle = null,
  streamSubtitle = null,
}: StationDetailsBodyProps) {
  const now = useClock();
  const website = safeWebsite(station.homepage);
  const place = formatStationPlace(station);
  const location = station.approximate ? `Near ${place.line}` : place.line;
  const audio = [station.codec, station.bitrate ? `${station.bitrate} kbps` : null]
    .filter(Boolean)
    .join(" · ");
  const localTime = now ? formatStationTime(station.timezone, now) : "--:--";
  const hasTrack = Boolean(streamTitle || streamSubtitle);

  if (surface === "glass") {
    return (
      <div className="details-body details-surface-glass details-player-card">
        <div className="details-player-hero">
          <StationArt
            favicon={station.favicon}
            name={station.name}
            className="details-player-art"
          />
        </div>

        <div className="details-player-copy">
          {hasTrack ? (
            <>
              {streamTitle ? (
                <p className="details-player-track truncate">{streamTitle}</p>
              ) : null}
              {streamSubtitle ? (
                <p className="details-player-artist truncate">{streamSubtitle}</p>
              ) : null}
              <p className="details-player-station truncate">{station.name}</p>
            </>
          ) : (
            <h2 className="details-player-station details-player-station-primary truncate">
              {station.name}
            </h2>
          )}
          <p className="details-player-place truncate">{location}</p>
        </div>

        <div className="details-player-meta">
          {isPlaying ? (
            <div className="details-player-live-wrap">
              <span className="apple-live-pill details-player-live">Live</span>
            </div>
          ) : null}

          <div className="apple-inset-group details-inset-group details-player-inset">
          <div className="apple-info-row">
            <span className="apple-info-label">Local Time</span>
            <span className="apple-info-value apple-tabular">{localTime}</span>
          </div>
          {audio ? (
            <div className="apple-info-row">
              <span className="apple-info-label">Audio</span>
              <span className="apple-info-value">{audio}</span>
            </div>
          ) : null}
        </div>
        </div>

        {website ? (
          <div className="apple-inset-group details-inset-group details-player-inset">
            <a
              href={website.href}
              target="_blank"
              rel="noopener noreferrer"
              className="apple-link-row"
            >
              <span className="apple-info-label">Website</span>
              <span className="apple-link-detail">
                <span className="truncate">
                  {website.hostname.replace(/^www\./, "")}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 opacity-45"
                  strokeWidth={2}
                />
              </span>
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="details-body details-surface-panel">
      <div className="details-header">
        <StationArt
          favicon={station.favicon}
          name={station.name}
          className="details-art"
        />
        <div className="details-header-copy">
          <div className="details-header-title-row">
            <h2 className="details-headline truncate">{station.name}</h2>
            <div className="details-header-actions">
              {!hideQuickActions ? (
                <button
                  type="button"
                  className="apple-icon-btn"
                  onClick={() => void shareStationLink(station.id, station.name)}
                  aria-label="Share station"
                >
                  <Share
                    className="h-[18px] w-[18px] text-[#86868b] details-glass-icon"
                    strokeWidth={1.75}
                  />
                </button>
              ) : null}
              {!hideQuickActions && onToggleFavorite ? (
                <button
                  type="button"
                  className="apple-icon-btn"
                  onClick={() => onToggleFavorite(station.id)}
                  aria-label={
                    isFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                  aria-pressed={isFavorite}
                >
                  <Heart
                    className={`h-[18px] w-[18px] details-glass-icon ${
                      isFavorite
                        ? "fill-[#ff3b30] text-[#ff3b30]"
                        : "text-[#86868b]"
                    }`}
                    strokeWidth={1.75}
                  />
                </button>
              ) : null}
              {isPlaying ? <span className="apple-live-pill">Live</span> : null}
            </div>
          </div>
          <p className="details-subheadline truncate">{location}</p>
        </div>
      </div>

      <div className="apple-inset-group mt-3 details-inset-group">
        <div className="apple-info-row">
          <span className="apple-info-label">Local Time</span>
          <span className="apple-info-value apple-tabular">{localTime}</span>
        </div>
        {audio ? (
          <div className="apple-info-row">
            <span className="apple-info-label">Audio</span>
            <span className="apple-info-value">{audio}</span>
          </div>
        ) : null}
      </div>

      {website ? (
        <div className="apple-inset-group mt-2 details-inset-group">
          <a
            href={website.href}
            target="_blank"
            rel="noopener noreferrer"
            className="apple-link-row"
          >
            <span className="apple-info-label">Website</span>
            <span className="apple-link-detail">
              <span className="truncate">
                {website.hostname.replace(/^www\./, "")}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 opacity-45"
                strokeWidth={2}
              />
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { ChevronRight, Heart, Share2 } from "lucide-react";
import ApplePanel from "@/components/ApplePanel";
import StationArt from "@/components/StationArt";
import { useClock } from "@/hooks/useClock";
import type { RadioStation } from "@/lib/radioApi";
import { formatStationPlace } from "@/lib/place";
import { shareStationLink } from "@/lib/shareStation";
import { formatStationTime } from "@/lib/time";

interface SelectedStationCardProps {
  station: RadioStation | null;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
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

export default function SelectedStationCard({
  station,
  isPlaying = false,
  isFavorite = false,
  onToggleFavorite,
}: SelectedStationCardProps) {
  const now = useClock();
  if (!station) return null;

  const website = safeWebsite(station.homepage);
  const place = formatStationPlace(station);
  const location = station.approximate
    ? `Near ${place.line}`
    : place.line;
  const audio = [
    station.codec,
    station.bitrate ? `${station.bitrate} kbps` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const localTime = now ? formatStationTime(station.timezone, now) : "--:--";

  return (
    <ApplePanel className="details-card" aria-label="Station details">
      <div className="details-body">
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
                <button
                  type="button"
                  className="apple-icon-btn"
                  onClick={() => void shareStationLink(station.id, station.name)}
                  aria-label="Share station"
                >
                  <Share2
                    className="h-[18px] w-[18px] text-[#86868b]"
                    strokeWidth={1.75}
                  />
                </button>
                {onToggleFavorite ? (
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
                      className={`h-[18px] w-[18px] ${
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

        <div className="apple-inset-group mt-3">
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
          <div className="apple-inset-group mt-2">
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
                <ChevronRight className="h-4 w-4 shrink-0 opacity-45" strokeWidth={2} />
              </span>
            </a>
          </div>
        ) : null}
      </div>
    </ApplePanel>
  );
}

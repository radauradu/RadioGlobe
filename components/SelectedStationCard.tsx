"use client";

import ApplePanel from "@/components/ApplePanel";
import StationDetailsBody from "@/components/StationDetailsBody";
import type { RadioStation } from "@/lib/radioApi";

interface SelectedStationCardProps {
  station: RadioStation | null;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
}

export default function SelectedStationCard({
  station,
  isPlaying = false,
  isFavorite = false,
  onToggleFavorite,
}: SelectedStationCardProps) {
  if (!station) return null;

  return (
    <ApplePanel className="details-card" aria-label="Station details">
      <StationDetailsBody
        station={station}
        isPlaying={isPlaying}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        surface="panel"
      />
    </ApplePanel>
  );
}

"use client";

interface CrosshairOverlayProps {
  isScanning: boolean;
  isPlaying?: boolean;
}

type CrosshairMode = "idle" | "scanning" | "playing";

function crosshairMode(isScanning: boolean, isPlaying: boolean): CrosshairMode {
  if (isScanning) return "scanning";
  if (isPlaying) return "playing";
  return "idle";
}

export default function CrosshairOverlay({
  isScanning,
  isPlaying = false,
}: CrosshairOverlayProps) {
  const mode = crosshairMode(isScanning, isPlaying);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <div className="crosshair-frame" data-mode={mode}>
        <div className="crosshair-scan-arc" aria-hidden />
        <div className="crosshair-ring" aria-hidden />
        <span className="crosshair-axis crosshair-axis-h" aria-hidden />
        <span className="crosshair-axis crosshair-axis-v" aria-hidden />
        <span className="crosshair-dot" aria-hidden />
        <span className="sr-only">
          {mode === "scanning"
            ? "Searching for a station"
            : mode === "playing"
              ? "Station is playing"
              : "Aim the globe to tune a station"}
        </span>
      </div>
    </div>
  );
}

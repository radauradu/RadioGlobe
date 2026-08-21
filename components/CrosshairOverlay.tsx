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
      <div className={`reticle reticle--${mode}`} aria-hidden>
        <span className="reticle-ring" />
        <span className="reticle-tick reticle-tick-n" />
        <span className="reticle-tick reticle-tick-e" />
        <span className="reticle-tick reticle-tick-s" />
        <span className="reticle-tick reticle-tick-w" />
        <span className="reticle-dot" />
      </div>
      <span className="sr-only">
        {mode === "scanning"
          ? "Searching for a station"
          : mode === "playing"
            ? "Station is playing"
            : "Aim the globe to tune a station"}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";

interface StationArtProps {
  favicon: string;
  name: string;
  className?: string;
}

export default function StationArt({
  favicon,
  name,
  className = "",
}: StationArtProps) {
  const [hidden, setHidden] = useState(false);
  const showImage = Boolean(favicon) && !hidden;

  return (
    <div
      className={`station-art ${className}`.trim()}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <img
          src={favicon}
          alt=""
          className="station-art-image"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setHidden(true)}
        />
      ) : (
        <span className="station-art-fallback">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

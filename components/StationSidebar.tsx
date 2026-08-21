"use client";

import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import ApplePanel from "@/components/ApplePanel";
import StationArt from "@/components/StationArt";
import { formatStationPlace } from "@/lib/place";
import type { RadioStation } from "@/lib/radioApi";
import { shareStationLink } from "@/lib/shareStation";

export type StationListMode = "browse" | "recent" | "favorites";

const COMPACT_QUERY = "(max-width: 767px)";

function isCompactViewport() {
  return (
    typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches
  );
}

interface StationSidebarProps {
  stations: RadioStation[];
  totalOnGlobe: number;
  selectedStation: RadioStation | null;
  onSelectStation: (station: RadioStation) => void;
  query: string;
  onQueryChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  genre: string;
  onGenreChange: (value: string) => void;
  countries: string[];
  genres: string[];
  listMode: StationListMode;
  onListModeChange: (mode: StationListMode) => void;
  favoriteCount: number;
  recentCount: number;
  isSelectedFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
}

export default function StationSidebar({
  stations,
  totalOnGlobe,
  selectedStation,
  onSelectStation,
  query,
  onQueryChange,
  country,
  onCountryChange,
  genre,
  onGenreChange,
  countries,
  genres,
  listMode,
  onListModeChange,
  favoriteCount,
  recentCount,
  isSelectedFavorite = false,
  onToggleFavorite,
}: StationSidebarProps) {
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showingFavorites = listMode === "favorites";
  const showingRecent = listMode === "recent";

  useEffect(() => {
    if (query.trim()) setListOpen(true);
  }, [query]);

  useEffect(() => {
    if (showingFavorites || showingRecent) setListOpen(true);
  }, [showingFavorites, showingRecent]);

  const featuredCount = stations.length;
  const globeTotal = Math.max(totalOnGlobe, featuredCount);
  const showingFeatured = featuredCount > 0 && featuredCount < globeTotal;
  const isBrowsingFeatured =
    !query.trim() && country === "all" && genre === "all";

  function closeMenu() {
    setMenuOpen(false);
  }

  function closeIfCompact() {
    if (isCompactViewport()) closeMenu();
  }

  function handleSelectStation(station: RadioStation) {
    onSelectStation(station);
    closeIfCompact();
  }

  async function handleShare() {
    if (!selectedStation) return;
    await shareStationLink(selectedStation.id, selectedStation.name);
  }

  const stationList = listOpen ? (
    <div className="apple-list sidebar-list">
      {stations.slice(0, 120).map((station) => {
        const selected = selectedStation?.id === station.id;
        const item = selected && selectedStation ? selectedStation : station;
        const place = formatStationPlace(item);
        return (
          <button
            type="button"
            key={station.id}
            onClick={() => handleSelectStation(station)}
            className={`apple-row ${selected ? "apple-row-active" : ""}`}
          >
            <StationArt
              favicon={item.favicon}
              name={item.name}
              className="sidebar-row-art"
            />
            <span className="min-w-0">
              <span className="apple-row-title">{item.name}</span>
              <span className="apple-row-subtitle">{place.line}</span>
            </span>
          </button>
        );
      })}
      {stations.length === 0 ? (
        <p className="sidebar-empty">
          {showingFavorites
            ? "No favorites yet. Tap the heart on a station to save it here. Saved stations appear in yellow on the globe."
            : showingRecent
              ? "No recent stations yet. Spin the globe to start exploring."
              : "No stations found"}
        </p>
      ) : showingFavorites ? (
        <p className="sidebar-footnote">
          Saved on this device. Favorites stay in this browser only and appear
          in yellow on the globe.
        </p>
      ) : showingRecent ? (
        <p className="sidebar-footnote">
          Recently played stations stay in this browser only.
        </p>
      ) : showingFeatured && isBrowsingFeatured ? (
        <p className="sidebar-footnote">
          Spin the globe or search to explore.
        </p>
      ) : null}
    </div>
  ) : null;

  const panelHeader = (
    <div className="sidebar-header">
      <p className="apple-title">Radio Globe</p>
      <button
        type="button"
        className="apple-icon-btn sidebar-close"
        onClick={closeMenu}
        aria-label="Close station menu"
      >
        <X className="sidebar-close-icon text-[#86868b]" strokeWidth={1.75} />
      </button>
    </div>
  );

  const browseControls = (
    <div className="sidebar-controls">
      <div className="field-wrap">
        <Search strokeWidth={1.75} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setListOpen(true)}
          placeholder="Search"
          className="apple-field apple-field-search"
        />
      </div>

      <div className="sidebar-filters">
        <select
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
          className="apple-field"
          aria-label="Country"
        >
          <option value="all">Country</option>
          {countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={genre}
          onChange={(event) => onGenreChange(event.target.value)}
          className="apple-field"
          aria-label="Genre"
        >
          <option value="all">Genre</option>
          {genres.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {selectedStation ? (
        <div className="apple-mobile-selected">
          <StationArt
            favicon={selectedStation.favicon}
            name={selectedStation.name}
            className="sidebar-selected-art"
          />
          <div className="min-w-0 flex-1">
            <p className="sidebar-selected-name truncate">
              {selectedStation.name}
            </p>
            <p className="sidebar-selected-place truncate">
              {formatStationPlace(selectedStation).line}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="apple-icon-btn"
              onClick={() => void handleShare()}
              aria-label="Share station"
            >
              <Share2
                className="h-[16px] w-[16px] text-[#86868b]"
                strokeWidth={1.75}
              />
            </button>
            {onToggleFavorite ? (
              <button
                type="button"
                className="apple-icon-btn"
                onClick={() => onToggleFavorite(selectedStation.id)}
                aria-label={
                  isSelectedFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                aria-pressed={isSelectedFavorite}
              >
                <Heart
                  className={`h-[16px] w-[16px] ${
                    isSelectedFavorite
                      ? "fill-[#ff3b30] text-[#ff3b30]"
                      : "text-[#86868b]"
                  }`}
                  strokeWidth={1.75}
                />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="apple-segment apple-segment-triple"
        role="tablist"
        aria-label="Station lists"
      >
        <button
          type="button"
          role="tab"
          aria-selected={listMode === "browse"}
          className={`apple-segment-btn ${listMode === "browse" ? "apple-segment-btn-active" : ""}`}
          onClick={() => onListModeChange("browse")}
        >
          Browse
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showingRecent}
          className={`apple-segment-btn ${showingRecent ? "apple-segment-btn-active" : ""}`}
          onClick={() => onListModeChange("recent")}
        >
          Recent{recentCount > 0 ? ` (${recentCount})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showingFavorites}
          className={`apple-segment-btn ${showingFavorites ? "apple-segment-btn-active" : ""}`}
          onClick={() => onListModeChange("favorites")}
        >
          Saved{favoriteCount > 0 ? ` (${favoriteCount})` : ""}
        </button>
      </div>

      <button
        type="button"
        className="apple-control apple-control-quiet sidebar-results-toggle"
        onClick={() => setListOpen((open) => !open)}
        aria-expanded={listOpen}
      >
        <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
          <span>
            {showingFavorites
              ? "Saved stations"
              : showingRecent
                ? "Recently played"
                : isBrowsingFeatured
                  ? "Featured stations"
                  : "Results"}
          </span>
          {showingRecent ? (
            <span className="sidebar-results-hint">
              Your listening trail on this device
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`sidebar-chevron ${listOpen ? "sidebar-chevron-open" : ""}`}
          strokeWidth={1.75}
        />
      </button>
    </div>
  );

  const panelBody = (
    <>
      {panelHeader}
      {browseControls}
      {stationList}
    </>
  );

  return (
    <div className="sidebar-root">
      <div className="sidebar-mobile-only sidebar-root-compact">
        <button
          type="button"
          className={`sidebar-fab ${menuOpen ? "sidebar-fab-hidden" : ""}`}
          onClick={() => setMenuOpen(true)}
          aria-label="Open station menu"
          aria-expanded={menuOpen}
          aria-controls="station-menu"
        >
          <Menu className="sidebar-fab-icon" strokeWidth={1.75} />
          {favoriteCount > 0 ? (
            <span className="sidebar-fab-badge">
              {favoriteCount > 9 ? "9+" : favoriteCount}
            </span>
          ) : null}
        </button>

        <ApplePanel
          id="station-menu"
          className={`sidebar-sheet ${menuOpen ? "sidebar-sheet-open" : ""}`}
          aria-label="Search stations"
        >
          {panelBody}
        </ApplePanel>
      </div>

      <div className="sidebar-desktop-only">
        <ApplePanel
          id="station-menu-desktop"
          className="sidebar-sheet sidebar-sheet-open"
          aria-label="Search stations"
        >
          {panelBody}
        </ApplePanel>
      </div>
    </div>
  );
}

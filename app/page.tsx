"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioPlayerHUD from "@/components/AudioPlayerHUD";
import CrosshairOverlay from "@/components/CrosshairOverlay";
import SelectedStationCard from "@/components/SelectedStationCard";
import StationSidebar, {
  type StationListMode,
} from "@/components/StationSidebar";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecentStations } from "@/hooks/useRecentStations";
import { useRadioStreams } from "@/hooks/useRadioStreams";
import { loadStationsByIds } from "@/lib/loadStationsByIds";
import type { RadioStation, StationPoint } from "@/lib/radioApi";
import {
  readStationIdFromSearch,
  syncStationInUrl,
} from "@/lib/shareUrl";
import { nearestStations, type Coordinates } from "@/lib/spatial";

const GlobeViewport = dynamic(() => import("@/components/GlobeViewport"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center">
      <div className="apple-panel flex items-center gap-2.5 px-4 py-3">
        <LoaderCircle className="h-4 w-4 animate-spin text-[#86868b]" />
        <span className="text-[15px] text-[#6e6e73]">Loading</span>
      </div>
    </div>
  ),
});

export default function Home() {
  const directory = useRadioStreams();
  const favorites = useFavorites();
  const recent = useRecentStations();
  const [selectedStation, setSelectedStation] =
    useState<RadioStation | null>(null);
  const [favoriteStations, setFavoriteStations] = useState<RadioStation[]>([]);
  const [recentStations, setRecentStations] = useState<RadioStation[]>([]);
  const [listMode, setListMode] = useState<StationListMode>("browse");
  const [isScanning, setIsScanning] = useState(false);
  const [failedStationIds, setFailedStationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const stationDetailsRef = useRef(new Map<string, RadioStation>());
  const selectedStationIdRef = useRef<string | null>(null);
  const selectionRequestRef = useRef(0);
  const deepLinkHandledRef = useRef(false);

  const onStationUnavailable = useCallback((station: RadioStation) => {
    setFailedStationIds((current) => new Set(current).add(station.id));
  }, []);
  const player = useAudioPlayer(onStationUnavailable);

  useEffect(() => {
    if (!favorites.ready) return;

    let cancelled = false;

    async function loadFavoriteStations() {
      const stations = await loadStationsByIds(
        favorites.ids,
        stationDetailsRef.current,
      );
      if (!cancelled) setFavoriteStations(stations);
    }

    void loadFavoriteStations();
    return () => {
      cancelled = true;
    };
  }, [favorites.ids, favorites.ready]);

  useEffect(() => {
    if (!recent.ready) return;

    let cancelled = false;

    async function loadRecentStations() {
      const stations = await loadStationsByIds(
        recent.ids,
        stationDetailsRef.current,
      );
      if (!cancelled) setRecentStations(stations);
    }

    void loadRecentStations();
    return () => {
      cancelled = true;
    };
  }, [recent.ids, recent.ready]);

  const sidebarStations =
    listMode === "favorites"
      ? favoriteStations
      : listMode === "recent"
        ? recentStations
        : directory.searchResults;

  const selectableStations = useMemo(
    () =>
      directory.stationPoints.filter(
        (station) =>
          station.id === selectedStation?.id ||
          !failedStationIds.has(station.id),
      ),
    [directory.stationPoints, failedStationIds, selectedStation?.id],
  );

  const trackRecent = recent.track;

  const selectStation = useCallback(
    (station: RadioStation, autoplay = true) => {
      stationDetailsRef.current.set(station.id, station);
      setSelectedStation(station);
      trackRecent(station.id);
      if (selectedStationIdRef.current === station.id) return;
      selectedStationIdRef.current = station.id;
      void player.tune(station, autoplay);
    },
    [player, trackRecent],
  );

  const selectPoint = useCallback(
    async (point: StationPoint, autoplay = true) => {
      const requestId = ++selectionRequestRef.current;
      const cached = stationDetailsRef.current.get(point.id);
      if (cached) {
        selectStation(cached, autoplay);
        return;
      }

      try {
        const response = await fetch(
          `/api/stations/${encodeURIComponent(point.id)}`,
        );
        if (!response.ok) throw new Error("Station details are unavailable.");
        const data = (await response.json()) as { station: RadioStation };
        stationDetailsRef.current.set(point.id, data.station);
        if (selectionRequestRef.current === requestId) {
          selectStation(data.station, autoplay);
        }
      } catch {
        setFailedStationIds((current) => new Set(current).add(point.id));
      }
    },
    [selectStation],
  );

  useEffect(() => {
    if (deepLinkHandledRef.current) return;

    const stationId = readStationIdFromSearch(window.location.search);
    if (!stationId) return;

    deepLinkHandledRef.current = true;
    void (async () => {
      const cached = stationDetailsRef.current.get(stationId);
      if (cached) {
        selectStation(cached, true);
        return;
      }

      try {
        const response = await fetch(
          `/api/stations/${encodeURIComponent(stationId)}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as { station: RadioStation };
        selectStation(data.station, true);
      } catch {
        // Ignore invalid share links.
      }
    })();
  }, [selectStation]);

  useEffect(() => {
    syncStationInUrl(selectedStation?.id ?? null);
  }, [selectedStation?.id]);

  const randomizeStation = useCallback(() => {
    const candidates =
      selectableStations.length > 1
        ? selectableStations.filter(
            (station) => station.id !== selectedStation?.id,
          )
        : selectableStations;
    if (candidates.length === 0) return;
    const randomStation =
      candidates[Math.floor(Math.random() * candidates.length)];
    void selectPoint(randomStation, true);
  }, [selectPoint, selectableStations, selectedStation?.id]);

  const handleCenterSettled = useCallback(
    async (coordinates: Coordinates, stationInCircle: StationPoint | null) => {
      try {
        const next =
          stationInCircle ??
          nearestStations(coordinates, selectableStations, 1)[0];
        if (!next) return;

        if (selectedStation?.id === next.id) return;

        await selectPoint(next, true);
      } finally {
        setIsScanning(false);
      }
    },
    [selectPoint, selectableStations, selectedStation?.id],
  );

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-black">
      <div className="space-backdrop" aria-hidden />
      <GlobeViewport
        stations={selectableStations}
        selectedStation={selectedStation}
        favoriteStationIds={favorites.ids}
        isPlaying={player.isPlaying}
        onSelectStation={(station) => void selectPoint(station, true)}
        onCenterSettled={handleCenterSettled}
        onInteraction={() => setIsScanning(true)}
        onNavigationSettled={({ awaitingCenterResolve } = {}) => {
          if (!awaitingCenterResolve) setIsScanning(false);
        }}
      />

      <CrosshairOverlay
        isScanning={isScanning}
        isPlaying={player.isPlaying}
      />

      <div className="pointer-events-none hud-overlay">
        <div className="hud-top">
          <div className="pointer-events-auto max-h-full min-w-0">
            <StationSidebar
              stations={sidebarStations}
              totalOnGlobe={directory.stationPoints.length}
              selectedStation={selectedStation}
              onSelectStation={(station) => selectStation(station, true)}
              query={directory.query}
              onQueryChange={directory.setQuery}
              country={directory.country}
              onCountryChange={directory.setCountry}
              genre={directory.genre}
              onGenreChange={directory.setGenre}
              language={directory.language}
              onLanguageChange={directory.setLanguage}
              countries={directory.countries}
              genres={directory.genres}
              languages={directory.languages}
              listMode={listMode}
              onListModeChange={setListMode}
              favoriteCount={favorites.ids.length}
              recentCount={recent.ids.length}
              isSelectedFavorite={
                selectedStation
                  ? favorites.isFavorite(selectedStation.id)
                  : false
              }
              onToggleFavorite={(stationId) => {
                favorites.toggle(stationId);
              }}
            />
          </div>
          <div className="pointer-events-auto hud-details max-h-full">
            <SelectedStationCard
              station={selectedStation}
              isPlaying={player.isPlaying}
              isFavorite={
                selectedStation
                  ? favorites.isFavorite(selectedStation.id)
                  : false
              }
              onToggleFavorite={(stationId) => {
                favorites.toggle(stationId);
              }}
            />
          </div>
        </div>

        <div className="hud-bottom">
          {directory.error ? (
            <p className="apple-panel apple-banner pointer-events-auto px-4 py-2.5 text-center text-[14px] text-[#ff3b30]">
              {directory.error}
            </p>
          ) : null}
          <div className="pointer-events-auto">
            <AudioPlayerHUD
              player={player}
              onRandomize={randomizeStation}
              canRandomize={selectableStations.length > 0}
              isFavorite={
                selectedStation
                  ? favorites.isFavorite(selectedStation.id)
                  : false
              }
              onToggleFavorite={(stationId) => {
                favorites.toggle(stationId);
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

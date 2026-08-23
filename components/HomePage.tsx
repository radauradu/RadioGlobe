"use client";

import dynamic from "next/dynamic";
import { LocateFixed, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioPlayerHUD from "@/components/AudioPlayerHUD";
import CrosshairOverlay from "@/components/CrosshairOverlay";
import PwaRegister from "@/components/PwaRegister";
import StationSidebar, {
  type StationListMode,
} from "@/components/StationSidebar";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecentStations } from "@/hooks/useRecentStations";
import { useRadioStreams } from "@/hooks/useRadioStreams";
import { loadStationsByIds } from "@/lib/loadStationsByIds";
import type { RadioStation, StationPoint } from "@/lib/radioApi";
import {
  readStationIdFromSearch,
  syncStationInUrl,
} from "@/lib/shareUrl";
import { AUTO_SKIP_CAP, nextWorkingStation } from "@/lib/skipStation";
import { nearestStations, type Coordinates } from "@/lib/spatial";

function stationsWithCoordinates(stations: StationPoint[]) {
  return stations.filter(
    (station) =>
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lng) &&
      !(Math.abs(station.lat) < 0.2 && Math.abs(station.lng) < 0.2),
  );
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was denied. Enable it in Settings, then try again.";
  }
  if (error.code === error.TIMEOUT) {
    return "Could not get your location. Try again.";
  }
  return "Location is unavailable on this device.";
}

interface FocusRequest extends Coordinates {
  nonce: number;
}

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

export default function HomePage() {
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
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const stationDetailsRef = useRef(new Map<string, RadioStation>());
  const selectedStationIdRef = useRef<string | null>(null);
  const selectionRequestRef = useRef(0);
  const deepLinkHandledRef = useRef(false);
  const initialAutoplayRef = useRef(false);
  const autoplayAttemptsRef = useRef(0);
  const everPlayedRef = useRef(false);
  const autoSkipCountRef = useRef(0);
  const nearMePendingRef = useRef(false);
  const pendingNearMeCoordinatesRef = useRef<Coordinates | null>(null);
  const failedStationIdsRef = useRef(failedStationIds);
  const selectableStationsRef = useRef<StationPoint[]>([]);
  const playerRef = useRef<ReturnType<typeof useAudioPlayer> | null>(null);
  const selectPointRef = useRef<
    (point: StationPoint, autoplay?: boolean) => Promise<void>
  >(async () => undefined);

  useEffect(() => {
    failedStationIdsRef.current = failedStationIds;
  }, [failedStationIds]);

  const markStationFailed = useCallback((stationId: string) => {
    setFailedStationIds((current) => {
      const next = new Set(current);
      next.add(stationId);
      failedStationIdsRef.current = next;
      return next;
    });
  }, []);

  const attemptAutoSkip = useCallback(
    async (failedStation: RadioStation | StationPoint) => {
      const player = playerRef.current;
      if (!player?.wantsPlayback) return false;
      if (autoSkipCountRef.current >= AUTO_SKIP_CAP) return false;

      const origin = { lat: failedStation.lat, lng: failedStation.lng };
      const next = nextWorkingStation(
        origin,
        selectableStationsRef.current,
        failedStationIdsRef.current,
        failedStation.id,
      );
      if (!next) return false;

      autoSkipCountRef.current += 1;
      setStatusOverride("Station unavailable. Tuning nearby…");
      await selectPointRef.current(next, true);
      return true;
    },
    [],
  );

  const onStationUnavailable = useCallback(
    (station: RadioStation) => {
      markStationFailed(station.id);
      void attemptAutoSkip(station);
    },
    [attemptAutoSkip, markStationFailed],
  );

  const player = useAudioPlayer(onStationUnavailable);
  playerRef.current = player;

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

  useEffect(() => {
    selectableStationsRef.current = selectableStations;
  }, [selectableStations]);

  const trackRecent = recent.track;

  const focusOnCoordinates = useCallback((coordinates: Coordinates) => {
    setIsScanning(true);
    setFocusRequest({ ...coordinates, nonce: Date.now() });
  }, []);

  const focusOnStation = useCallback(
    (station: { lat: number; lng: number }) => {
      if (
        Number.isFinite(station.lat) &&
        Number.isFinite(station.lng) &&
        !(Math.abs(station.lat) < 0.05 && Math.abs(station.lng) < 0.05)
      ) {
        focusOnCoordinates({ lat: station.lat, lng: station.lng });
      }
    },
    [focusOnCoordinates],
  );

  const selectStation = useCallback(
    (station: RadioStation, autoplay = true) => {
      stationDetailsRef.current.set(station.id, station);
      setSelectedStation(station);
      trackRecent(station.id);
      setStatusOverride(null);
      const sameStation = selectedStationIdRef.current === station.id;
      selectedStationIdRef.current = station.id;
      if (sameStation && !autoplay) return;
      if (sameStation && player.isPlaying) return;
      void player.tune(station, autoplay);
    },
    [player, trackRecent],
  );

  const handleSidebarSelect = useCallback(
    (station: RadioStation) => {
      selectStation(station, true);
      focusOnStation(station);
    },
    [focusOnStation, selectStation],
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
        markStationFailed(point.id);
        await attemptAutoSkip(point);
      }
    },
    [attemptAutoSkip, markStationFailed, selectStation],
  );

  selectPointRef.current = selectPoint;

  useEffect(() => {
    if (deepLinkHandledRef.current) return;

    const stationId = readStationIdFromSearch(window.location.search);
    if (!stationId) return;

    deepLinkHandledRef.current = true;
    initialAutoplayRef.current = true;
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
    focusOnStation(randomStation);
    void selectPoint(randomStation, true);
  }, [focusOnStation, selectPoint, selectableStations, selectedStation?.id]);

  const playPreviousStation = useCallback(() => {
    if (!selectedStation || recent.ids.length < 2) return;
    const currentIndex = recent.ids.indexOf(selectedStation.id);
    const previousId =
      currentIndex > 0
        ? recent.ids[currentIndex - 1]
        : recent.ids.find((id) => id !== selectedStation.id);
    if (!previousId) return;

    const cached = stationDetailsRef.current.get(previousId);
    if (cached) {
      selectStation(cached, true);
      return;
    }

    void selectPoint({ id: previousId, lat: 0, lng: 0, votes: 0, clickCount: 0 }, true);
  }, [recent.ids, selectPoint, selectStation, selectedStation]);

  useMediaSession({
    player,
    station: player.station ?? selectedStation,
    onRandomize: randomizeStation,
    onPlayPrevious: playPreviousStation,
  });

  const applyNearMe = useCallback(
    (coordinates: Coordinates) => {
      const located = stationsWithCoordinates(selectableStationsRef.current);
      if (located.length === 0) {
        pendingNearMeCoordinatesRef.current = coordinates;
        setFocusRequest({ ...coordinates, nonce: Date.now() });
        setStatusOverride("Loading stations near you…");
        return;
      }

      const next = nearestStations(coordinates, located, 1)[0];
      if (!next) {
        pendingNearMeCoordinatesRef.current = null;
        setStatusOverride("No stations found near you.");
        return;
      }

      pendingNearMeCoordinatesRef.current = null;
      nearMePendingRef.current = true;
      setStatusOverride(null);
      focusOnStation(next);
      void selectPoint(next, true);
    },
    [focusOnStation, selectPoint],
  );

  useEffect(() => {
    const pending = pendingNearMeCoordinatesRef.current;
    if (!pending) return;
    if (stationsWithCoordinates(selectableStations).length === 0) return;
    applyNearMe(pending);
  }, [applyNearMe, selectableStations]);

  const handleNearMe = useCallback(() => {
    void player.unlockPlayback();

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusOverride("Location is not available in this browser.");
      return;
    }

    setStatusOverride("Finding the nearest station…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyNearMe({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        pendingNearMeCoordinatesRef.current = null;
        nearMePendingRef.current = false;
        setStatusOverride(geolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 120_000,
      },
    );
  }, [applyNearMe, player]);

  const handleCenterSettled = useCallback(
    async (coordinates: Coordinates, stationInCircle: StationPoint | null) => {
      try {
        if (nearMePendingRef.current) {
          nearMePendingRef.current = false;
          return;
        }

        const next =
          stationInCircle ??
          nearestStations(coordinates, selectableStations, 1)[0];
        if (!next) return;

        if (!player.wantsPlayback && !player.isPlaying) {
          return;
        }

        initialAutoplayRef.current = true;

        if (selectedStation?.id === next.id) {
          return;
        }

        await selectPoint(next, true);
      } finally {
        setIsScanning(false);
      }
    },
    [
      player.isPlaying,
      player.wantsPlayback,
      selectPoint,
      selectableStations,
      selectedStation?.id,
    ],
  );

  useEffect(() => {
    if (initialAutoplayRef.current) return;
    if (readStationIdFromSearch(window.location.search)) return;
    if (selectableStations.length === 0 || selectedStation) return;

    const timer = window.setTimeout(() => {
      if (initialAutoplayRef.current) return;
      if (selectableStations.length === 0) return;
      if (player.isPlaying || player.wantsPlayback) return;

      initialAutoplayRef.current = true;
      autoplayAttemptsRef.current += 1;
      const starter =
        selectableStations[
          Math.floor(Math.random() * Math.min(selectableStations.length, 500))
        ];
      void selectPoint(starter, true);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    player.isPlaying,
    player.wantsPlayback,
    selectableStations.length,
    selectPoint,
    selectedStation,
  ]);

  useEffect(() => {
    if (player.isPlaying) {
      everPlayedRef.current = true;
      autoSkipCountRef.current = 0;
      setStatusOverride(null);
    }
  }, [player.isPlaying]);

  useEffect(() => {
    if (!selectedStation || everPlayedRef.current) return;
    if (player.isPlaying || player.wantsPlayback) return;
    if (autoplayAttemptsRef.current >= 4) return;

    const timer = window.setTimeout(() => {
      if (!selectedStation || everPlayedRef.current) return;
      if (player.isPlaying || player.wantsPlayback) return;
      if (autoplayAttemptsRef.current >= 4) return;

      autoplayAttemptsRef.current += 1;
      initialAutoplayRef.current = true;
      void player.tune(selectedStation, true);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [player.isPlaying, player.wantsPlayback, selectedStation, player.tune]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-black">
      <PwaRegister />
      <div className="space-backdrop" aria-hidden />
      <GlobeViewport
        stations={selectableStations}
        selectedStation={selectedStation}
        favoriteStationIds={favorites.ids}
        isPlaying={player.isPlaying}
        focusCoordinates={focusRequest}
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
          <div className="pointer-events-auto sidebar-host">
            <StationSidebar
              stations={sidebarStations}
              totalOnGlobe={directory.stationPoints.length}
              selectedStation={selectedStation}
              onSelectStation={handleSidebarSelect}
              query={directory.query}
              onQueryChange={directory.setQuery}
              country={directory.country}
              onCountryChange={directory.setCountry}
              genre={directory.genre}
              onGenreChange={directory.setGenre}
              countries={directory.countries}
              genres={directory.genres}
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

          <button
            type="button"
            className="pointer-events-auto hud-near-me-btn"
            onClick={handleNearMe}
            aria-label="Tune nearest station to my location"
          >
            <LocateFixed className="hud-near-me-icon" strokeWidth={1.75} />
          </button>
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
              statusOverride={statusOverride}
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

"use client";

import { useEffect, useState } from "react";
import type { RadioStation, StationPoint } from "@/lib/radioApi";
import {
  readStationIndex,
  writeStationIndex,
} from "@/lib/stationIndexCache";

const TARGET_STATIONS = 50_000;
const PAGE_SIZE = 5_000;
const INDEX_CACHE_TTL = 24 * 60 * 60 * 1_000;
const REVEAL_BATCH_SIZE = 320;
const REVEAL_INTERVAL_MS = 16;

interface IndexResponse {
  stations: StationPoint[];
  nextOffset: number;
  hasMore: boolean;
}

interface SearchResponse {
  stations: RadioStation[];
}

interface FacetResponse {
  countries: string[];
  genres: string[];
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort);
  });
}

async function revealStations(
  stations: StationPoint[],
  startIndex: number,
  signal: AbortSignal,
  publish: (visible: StationPoint[]) => void,
): Promise<number> {
  let revealed = startIndex;
  const total = stations.length;

  while (revealed < total && !signal.aborted) {
    revealed = Math.min(revealed + REVEAL_BATCH_SIZE, total);
    publish(stations.slice(0, revealed));
    if (revealed < total) await sleep(REVEAL_INTERVAL_MS, signal);
  }

  return revealed;
}

export function useRadioStreams() {
  const [stationPoints, setStationPoints] = useState<StationPoint[]>([]);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [genre, setGenre] = useState("all");

  useEffect(() => {
    const controller = new AbortController();

    async function loadIndex() {
      try {
        const cached = await readStationIndex().catch(() => null);
        if (
          cached &&
          Date.now() - cached.cachedAt < INDEX_CACHE_TTL &&
          (cached.complete || cached.stations.length >= TARGET_STATIONS)
        ) {
          const stations = cached.stations.slice(0, TARGET_STATIONS);
          await revealStations(stations, 0, controller.signal, (visible) => {
            setStationPoints(visible);
            setIsLoading(false);
          });
          return;
        }

        const deduplicated = new Map<string, StationPoint>();
        let offset = 0;
        let hasMore = true;
        let revealedCount = 0;

        while (
          hasMore &&
          deduplicated.size < TARGET_STATIONS &&
          !controller.signal.aborted
        ) {
          const response = await fetch(
            `/api/stations/index?offset=${offset}&limit=${PAGE_SIZE}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("The station index is offline.");
          const page = (await response.json()) as IndexResponse;
          for (const station of page.stations) {
            deduplicated.set(station.id, station);
          }
          const previousOffset = offset;
          offset = page.nextOffset;
          hasMore = page.hasMore && offset > previousOffset;

          const stations = [...deduplicated.values()].slice(0, TARGET_STATIONS);
          revealedCount = await revealStations(
            stations,
            revealedCount,
            controller.signal,
            (visible) => {
              setStationPoints(visible);
              setIsLoading(false);
            },
          );
        }

        const stations = [...deduplicated.values()].slice(0, TARGET_STATIONS);
        setStationPoints(stations);
        setError(null);
        await writeStationIndex({
          stations,
          cachedAt: Date.now(),
          complete: !hasMore || stations.length >= TARGET_STATIONS,
        }).catch(() => undefined);
      } catch (reason) {
        if (
          !controller.signal.aborted &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load stations.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadIndex();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFacets() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/stations/facets", {
            signal: controller.signal,
          });
          if (!response.ok) {
            await sleep(700 * (attempt + 1), controller.signal);
            continue;
          }
          const data = (await response.json()) as FacetResponse;
          setCountries(data.countries ?? []);
          setGenres(data.genres ?? []);
          return;
        } catch (reason) {
          if (controller.signal.aborted) return;
          if (reason instanceof DOMException && reason.name === "AbortError") {
            return;
          }
          try {
            await sleep(700 * (attempt + 1), controller.signal);
          } catch {
            return;
          }
        }
      }
    }

    void loadFacets();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      const params = new URLSearchParams({ query, country, genre, language: "all" });
      try {
        const response = await fetch(`/api/stations/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search is unavailable.");
        const data = (await response.json()) as SearchResponse;
        setSearchResults(data.stations);
      } catch (reason) {
        if (
          !controller.signal.aborted &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [country, genre, query]);

  return {
    stationPoints,
    searchResults,
    countries,
    genres,
    isLoading,
    isSearching,
    error,
    query,
    setQuery,
    country,
    setCountry,
    genre,
    setGenre,
  };
}

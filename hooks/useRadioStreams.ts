"use client";

import { useEffect, useState } from "react";
import type { RadioStation, StationPoint } from "@/lib/radioApi";
import {
  readStationIndex,
  writeStationIndex,
} from "@/lib/stationIndexCache";

const TARGET_STATIONS = 40_000;
const PAGE_SIZE = 5_000;
const INDEX_CACHE_TTL = 24 * 60 * 60 * 1_000;

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
  languages: string[];
}

export function useRadioStreams() {
  const [stationPoints, setStationPoints] = useState<StationPoint[]>([]);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [genre, setGenre] = useState("all");
  const [language, setLanguage] = useState("all");

  useEffect(() => {
    const controller = new AbortController();

    async function loadIndex() {
      try {
        const cached = await readStationIndex().catch(() => null);
        if (
          cached &&
          Date.now() - cached.cachedAt < INDEX_CACHE_TTL &&
          cached.stations.length > 0
        ) {
          setStationPoints(cached.stations);
          setIsLoading(false);
          return;
        }

        const deduplicated = new Map<string, StationPoint>();
        let offset = 0;
        let hasMore = true;

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
          setStationPoints([...deduplicated.values()]);
          setIsLoading(false);
        }

        const stations = [...deduplicated.values()].slice(0, TARGET_STATIONS);
        setStationPoints(stations);
        setError(null);
        await writeStationIndex({
          stations,
          cachedAt: Date.now(),
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
      try {
        const response = await fetch("/api/stations/facets", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as FacetResponse;
        setCountries(data.countries);
        setGenres(data.genres);
        setLanguages(data.languages ?? []);
      } catch {
        // Search remains available without optional filter lists.
      }
    }

    void loadFacets();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      const params = new URLSearchParams({ query, country, genre, language });
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
  }, [country, genre, language, query]);

  return {
    stationPoints,
    searchResults,
    countries,
    genres,
    languages,
    isLoading,
    isSearching,
    error,
    query,
    setQuery,
    country,
    setCountry,
    genre,
    setGenre,
    language,
    setLanguage,
  };
}

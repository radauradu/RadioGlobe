import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  toggleFavorite,
  writeFavoriteIds,
} from "./favorites";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("favorites", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty when nothing is stored", () => {
    expect(readFavoriteIds()).toEqual([]);
  });

  it("persists favorite station ids", () => {
    writeFavoriteIds(["a", "b"]);
    expect(readFavoriteIds()).toEqual(["a", "b"]);
  });

  it("adds and removes ids with toggle", () => {
    expect(toggleFavorite("station-1")).toEqual(["station-1"]);
    expect(toggleFavorite("station-2")).toEqual(["station-1", "station-2"]);
    expect(toggleFavorite("station-1")).toEqual(["station-2"]);
  });

  it("ignores invalid stored values", () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "{not-json");
    expect(readFavoriteIds()).toEqual([]);
  });
});

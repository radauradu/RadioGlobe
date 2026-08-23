import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECENT_STORAGE_KEY,
  pushRecentId,
  readRecentIds,
} from "./recentStations";

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
  };
}

describe("recentStations", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty", () => {
    expect(readRecentIds()).toEqual([]);
  });

  it("prepends new ids and deduplicates", () => {
    expect(pushRecentId("a")).toEqual(["a"]);
    expect(pushRecentId("b")).toEqual(["b", "a"]);
    expect(pushRecentId("a")).toEqual(["a", "b"]);
  });

  it("ignores invalid stored values", () => {
    window.localStorage.setItem(RECENT_STORAGE_KEY, "not-json");
    expect(readRecentIds()).toEqual([]);
  });

  it("keeps only the latest ten ids and trims persisted storage", () => {
    const stale = Array.from({ length: 12 }, (_, index) => `station-${index}`);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(stale));

    expect(readRecentIds()).toEqual(stale.slice(0, 10));
    expect(JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY)!)).toEqual(
      stale.slice(0, 10),
    );
  });

  it("drops older ids when pushing beyond the limit", () => {
    for (let index = 0; index < 12; index += 1) {
      pushRecentId(`station-${index}`);
    }

    expect(readRecentIds()).toHaveLength(10);
    expect(readRecentIds()[0]).toBe("station-11");
    expect(readRecentIds()[9]).toBe("station-2");
  });
});

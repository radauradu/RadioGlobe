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
});

import { describe, expect, it, vi } from "vitest";
import {
  WELCOME_GUIDE_STORAGE_KEY,
  hasSeenWelcomeGuide,
  markWelcomeGuideSeen,
} from "./welcomeGuide";

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("welcomeGuide", () => {
  it("tracks whether the welcome guide was dismissed", () => {
    vi.stubGlobal("window", { localStorage: createStorage() });

    expect(hasSeenWelcomeGuide()).toBe(false);
    markWelcomeGuideSeen();
    expect(hasSeenWelcomeGuide()).toBe(true);
    expect(window.localStorage.getItem(WELCOME_GUIDE_STORAGE_KEY)).toBe("1");
  });
});

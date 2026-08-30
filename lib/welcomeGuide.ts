export const WELCOME_GUIDE_STORAGE_KEY = "wanderfm:welcome-seen";

export function hasSeenWelcomeGuide() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(WELCOME_GUIDE_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomeGuideSeen() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WELCOME_GUIDE_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

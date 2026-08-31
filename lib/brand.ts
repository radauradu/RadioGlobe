export const APP_NAME = "WanderFM";

export const APP_SEO_TITLE =
  "WanderFM – World Radio on an Interactive 3D Globe";

export const APP_GITHUB_URL = "https://github.com/radauradu/RadioGlobe";

export const APP_DESCRIPTION =
  "WanderFM lets you explore and listen to live radio stations worldwide on an interactive 3D globe. Spin the Earth, search by country and genre, save favorites, and tune in instantly.";

export const APP_SHORT_DESCRIPTION =
  "Wander world radio on an interactive 3D globe.";

export const APP_KEYWORDS = [
  "WanderFM",
  "world radio",
  "live radio",
  "internet radio",
  "radio globe",
  "3D globe",
  "explore radio",
  "radio stations",
  "listen online",
  "worldwide FM",
];

export function stationPageTitle(stationName: string) {
  return `${stationName} · ${APP_NAME}`;
}

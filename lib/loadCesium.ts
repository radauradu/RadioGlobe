export type CesiumModule = typeof import("cesium");

let cesiumPromise: Promise<CesiumModule> | null = null;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

export function loadCesium() {
  if (!cesiumPromise) {
    if (typeof window !== "undefined") {
      window.CESIUM_BASE_URL = "/cesium/";
    }
    cesiumPromise = import("cesium");
  }
  return cesiumPromise;
}

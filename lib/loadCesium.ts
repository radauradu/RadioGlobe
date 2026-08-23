export type CesiumModule = typeof import("cesium");

let cesiumPromise: Promise<CesiumModule> | null = null;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: CesiumModule;
  }
}

export function loadCesium() {
  if (!cesiumPromise) {
    cesiumPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Cesium can only load in the browser."));
        return;
      }

      window.CESIUM_BASE_URL = "/cesium/";
      if (window.Cesium) {
        resolve(window.Cesium);
        return;
      }

      const timeout = window.setTimeout(() => {
        reject(new Error("Timed out loading Cesium."));
      }, 20_000);

      const script = document.createElement("script");
      script.src = "/cesium/Cesium.js";
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        if (!window.Cesium) {
          reject(new Error("Cesium loaded without a global export."));
          return;
        }
        resolve(window.Cesium);
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Failed to load /cesium/Cesium.js."));
      };
      document.head.appendChild(script);
    });
  }
  return cesiumPromise;
}

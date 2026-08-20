import type { StationPoint } from "./radioApi";

const DATABASE_NAME = "radio-globe";
const STORE_NAME = "catalog";
const CACHE_KEY = "station-index-v6";
const DATABASE_VERSION = 1;

export interface StationIndexCache {
  stations: StationPoint[];
  cachedAt: number;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStationIndex() {
  const database = await openDatabase();
  return new Promise<StationIndexCache | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(CACHE_KEY);
    request.onsuccess = () =>
      resolve((request.result as StationIndexCache | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function writeStationIndex(cache: StationIndexCache) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(cache, CACHE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

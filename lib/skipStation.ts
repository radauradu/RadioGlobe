import type { StationPoint } from "./radioApi";
import { nearestStations, type Coordinates } from "./spatial";

export const AUTO_SKIP_CAP = 8;

export function nextWorkingStation(
  origin: Coordinates,
  stations: StationPoint[],
  failedIds: ReadonlySet<string>,
  excludeId?: string,
  limit = 8,
): StationPoint | null {
  const candidates = stations.filter(
    (station) => station.id !== excludeId && !failedIds.has(station.id),
  );
  return nearestStations(origin, candidates, limit)[0] ?? null;
}

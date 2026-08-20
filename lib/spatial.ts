export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6_371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineDistance(
  first: Coordinates,
  second: Coordinates,
): number {
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function nearestStations<T extends Coordinates>(
  origin: Coordinates,
  stations: T[],
  limit = 1,
): T[] {
  if (limit <= 0) return [];

  const nearest: Array<{ station: T; distance: number }> = [];
  for (const station of stations) {
    const distance = haversineDistance(origin, station);
    if (
      nearest.length === limit &&
      distance >= nearest[nearest.length - 1].distance
    ) {
      continue;
    }
    const insertAt = nearest.findIndex((entry) => distance < entry.distance);
    nearest.splice(insertAt === -1 ? nearest.length : insertAt, 0, {
      station,
      distance,
    });
    if (nearest.length > limit) nearest.pop();
  }
  return nearest.map(({ station }) => station);
}

export function normalizeLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function clampLatitude(lat: number) {
  return Math.max(-90, Math.min(90, lat));
}

import type { RadioStation } from "./radioApi";

export async function loadStationsByIds(
  ids: string[],
  cache: Map<string, RadioStation>,
) {
  if (ids.length === 0) return [];

  const loaded = await Promise.all(
    ids.map(async (id) => {
      const cached = cache.get(id);
      if (cached) return cached;

      try {
        const response = await fetch(
          `/api/stations/${encodeURIComponent(id)}`,
        );
        if (!response.ok) return null;
        const data = (await response.json()) as { station: RadioStation };
        cache.set(id, data.station);
        return data.station;
      } catch {
        return null;
      }
    }),
  );

  const byId = new Map(
    loaded
      .filter((station): station is RadioStation => station != null)
      .map((station) => [station.id, station]),
  );

  return ids
    .map((id) => byId.get(id))
    .filter((station): station is RadioStation => station != null);
}

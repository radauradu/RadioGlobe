import { normalizeBroadcastText } from "./text";

interface RegionCentroid {
  lat: number;
  lng: number;
  countryCode: string;
}

const GERMAN_STATES: Record<string, RegionCentroid> = {
  "baden-wurttemberg": { lat: 48.775, lng: 9.182, countryCode: "DE" },
  bayern: { lat: 48.137, lng: 11.575, countryCode: "DE" },
  berlin: { lat: 52.52, lng: 13.405, countryCode: "DE" },
  brandenburg: { lat: 52.412, lng: 12.531, countryCode: "DE" },
  bremen: { lat: 53.079, lng: 8.802, countryCode: "DE" },
  hamburg: { lat: 53.551, lng: 9.993, countryCode: "DE" },
  hessen: { lat: 50.11, lng: 8.682, countryCode: "DE" },
  "mecklenburg-vorpommern": { lat: 53.635, lng: 11.401, countryCode: "DE" },
  niedersachsen: { lat: 52.375, lng: 9.732, countryCode: "DE" },
  "nordrhein-westfalen": { lat: 51.227, lng: 6.773, countryCode: "DE" },
  "rheinland-pfalz": { lat: 49.992, lng: 8.247, countryCode: "DE" },
  saarland: { lat: 49.235, lng: 7.002, countryCode: "DE" },
  sachsen: { lat: 51.051, lng: 13.737, countryCode: "DE" },
  "sachsen-anhalt": { lat: 51.482, lng: 11.969, countryCode: "DE" },
  "schleswig-holstein": { lat: 54.086, lng: 9.981, countryCode: "DE" },
  thuringen: { lat: 50.978, lng: 11.028, countryCode: "DE" },
};

const GERMAN_STATE_ALIASES: Record<string, string> = {
  "baden wurttemberg": "baden-wurttemberg",
  bavaria: "bayern",
  bayern: "bayern",
  berlin: "berlin",
  "berlin brandenburg": "berlin",
  brandenburg: "brandenburg",
  bremen: "bremen",
  cologne: "nordrhein-westfalen",
  deutschland: "nordrhein-westfalen",
  "deutschland germany": "nordrhein-westfalen",
  "deutschland und nrw": "nordrhein-westfalen",
  germany: "nordrhein-westfalen",
  hamburg: "hamburg",
  hessen: "hessen",
  hesse: "hessen",
  "lower saxony": "niedersachsen",
  "mecklenburg vorpommern": "mecklenburg-vorpommern",
  niedersachsen: "niedersachsen",
  "north rhine westphalia": "nordrhein-westfalen",
  "north-rhine-westphalia": "nordrhein-westfalen",
  "nordrhein westfalen": "nordrhein-westfalen",
  nrw: "nordrhein-westfalen",
  radolfzell: "baden-wurttemberg",
  "rhineland palatinate": "rheinland-pfalz",
  "rhineland-palatinate": "rheinland-pfalz",
  "rheinland pfalz": "rheinland-pfalz",
  saarland: "saarland",
  sachsen: "sachsen",
  "sachsen anhalt": "sachsen-anhalt",
  "saxony anhalt": "sachsen-anhalt",
  "schleswig holstein": "schleswig-holstein",
  thuringia: "thuringen",
  thuringen: "thuringen",
  bw: "baden-wurttemberg",
};

function normalizeRegionLabel(value: string) {
  return normalizeBroadcastText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function regionCentroidForStation(
  countryCode: string,
  state: string | undefined,
): RegionCentroid | null {
  if (!state?.trim()) return null;
  const normalizedState = normalizeRegionLabel(state);
  if (!normalizedState) return null;

  if (countryCode === "DE") {
    const canonical =
      GERMAN_STATE_ALIASES[normalizedState] ??
      (normalizedState in GERMAN_STATES ? normalizedState : null);
    if (canonical) return GERMAN_STATES[canonical];
  }

  return null;
}

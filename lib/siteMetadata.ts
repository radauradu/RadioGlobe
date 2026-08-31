import type { RadioStation } from "./radioApi";
import { APP_GITHUB_URL, APP_NAME } from "./brand";
import { formatStationPlace } from "./place";

export function resolveMetadataBase() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export function stationShareTitle(station: RadioStation) {
  return `${station.name} · ${APP_NAME}`;
}

export function stationShareDescription(station: RadioStation) {
  const place = formatStationPlace(station);
  return `Live radio from ${place.line}`;
}

export function buildCanonicalUrl(pathname: string, base?: URL) {
  const origin = base ?? resolveMetadataBase();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, origin).toString();
}

export function siteSocialProfiles() {
  return [APP_GITHUB_URL];
}

export function googleSiteVerification() {
  const value = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return value || undefined;
}

export function buildOgImageUrl(stationId?: string | null, base?: URL) {
  const origin = base ?? resolveMetadataBase();
  const url = new URL("/og", origin);
  if (stationId) {
    url.searchParams.set("station", stationId);
  }
  return url.toString();
}

export function readStationIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const raw = searchParams.station;
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value || !/^[a-zA-Z0-9-]{8,64}$/.test(value)) return null;
  return value;
}

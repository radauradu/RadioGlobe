import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import { fetchStationById } from "@/lib/radioApi";
import {
  buildOgImageUrl,
  readStationIdFromSearchParams,
  resolveMetadataBase,
  stationShareDescription,
  stationShareTitle,
} from "@/lib/siteMetadata";

const DEFAULT_TITLE = "Radio Globe";
const DEFAULT_DESCRIPTION = "Listen to live radio stations around the world.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const metadataBase = resolveMetadataBase();
  const stationId = readStationIdFromSearchParams(params);
  const defaultOgImage = buildOgImageUrl(null, metadataBase);

  const baseMetadata: Metadata = {
    metadataBase,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      type: "website",
      images: [{ url: defaultOgImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [defaultOgImage],
    },
  };

  if (!stationId) return baseMetadata;

  const station = await fetchStationById(stationId);
  if (!station) return baseMetadata;

  const title = stationShareTitle(station);
  const description = stationShareDescription(station);
  const ogImage = buildOgImageUrl(stationId, metadataBase);

  return {
    ...baseMetadata,
    title,
    description,
    openGraph: {
      ...baseMetadata.openGraph,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: station.name }],
    },
    twitter: {
      ...baseMetadata.twitter,
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Page() {
  return <HomePage />;
}

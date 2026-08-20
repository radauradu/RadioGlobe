import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { fetchStationById } from "./radioApi";

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 12_000;

export class StreamSecurityError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function validatePublicStreamUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StreamSecurityError("The station returned an invalid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new StreamSecurityError("Only public HTTP(S) streams are supported.");
  }
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".local")
  ) {
    throw new StreamSecurityError("Local stream destinations are blocked.");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new StreamSecurityError("Private stream destinations are blocked.");
  }

  return url;
}

export function encodeStreamResource(url: string) {
  return Buffer.from(url).toString("base64url");
}

export function decodeStreamResource(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    throw new StreamSecurityError("Invalid stream resource.");
  }
}

export async function resolveStationStream(
  stationId: string,
  encodedResource?: string | null,
) {
  const station = await fetchStationById(stationId);
  if (!station) throw new StreamSecurityError("Station not found.", 404);

  const stationUrl = await validatePublicStreamUrl(station.streamUrl);
  if (!encodedResource) return { station, url: stationUrl };

  const resourceUrl = await validatePublicStreamUrl(
    decodeStreamResource(encodedResource),
  );
  if (resourceUrl.hostname !== stationUrl.hostname) {
    throw new StreamSecurityError(
      "Playlist resources must use the station host.",
      403,
    );
  }

  return { station, url: resourceUrl };
}

export async function safeStreamFetch(
  initialUrl: URL,
  init: RequestInit = {},
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await validatePublicStreamUrl(currentUrl.toString());
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error("Upstream connection timed out.")),
      REQUEST_TIMEOUT_MS,
    );
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutController.signal])
      : timeoutController.signal;
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...init,
        cache: "no-store",
        redirect: "manual",
        signal,
      });
    } finally {
      // This timeout protects only the connection/header phase. Leaving an
      // AbortSignal.timeout attached here kills a healthy infinite radio
      // response after 12 seconds, once the audio buffer runs dry.
      clearTimeout(timeout);
    }

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    currentUrl = new URL(location, currentUrl);
  }

  throw new StreamSecurityError("The stream redirected too many times.", 502);
}

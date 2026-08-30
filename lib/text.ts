const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }
      return HTML_ENTITIES[entity.toLocaleLowerCase()] ?? match;
    },
  );
}

function decodePercentEscapes(value: string) {
  let decoded = value.replace(/%u([\da-f]{4})/gi, (_match, code: string) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
  decoded = decoded.replace(/\\u([\da-f]{4})/gi, (_match, code: string) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );

  if (/%[\da-f]{2}/i.test(decoded)) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Preserve partially encoded station metadata.
    }
  }
  return decoded;
}

function repairUtf8Mojibake(value: string) {
  if (!/[ÃÂÐÑ]/.test(value)) return value;
  if ([...value].some((character) => character.charCodeAt(0) > 255)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(
      [...value].map((character) => character.charCodeAt(0)),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

export function normalizeBroadcastText(value: string) {
  return repairUtf8Mojibake(
    decodeHtmlEntities(decodePercentEscapes(value)),
  )
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIheartIcyTitle(value: string) {
  const normalized = normalizeBroadcastText(value);
  const textMatch = normalized.match(/\btext="([^"]+)"/i);
  const titleMatch = normalized.match(/\btitle="([^"]+)"/i);
  const song = textMatch?.[1] ?? titleMatch?.[1];
  if (!song) return normalized;

  const artistPrefix = normalized.match(/^(.+?)\s*-\s*text="/i);
  const artist = artistPrefix?.[1]?.trim();
  if (artist) return `${artist} - ${song}`;
  return song;
}

export function normalizeLive504IcyTitle(value: string) {
  const normalized = normalizeBroadcastText(value);
  if (!normalized) return normalized;

  const mixMatch = normalized.match(/^live504mix(.+)$/i);
  if (!mixMatch) return normalized;

  const mixName = mixMatch[1]
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return `Live504 Radio - Mix ${mixName}`;
}

export function parseNowPlaying(streamTitle: string | null | undefined) {
  const text = streamTitle
    ? normalizeLive504IcyTitle(normalizeIheartIcyTitle(streamTitle))
    : "";
  if (!text) return { artist: null, song: null };

  const parts = text
    .split(/\s[-–—|]\s/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      song: parts.slice(1).join(" — "),
    };
  }

  return { artist: null, song: text };
}

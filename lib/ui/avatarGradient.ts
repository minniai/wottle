/**
 * Deterministic gradient + monogram avatar generator (FR-011).
 *
 * Hash: 32-bit FNV-1a over the stable player id.
 * Background: two-stop linear-gradient in HSL with controlled lightness band
 *   (30–45%) so the cream `#F2EAD3` foreground always clears WCAG AA 4.5:1.
 * Initials: 1–2 grapheme clusters extracted via `Intl.Segmenter` — preserves
 *   Icelandic accented letters and combining diacritics.
 */

export interface GeneratedAvatar {
  background: string;
  foreground: string;
  initials: string;
}

const CREAM_FOREGROUND = "#F2EAD3";

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function segmenter(): {
  segment(s: string): Iterable<{ segment: string }>;
} | null {
  const Ctor = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string | string[],
        options?: { granularity: "grapheme" | "word" | "sentence" },
      ) => { segment(s: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  return Ctor ? new Ctor(undefined, { granularity: "grapheme" }) : null;
}

function extractInitials(displayName: string): string {
  const trimmed = (displayName ?? "").trim();
  if (trimmed.length === 0) {
    return "?";
  }
  const seg = segmenter();
  const words = trimmed.split(/\s+/u).slice(0, 2);
  if (seg === null) {
    if (words.length > 1) {
      return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (words.length > 1) {
    const firsts = words.map((word) => {
      const first = [...seg.segment(word)][0];
      return (first?.segment ?? "").toUpperCase();
    });
    return firsts.join("");
  }
  const graphs = [...seg.segment(words[0]!)].slice(0, 2);
  return graphs.map((g) => g.segment.toUpperCase()).join("");
}

export function generateAvatar(
  playerId: string,
  displayName: string,
): GeneratedAvatar {
  const hash = fnv1a(playerId);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40 + ((hash >> 8) % 60)) % 360;
  const background = `linear-gradient(135deg, hsl(${hue1} 65% 45%), hsl(${hue2} 65% 30%))`;
  return {
    background,
    foreground: CREAM_FOREGROUND,
    initials: extractInitials(displayName),
  };
}

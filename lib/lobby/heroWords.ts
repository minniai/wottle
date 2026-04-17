/**
 * Curated Icelandic noun rotation set for the lobby hero (FR-001a).
 * Must include ORÐUSTA + ≥3 additional nouns featuring Icelandic-specific
 * letters (Þ, Æ, Ð, Ö). Each word 4–8 letters; letters are grapheme
 * clusters preserving combining diacritics.
 */

export interface HeroWord {
  letters: string[];
  locale: "is";
  isProductName: boolean;
}

function graphemes(word: string): string[] {
  const Ctor = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string | string[],
        options?: { granularity: "grapheme" | "word" | "sentence" },
      ) => { segment(s: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  if (Ctor) {
    const seg = new Ctor("is", { granularity: "grapheme" });
    return [...seg.segment(word)].map((s) => s.segment);
  }
  return [...word];
}

function word(raw: string, isProductName = false): HeroWord {
  return {
    letters: graphemes(raw),
    locale: "is",
    isProductName,
  };
}

export const HERO_WORDS: readonly HeroWord[] = [
  word("ORÐUSTA", true),
  word("ÞOKA"),
  word("ÆVINTÝRI"),
  word("BÓKASAFN"),
  word("HESTUR"),
  word("SÖGUR"),
  word("LJÓÐ"),
  word("FISKUR"),
] as const;

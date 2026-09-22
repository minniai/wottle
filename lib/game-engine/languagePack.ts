import { z } from "zod";


import { ENGLISH_LETTER_WEIGHTS, ICELANDIC_LETTER_WEIGHTS } from "@/lib/game-engine/boardGenerator";
import { LETTER_SCORING_VALUES_EN } from "@/lib/game-engine/letter-values/letter_scoring_values_en";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import type { Language } from "@/lib/types/game-config";

/**
 * Everything a match's language decides apart from its dictionary (spec 060):
 * the letters on the board and how often, what each is worth, and how its
 * words are uppercased. The dictionary itself loads by language in `dictionary.ts`.
 */
export interface LanguagePack {
  language: Language;
  letterValues: Record<string, number>;
  letterWeights: Record<string, number>;
  alphabet: readonly string[];
  upperLocale: string;
}

export class UnsupportedLanguageError extends Error {
  constructor(language: string) {
    super(`No language pack for "${language}"`);
    this.name = "UnsupportedLanguageError";
  }
}

function pack(language: Language, letterValues: Record<string, number>, letterWeights: Record<string, number>): LanguagePack {
  return { language, letterValues, letterWeights, alphabet: Object.keys(letterWeights), upperLocale: language };
}

const PACKS: Partial<Record<Language, LanguagePack>> = {
  is: pack("is", LETTER_SCORING_VALUES_IS, ICELANDIC_LETTER_WEIGHTS),
  en: pack("en", LETTER_SCORING_VALUES_EN, ENGLISH_LETTER_WEIGHTS),
};

/** The languages a match can be played in. */
export const PLAYABLE_LANGUAGES = Object.keys(PACKS) as Language[];

export function getLanguagePack(language: Language): LanguagePack {
  const found = PACKS[language];
  if (!found) throw new UnsupportedLanguageError(language);
  return found;
}

/** Every letter any playable language can put on a board, for the board schemas. */
export const ALL_LETTERS: ReadonlySet<string> = new Set(Object.values(PACKS).flatMap((p) => p.alphabet));

/** A language a client may ask to play in (queue, challenge, warm-up preview); Icelandic when absent. */
export const playableLanguageSchema = z
  .enum(["is", "en"])
  .optional()
  .transform((language): Language => language ?? "is");

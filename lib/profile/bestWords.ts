import { getLanguagePack } from "@/lib/game-engine/languagePack";
import type { Language } from "@/lib/types/game-config";
import type { ProfileWord } from "@/lib/types/profile";

const SHOWN = 3;

/** The best words as strips (spec 072 E1): each letter on its cell with its value, in the language's upper case. */
export function toProfileWords(rows: { word: string; points: number }[], language: Language): ProfileWord[] {
  const pack = getLanguagePack(language);
  return rows.slice(0, SHOWN).map(({ word, points }) => {
    const upper = word.toLocaleUpperCase(pack.upperLocale);
    return { word: upper, points, tiles: Array.from(upper, (letter) => ({ letter, value: pack.letterValues[letter] ?? 0 })) };
  });
}

# Contract: language pack and threading

`getLanguagePack(language: Language): LanguagePack` — throws `UnsupportedLanguageError` for a language with no weights (se/no/dk until added).

| Site | Before | After |
| --- | --- | --- |
| `moveResolver.resolveClaim` | `loadDictionary("is")`, IS values | `loadDictionary(match.language)`, `pack.letterValues` |
| `crossValidator` L184 | `calculateLetterPoints(word.text)` | `calculateLetterPoints(word.text, letterValues)` (param) |
| `previewSwap` | `loadDictionary("is")` | select `language`; pack + dictionary |
| `stateLoader` start | `generateBoard({ seed })`, warm `is` | `generateBoard({ seed, weights: pack.letterWeights })`, warm `match.language` |
| `liveState.letterValue` | IS constant | `letterValue(letter, language)` from `MatchState.language` |
| `wordIntegrity` / `bandGeometry` / `matchIntegrity` | `toLocaleUpperCase("is")` | `toLocaleUpperCase(pack.upperLocale)` |
| Lobby warm-up / queue placeholder | IS weights | locale's `language` pack weights |

Regression pins: every existing scoring test runs unchanged (language defaults to `is`); new `moveResolver.english.spec.ts` resolves a move on an English board forming `CAT` (scores, en values) and `HESTUR` (does not score).

# Contract: copy

- `lib/i18n/copy/en.ts` exports `copyEn` (every current `lib/constants/copy.ts` export as a property, same name, same value/signature) plus the strings moved in P2 (`menu.*`, `profile.*`, `errors.*`, `aria.*`, `rules.*` labels, `languageLink`).
- `export type Copy = { [K in keyof typeof copyEn]: Widen<(typeof copyEn)[K]> }` (string literals widen to `string`).
- `lib/i18n/copy/is.ts`: `export const copyIs = { … } satisfies Copy`.
- `getCopy(locale: Locale): Copy`; `useCopy(): Copy`, `useLocale(): LocaleConfig`, `useLocalePath(): (path) => string`.
- `copy.errors: Record<ErrorCode, string>`; `ErrorCode = "rate_limited" | "invalid_name" | "name_taken" | "login_failed" | "queue_failed" | "invite_failed" | "rematch_failed" | "preview_frozen" | "preview_signed_out" | "unknown"` (final list fixed in P2 from the grep of player-visible messages).
- Tests: `copy.spec.ts` asserts en values unchanged (existing assertions), `copyParity.spec.ts` asserts every key of `copyEn` exists in `copyIs` with the same `typeof`, and calls every function in `copyIs` with sample args (no `undefined`, no `NaN`, no English stopwords from a small list).
- Icelandic plurals: helper `plural(locale, n, { one, other })` in `lib/i18n/plural.ts`.

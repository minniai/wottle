# Implementation Plan: Languages by URL — Orðusta and wottle

**Branch**: `060-locales` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/060-locales/spec.md`

## Summary

The interface language comes from the URL and the game language comes from the match. All pages move under an `app/[locale]` segment. A root `proxy.ts` rewrites unprefixed paths to `/is/…` and redirects `/is/…` back to the unprefixed path. A small registry (`lib/i18n/locales.ts`) gives each locale its path segment, html tag, wordmark and game `Language`.

UI strings become one typed `Copy` object per locale:
- `lib/i18n/copy/en.ts` holds today's `copy.ts`.
- `is.ts` is the Icelandic translation.
- Server components read copy through `getCopy(locale)`; client components read it through `useCopy()`.

The engine already keys dictionaries and letter values by `Language`. A new `getLanguagePack(language)` bundles letter values, letter weights, alphabet and uppercase locale. It is threaded from `matches.language` through the resolver, preview, loader, cross-validator and client tile values.

Additive migrations cover the rest:
- `matches.language`, `match_invitations.language` and `lobby_presence.language`.
- `players.queue_language`, which partitions the queue.
- A new `player_ratings` table keyed `(player_id, language)`, backfilled from `players`, plus `match_ratings.language`, so each language has its own Elo.

The work ships in four phases. P1 does routing, P2 does copy and the Icelandic translation, P3 threads the game language and partitions matchmaking, and P4 splits ratings by language.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router, `proxy.ts` convention)
**Primary Dependencies**: Supabase JS v2, Zod, zustand, Tailwind 4. No new dependency; i18n is a typed object per locale plus `Intl.PluralRules` / `Intl.DateTimeFormat`.
**Storage**: Supabase PostgreSQL. Two additive migrations. `claim_next_move` is recreated to return `language`.
**Testing**: Vitest (unit/contract), Vitest integration against local Supabase, Playwright (chromium + firefox two-player), visual suite on `/[locale]/dev/room`.
**Target Platform**: Vercel (Node runtime) and Supabase Cloud.
**Project Type**: Web application (single Next.js project).
**Performance Goals**: Unchanged SLAs. Move RTT <200ms p95, one move resolves <50ms p95 with a warm dictionary, broadcast <100ms p95. The proxy adds one pathname check per request and no I/O.
**Constraints**:
- Icelandic behaviour must stay bit-identical (FR-017).
- The English visual baselines must pass unchanged at `/en` (SC-002).
- The design system's eight tokens and two type families are untouched. <!-- retired-name -->
- Both dictionaries must fit in one serverless instance; en is 615 KB against is at 55 MB, so this is negligible.
**Scale/Scope**:
- About 100 existing copy exports plus about 60 hardcoded strings and about 15 server messages to translate.
- The rules page runs to about 90 lines of prose.
- About 35 navigation sites.
- 25 fixture phases.
- Two locales in this pass.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
| --- | --- |
| I. Server-authoritative | Pass. A match's language is written once by the server at creation (`bootstrapMatchRecord`). The client never sends a language for a move: the resolver reads `matches.language`. The queue and invite language comes from the page's locale, but the server validates it as a supported `Language` with Zod. |
| II. Performance | Pass. Dictionaries are cached per language, already. `claim_next_move` returns one more column. The proxy does string checks only. `perf:move-resolve` is re-run with both dictionaries warm. |
| III. Type-safe | Pass. `Copy` is derived from the en object, and `is` must `satisfies Copy`, so a missing key is a type error (FR-011). `Locale` and `Language` are unions. The new columns get Zod schemas and a `language` field on `MatchState`. |
| IV. Progressive / mobile | Pass. There is no client-only language detection; the server renders the right language from the URL. |
| V. Observability | Pass. `language` is added to the resolver's and settlement's structured logs. |
| VI. Clean code | Pass. The pure `lib/room` functions take `copy` as a parameter instead of importing a global. There are no boolean flags; the locale is a value. |
| VII. TDD | Pass. Each phase starts with failing tests: registry/proxy decisions, copy parity, language pack, resolver on an English board, language-filtered queue, per-language Elo. |
| IX. Commits | Conventional commits for each passing test group. |

There are no violations, so Complexity Tracking is empty.

**Post-design re-check**: Still passing. The data model adds no service-role exposure: `player_ratings` gets the same RLS shape as `match_ratings`, which is public read and service-role write.

## Project Structure

### Documentation (this feature)

```text
specs/060-locales/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── locale-routing.md
│   ├── copy.md
│   ├── language-pack.md
│   ├── matchmaking-language.md
│   └── ratings-by-language.md
└── tasks.md            # /speckit.tasks
```

### Source Code (repository root)

```text
proxy.ts                               # new: locale rewrite/redirect
app/
├── [locale]/
│   ├── layout.tsx                     # was app/layout.tsx: html lang, fonts, metadata, LocaleProvider
│   ├── not-found.tsx
│   ├── (room)/…                       # moved: layout, page, lobby, matchmaking, match/[matchId]
│   ├── rules/page.tsx                 # moved: picks components/rules/content/{is,en}
│   ├── profile/…                      # moved
│   ├── match/[matchId]/summary/…      # moved
│   └── dev/room/…                     # moved
├── api/…                              # unchanged location
└── actions/…                          # take `language` where needed; return `code`
lib/
├── i18n/
│   ├── locales.ts                     # registry, localePath, switchLocalePath, isLocale
│   ├── routing.ts                     # pure proxy decision (tested)
│   ├── getCopy.ts
│   └── copy/{types,en,is}.ts
├── game-engine/languagePack.ts        # new
├── constants/copy.ts                  # removed at the end of P2 (re-export shim during P2)
└── …                                  # threaded (see contracts)
components/
├── i18n/LocaleProvider.tsx            # new: useLocale, useCopy, useLocalePath
└── rules/content/{is,en}.tsx          # new
supabase/migrations/
├── 20260922001_match_language.sql     # P3
└── 20260922002_ratings_by_language.sql # P4
tests/
├── unit/lib/i18n/…                    # registry, routing, copy parity, copy grep guard
├── unit/lib/game-engine/languagePack.spec.ts
├── unit/match/moveResolver.english.spec.ts
├── integration/db/…language…          # claim returns language; queue partition; ratings
└── integration/ui/{locale-is.spec.ts, cross-language-queue.spec.ts}
```

**Structure Decision**: Keep the single Next.js project. Every page lives under `app/[locale]`; API routes and actions stay unprefixed and take the language as data.

## Phases

| Phase | Delivers | Spec coverage | Shippable state |
| --- | --- | --- | --- |
| P1 Routing | Registry, `[locale]` tree, proxy, `localePath` sweep, html lang and metadata for each locale, `/en` visual baselines | FR-001–005, SC-002 | Both URLs work; both still read English; game unchanged |
| P2 Copy | `Copy` type, en/is objects, provider, `lib/room` functions take copy, hardcoded strings moved, server message codes, rules content, language link, Icelandic visual set, design system §8 | FR-006–011, FR-025, US1, US5, SC-001 | Icelandic at `/`, English at `/en`; every match still Icelandic |
| P3 Game language | Language pack, migration 1, threading, queue/lobby/invite/presence partition, match-locale redirect, warm-up boards | FR-012–020, US2, US3, SC-003–005, SC-007 | English matches play English |
| P4 Ratings | Migration 2, `player_ratings` reads and writes, per-language profile, lobby and slip | FR-021–024, US4, SC-006 | Separate Elo |

## Complexity Tracking

None.

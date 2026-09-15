# Phase 1 data model — Field & Ledger completion

This feature adds **one column, one type field, one interface field, one model field and two pieces of component-local state.** Everything else it touches is presentation. Fixtures introduce no types at all — that is a hard constraint, not a preference: a fixture that needed its own type would prove the fixture route is not rendering the real room.

---

## 1. `matches.rated` — persisted

| | |
| --- | --- |
| **Table** | `matches` |
| **Column** | `rated boolean not null default true` |
| **Migration** | `supabase/migrations/<timestamp>_matches_rated.sql`, additive, no backfill |
| **Written by** | `bootstrapMatchRecord` (`lib/matchmaking/service.ts`) — the single creation point |
| **Read by** | `loadMatchState` (`lib/match/stateLoader.ts`) → `MatchState.rated`; `completeMatch` before the rating step |
| **Never written by** | the client |

**Values by creation path** — the four callers of `bootstrapMatchRecord`:

| Caller | Path | `rated` | Why |
| --- | --- | --- | --- |
| `startAutoQueue` | ranked queue | `true` (default) | opponent assigned, not chosen |
| `respondToInvite` (accept branch) | directory challenge | `false` | the player picked their opponent |
| `requestRematch` | rematch | **inherited from the source match** | a rematch of a challenge is still a chosen opponent |
| `respondToRematch` | rematch | **inherited from the source match** | same |

**Invariants**

- `rated` never changes after creation. There is no transition; a match is rated or it is not, from the first round to the verdict.
- `rated = false` ⇒ `persistRatingChanges` is not called and no `match_ratings` row is written for that match.
- `rated = false` ⇒ neither player's `elo_rating` changes.
- Existing rows and every queue match are `true`, so today's behaviour is preserved by the default.

**Rendering** — `rated` selects one word in three strings and nothing else:

| Place | `rated = true` | `rated = false` |
| --- | --- | --- |
| match caption | `ranked · round n of 10` | `unranked · round n of 10` |
| final caption | `ranked · 10 rounds · mm:ss` | `unranked · 10 rounds · mm:ss` |
| final rating line | `1191 → 1203 · +12 · wins` | no rating line |
| lobby `here now` | — | `challenge for an unranked match` |

---

## 2. `MatchState.rated` — in memory

```
MatchState {
  …existing fields unchanged…
  rated: boolean      // NEW — from matches.rated; default true for any state built without it
}
```

Added to the type in `lib/types/match.ts` and to its Zod schema. Hydrated by `loadMatchState` and carried on every realtime broadcast, because the ledger caption renders from `MatchState` on the client and must not need a second fetch.

---

## 3. `SeatColors.text` — derived, not stored

```
SeatColors {
  ink:  string   // existing — letters, lanes, totals, seat squares
  band: string   // existing — 14% settled band
  live: string   // existing — 30% live reveal band
  text: string   // NEW — the same colour as `ink` for the viewer seat,
                 //       a darker coral for the opponent seat
}
```

`getSeatColors("you").text === "var(--you)"` — teal is 4.9:1 on paper and needs no variant.
`getSeatColors("opp").text === "var(--opp-text)"` — coral is 3.4:1 on paper and fails AA below 17px.

The asymmetry lives inside the function so no caller has to know about it. **Consumers**: the ledger word (14px), the value numeral on a scored cell, the profile's `vs` rows. **Non-consumers, which keep `ink`**: every letter on the field, both clock lanes, both totals, both seat squares — all of them either ≥17px or not text.

The palette becomes eight declared colour values: `--paper --ink --rule --tint --muted --you --opp --opp-text`, plus the derived `--you-band --you-live --opp-band --opp-live` and the single grey `--future-label`.

---

## 4. `LedgerModel.live` — the queue's live line

```
LedgerModel {
  caption:   string
  rows:      LedgerRow[]
  territory: Territory
  hint:      string
  verdict?:  Verdict
  live?:     string     // NEW — queue only
}
```

The match and final variants already carry their live state per-row, as `LedgerRow.liveText` on the row whose `status` is `"live"`. The queue has no rows at all, so it had nowhere to put `setting the field · 58 of 100 letters` and `round 1 in 3` and they were printed in `hint`. `live` gives the queue the same tinted element the match uses, above the hint line, and is `undefined` in every other variant.

**States during the queue phase**: `setting the field · n of 100 letters` while the placeholder lands → `round 1 in 3`, `round 1 in 2`, `round 1 in 1` once an opponent is found.

---

## 5. Component-local state — not persisted, not in any store

| State | Owner | Shape | Meaning |
| --- | --- | --- | --- |
| `collapsed` | `Ledger` (prop) | `boolean` | the phone ledger shows only caption + live row + territory; passed as `collapsed={isPhone}` from the three views |
| `sheetOpen` | `Ledger` (local) | `boolean` | the rest of the ledger is open beneath the live row; resets to `false` when `collapsed` becomes `false` |
| `isPhone` | `useIsPhone` | `boolean` | tracks `matchMedia("(max-width: 900px)")`; **`false` on the server**, so the first client paint may correct it |
| `exchange` | `FieldCell` (prop) | `{ dx: number; dy: number } \| null` | FLIP offset for the 150ms letter travel; cleared on `animationend` |
| `unpinned` | `FieldCell` (prop) | `boolean` | the cell just left `pinned`; drives the 200ms fade |
| `writing` | `PlayerBar` (prop) | `boolean` | the opponent's name is being written in over 200ms |
| drag origin | `useFieldInteraction` (ref) | `Coordinate \| null` | the cell `pointerdown` landed on; a ref, not state, so it never re-renders |
| click suppression | `Field` (ref) | `boolean` | set when a drag resolves, cleared on the next `click`, so the browser's synthetic click after `pointerup` is not read as a tap |

`isPhone` returning `false` on the server is deliberate: the desktop ledger is the safe first paint, and a phone corrects it on hydration. The alternative — guessing from a user-agent header — is unreliable and would make the fixture route's output depend on the request.

---

## 6. Fixture data — typed only with existing types

`app/dev/room/fixtures.ts` exports one object per phase, each assembled from `MatchState`, `LedgerModel`, `AccumulatedWord`, `FrozenTileMap`, `Territory`, `Verdict` and the existing profile types. **No new interface may be declared in this file.**

**The board** (the ten rows the review's companion renders, so a fixture screenshot is directly comparable with fixture B):

```
ÞAKREISTÖL
GÆFUNDIRÓM
SKBORÐTÝUN      BORÐ   you   round 1   left-to-right    x 2–5, y 2
ÁLNIRÖSKUM
EYÐIHVAGTL      GILT   opp   round 2   top-to-bottom    x 7, y 4–7
RÚNTÆKSIÐÓ
ÖFLUGRÁLEK      LEK    you   round 3   left-to-right    x 7–9, y 6  (shares (7,6) with GILT)
MÝSJAÐETRI
ISKÓPUNÆHÖ
TRAUÐLEGIS      T at x 0, y 9 picked in the match phase
```

Round 3's word is `LEK`, chosen because it crosses `GILT` at (7, 6): that cell belongs to a teal word and a coral word at once, so the `shared` ink-700 cell state appears in the baselines. It also gives the fold rule and the ten shared rows something to show. The fixture bypasses the dictionary — the engine never sees this board — so word validity here is cosmetic, but `LEK` is a real Icelandic form.

**The players**: Birna, rating 1204, viewer seat (teal, bottom bar), 4:12 left of 5:00. Kári, rating 1187, opponent seat (coral, top bar), 2:31 left.

**Phase differences**, all built from the same board and players:

| Phase | What it fixes |
| --- | --- |
| `landing` | no session; the name input in the bottom bar; empty opponent seat |
| `lobby` | warm-up field; `here now` and `your last matches` tables |
| `queue` | placeholder letters part-landed; live row `setting the field · 58 of 100 letters` |
| `found` | opponent written into the top bar; live row `round 1 in 3`; both lanes full |
| `match` | round 4 of 10, rounds 1–3 scored, `T` picked at x 0 y 9 |
| `reveal` | the round-3 words mid-draw, so the band, chevron and count-up are all captured |
| `final` | `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25`, rating lines, rematch foot |
| `disconnect` | `reconnecting · 0:42 left` on the top bar, dashed lane, both clocks held |
| `profile` | rating history of twelve points, record row, best words, recent matches |

**Determinism**: every clock, count and timestamp in the fixtures is a literal. Nothing reads `Date.now()`, `Math.random()` or the system locale, or the reference images would differ on every run.

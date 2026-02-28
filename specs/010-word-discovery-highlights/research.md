# Research: Word Discovery Highlights

**Branch**: `010-word-discovery-highlights`
**Phase**: 0 — Research & Unknowns Resolution
**Date**: 2026-02-28

---

## 1. Animation Duration — 700ms

**Decision**: Use 700ms as the target highlight duration (midpoint of the 600–800ms PRD range).

**Rationale**: The existing `scored-tile-highlight` keyframe uses 3s, which is far too long per PRD §7.2. The 700ms midpoint gives a natural feel: fast enough to maintain game pace, long enough to register consciously. The timeout in `MatchClient` will be set to 800ms (end of range) so the animation CSS can fade out gracefully before the callback fires.

**Current state**: `highlightDurationMs={3000}` in `MatchClient.tsx:368`. `@keyframes scored-tile-highlight` duration `3s` in `board.css:118`.

**Alternatives considered**: 500ms (too brief for peripheral vision), 900ms (exceeds spec ceiling).

---

## 2. Player Color Source — Existing `playerColors.ts` Constants

**Decision**: Use `PLAYER_A_HIGHLIGHT` ("rgba(59, 130, 246, 0.6)") and `PLAYER_B_HIGHLIGHT` ("rgba(239, 68, 68, 0.6)") already exported from `lib/constants/playerColors.ts`.

**Rationale**: These constants were explicitly added for scored tile use (matching the constant name). They match Player A = blue (#3B82F6) and Player B = red (#EF4444) — the convention already established in GameChrome and frozen tile overlays. No new color values needed.

**Current state**: `PLAYER_A_HIGHLIGHT` and `PLAYER_B_HIGHLIGHT` exist in `playerColors.ts:11-13`.

---

## 3. Highlight Data Shape — Per-Tile Color Map Derived from `summary.words`

**Decision**: Derive a `highlightPlayerColors: Record<string, string>` map (key = "x,y" string, value = highlight CSS color) in `MatchClient` from `summary.words[]`. Pass this alongside the existing `scoredTileHighlights` prop to `BoardGrid`.

**Rationale**: The existing `RoundSummary.highlights: Coordinate[][]` field does not carry player attribution. However, `RoundSummary.words[].playerId` + `words[].coordinates` does. Deriving the color map in `MatchClient` keeps `BoardGrid` dumb about player slots — it just receives a `{key → color}` map and applies it per tile.

**Current state**: `highlights` in `RoundSummary` (match.ts:77) is flat `Coordinate[][]` with no player attribution. `words[]` has `playerId` and `coordinates` per word.

**Derivation logic** (in MatchClient):
```
playerAId = matchState.timers.playerA.playerId
highlightPlayerColors = {}
for word of summary.words:
  color = word.playerId === playerAId ? PLAYER_A_HIGHLIGHT : PLAYER_B_HIGHLIGHT
  for coord of word.coordinates:
    highlightPlayerColors["x,y"] = color
```

**Alternatives considered**:
- Separate `playerAHighlights: Coordinate[][]` + `playerBHighlights: Coordinate[][]` props — clean but requires more prop changes in `BoardGrid`
- Enriching `RoundSummary.highlights` with player attribution — requires server/type change, violates "pure frontend" scope
- CSS classes `--scored-a` / `--scored-b` — needs no inline styles but requires two keyframe variants

---

## 4. CSS Custom Property Approach — `--highlight-color` per Tile

**Decision**: Apply a `--highlight-color` CSS custom property as an inline style on each scored tile. The keyframe references `var(--highlight-color)` for glow color.

**Rationale**: A single keyframe that reads from a custom property supports any color without duplicate CSS. The inline style is scoped to the tile element so each tile can be independently colored. This is the pattern described in the existing `tasks.md T031`.

**Keyframe structure** (700ms total):
```css
@keyframes scored-tile-highlight {
  0%   { opacity: 0; box-shadow: 0 0 0 0 var(--highlight-color); }
  28%  { opacity: 1; box-shadow: 0 0 0 6px var(--highlight-color); }  /* ~200ms fade-in */
  71%  { opacity: 1; box-shadow: 0 0 0 6px var(--highlight-color); }  /* hold ~300ms */
  100% { opacity: 0; box-shadow: 0 0 0 0 var(--highlight-color); }   /* ~200ms fade-out */
}
```

**Reduced motion**: `animation-duration: 0ms` on `.board-grid__cell--scored` under `@media (prefers-reduced-motion: reduce)`.

---

## 5. Animation Phase State Machine — `"idle" | "highlighting" | "showing-summary"`

**Decision**: Three-phase state in `MatchClient`. The tasks.md T032 describes four phases (`idle | highlighting | freezing | showing-summary`), but the frozen tile sequence is simplified: frozen tiles arrive in the same state snapshot as the summary and are already visible on the board before highlights even start. So "freezing" as a separate phase is unnecessary.

**Rationale**: Per spec assumption: "Frozen tile overlay logic already exists and only needs to be sequenced after the highlight phase." The frozen tiles are applied via `applySnapshot()` when the state broadcast arrives — this happens simultaneously with (or just before) the summary broadcast. So FR-004 is already satisfied: frozen overlays are visible the moment highlights start.

**Three-state design**:
- `"idle"` → receive summary broadcast → store `pendingSummary`, set phase to `"highlighting"`
- `"highlighting"` → after 800ms → set phase to `"showing-summary"`, show `RoundSummaryPanel`
- `"showing-summary"` → user dismisses → set phase to `"idle"`, clear `pendingSummary`

**Summary panel gating**: `RoundSummaryPanel` renders only when `animationPhase === "showing-summary"`. The existing `summary` state is not changed; instead a separate `displaySummary` flag gates rendering.

**Reduced motion path**: When `prefers-reduced-motion` is true (detected via `window.matchMedia`), skip the 800ms timer — immediately transition from `"highlighting"` to `"showing-summary"`.

**Alternatives considered**:
- Four phases with explicit "freezing" — adds 200ms artificial delay with no visible benefit since frozen tiles are already applied
- No phase machine, just defer `setSummary` by 800ms — simpler but harder to extend and doesn't handle reduced-motion correctly

---

## 6. `BoardGrid` Prop Changes — Minimal Surface

**Decision**: Add one new optional prop to `BoardGrid`: `highlightPlayerColors?: Record<string, string>`. Keep existing `scoredTileHighlights` and `highlightDurationMs` props unchanged in signature but update default for `highlightDurationMs` from 3000 to 800.

**Rationale**: Minimal interface change. The existing `isTileInHighlights` helper remains unchanged. A new lookup `highlightPlayerColors[tileKey]` provides the per-tile CSS color. When `highlightPlayerColors` is absent, the tile gets no `--highlight-color` variable (the CSS falls back gracefully to transparent/invisible glow).

---

## 7. Existing Infrastructure Confirmed

**Findings from codebase audit**:

- `board-grid__cell--scored` CSS class: ✅ already applied in `BoardGrid.tsx:466`
- `activeHighlights` state with timer: ✅ already exists in `BoardGrid.tsx:174`
- `isTileInHighlights()` helper: ✅ already exists at `BoardGrid.tsx:95`
- `PLAYER_A_HIGHLIGHT` / `PLAYER_B_HIGHLIGHT` constants: ✅ `playerColors.ts:11-13`
- Reduced motion for swap animation: ✅ `board.css:67-71`
- Reduced motion for score-delta popup: ✅ `board.css:179-183`
- Reduced motion for scored-tile highlight: ❌ **MISSING** — needs to be added
- Player-colored glow on scored tiles: ❌ **MISSING** — keyframe uses hardcoded green
- Animation phase sequencing in MatchClient: ❌ **MISSING** — summary shows immediately
- `highlightDurationMs` in MatchClient: ❌ **WRONG** — currently 3000, needs 800

---

## 8. No Server Changes Required

**Confirmed**: All required data is present in the existing `RoundSummary` type:
- `words[].playerId` — player attribution
- `words[].coordinates` — tile positions
- `highlights` — existing coordinate list (still used for the `scoredTileHighlights` prop)

No schema migrations, Server Actions, or API changes needed.

---

## Summary: All NEEDS CLARIFICATION Resolved

| Question | Answer |
|----------|--------|
| Animation duration | 700ms CSS, 800ms JS timer (end-of-range buffer) |
| Player color source | Existing `PLAYER_A_HIGHLIGHT` / `PLAYER_B_HIGHLIGHT` from `playerColors.ts` |
| Highlight attribution | Derived from `summary.words[].playerId` + `words[].coordinates` in MatchClient |
| CSS color application | `--highlight-color` CSS custom property per tile via inline style |
| Phase count | 3 phases: idle → highlighting → showing-summary |
| Reduced motion | `animation-duration: 0ms` in CSS + immediate JS transition |
| Frozen tile sequencing | Already satisfied by simultaneous state broadcast; no artificial delay needed |

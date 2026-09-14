# Contract: room component props and test ids

Component boundaries for `components/room/`. Every component is a Client Component unless noted; each stays under 300 lines and each function under 20 lines (Constitution VI). Props are the full public surface — no context reads except `roomStore` in `Room` and `RoomShell`.

## `Room`
```ts
interface RoomProps { phase: RoomPhase }   // reads roomStore; composes the rest
```
Renders `<div data-testid="room" data-phase={phase}>` with `PlayerBar(top)`, `Field`, `PlayerBar(bottom)`, `Ledger` (or `LiveRowOnly` + `LedgerSheet` below 900px).

## `PlayerBar`
```ts
interface PlayerBarProps {
  seat: "you" | "opp";
  position: "top" | "bottom";
  state: "empty" | "searching" | "found" | "playing" | "final";
  name?: string; rating?: number; subline: string;          // one line, nowrap
  clockMs?: number; clockRunning?: boolean; budgetMs: number; // 300_000
  score?: number;
  disconnected?: { untilMs: number } | null;
  action?: ReactNode;                                         // primary action when the seat is empty
  nameInput?: { value: string; onChange(v: string): void; onSubmit(): void } | null; // landing
}
```
Test ids: `player-bar-top`, `player-bar-bottom`, `player-bar-clock`, `player-bar-lane` (role=progressbar, aria-valuemin=0, aria-valuemax=300, aria-valuenow=<s>, aria-valuetext="6:45 remaining, running"), `player-bar-score`, `player-bar-subline`, `player-bar-name-input`, `player-bar-action`.

## `Field`
```ts
interface FieldProps {
  board: string[][];
  frozenTiles: FrozenTileMap;
  bands: WordBand[];
  interaction: FieldInteraction;
  ownPins: [Coordinate, Coordinate] | null;
  oppPins: [Coordinate, Coordinate] | null;
  shakeAt: Coordinate | null;
  viewerSlot: PlayerSlot | null;
  highlightRound: number | null;         // ledger row hover → dim other bands
  disabled: boolean;                     // final / read-only
  onEvent(event: FieldEvent): void;
}
```
Test ids: `field`, `field-cell` (+ `data-x`, `data-y`, `data-state`), `field-band` (+ `data-seat`, `data-direction`, `data-round`), `field-live`. Cells: `role="gridcell"`, `aria-label="row 8, column F, T, value 2, free"`. Keyboard: arrows, Space, Enter, Escape handled in `Field`; `?` and `M` handled in `Room`.

## `FieldBands` (child of `Field`, SVG)
```ts
interface FieldBandsProps { bands: WordBand[]; highlightRound: number | null; drawnCount: number | null }
```

## `Ledger`
```ts
interface LedgerProps {
  variant: "match" | "final" | "lobby" | "queue";
  model: LedgerModel;
  notices: Notice[];
  viewerName: string; opponentName: string | null;
  onRowHover(round: number | null): void;
  onAction(action: LedgerAction): void;  // "rules" | "resign" | "confirmResign" | "cancelResign" | "rematch" | "acceptRematch" | "declineRematch" | "newOpponent" | "lobby" | "cancelQueue" | "toggleSound" | "togglePreview" | "signOut" | "profile" | "claimWin" | { challenge: playerId }
}
```
Test ids: `ledger`, `ledger-caption`, `ledger-header`, `ledger-row-<n>`, `ledger-live-row` (aria-live=polite), `ledger-territory`, `ledger-hint`, `ledger-notice`, `ledger-foot`, `ledger-menu`, `verdict` (aria-live=assertive), lobby: `ledger-here-now`, `ledger-last-matches`, `ledger-challenge-<playerId>`.

## `LedgerSheet` (below 900px)
```ts
interface LedgerSheetProps extends LedgerProps { open: boolean; onClose(): void }
```
Test id: `ledger-sheet`. Focus-trapped; opens from `ledger-live-row`.

## Hooks (`components/room/hooks/`)
- `useFieldSize(roomRef): number` — ResizeObserver, `min(available, 720)`.
- `useReveal(plan): RevealProgress`.
- `useClockTick(timers, running): { youMs, oppMs }`.
- `useMeasuredLines(rowRefs): number[]`.
- `useReducedMotion(): boolean`.

## Retired test ids (delete with their components)
`hud-card`, `round-pip-bar`, `your-move-card`, `scored-words-card`, `tiles-claimed-card`, `move-lock-banner`, `round-announce`, `match-ring`, `post-game-scoreboard-card`, `rematch-banner`, `board-grid`, `board-tile`, `board-coords-top`, `board-coords-left`, `move-feedback-toast`, `score-delta-popup`, `round-history-panel`, `final-summary-*`, `landing-login-form`, `matchmaker-start-button`, `topbar`, `dialog-backdrop` (match), `profile-word-cloud`.

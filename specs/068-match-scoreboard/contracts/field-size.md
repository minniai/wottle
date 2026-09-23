# Contract: `computeFieldSize`

```ts
export type RoomLayout = "bars" | "scoreboard";
export interface FieldSizeOptions {
  layout?: RoomLayout;          // default "bars"
  paddingX?: number;
  ledgerWidth?: number;         // 0 on the one-column phone layout
  gutter?: number;
  scoreboardHeight?: number;    // 3 × row + frame: 123 desktop, 105 phone
}
export function computeFieldSize(width: number, height: number, opts?: FieldSizeOptions): { cell: number; field: number };
```

| Case | Result |
|---|---|
| scoreboard, 1440×900, ledger 340, gutter 56 | `{ cell: 71, field: 713 }` |
| scoreboard, 1280×800 | whole cell, `field = cell × 10 + 3` |
| scoreboard, 1000×800, ledger 260, gutter 40 | width-bound: field + 260 + 40 + padding ≤ 1000 |
| scoreboard, phone 390×844 | `field = min(358, width − 32)` = 358, `cell = field / 10` (fractional allowed: the phone ledger sits below the field, so no rows must line up) |
| bars (lobby, queue) | unchanged below 901px wide; width-bound on desktop (fixes the 901–1100 overflow) |
| every case | never negative; `cell` is an integer |

`Room` sets `--field-size: {field}px` and `--cell-size: {cell}px`. Ledger move rows use `--cell-size`, and scoreboard rows use `--sb-row`.

Whole-pixel cells apply only on desktop, where the ledger's rows sit beside the board's rows (clarification Q2). On a phone the field keeps FR-016's `min(358, 100vw − 32)`.

# Contract: the slip

The one element ever drawn over the field (DS §5.9, amended §1.1 / §1.9 / §10).

## Rendering

- Mounted by `Room` inside `.room__field-slot` (which gains `position: relative`) when `useRoomStore().slip !== null`; the slot gains `data-slipped="true"` and the `Field` inside it is faded to `opacity: 0.32` (transition 150ms, 0ms under reduced motion via the existing `.room *` block; the slip is never portaled).
- The dialog root carries `data-field-safe` so a pointerdown on it does not cancel a pick (`useFieldInteraction`).
- `<div role="dialog" aria-modal="true" aria-labelledby=… data-testid="slip" data-kind={kind}>`: `--paper` fill, `1.5px solid var(--ink)` frame, `border-radius: 0`, no shadow, padding 28/28/24 (20 on phones), width 420 (`matchOver` 440, `signIn` 420, phones `min(300px, 100%)`), centred in the slot.
- Focus: `useFocusTrap({ isActive: true, initialFocusRef: primaryAction, onEscape, restoreFocus: true })`. Escape maps to the slip's cancel action where one exists (`resign` → `keepPlaying`, `claimWin` → `keepWaiting`, `matchOver` → `reviewField`); `signIn` has no cancel.
- Announcement: the headline is in a `role="status" aria-live="assertive"` region rendered once per slip mount.
- Motion: 150ms opacity in/out with the field fade; `prefers-reduced-motion` → 0ms.

## Kinds

| kind        | label line                                                                          | headline                                                               | body                                                                                                                   | actions (first is primary)                                                                                                                                                             | test id of primary              |
| ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `signIn`    | —                                                                                   | `wottle` (wordmark 28px) + `two players · one field · Icelandic words` | `NameInput` (label `your name`) + error line                                                                           | `play ▸` · `no account needed` · `new here · how to play ▸`                                                                                                                            | `player-bar-action-play` (kept) |
| `resign`    | `round 4 of 10 · 4:12 on your clock`                                                | `Resign the match?`                                                    | `Kári wins · your rating moves as a loss`                                                                              | `yes, resign ▸` · `keep playing ▸`                                                                                                                                                     | `slip-confirm-resign`           |
| `claimWin`  | `round 4 of 10`                                                                     | `Kári is gone`                                                         | `0:00 left to reconnect`                                                                                               | `claim the win ▸` · `keep waiting ▸`                                                                                                                                                   | `slip-claim-win`                |
| `matchOver` | `match over · 10 rounds · 18:50` (+ `· resigned` / `· out of time` / `· Kári left`) | `Kári wins` in the winner's seat colour, `draw` in ink                 | score `170 – 127` (40px mono, each total in its seat's ink), detail line, two rating rows (`■ Kári 1187 → 1199 · +12`) | `rematch ▸` · `new opponent ▸` · `review the field ▸` · `lobby`; read-only: `lobby` only; rematch incoming replaces the action row with `Kári asks for a rematch · accept ▸ · decline` | `slip-rematch`                  |
<!-- zen:cols=125,200,176,230,347,107 -->

## Store API

```ts
setSlip(next: SlipState): void        // no-op if the current slip outranks next
clearSlip(kind: SlipState["kind"]): void
slipDismissed: boolean                 // final phase only; `result ▸` in the foot sets it false
```

Precedence: `matchOver` > `claimWin` > `resign` > `signIn`.

## Timing

- `matchOver`: `setSlip` runs `MATCH_OVER_DELAY_MS = 600` after `useReveal` reports `settled` for the final round; when the controller mounts with `completed === true` and nothing to reveal (reload), immediately.
- `claimWin`: set when `reconnectMsLeft === 0`; cleared when `disconnectedPlayerId` clears.
- `resign`: set by the `resign`/`leave` ledger action; no expiry (replaces `RESIGN_CONFIRM_MS`).

## Tests

- `tests/unit/lib/room/slip.spec.ts` — precedence, clear by kind, signIn cleared by `setViewer`.
- `tests/unit/components/room/Slip.spec.tsx` — each kind renders its strings and actions; Escape dispatches the cancel; focus lands on the primary and is restored on close.
- `tests/integration/ui/room-fixtures.spec.ts` — `landing-slip`, `resign`, `claim-win`, `over-slip` baselines; axe clean with the slip up.
- `tests/integration/ui/match-completion.spec.ts` — both clients show the slip after round 10; `review the field ▸` lifts it; `result ▸` restores it.

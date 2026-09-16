# Superseded

**Scope superseded:** the UI part only — the rematch negotiation and series tracking stay.

The UI described in this spec was retired by the Field & Ledger rebuild (2026-09-14). Its replacement
is live-row-styled notices in the ledger (`<name> asks for a rematch · accept ▸ · decline`) and the final room state; `RematchBanner`, `RematchInterstitial` and `FinalSummary` are retired. See `docs/design_documentation/README.md`, the plan
`docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md` (§11 order of work) and the
feature spec `specs/044-field-ledger-redesign/spec.md`.

The folder is kept for history. Any engine or server behaviour this spec introduced remains valid.

**Replacing pieces (2026-09-14, US9):** `lib/room/useRematchNegotiation.ts` (events arrive through the room's single match channel), rendered by `components/room/Ledger.tsx` as live-row lines (`<name> asks for a rematch · accept ▸ · decline`, `waiting for <name>`, `<name> declined`) and the foot actions `rematch ▸ · new opponent ▸ · lobby` in `MatchRoomController`. Server actions and `rematch_requests` unchanged. `/match/[id]/summary` now redirects to the room.

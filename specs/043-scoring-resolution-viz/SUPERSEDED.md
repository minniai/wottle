# Superseded

**Scope superseded:** the whole UI part.

The UI described in this spec was retired by the Field & Ledger rebuild (2026-09-14). Its replacement
is current-round words drawn as live bands at 30% tint that settle to 14%, pins that fade, no locked frame, no lock banner (`Field`). See `docs/design_documentation/README.md`, the plan
`docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md` (§11 order of work) and the
feature spec `specs/044-field-ledger-redesign/spec.md`.

The folder is kept for history. Any engine or server behaviour this spec introduced remains valid.

**Replacing hooks (2026-09-14):** `components/room/hooks/useReveal.ts` + `lib/room/revealSequence.ts` (`planReveal`) draw the current round's words as live bands (30 %) that settle to 14 %; `useFieldInteraction` pins replace the swap lift; there is no locked frame or lock banner.

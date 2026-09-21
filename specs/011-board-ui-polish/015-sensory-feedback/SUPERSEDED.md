# Superseded

**Scope superseded:** the sequential-reveal part only — audio and haptics stay.

The UI described in this spec was retired by the Field & Ledger rebuild (2026-09-14). Its replacement
is the reveal choreography (bands draw 400ms each, staggered 120ms) in `Field`; sound is toggled from the ledger's `⋯` menu. See `docs/design_documentation/README.md`, the plan
`docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_PLAN.md` (§11 order of work) and the
feature spec `specs/044-field-ledger-redesign/spec.md`.

The folder is kept for history. Any engine or server behaviour this spec introduced remains valid.

**Replacing hooks (2026-09-14):** the sequential reveal is `planReveal`/`useReveal` (400 ms per band, 120 ms stagger, `playWordDiscovery` tick per band); reduced motion collapses the plan to a single settle step. Audio/haptics hooks are unchanged and toggled from `components/room/RoomMenu.tsx`.

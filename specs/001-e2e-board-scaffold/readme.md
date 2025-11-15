# MVP E2E Board Scaffold (Milestone M0)

This milestone delivers the automated Supabase quickstart workflow and the weighted 10x10 board seed that underpin the subsequent user stories.

## Included in M0

- Supabase CLI preflight checks, local stack automation, and structured quickstart logging
- Weighted, deterministic-by-match-id board generator (Icelandic alphabet coverage)
- Seed/reset scripts wired to the generator with service-role isolation
- Updated documentation (`quickstart.md`) and checklist entries covering the automation

## Deferred to Future Milestones

- Competitive gameplay features (dictionary validation, scoring, frozen tiles, timers, matchmaking)
- UI board rendering, swap interactions, and feedback flows (User Stories 2–4)
- Performance instrumentation beyond the quickstart baseline

For full requirements and clarifications, see `specs/001-e2e-board-scaffold/spec.md`.


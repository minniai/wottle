# Server Actions

This directory hosts server-side actions that orchestrate Supabase operations.

- `getBoard` (Phase 4) will fetch the immutable board grid.
- `swapTiles` (Phase 5) will perform validated swaps and persist move audits.

Keep this folder limited to server-only modules. Client components should access
these actions via the Next.js App Router conventions (e.g., form actions or
`useTransition`).

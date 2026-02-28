# Quickstart

No new dependencies or external services are introduced. The GameConfig is purely an internal data structure used to enforce parameters on the game engine logic.

To interact with the new rules:
1. Modify `lib/constants/game-config.ts` (or equivalent location established during implementation).
2. Run standard suite of unit tests to verify:
   ```bash
   pnpm test:unit
   ```

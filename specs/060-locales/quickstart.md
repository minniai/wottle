# Quickstart: 060-locales

```bash
pnpm supabase:migrate          # applies 20260922001/002 (additive)
pnpm dev
```

1. `http://localhost:3000/` → Icelandic sign-in slip, wordmark `orðusta`, `<html lang="is">`.
2. `http://localhost:3000/is/lobby` → 308 to `/lobby`.
3. `http://localhost:3000/en` → English, `wottle`, `<html lang="en">`.
4. Two browsers at `/en/lobby` → `find an opponent ▸` → English board (A–Z only); form `CAT` → scores.
5. One browser at `/lobby`, one at `/en/lobby`, both queue → never paired; each sees only its own lobby.
6. Open an English match at `/match/<id>` → lands on `/en/match/<id>`.
7. `/lobby` foot `english ▸` → `/en/lobby`, same player.
8. Finish an English match → `/en/profile/<name>` rating changed; `/profile/<name>` unchanged.

Checks:

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm docs:check
pnpm test:visual               # en baselines unchanged; is set present
pnpm test:integration
pnpm exec playwright test --project=chromium
pnpm perf:move-resolve
```

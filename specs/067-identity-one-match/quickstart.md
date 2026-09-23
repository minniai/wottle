# Quickstart: Identity, and one commitment at a time

## Setup

```bash
pnpm quickstart            # now also writes WOTTLE_SESSION_SECRET to .env.local if it is absent
pnpm supabase:migrate      # applies 20260923001–004 (identity columns, match creation, claim, sign-out)
pnpm dev
```

A manual `.env.local` needs `WOTTLE_SESSION_SECRET=$(openssl rand -base64 48)`. Without it, the first request that touches a session throws `SessionSecretMissingError`.

## Verify by hand

1. **Forgery (US1).** Enter as `birna`. In devtools, change one character of `wottle-playtest-session` and reload: the sign-in slip appears. Replace the value with `base64url({"player":{"id":"<another id>"}})` and reload: the slip appears again.
2. **Name taken (US2).** In a private window, enter `birna`. The error line reads `that name is taken · pick another`. `BIRNA` fails the same way.
3. **Silent renewal (US2-4).** In the first window, delete only `wottle-playtest-session` and reload: you are still Birna, and there is a new session cookie.
4. **Returning door (US3).** Sign out from the lobby menu. The slip shows `WELCOME BACK`, `Birna` with a teal square, and `1310 · english` (or the language alone). `enter the lobby ▸` brings you back as Birna. `not Birna? · use another name` shows the input. Entering `embla` works, and afterwards the browser can enter as either name.
5. **Sign-out (US4).** In a match, the menu offers no sign-out. `/profile` hides it too. Calling the action anyway returns `sign_out_in_match`.
6. **One match (US5).** Birna challenges Embla. Kári and Birna pair through the queue. Embla accepts: `Birna can't play right now`, and no new match row appears.
   - Crossed: Birna challenges Kári, and Kári challenges Birna. One match is created, and both invites are closed.

## Automated

```bash
pnpm test:unit -- tests/unit/auth                                   # sign/verify, device key, proxy renewal, redirects
pnpm test:unit -- tests/unit/match/one-way-to-make-a-match.test.ts  # grep: no matches insert outside SQL
pnpm test:integration -- tests/integration/db/create-match-between.test.ts  # 100+ concurrent races (SC-004), needs local Supabase
pnpm test:integration -- tests/integration/db/enter-player.test.ts          # simultaneous claims, name_taken, resolve_claim
pnpm exec playwright test --grep "@identity"                         # name-taken + returning door, two browser contexts
pnpm test:visual                                                     # adds the returning-slip phase (en + is)
```

## Release runbook

1. Set `WOTTLE_SESSION_SECRET` in Vercel for production and preview, a different value in each, **before** merging.
2. Choose a moment when `select count(*) from matches where state = 'in_progress'` returns 0.
3. Apply the migration, then deploy. Every player is signed out once and types their name to claim it (clarification Q3).
4. Watch `auth.session.rejected{reason:legacy}` fall to zero, and `match.create.refused` for unexpected `invalid`.

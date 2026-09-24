# Quickstart: Invite links and profiles

## Setup

```bash
pnpm quickstart            # or: pnpm supabase:migrate (applies 20260927001_invite_links_profiles.sql)
pnpm dev
```

Two browsers: A (normal window) and B (private window, or another browser).

## Manual walk

1. **Invite from an empty lobby.** A signs in at `/` as `birna`. With nobody else in the lobby, `bjóða vini ▸` is the primary. Press it: the slot reads `Tengill afritaður · gildir í 9:58` with a 10:00 drain, and the clipboard holds `http://localhost:3000/c/<43 chars>`.
2. **Previews are harmless.** Run `curl -s -A Slackbot-LinkExpanding <link> > /dev/null` five times. The link is still valid (A's slot unchanged; `select status from match_links` = `pending`).
3. **A friend accepts.** B opens the link: the invite door, with the band `Birna skorar á þig · 1200 · íslensk orð · tengill gildir í 9:4x`. Type `kari`, press `samþykkja ▸`. B lands on the table, seated. A's tab moves to the same table (hide A's tab first to hear the cue and see the title and notification). A presses `ég er til ▸`, the 3·2·1 runs, and the match starts.
4. **Single use.** Open the same link again in B: `þessi tengill er útrunninn`, primary `inn í lobbíið ▸`.
5. **The friend leaves while the sender is away.** Make a new link in A, then close A's tab. B accepts, then presses `leave`: the table voids as `not_seated` for A; B can search at once (no cooldown even after doing this twice).
6. **Signed-in recipient.** A makes a link; B (signed in as `kari`) opens it: the URL becomes `/`, the slot reads `Birna býður þér með tengli · samþykkja ▸`. Accept → the table.
7. **Own link.** A opens its own link: the lobby with `þetta er tengillinn þinn · afrita ▸`.
8. **Other locale.** Open an Icelandic link under `/en/c/<token>`: it redirects to `/c/<token>`.
9. **One outgoing.** With a link out, open a row's composer: line 3 reads `tengillinn þinn fellur úr gildi`. Send: the link slot is replaced by the sent state, and the old link reads expired.
10. **Own profile.** Click `■ Birna ▸`: name, rating, sub-lines, chart, form strip, record, best words, recent matches, the other-language link and sign out. With no matches: the new-player lines.
11. **Public profile.** From the English lobby, click a name: their seat colour, `HERE NOW`, `CHALLENGE ▸` with the stakes. Challenge → the composer in column B → `send challenge ▸` → the primary slot reads `sent · 0:5x` and the line slot `withdraw ▸`. In devtools, search the page source and RSC payload for `last_seen`: nothing.
12. **Rules.** `how to play ▸` from the door, the lobby, a profile and the phone `⋯`, and from a match's `⋯` (it opens a new tab whose primary is `loka flipanum ▸`, which closes it).
13. **Review link.** On a finished match's review, `⋯ → afrita tengil ▸`; open it signed out: the review.

## Fixtures

- `/dev/page?phase=`:
  - invite door: `invite-door`, `is-invite-door`, `invite-door-expired`, `invite-door-returning`;
  - lobby: `lobby-link-out`, `lobby-link-call`, `lobby-own-link`, `lobby-empty-invite`;
  - own profile: `profile-own`, `is-profile-own`, `profile-own-new`, `profile-own-call`;
  - public profile: `profile-public`, `profile-public-sent`, `profile-public-in-match`, `profile-public-away`, `profile-public-signed-out`, `profile-missing`;
  - rules: `rules`, `rules-from-match`.
- `/dev/room?phase=`: `table-link-waits`, `review-copy-link`.
- The phone views are `phone-profile`, `phone-profile-public` and `phone-invite-door`.

## Gates

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
pnpm test:integration -- tests/integration/db/link.test.ts tests/integration/db/link.race.test.ts
pnpm exec playwright test tests/integration/ui/invite-link-flow.spec.ts   # two browsers, run alone
pnpm exec playwright test tests/integration/ui/profile.spec.ts
pnpm test:visual                                                           # new phases; baselines only via --update-snapshots
pnpm perf:link-accept                                                      # accept_link < 200ms p95
pnpm docs:check && pnpm guard:no-service-role
```

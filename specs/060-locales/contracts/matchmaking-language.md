# Contract: matchmaking by language

- `startQueueAction(input: { language: Language })` (Zod) → `startAutoQueue(client, playerId, language)`: sets `status='matchmaking', queue_language=language`; candidates `.eq("queue_language", language)`; claim update `.eq("status","matchmaking").eq("queue_language", language)`; match created with `language`.
- Leaving the queue (cancel, match found, sweep) sets `queue_language = null`.
- Presence: `POST /api/lobby/presence` and login upsert `lobby_presence.language`; snapshot, count (`matches-in-progress` stays global) and `players` directory filter by `?language=`; Realtime channel `lobby-presence:${language}`.
- Invite: `sendInvite({ recipientId, language })` rejects (`code: "invite_failed"`) when the recipient's presence language differs; row stores `language`; `acceptInvite` → `bootstrapMatchRecord({ …, language: invite.language })`.
- Rematch: `requestRematch` / `respondToRematch` read `language` from the original match.
- Match page: `app/[locale]/(room)/match/[matchId]/page.tsx` loads the match; if `match.language !== locale.language` → `redirect(localePath(localeForLanguage(match.language), \`/match/${id}\`))`.
- Tests: unit (`inviteService` candidate query includes the filter; mismatched invite rejected); integration (`tests/integration/db`) two players in different languages never claim each other; Playwright `cross-language-queue.spec.ts`.

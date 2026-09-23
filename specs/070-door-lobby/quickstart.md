# Quickstart: verifying spec 070 by hand

Prerequisites: `pnpm quickstart` has run, then `pnpm supabase:migrate`, then `pnpm dev`. Use two browsers (or one normal window and one private window), A and B.

## 1. The door
1. In A, open `/`. You should see the ORÐUSTA × WOTTLE lockup, the headline `Tveir leikmenn, eitt borð,`, a name field, `INN Í LOBBÍIÐ ▸`, and `HÉR NÚNA` with the players who are here (or `Enginn hér enn.`). There should be no field.
2. Open `/en`. The lockup should be WOTTLE × ORÐUSTA, crossing at O.
3. Type `ab` and press Enter. The error line should show the format rule and the input should be marked invalid.
4. Enter as `Birna`. The URL should stay at `/`, and the lobby should render with Birna's block, the form strip, `HÉR NÚNA` and `SÍÐASTA VIÐUREIGN` (or the new-player state).

## 2. Presence
1. In B, enter as `Kári`. Within about a second, A's `HÉR NÚNA` should list Kári as `hér`, with `SKORA Á ▸`.
2. Hide B's tab (switch to another tab) for two minutes. A should show Kári as `fjarverandi`, muted, with no action.
3. Close B's tab. Kári should disappear from A's list within 8 seconds.
4. Reopen `/` in B, then reload it. Kári should never drop out of A's list during the reload.

## 3. Challenges
1. In A, press `SKORA Á ▸` on Kári. The row should open and read `GILDIR TIL ELO · SIGUR +N · JAFNTEFLI … · TAP −N · ÍSLENSK ORÐ · 10 LEIKIR HVOR · EIN 5:00 KLUKKA`, with focus on `SENDA ÁSKORUN ▸`.
2. Send. A's line slot should read `Áskorun send · Kári · 0:59` with `draga til baka ▸` and a draining bar. Kári's row should read `send · 0:5x`.
3. In B (on `/rules`, with the tab hidden), the tab title should become `(1) Birna skorar á þig · Orðusta` and the favicon letter should turn terracotta. After a click anywhere in B, the cue should play on the next challenge.
4. In B, press `hafna`. A's slot and Kári's row should both read `hafnaði` for four seconds, then the row should read `aftur eftir 0:5x`. Sending again within 60 seconds should be refused.
5. After 60 seconds, send again and accept in B. Both A and B should be taken to the table (spec 069), with A seated by the input rule.

## 4. Search from the lobby
1. In A, press `FINNA MÓTSPILARA ▸`. The slot should read `Leitar að mótspilara · 0:0x` with `hætta við ▸` and the sweep, and the URL should not change.
2. Open a row's composer. Its line 3 should read `leitin hættir ef þú sendir`.
3. Go to `/rules`. The same slot should keep counting.

## 5. Lobby language
1. In A (in the Icelandic lobby, searching), type `/en` in the address bar. The English lobby should render with find and challenge turned off, and the slot should read `you are in the Icelandic lobby · switching cancels your search · switch ▸`.
2. Press `switch ▸`. The search should stop, and A should now be listed in the English lobby only.

## 6. Leave slip
1. Start a match between A and B. In A, pick a letter, then press the browser's Back button. The `Fara úr viðureigninni?` slip should open with `VERA ÁFRAM ▸` focused.
2. Choose `fara í lobbíið`. A's lobby slot should read `Viðureignin þín · Kári` with `AFTUR Í VIÐUREIGNINA ▸`. B's scoreboard should read `brá sér frá` for A.
3. Let the clock run out. A's slot should read `Viðureigninni er lokið · …` with `ÚRSLIT ▸`.

## 7. Gates
Run `pnpm test:unit && pnpm test:integration && pnpm lint && pnpm typecheck && pnpm docs:check && pnpm test:visual && pnpm perf:heartbeat && pnpm perf:standing`, then `pnpm exec playwright test door lobby-challenge line-slot leave-slip presence --project=chromium`.

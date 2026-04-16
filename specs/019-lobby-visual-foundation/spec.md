# Feature Specification: Lobby Visual Foundation

**Feature Branch**: `019-lobby-visual-foundation`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "Replace the playtest-style lobby with a branded, mobile-first lobby built on a new lightweight design-system layer (Button / Card / Dialog / Avatar / Badge / Skeleton / Toast) and brand tokens. Ship a hero with wordmark and tile motif, live stats strip, primary Play Now zone with mode pills (Ranked only active in this iteration), player directory with generated gradient-initials avatars and Challenge affordance, Dialog-based invite flow with focus trap, skeleton and empty states, and a motion language that respects prefers-reduced-motion. Visual and interaction only; no backend or matchmaking-logic changes. Warm Editorial brand: deep navy surfaces, cream text, citron-amber accent; Fraunces display font paired with existing Inter for UI via next/font."

## Overview

Today the Wottle lobby is labelled "Phase 3" and reads as an internal playtest harness: text-only player cards, a login form that competes with the primary call-to-action, no avatars, no brand identity, no live social signal, and no visual polish that communicates "Icelandic word duel." This feature replaces that screen with a professional lobby that signals the game, gets a returning player into their next match quickly, and establishes a design vocabulary the rest of the product can inherit.

Scope is visual and interaction design only. Matchmaking algorithms, presence tracking, Elo calculation, session handling, and all existing server actions are untouched.

## Clarifications

### Session 2026-04-16

- Q: When a player taps the Challenge action on an opponent's card, does it send the invite immediately or open the invite dialog first? → A: Dialog-first — tap opens the invite dialog with the opponent pre-selected; the user must confirm inside the dialog to send.
- Q: What form should the hero's tile motif take? → A: Rotating Icelandic nouns rendered as tile glyphs, cycling every ~5s via letter flip/fade. Reduced-motion fallback: one fixed word. The Icelandic product name **ORÐUSTA** (a portmanteau of *orð* "word" + *orrusta* "battle", mirroring the English "Wottle" = *word* + *battle*) MUST appear in the word rotation set and MAY anchor the wordmark typography.
- Q: How live must the lobby's live stats strip be? → A: Online-players count updates reactively as players join or leave (no user action required); matches-in-progress count refreshes at least every 10 seconds. No new real-time channel is introduced solely for stats.
- Q: What is the relationship between the Play Now button and the mode pills? → A: Pills represent mode-selection state. Ranked is pre-selected on load; Play Now dispatches a queue for the currently-selected mode. Casual and Challenge pills are disabled (not selectable) this iteration, so Ranked is effectively the only reachable selection, but the interaction shape is future-ready for when those modes ship.
- Q: How does the directory behave when many players are online? → A: Soft cap: render the first 24 online players (ordered by availability, then rating proximity to the viewer, then most-recently-seen) with an explicit "Show all N" control revealing the remainder inline. No virtualisation or pagination this iteration; search/sort/filter land in a later iteration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning player starts a match fast (Priority: P1)

A logged-in player lands on the lobby and wants to be in a ranked match as quickly as possible. They see a single dominant Play Now action above the fold with their current rating visible, tap or click it, and are matched and navigated into the game.

**Why this priority**: This is the primary job of the lobby. Every returning session starts here, and friction at this step compounds across the retention funnel (PRD §9 targets day-1 retention ≥ 30 %, average session 6–10 minutes).

**Independent Test**: Deploy the new lobby, log in as an existing user, start a stopwatch, click Play Now once, observe that the app transitions to a match screen within the existing matchmaking SLA (<10 s with another waiting player). No other navigation or form filling required.

**Acceptance Scenarios**:

1. **Given** a returning player is logged in, **When** the lobby loads on any supported viewport, **Then** a Play Now action is visible without scrolling and is the single most visually prominent element on the page.
2. **Given** the player activates Play Now, **When** matchmaking succeeds, **Then** the app transitions to the match view with a clear "match found" announcement that screen readers receive.
3. **Given** the player activates Play Now and no opponent is immediately available, **Then** the action transitions into a queued state that preserves the CTA's dominance and shows elapsed queue time.
4. **Given** the player is already queued, **When** they view the lobby, **Then** they see an explicit cancel-queue affordance in place of Play Now.

---

### User Story 2 - First-time visitor learns what Wottle is and signs in (Priority: P1)

A visitor who has never seen Wottle before lands on the lobby URL. Within a few seconds they understand it is a competitive Icelandic word-duel game, and they can pick a username and enter the lobby in one step without navigating away.

**Why this priority**: The front door determines whether new users proceed at all. The current lobby does not communicate what Wottle is until the user is inside a match.

**Independent Test**: Show the logged-out lobby to a 5-person panel unfamiliar with Wottle. Measure time-to-identify ("what kind of site is this?") and conversion (did they pick a username and enter?). Target: ≥ 4 of 5 correctly identify a word game within 3 seconds; ≥ 4 of 5 complete sign-in on first attempt.

**Acceptance Scenarios**:

1. **Given** a logged-out visitor loads the lobby, **When** the page renders, **Then** a branded hero communicates the product identity (game name, tagline, and a word/tile motif) within the first screenful.
2. **Given** a visitor wants to sign in, **When** they look for an entry action, **Then** a username entry is integrated with the primary call-to-action zone so it does not compete with the lobby list or any other interactive surface.
3. **Given** a visitor enters an invalid username, **When** they submit, **Then** an inline error appears with specific remediation guidance, and the submission does not navigate away.
4. **Given** a visitor enters a valid username, **When** they submit, **Then** they land on the logged-in lobby view with their own player record highlighted.

---

### User Story 3 - Player browses the directory and challenges a specific opponent (Priority: P2)

A player wants to play a specific person visible in the lobby. They scan the player list, see each person's avatar, display name, rating, and availability at a glance, pick a competitive opponent, and send a direct challenge.

**Why this priority**: Direct challenges are a key PRD flow (Challenge Mode, PRD §3.1). Today the UX is a hidden dropdown; surfacing per-card "Challenge" affordances and avatars is the biggest lift in perceived polish.

**Independent Test**: Log in with two accounts in two browsers. From account A, locate account B in the directory, trigger Challenge from the card, confirm account B receives an invite, accept, confirm both navigate to the same match.

**Acceptance Scenarios**:

1. **Given** the lobby has two or more online players, **When** the directory renders, **Then** each player card shows an avatar (either their uploaded avatar or a deterministic gradient-and-initials fallback), display name, rating, rating-difference from viewer, and a status indicator.
2. **Given** a player card is not the viewer's own card, **When** it is the `available` status, **Then** a Challenge action is directly invokable from the card and opens the invite dialog with that opponent pre-selected, without requiring the user to navigate through a separate menu first.
3. **Given** a player card belongs to a player already in a match, **When** the viewer tries to challenge them, **Then** the Challenge action is disabled with an accessible explanation that the player is currently in a game.
4. **Given** the Challenge action opens the invite dialog, **When** the dialog renders, **Then** it appears as a proper modal with focus trap, escape-to-close, and backdrop dismissal, and shows the pre-selected opponent plus an explicit confirmation control that actually sends the invite.
5. **Given** the invite dialog is open with an opponent pre-selected, **When** the viewer dismisses the dialog without confirming, **Then** no invite is sent.

---

### User Story 4 - Keyboard and screen-reader users navigate the lobby without barriers (Priority: P2)

A keyboard-only user and a screen-reader user each complete the entire lobby flow — sign in, view the directory, start Play Now, receive and respond to an invite — with no mouse input and with all state changes announced.

**Why this priority**: The constitution and PRD §3.1 both require WCAG 2.1 compliance. The current lobby's invite dropdown is inaccessible (no focus trap, no dialog semantics). Fixing this during a visual overhaul is cheaper than retrofitting later.

**Independent Test**: Run an automated accessibility audit against the logged-out and logged-in lobby routes (zero serious or critical violations). Manually complete the full flow keyboard-only and with VoiceOver on macOS/Safari and NVDA on Windows/Firefox.

**Acceptance Scenarios**:

1. **Given** a keyboard-only user loads the lobby, **When** they press Tab repeatedly from the top of the page, **Then** focus moves through hero → primary CTA → directory cards → footer controls in a logical visible order, with no focus traps outside dialogs.
2. **Given** an invite dialog opens, **When** the user presses Tab or Shift+Tab, **Then** focus cycles within the dialog only; pressing Escape closes the dialog and returns focus to the element that opened it.
3. **Given** a screen-reader user is on the lobby, **When** an invite arrives, a queue finds a match, or a Challenge is sent, **Then** the status is announced via a polite or assertive live region without stealing focus.
4. **Given** any interactive element is focused, **When** it has the focus state, **Then** a visible focus indicator meets 3:1 contrast against its background and is not obscured by surrounding content.

---

### User Story 5 - Mobile player completes the full flow on a phone (Priority: P3)

A player on a phone (≈ 375 × 812 viewport) signs in, sees a mobile-optimised layout with a sticky primary call-to-action, browses the directory as a vertical stack, opens an invite as a bottom-sheet, and responds to an incoming invite — all with thumb-friendly touch targets.

**Why this priority**: Current layout is a desktop two-column grid that merely stacks on small screens. A real mobile-first layout removes friction for the meaningful share of playtest and early-access users on phones.

**Independent Test**: Load the lobby at 375 × 812 in a mobile emulator. Verify no horizontal scroll. Complete sign-in → Play Now → accept an invite with only taps. Measure every interactive element ≥ 44 × 44 px.

**Acceptance Scenarios**:

1. **Given** a 375-pixel-wide viewport, **When** the lobby renders, **Then** all content lays out in a single column with no horizontal scrollbar and no content clipping.
2. **Given** a logged-in mobile user scrolls the directory, **When** they reach any scroll position, **Then** the primary Play Now control remains visible and thumb-reachable at the bottom of the viewport.
3. **Given** a mobile user opens the invite dialog, **When** it renders, **Then** it appears as a bottom-sheet that does not require precise aiming at a small dropdown, and respects device safe-area insets.
4. **Given** any interactive element on mobile, **When** measured, **Then** its hit target is at least 44 × 44 pixels.

---

### User Story 6 - Reduced-motion user sees instant state changes with no ambient animation (Priority: P3)

A player with `prefers-reduced-motion: reduce` enabled loads the lobby and uses all features. Ambient animations (hero tile cascade, status pulse, skeleton shimmer, CTA hover scale) are suppressed. State changes are instant and legible.

**Why this priority**: Required by WCAG 2.3.3 and called out in the constitution. The existing board already honours this; the lobby must match.

**Independent Test**: Enable OS-level reduced motion, reload the lobby, visually confirm no keyframe animations play, functionally confirm all state transitions still occur and announce correctly.

**Acceptance Scenarios**:

1. **Given** reduced motion is enabled, **When** the lobby first loads, **Then** no entry, pulse, shimmer, or cascade animations play.
2. **Given** reduced motion is enabled, **When** a player activates any control, **Then** the control's response is instantaneous (no scale, slide, or fade) but visibly differentiated from idle state.
3. **Given** reduced motion is enabled, **When** an invite arrives, **Then** the announcement still reaches assistive technology and the visual change is still obvious without motion.

---

### Edge Cases

- **No one else online**: The directory shows an inviting empty state with a "Share invite link" affordance that copies the app URL. Play Now remains available (queue still works solo).
- **Connection quality degrades**: When real-time presence falls back to polling, a subtle, non-alarming status chip surfaces the mode without implying a broken app.
- **Rate-limited sign-in**: On repeated rapid login attempts, the inline form error explains the wait; the primary CTA zone stays stable.
- **Incoming invite arrives while Play Now queue is active**: The user can accept the invite (cancelling the queue) or decline (keep queueing) with explicit, labelled choices.
- **Player's own card**: Clearly marked as "You" without a Challenge action, ranking position preserved within the list.
- **Long display names**: Player cards truncate cleanly at a language-aware boundary and expose the full name via tooltip, title, or aria-label.
- **Presence TTL expiry mid-session**: Stale `offline` players fade out of the directory with a gentle transition (or instantly under reduced motion).
- **Viewport between phone and desktop (e.g., tablet portrait 768 px)**: Layout scales without awkward two-column collapse; the sticky mobile CTA deactivates at the defined breakpoint.
- **Lobby exceeds 24 concurrent online players**: First 24 cards render per the prioritised ordering (available → rating proximity → last-seen), with a "Show all N players" control exposing the rest inline. The viewer's own card is always visible, even if it would fall outside the top 24 by the ordering rule.
- **JavaScript disabled / during hydration**: The logged-out hero and static content render without a flash of unstyled content; the server-rendered directory snapshot is visible before hydration completes.
- **Avatar generation for a player with a non-Latin username (e.g., Icelandic accented letters)**: Monogram preserves the first glyph(s) correctly, including combining diacritics.

## Requirements *(mandatory)*

### Functional Requirements

#### Brand and identity

- **FR-001**: The lobby MUST display a branded hero containing the product wordmark (with **ORÐUSTA** — the Icelandic counterpart of "Wottle", a portmanteau of *orð* "word" + *orrusta* "battle" — surfaced alongside or beneath the English name), a single-line tagline identifying it as an Icelandic word-duel game, and a tile-based visual motif composed of letter tiles.
- **FR-001a**: The hero's tile motif MUST cycle through a curated set of Icelandic nouns rendered as tile glyphs, advancing approximately every 5 seconds with a letter flip or fade transition between words. The set MUST include **ORÐUSTA** and at least three additional Icelandic nouns chosen from the existing dictionary that showcase Icelandic-specific letters (e.g., Þ, Æ, Ð, Ö). Under `prefers-reduced-motion: reduce`, the motif MUST render a single fixed word with no cycling or transition.
- **FR-002**: The hero and overall surface MUST use the Warm Editorial brand system (deep navy surfaces, cream primary text, citron-amber accent) with typography that pairs a literary display face with a neutral UI face.
- **FR-003**: The existing in-match player identity colours (player A sky, player B rose) MUST remain unchanged and remain legible against the new surface palette.

#### Primary call-to-action

- **FR-004**: The lobby MUST present Play Now as the single most visually dominant interactive element above the fold on every supported viewport.
- **FR-005**: Play Now MUST have four visibly distinct states: idle-available, queuing, cancelable (queue active), and disabled-while-in-match.
- **FR-006**: The Play Now zone MUST display three mode pills labelled Ranked, Casual, and Challenge. Ranked MUST be selectable and active; Casual and Challenge MUST render as visibly disabled with an accessible "Coming soon" explanation.
- **FR-006a**: The mode pills MUST function as a single-select group representing the mode that Play Now will dispatch. On load, Ranked MUST be the pre-selected mode so Play Now is immediately actionable without any prior pill interaction.
- **FR-006b**: Activating Play Now MUST start matchmaking for the currently-selected mode. Because Casual and Challenge are disabled selections in this iteration, the effective dispatch target is always Ranked — but the interaction MUST be implemented as "dispatch the selected mode", not "always dispatch Ranked", so the behavior extends cleanly when Casual and Challenge become selectable in a later iteration.
- **FR-007**: The Play Now zone MUST surface queue status (elapsed time, search state) in a region that updates under both real-time and polling modes.

#### Live social signal

- **FR-008**: The lobby MUST display a live stats strip showing the current count of online players and the current count of matches in progress, derived from existing presence and match data.
- **FR-008a**: The online-players count in the stats strip MUST update reactively (without user action, reload, or navigation) whenever a player joins or leaves the lobby, matching the latency characteristics of the existing presence pipeline (≤2 s p95 per Spec 002 PERF-003).
- **FR-008b**: The matches-in-progress count in the stats strip MUST refresh at least once every 10 seconds. An update MUST NOT require opening a new real-time channel solely to serve this stat.

#### Player directory

- **FR-009**: The lobby MUST render each visible online player as a card in a responsive grid, showing avatar, display name, username handle, rating, rating difference from the viewer, status indicator, and last-seen time.
- **FR-009a**: The directory MUST display at most 24 cards by default. When more than 24 players are online, the visible cards MUST be selected by this ordering: (1) `available` status first, then other statuses; (2) closer absolute rating difference from the viewer first; (3) most-recently-seen first as final tiebreaker. The viewer's own card is always visible regardless of the 24-card cap.
- **FR-009b**: When the online-player count exceeds the visible cap, the lobby MUST render an explicit "Show all N players" control below the grid. Activating the control MUST reveal the remaining cards inline (no separate page, no virtualisation) using the same card layout and ordering rules.
- **FR-010**: The viewer's own card MUST be visually distinguished (e.g., a "You" label or ring) and MUST NOT expose a Challenge action against the viewer themselves.
- **FR-011**: When a player does not have an avatar asset, the system MUST render a deterministic gradient-and-initials avatar derived from the player's stable identifier so the same player always renders the same avatar.
- **FR-012**: When a player has an avatar asset present, the system MUST prefer that asset over the generated fallback.
- **FR-013**: Each card for an available opponent MUST expose a Challenge action that, when activated, opens the invite dialog with that opponent pre-selected. The dialog MUST require explicit user confirmation before the invite is dispatched; dismissing the dialog without confirming MUST NOT send an invite.
- **FR-014**: Each card for a player already in a match MUST disable the Challenge action with an accessible explanation.

#### Invitation flow

- **FR-015**: Sending or viewing an invite MUST open a proper modal dialog that traps focus within itself, dismisses on Escape, dismisses on backdrop click, and returns focus to the originating trigger.
- **FR-016**: The invite dialog MUST be rendered as a bottom-sheet on small viewports and as a centred or anchored dialog on larger viewports, with safe-area-inset padding respected on mobile.
- **FR-017**: Incoming invite notifications MUST appear in a dedicated region with assertive live-region semantics and MUST show sender identity and expiry time.

#### Sign-in

- **FR-018**: The logged-out view MUST present the username entry form inside the primary call-to-action zone so it does not compete with the directory.
- **FR-019**: The sign-in form MUST display inline validation errors adjacent to the relevant field without navigating away.
- **FR-020**: On successful sign-in, the user MUST transition to the logged-in lobby view with their own player card highlighted within the directory.

#### Loading, empty, and degraded states

- **FR-021**: While the directory is loading, the lobby MUST display skeleton placeholders that match the shape of loaded cards.
- **FR-022**: When the directory is empty (viewer is the only online player), the lobby MUST display an empty state that invites the viewer to share the app URL and preserves the Play Now action.
- **FR-023**: When real-time presence falls back to polling, the lobby MUST surface a non-alarming status indicator communicating the connection mode.
- **FR-024**: On any non-blocking error (invite failure, queue failure), the lobby MUST surface a toast notification with a clear message and dismissal control without disrupting focus.

#### Motion and accessibility

- **FR-025**: The lobby MUST include ambient motion cues that serve meaning: a status pulse on `available` players, a gentle scale on primary-CTA hover, a shimmer on skeleton placeholders, and an entry cascade for hero tiles on first mount. No motion purely decorative or non-communicative is permitted.
- **FR-026**: When the user has `prefers-reduced-motion: reduce` set, ALL keyframe animations and decorative transitions MUST be suppressed while functional state differences (focus, active, disabled, selected) remain visible.
- **FR-027**: Every interactive element MUST be reachable and activatable by keyboard alone with a visible focus indicator meeting 3:1 contrast.
- **FR-028**: All text in the lobby MUST meet WCAG 2.1 AA contrast ratios (4.5:1 body, 3:1 large text and UI components) against its background.
- **FR-029**: State changes that are not caused by direct user action (invite arrival, queue match, presence update affecting the viewer) MUST be announced via appropriate aria-live regions without moving focus.
- **FR-030**: Every interactive element on mobile viewports MUST have a hit target of at least 44 × 44 pixels.

#### Layout and responsiveness

- **FR-031**: The lobby MUST lay out in a single column below 640 pixels wide, with the primary Play Now control persistently reachable (e.g., sticky) from the bottom of the viewport.
- **FR-032**: The lobby MUST lay out with hero, CTA zone, and directory visible simultaneously above the fold on viewports 1280 pixels or wider.
- **FR-033**: The lobby MUST not produce any horizontal scrolling at any supported viewport width from 320 px to 1920 px.

#### Preservation of existing behaviour

- **FR-034**: This feature MUST NOT alter matchmaking logic (queue algorithm, Elo pairing, invite expiry), presence channel behaviour (WebSocket + polling fallback), Elo rating calculation, session cookie handling, or rematch flow.
- **FR-035**: All existing lobby-related server actions and API endpoints MUST continue to satisfy their current contracts (inputs, outputs, status codes, rate limits).
- **FR-036**: All existing lobby integration and end-to-end tests MUST continue to pass, with selector updates limited to cases where `data-testid` attributes move between restructured components.

### Key Entities

This feature is presentational. It does not introduce or modify persisted entities. It consumes existing entities:

- **Player**: Existing record providing id, display name, username, rating, and optional avatar URL. Rendered throughout the lobby and directory.
- **LobbyPresence**: Existing real-time record providing status (`available`, `matchmaking`, `in_match`, `offline`) and last-seen timestamp. Drives directory state and status indicators.
- **Match**: Existing record used only for the aggregate "matches in progress" count displayed in the live stats strip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a 5-person unmoderated usability panel, at least 4 of 5 first-time visitors correctly identify the site as a "word game" or equivalent within 3 seconds of page load.
- **SC-002**: Median time from a returning player landing on the lobby to being inside a match drops by at least 30 % compared with the current lobby baseline (measured via session analytics over a 7-day sample).
- **SC-003**: The lobby passes WCAG 2.1 AA automated audit with zero serious or critical violations on both logged-out and logged-in views.
- **SC-004**: A keyboard-only user can complete the full flow (sign in, browse directory, Play Now, send and accept an invite) without reaching for a mouse, verified manually on macOS Safari + VoiceOver and Windows Firefox + NVDA.
- **SC-005**: The lobby achieves a Lighthouse Performance score of at least 90 on a throttled 4G mobile profile, with Largest Contentful Paint under 2.0 s and Cumulative Layout Shift under 0.05.
- **SC-006**: No regression in existing lobby end-to-end test suite: all currently passing lobby integration and Playwright tests continue to pass after the change.
- **SC-007**: On a 375 × 812 viewport, every interactive element passes a 44 × 44 px hit-target measurement, and the primary Play Now control is reachable without scrolling once the user is logged in.
- **SC-008**: Under `prefers-reduced-motion: reduce`, zero keyframe animations play on the lobby, while all state changes remain functionally observable and announced.

## Assumptions

These decisions were locked ahead of spec drafting and are not open clarifications.

- **Avatars**: Deterministic gradient + 1–2-letter monogram derived from `player.id` is the fallback. Player-uploaded avatars remain out of scope; the optional `avatarUrl` field, when populated, overrides the generated avatar.
- **Brand direction**: Warm Editorial — deep navy surface (`#0B1220` base, layered elevation), cream primary text (`#F2EAD3`), citron-amber accent (`#E8B64C`). In-match player colours (sky `#38BDF8`, rose `#EF4444`) are preserved.
- **Bilingual product name**: English "Wottle" remains the primary/URL name. The Icelandic counterpart **ORÐUSTA** (*orð* "word" + *orrusta* "battle") is treated as a first-class secondary name surfaced in the hero and rotating word set. No full Icelandic UI localisation is introduced by this spec.
- **Typography**: A literary display face (Fraunces) paired with Inter for UI, delivered via self-hosted font loading to avoid runtime webfont flash.
- **Scope**: Visual and interaction only. Mode pills Casual and Challenge are rendered as visibly disabled; the `mode` column, Casual/Challenge routing, and matchmaking-logic changes are deferred to a subsequent iteration.
- **Motion library**: No JavaScript animation library is introduced; all motion uses existing CSS-transform patterns consistent with the board animation system.
- **Viewports supported**: 320 px to 1920 px wide; layout breakpoints at approximately 640 px and 1280 px. Landscape phones and portrait tablets fall under the existing mobile and desktop layouts respectively.
- **Content locale**: Lobby UI strings remain in English for this iteration; Icelandic UI localisation is a separate future concern.

## Out of Scope

- Any change to matchmaking pairing logic, queue timeout, Elo range expansion, or invite expiry rules (covered by the subsequent matchmaking-depth iteration).
- A real `mode` distinction between Ranked, Casual, and Challenge at the data or routing layer.
- User-uploaded avatars, avatar cropping, and associated storage infrastructure.
- Search, sort, and filter controls on the player directory.
- Activity feeds, live match ticker, leaderboards, and announcements.
- Profile modal enhancements beyond what today's profile view already renders.
- Onboarding or tutorial flows for first-time players.
- Full Icelandic localisation of the lobby.
- Changes to the in-match view, summary screen, or rematch flow.

# Prominent, urgency-aware match timers (O-59)

**Issue:** O-59 — "The timers should be way more prominent in the UI as visual elements."

**Date:** 2026-06-18

## Problem

The match timers are visually subdued. On desktop each player's clock is a 15px
mono pill (`.hud-card__clock`), secondary to the 34px score; its only urgency
signal is a single "low" state that fires at a too-broad `< 60s`. On mobile the
`TimerDisplay` has running/paused/expired/low states but the "low" threshold is
`≤ 15s`. Neither matches the desired behavior, and neither makes the clock feel
"central to the gameplay experience."

The issue asks for three things:

1. Timers far more prominent as visual elements.
2. At **30 s** remaining, the timer turns **yellow** and **gradually** shifts to
   **red** as it approaches zero.
3. At **15 s** remaining, the timer **blinks** — noticeable but not overwhelming.

## Decisions (from brainstorming)

- **Prominence approach:** enlarge the existing HUD clocks (keep the 3-column top
  strip; no new center timer). Mobile compact bars get the same boost.
- **Scope:** both the player's and the opponent's clocks get the gradient + blink
  (both run simultaneously in the chess-clock model).
- **Clock size:** co-equal with the score (~36px on desktop), clearly primary but
  not forcing a layout overhaul.

## Design

### 1. Shared pure helper — `components/match/deriveClockUrgency.ts`

Both surfaces derive their visual state from one tested function so they never
drift:

```ts
type ClockTone = "active" | "warning" | "critical" | "expired" | "waiting";

interface ClockUrgency {
  tone: ClockTone;
  urgency: number; // 0..1, only meaningful for warning/critical
}

function deriveClockUrgency(
  status: "running" | "paused" | "expired",
  seconds: number,
): ClockUrgency;
```

Rules:

| Condition                         | tone       | urgency              |
| --------------------------------- | ---------- | -------------------- |
| `status === "paused"`             | `waiting`  | 0                    |
| `status === "expired"` or `s ≤ 0` | `expired`  | 1                    |
| running and `s > 30`              | `active`   | 0                    |
| running and `15 < s ≤ 30`         | `warning`  | `(30 − s) / 30`      |
| running and `0 < s ≤ 15`          | `critical` | `(30 − s) / 30`      |

`urgency` is clamped to `[0, 1]`. `critical` is the only tone that blinks.
A paused/waiting clock (player already submitted) never gradients or blinks.

This replaces `deriveClockState` in `MatchClient.tsx`.

### 2. Gradual yellow → red gradient

Add one semantic token to `app/globals.css`:

```css
--clock-warn: oklch(0.86 0.15 95); /* warm yellow start of the urgency ramp */
```

The clock element receives the urgency ratio as an inline custom property
(`style={{ "--clock-urgency": urgency }}`) and CSS interpolates the color in
OKLAB from yellow → `--bad` (red):

```css
color-mix(in oklab, var(--bad) calc(var(--clock-urgency) * 100%), var(--clock-warn))
```

OKLAB interpolation passes through orange, producing the smooth
yellow → orange → red ramp. Applied to both `warning` and `critical` tones for
color and border/background tints.

> Verification note: `calc()` inside a `color-mix()` percentage is supported in
> modern engines but will be confirmed in the browser preview. Fallback if it
> fails to render: compute the interpolated color string in `deriveClockUrgency`
> and pass it as `--clock-color` directly.

### 3. Blink at ≤ 15 s

```css
@keyframes clock-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
}
.hud-card__clock--critical { animation: clock-blink 1s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .hud-card__clock--critical {
    animation: none;
    box-shadow: 0 0 0 2px var(--bad); /* static strong ring instead of blink */
  }
}
```

The 1s / 0.45-opacity pulse is noticeable without strobing. The same treatment
is mirrored on the mobile `TimerDisplay`.

### 4. Prominence

- **Desktop** `.hud-card__clock`: grow from 15px → ~36px, bold, mono,
  `tabular-nums`, on both the `you` and `opp` cards — co-equal with the score so
  it reads as a primary number.
- **Mobile** `TimerDisplay`: bump the `sm` size and apply the same tone classes,
  gradient, and blink so the compact bars match.

### 5. Wiring — `MatchClient.tsx`

Replace the two `deriveClockState(...)` calls with `deriveClockUrgency(...)` and
pass `clockState` (tone) + `clockUrgency` to each `HudCard`. `HudCard` maps tone
→ class, adds the blink class for `critical`, and sets the inline
`--clock-urgency`. `PlayerPanel` / `TimerDisplay` consume the same helper.

## Testing

- **Unit** — `deriveClockUrgency`: threshold table at 31, 30, 16, 15, 1, 0 s,
  plus paused and expired; assert tone and urgency ratio (with clamping).
- **Component** — update `HudCard`, `TimerDisplay`, `PlayerPanel` tests for the
  new `warning` / `critical` tones (replacing the single `low`); assert the
  inline `--clock-urgency` is set and the blink class appears only at `critical`.
- **Browser** — preview-verify the gradient and blink at 31 s, 30 s, 15 s, 3 s,
  and confirm `prefers-reduced-motion` swaps the blink for a static ring.

## Out of scope

- `components/game/TimerHud.tsx` is dead code (referenced only by its own test);
  left untouched.
- No new center timer; no top-strip layout restructure beyond the size bump.
- No server/timer-logic changes — this is presentation only.

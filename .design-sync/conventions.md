# Building with Wottle Warm Editorial

Wottle is a 2-player Icelandic word-duel app. Its design language ("Warm Editorial") is
warm paper surfaces, deep ink text, an ochre brand accent, a serif display face
(Fraunces), and mono numerals (JetBrains Mono). Body text is Inter.

## Setup

No global provider is required — components are self-styled once `styles.css` is
loaded. Two exceptions:

- Toast notifications: wrap the app in `ToastProvider`; render `Toast` only inside it.
- `PlayerProfileModal` self-loads a built-in sample profile (there is no backend here);
  pass any `playerId`/`viewerId` strings.

`Dialog`, `LogoutConfirmDialog`, `DisconnectionModal`, and `RematchInterstitial` are
overlay components — render them at the page root, controlled by state.

## Styling your own layout glue

The shipped stylesheet is compiled from the app's own usage, so **only the utility
classes the app already uses exist** — do not invent new Tailwind classes (an unused
class like `bg-red-500` or `gap-7` will silently do nothing). For your own containers
and layout, use inline styles built on the design tokens (CSS custom properties defined
in `styles.css` → `_ds_bundle.css`):

- Surfaces: `var(--paper)` (page), `var(--paper-2)`, `var(--paper-3)` (recessed)
- Text: `var(--ink)` (primary), `var(--ink-2)`, `var(--ink-3)`, `var(--ink-soft)` (muted)
- Accent: `var(--ochre)`, `var(--ochre-deep)`, `var(--ochre-tint)`
- Player colors: `var(--p1)` / `var(--p1-tint)` / `var(--p1-deep)` (warm, player A),
  `var(--p2)` / `var(--p2-tint)` / `var(--p2-deep)` (blue, player B)
- Semantic: `var(--good)`, `var(--warn)`, `var(--bad)`
- Hairlines: `1px solid var(--hair)` (or `--hair-strong`); shadows: `var(--shadow-sm)`,
  `var(--shadow-md)`, `var(--shadow-lg)`
- Fonts: `var(--font-fraunces)` for display headings, `var(--font-jetbrains-mono)` for
  numerals/labels, `var(--font-inter)` for body

House motifs: cards are paper surfaces with a hairline border, `border-radius` ~12px and
`var(--shadow-sm)`; section labels are 10px uppercase JetBrains Mono with 0.12em
letter-spacing in `var(--ink-soft)`.

## Where the truth lives

Read `styles.css` (and its `_ds_bundle.css` import) for every token and available
class; each component's `.d.ts` is its exact props contract and its `.prompt.md` shows
composition examples.

## Example composition

```jsx
const { HudCard, TimerDisplay, Button, RoundPipBar } = window.Wottle;

<div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh",
              fontFamily: "var(--font-inter), system-ui, sans-serif", padding: 24 }}>
  <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 28, margin: 0 }}>
    Orðusta
  </h1>
  <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "flex-start" }}>
    <HudCard label="Round"><RoundPipBar currentRound={4} totalRounds={10} /></HudCard>
    <Button variant="primary">Play now</Button>
  </div>
</div>
```

(Check `HudCard.d.ts`/`RoundPipBar.d.ts` for exact props before use — the pattern above
shows the token idiom, not memorized APIs.)

# Phase 1a — Theme Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip Wottle's production theme from dark navy (`surface-0 = #0B1220` cream text) to the prototype's Warm Editorial light theme (`paper` cream background, `ink` navy text) without regressing any existing screen, and mount a persistent `TopBar` across every route.

**Architecture:** Replace the dark-mode semantic tokens in `tailwind.config.ts` with OKLCH light-mode values; add the new ochre / paper-scale / ink-scale / p1 / p2 / hair / shadow token families; backfill `:root` CSS custom properties in `app/globals.css` so prototype-style selectors (`var(--paper)`, `var(--ink)`, etc.) work. Drop `color-scheme: dark`. Add JetBrains Mono via `next/font/google`. Audit and re-theme the three existing dark surfaces that spec 019 / prior specs shipped: lobby ambient background, match client chrome, post-game final summary. Introduce a new `TopBar` component mounted in `app/layout.tsx`.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS 4, `next/font/google`, Vitest + React Testing Library, Playwright.

**Prerequisites:**
- Read the spec: `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 1.
- Read the prototype's source of truth: `/tmp/wottle-design/wottle-game-design/project/prototype/styles.css` lines 1–64 (the `:root` token block) and lines 74–105 (topbar styling).
- Existing token file: `tailwind.config.ts`.
- Existing app root: `app/layout.tsx`, `app/globals.css`.
- Existing dark-mode styles that will change: `app/styles/lobby.css`, `app/styles/board.css`.

**Test commands (run after every task):**
- `pnpm lint` — must report zero warnings.
- `pnpm typecheck` — must exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @theme-flip` — new Playwright tag added in Task 10.

---

## File Structure

**Create:**
- `components/ui/TopBar.tsx` — sticky top navigation with wordmark + screen links.
- `tests/unit/components/ui/TopBar.test.tsx` — unit tests for TopBar.
- `tests/integration/ui/theme-flip.spec.ts` — Playwright visual smoke that the app renders on a cream paper background with ink text across lobby, match, and post-game.

**Modify:**
- `app/globals.css` — replace the dark-mode `:root` block with the light-mode OKLCH token set; add `--font-mono` expectation.
- `tailwind.config.ts` — add OKLCH token families (`paper`, `ink`, `ochre`, `p1`, `p2`, `hair`, shadows) and alias existing dark-mode names to the new light-mode values so legacy class names don't break.
- `app/layout.tsx` — add `JetBrains_Mono` import, apply `--font-mono` CSS variable to the `<html>` tag, mount `<TopBar>` inside the main flex column.
- `app/styles/lobby.css` — flip the ambient navy background to paper, adjust halo colours for light mode.
- `app/styles/board.css` — adjust any hard-coded dark-mode colour values to the new tokens (this task audits and fixes; specific changes depend on what's in the file).
- `components/match/PlayerPanel.tsx` — replace `bg-gray-900/80 border-white/10` with token-referenced classes; update tests accordingly.
- `components/match/FinalSummary.tsx` — replace any hard-coded dark surface classes with token references.

**Not touched in this plan** (Phase 1b will cover):
- Letterpress tile gradients, coord labels, HUD classic refresh, round pip bar, left/right rail cards.

---

## Task 1: Add OKLCH design tokens to `app/globals.css`

**Files:**
- Modify: `app/globals.css`

The prototype's source-of-truth colour set lives in its `:root` block. We import those verbatim here so `var(--paper)` selectors work both in Tailwind-generated CSS and in any `app/styles/*.css` file that references them.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/styles/globals.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(
  resolve(__dirname, "../../../app/globals.css"),
  "utf-8",
);

describe("globals.css token declarations", () => {
  test.each([
    ["--paper"],
    ["--paper-2"],
    ["--paper-3"],
    ["--ink"],
    ["--ink-2"],
    ["--ink-3"],
    ["--ink-soft"],
    ["--ochre"],
    ["--ochre-deep"],
    ["--ochre-tint"],
    ["--p1"],
    ["--p1-tint"],
    ["--p1-deep"],
    ["--p2"],
    ["--p2-tint"],
    ["--p2-deep"],
    ["--good"],
    ["--warn"],
    ["--bad"],
    ["--hair"],
    ["--hair-strong"],
    ["--shadow-sm"],
    ["--shadow-md"],
    ["--shadow-lg"],
  ])("declares %s", (token) => {
    expect(globalsCss).toMatch(new RegExp(`${token}\\s*:`));
  });

  test("uses light color-scheme", () => {
    expect(globalsCss).toMatch(/color-scheme:\s*light/);
  });

  test("sets body background to var(--paper)", () => {
    expect(globalsCss).toMatch(/background:\s*var\(--paper\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/globals.test.ts`
Expected: 26 failures (each token missing, plus `color-scheme: dark` still present).

- [ ] **Step 3: Write the minimal implementation**

Replace the entire contents of `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;

  /* Surfaces — warm paper + deep ink */
  --paper: oklch(0.975 0.012 85);
  --paper-2: oklch(0.955 0.014 82);
  --paper-3: oklch(0.925 0.016 80);
  --ink: oklch(0.22 0.025 258);
  --ink-2: oklch(0.29 0.027 258);
  --ink-3: oklch(0.38 0.024 258);
  --ink-soft: oklch(0.52 0.020 258);

  /* Accent — warm ochre (brand) */
  --ochre: oklch(0.72 0.13 70);
  --ochre-deep: oklch(0.58 0.14 60);
  --ochre-tint: oklch(0.93 0.045 80);

  /* Player colors */
  --p1: oklch(0.68 0.14 60);
  --p1-tint: oklch(0.92 0.06 70);
  --p1-deep: oklch(0.48 0.14 55);
  --p2: oklch(0.56 0.08 220);
  --p2-tint: oklch(0.92 0.035 220);
  --p2-deep: oklch(0.38 0.08 220);

  /* Semantic */
  --good: oklch(0.62 0.12 150);
  --warn: oklch(0.70 0.15 40);
  --bad: oklch(0.58 0.17 25);

  /* Lines */
  --hair: color-mix(in oklab, var(--ink) 14%, transparent);
  --hair-strong: color-mix(in oklab, var(--ink) 22%, transparent);

  /* Shadows */
  --shadow-sm: 0 1px 0 color-mix(in oklab, var(--ink) 8%, transparent);
  --shadow-md:
    0 1px 2px color-mix(in oklab, var(--ink) 6%, transparent),
    0 8px 24px color-mix(in oklab, var(--ink) 10%, transparent);
  --shadow-lg:
    0 2px 4px color-mix(in oklab, var(--ink) 8%, transparent),
    0 20px 60px color-mix(in oklab, var(--ink) 16%, transparent);

  font-family: var(--font-inter, "Inter"), system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

html,
body {
  min-height: 100%;
  scrollbar-gutter: stable;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/styles/globals.test.ts`
Expected: 26 passing tests.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tests/unit/styles/globals.test.ts
git commit -m "feat(theme): add OKLCH Warm Editorial tokens to globals.css

Declare --paper, --ink, --ochre, --p1/--p2, --hair, --shadow-{sm,md,lg}
plus semantic colours in :root. Flip color-scheme to light and set body
background to var(--paper). Tests lock the token set in place."
```

---

## Task 2: Extend Tailwind theme with light-mode token families and alias existing names

**Files:**
- Modify: `tailwind.config.ts`

Goal: every existing utility class (`bg-surface-0`, `text-text-primary`, etc.) resolves to the new light-mode colour. New utility classes `bg-paper`, `text-ink`, `border-hair`, etc. are added for future components.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/styles/tailwind-config.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import config from "../../../tailwind.config";

const colors = config.theme?.extend?.colors as Record<
  string,
  string | Record<string, string>
>;

describe("tailwind token extension — new Warm Editorial families", () => {
  test("paper scale is declared", () => {
    expect(colors.paper).toEqual({
      DEFAULT: "oklch(0.975 0.012 85)",
      2: "oklch(0.955 0.014 82)",
      3: "oklch(0.925 0.016 80)",
    });
  });

  test("ink scale is declared", () => {
    expect(colors.ink).toMatchObject({
      DEFAULT: "oklch(0.22 0.025 258)",
      2: "oklch(0.29 0.027 258)",
      3: "oklch(0.38 0.024 258)",
      soft: "oklch(0.52 0.020 258)",
    });
  });

  test("ochre family is declared", () => {
    expect(colors.ochre).toMatchObject({
      DEFAULT: "oklch(0.72 0.13 70)",
      deep: "oklch(0.58 0.14 60)",
      tint: "oklch(0.93 0.045 80)",
    });
  });

  test("player families p1 and p2 declared", () => {
    expect(colors.p1).toMatchObject({
      DEFAULT: "oklch(0.68 0.14 60)",
      tint: "oklch(0.92 0.06 70)",
      deep: "oklch(0.48 0.14 55)",
    });
    expect(colors.p2).toMatchObject({
      DEFAULT: "oklch(0.56 0.08 220)",
      tint: "oklch(0.92 0.035 220)",
      deep: "oklch(0.38 0.08 220)",
    });
  });

  test("hair line colours declared", () => {
    expect(colors.hair).toMatchObject({
      DEFAULT: "color-mix(in oklab, oklch(0.22 0.025 258) 14%, transparent)",
      strong: "color-mix(in oklab, oklch(0.22 0.025 258) 22%, transparent)",
    });
  });

  test("legacy surface alias resolves to paper scale", () => {
    expect(colors.surface).toMatchObject({
      0: "oklch(0.975 0.012 85)",
      1: "oklch(0.955 0.014 82)",
      2: "oklch(0.925 0.016 80)",
    });
  });

  test("legacy text alias resolves to ink scale", () => {
    expect(colors.text).toMatchObject({
      primary: "oklch(0.22 0.025 258)",
      secondary: "oklch(0.38 0.024 258)",
      muted: "oklch(0.52 0.020 258)",
      inverse: "oklch(0.975 0.012 85)",
    });
  });

  test("mono font family added", () => {
    const fontFamily = config.theme?.extend?.fontFamily as Record<string, string[]>;
    expect(fontFamily.mono).toEqual([
      "var(--font-jetbrains-mono)",
      "JetBrains Mono",
      "ui-monospace",
      "monospace",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/tailwind-config.test.ts`
Expected: 8 failures — all of the expected tokens and aliases are absent.

- [ ] **Step 3: Write the implementation**

Replace the contents of `tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const INK = "oklch(0.22 0.025 258)";
const INK_2 = "oklch(0.29 0.027 258)";
const INK_3 = "oklch(0.38 0.024 258)";
const INK_SOFT = "oklch(0.52 0.020 258)";

const PAPER = "oklch(0.975 0.012 85)";
const PAPER_2 = "oklch(0.955 0.014 82)";
const PAPER_3 = "oklch(0.925 0.016 80)";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* New Warm Editorial families */
        paper: {
          DEFAULT: PAPER,
          2: PAPER_2,
          3: PAPER_3,
        },
        ink: {
          DEFAULT: INK,
          2: INK_2,
          3: INK_3,
          soft: INK_SOFT,
        },
        ochre: {
          DEFAULT: "oklch(0.72 0.13 70)",
          deep: "oklch(0.58 0.14 60)",
          tint: "oklch(0.93 0.045 80)",
        },
        p1: {
          DEFAULT: "oklch(0.68 0.14 60)",
          tint: "oklch(0.92 0.06 70)",
          deep: "oklch(0.48 0.14 55)",
        },
        p2: {
          DEFAULT: "oklch(0.56 0.08 220)",
          tint: "oklch(0.92 0.035 220)",
          deep: "oklch(0.38 0.08 220)",
        },
        good: "oklch(0.62 0.12 150)",
        warn: "oklch(0.70 0.15 40)",
        bad: "oklch(0.58 0.17 25)",
        hair: {
          DEFAULT: `color-mix(in oklab, ${INK} 14%, transparent)`,
          strong: `color-mix(in oklab, ${INK} 22%, transparent)`,
        },

        /* Legacy aliases — existing class names resolve to the new light palette */
        board: {
          background: PAPER_3,
          cell: PAPER,
          highlight: "oklch(0.72 0.13 70)",
        },
        player: {
          a: "oklch(0.68 0.14 60)",
          b: "oklch(0.56 0.08 220)",
        },
        brand: {
          50: "oklch(0.97 0.022 80)",
          100: "oklch(0.94 0.04 80)",
          200: "oklch(0.90 0.06 75)",
          300: "oklch(0.84 0.09 72)",
          400: "oklch(0.78 0.11 70)",
          500: "oklch(0.72 0.13 70)",
          600: "oklch(0.62 0.14 65)",
          700: "oklch(0.52 0.14 60)",
          800: "oklch(0.42 0.13 55)",
          900: "oklch(0.32 0.10 50)",
          950: "oklch(0.22 0.08 45)",
        },
        surface: {
          0: PAPER,
          1: PAPER_2,
          2: PAPER_3,
          3: PAPER_3,
        },
        text: {
          primary: INK,
          secondary: INK_3,
          muted: INK_SOFT,
          inverse: PAPER,
        },
        accent: {
          focus: "oklch(0.58 0.14 60)",
          warning: "oklch(0.70 0.15 40)",
          success: "oklch(0.62 0.12 150)",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      transitionDuration: {
        swap: "200ms",
        shake: "350ms",
        highlight: "700ms",
      },
      boxShadow: {
        "wottle-sm": "var(--shadow-sm)",
        "wottle-md": "var(--shadow-md)",
        "wottle-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/styles/tailwind-config.test.ts`
Expected: all 8 tests pass.

- [ ] **Step 5: Run the existing unit suite to catch any regressions**

Run: `pnpm test -- --run`
Expected: existing suite still passes. (A few PlayerPanel / lobby tests may depend on inline colour strings — if so, make notes and fix in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts tests/unit/styles/tailwind-config.test.ts
git commit -m "feat(theme): extend Tailwind with Warm Editorial token families

Add paper/ink/ochre/p1/p2/hair families plus good/warn/bad semantic
colours, JetBrains Mono font family, and Warm Editorial shadow utilities.
Existing surface/text/brand class names are aliased to the new light
palette so callers keep working."
```

---

## Task 3: Wire JetBrains Mono via `next/font/google`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app/layout.test.tsx`:

```tsx
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(
  resolve(__dirname, "../../../app/layout.tsx"),
  "utf-8",
);

describe("app/layout.tsx font wiring", () => {
  test("imports JetBrains_Mono from next/font/google", () => {
    expect(layoutSource).toMatch(
      /import\s*\{\s*[^}]*JetBrains_Mono[^}]*\}\s*from\s*"next\/font\/google"/,
    );
  });

  test("constructs jetbrainsMono with variable --font-jetbrains-mono", () => {
    expect(layoutSource).toMatch(/variable:\s*"--font-jetbrains-mono"/);
  });

  test("html element uses both font variables", () => {
    expect(layoutSource).toMatch(
      /className=\{[^}]*fraunces\.variable[^}]*jetbrainsMono\.variable[^}]*\}/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/app/layout.test.tsx`
Expected: 3 failures.

- [ ] **Step 3: Implement the change**

Edit `app/layout.tsx`. Find:

```tsx
import { Fraunces } from "next/font/google";
```

Replace with:

```tsx
import { Fraunces, JetBrains_Mono } from "next/font/google";
```

Find:

```tsx
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-fraunces",
  axes: ["opsz"],
});
```

Append after that block:

```tsx
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
});
```

Find:

```tsx
<html lang="en" className={fraunces.variable}>
```

Replace with:

```tsx
<html lang="en" className={`${fraunces.variable} ${jetbrainsMono.variable}`}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/app/layout.test.tsx`
Expected: 3 passing tests.

- [ ] **Step 5: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx tests/unit/app/layout.test.tsx
git commit -m "feat(theme): wire JetBrains Mono via next/font/google

Expose --font-jetbrains-mono on <html> so Tailwind's font-mono and
prototype-style .mono class selectors resolve to the Warm Editorial
monospace."
```

---

## Task 4: Flip `app/styles/lobby.css` ambient background to light mode

**Files:**
- Modify: `app/styles/lobby.css`

The current ambient background is a deep navy radial halo. We need to replace it with cream paper + warm-ochre halos so the lobby reads as Warm Editorial.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/styles/lobby-css.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lobbyCss = readFileSync(
  resolve(__dirname, "../../../app/styles/lobby.css"),
  "utf-8",
);

describe("lobby.css light-mode flip", () => {
  test("does not hard-code the dark navy base colour #0B1220", () => {
    expect(lobbyCss).not.toMatch(/#0B1220/i);
  });

  test("does not hard-code the intermediate navy #0A1220", () => {
    expect(lobbyCss).not.toMatch(/#0A1220/i);
  });

  test("does not hard-code the deep navy #07101B", () => {
    expect(lobbyCss).not.toMatch(/#07101B/i);
  });

  test("references var(--paper) at least once", () => {
    expect(lobbyCss).toMatch(/var\(--paper\)/);
  });

  test("references var(--ochre-tint) for halos", () => {
    expect(lobbyCss).toMatch(/var\(--ochre-tint\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/lobby-css.test.ts`
Expected: 5 failures (all three hex values still present, token refs absent).

- [ ] **Step 3: Implement**

In `app/styles/lobby.css`, find the `.lobby-ambient-bg` block (starts around line 19):

```css
.lobby-ambient-bg {
  position: relative;
  background-color: #0B1220;
  ...
```

Replace it with:

```css
.lobby-ambient-bg {
  position: relative;
  background-color: var(--paper);
  isolation: isolate;
  overflow-x: clip;
}
```

Find the `.lobby-ambient-bg::before` block:

```css
.lobby-ambient-bg::before {
  ...
  background-image:
    radial-gradient(ellipse 80% 50% at 10% 0%, rgba(232, 182, 76, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 70% 55% at 90% 100%, rgba(56, 189, 248, 0.12) 0%, transparent 65%),
    linear-gradient(180deg, #0B1220 0%, #0A1220 40%, #07101B 100%);
  ...
}
```

Replace the `background-image` value with:

```css
  background-image:
    radial-gradient(ellipse 80% 50% at 88% 10%, var(--ochre-tint) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 10% 90%, color-mix(in oklab, var(--p2-tint) 50%, transparent) 0%, transparent 60%),
    linear-gradient(180deg, var(--paper) 0%, var(--paper-2) 100%);
```

Find the `.lobby-ambient-bg::after` block and replace:

```css
  background-image:
    linear-gradient(rgba(242, 234, 211, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(242, 234, 211, 0.035) 1px, transparent 1px);
```

with:

```css
  background-image:
    linear-gradient(color-mix(in oklab, var(--ink) 4%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--ink) 4%, transparent) 1px, transparent 1px);
```

- [ ] **Step 4: Search the rest of `lobby.css` for any remaining `#0B1220`, `#0A1220`, `#07101B`, `rgba(242, 234, 211, ...)` references**

Run: `grep -nE "#0B1220|#0A1220|#07101B|rgba\\(242" app/styles/lobby.css`
Expected: no matches. If any remain, replace them the same way — navy → paper, cream-rgba → `color-mix(in oklab, var(--ink) N%, transparent)`.

- [ ] **Step 5: Run the test**

Run: `pnpm test -- --run tests/unit/styles/lobby-css.test.ts`
Expected: 5 passing tests.

- [ ] **Step 6: Commit**

```bash
git add app/styles/lobby.css tests/unit/styles/lobby-css.test.ts
git commit -m "refactor(theme): flip lobby ambient background to paper-and-ochre

Replace navy radial halos + cream grid lines with paper + ochre-tint
halos + ink-tinted grid lines. All legacy hex values removed in favour
of OKLCH tokens."
```

---

## Task 5: Audit and flip `app/styles/board.css` hard-coded dark values

**Files:**
- Modify: `app/styles/board.css`

`board.css` was written under the dark-mode palette and may contain hex or rgba literals that read poorly on the new cream paper. This task audits and converts.

- [ ] **Step 1: Enumerate hard-coded dark values**

Run: `grep -nE "#[0-9a-fA-F]{3,6}|rgba\\(" app/styles/board.css`

Record the output. Every hex not already tied to a token needs review.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/styles/board-css.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe("board.css theme-flip audit", () => {
  test("no hard-coded navy or slate hex values", () => {
    const navyHex = boardCss.match(/#(0[Bb]1220|0[aA]1220|07101[Bb]|1[Ee]293[Bb]|0[Ff]172[Aa])/g);
    expect(navyHex).toBeNull();
  });

  test("no cream-on-dark rgba usage", () => {
    const creamRgba = boardCss.match(/rgba\(242,\s*234,\s*211/g);
    expect(creamRgba).toBeNull();
  });

  test("references var(--paper) or var(--ink) at least once", () => {
    expect(boardCss).toMatch(/var\(--(paper|ink)/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails (or note the scope)**

Run: `pnpm test -- --run tests/unit/styles/board-css.test.ts`
Expected: any hard-coded dark values cause failures.

- [ ] **Step 4: Replace hard-coded navy or slate hex values with tokens**

For each match from Step 1:
- `#0B1220` / `#0A1220` / `#07101B` → `var(--paper)` if used as a background, `var(--ink)` if used as text
- `#1E293B` / `#0F172A` (Tailwind slate) → `var(--paper-2)` or `var(--paper-3)`
- `rgba(242, 234, 211, X)` (cream-on-dark hairlines) → `color-mix(in oklab, var(--ink) N%, transparent)` with N chosen to preserve approximate contrast

If a block no longer has any styling that makes sense on light, delete it. Note the decision in the commit message.

- [ ] **Step 5: Run the test**

Run: `pnpm test -- --run tests/unit/styles/board-css.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 6: Run existing Playwright suite that touches the board**

Run: `pnpm exec playwright test --grep board-ui.spec`
Expected: existing tests still pass. If any now fail because an assertion checks a colour, update the assertion or adjust the token.

- [ ] **Step 7: Commit**

```bash
git add app/styles/board.css tests/unit/styles/board-css.test.ts
git commit -m "refactor(theme): flip board.css dark-mode literals to paper/ink tokens

Audit and replace every navy/slate hex and cream-on-dark rgba in
board.css with Warm Editorial tokens. Behaviour unchanged; existing
Playwright board-ui specs still pass."
```

---

## Task 6: Re-theme `components/match/PlayerPanel.tsx` for light mode

**Files:**
- Modify: `components/match/PlayerPanel.tsx`
- Modify: `tests/unit/components/PlayerPanel.test.tsx`

Current: `bg-gray-900/80 border-white/10` (explicit dark-mode classes, not token-referenced). Target: paper-surface card with `hair` border and `ink` text. This task keeps all props and behaviour identical — only swaps the class strings.

- [ ] **Step 1: Update the existing test to assert the new classes**

In `tests/unit/components/PlayerPanel.test.tsx`, find the first `test("renders display name", …)` block. After the existing `expect(screen.getByText("Alice Wonderland"))…` assertion, append a new standalone test right after:

```tsx
test("full variant uses paper surface and hair border", () => {
  render(
    <PlayerPanel
      player={defaultPlayer}
      gameState={defaultGameState}
      variant="full"
    />,
  );

  const panel = screen.getByTestId("player-panel");
  expect(panel.className).toContain("bg-paper");
  expect(panel.className).toContain("border-hair");
  expect(panel.className).not.toContain("bg-gray-900");
  expect(panel.className).not.toContain("border-white/10");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: the new test fails — classes still include `bg-gray-900/80`.

- [ ] **Step 3: Implement**

In `components/match/PlayerPanel.tsx`, find:

```tsx
<div
  data-testid="player-panel"
  className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-gray-900/80 p-4"
>
```

Replace with:

```tsx
<div
  data-testid="player-panel"
  className="flex flex-col items-center gap-3 rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
>
```

- [ ] **Step 4: Search for any other `bg-gray-*` or `border-white/*` in the same file**

Run: `grep -n "bg-gray\|border-white\|text-white" components/match/PlayerPanel.tsx`

For every match:
- `bg-gray-800` / `bg-gray-900` → `bg-paper-2` or `bg-paper`
- `border-white/N` → `border-hair` (strong if N ≥ 20)
- `text-white` → `text-ink`
- `text-gray-400` / `text-gray-500` → `text-ink-soft`

- [ ] **Step 5: Run the test**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: all tests in the file pass, including the new assertion.

- [ ] **Step 6: Run the full unit suite to catch snapshot / colour regressions**

Run: `pnpm test -- --run`
Expected: pass. If snapshots fail, update them only after visually confirming the expected light-mode rendering.

- [ ] **Step 7: Commit**

```bash
git add components/match/PlayerPanel.tsx tests/unit/components/PlayerPanel.test.tsx
git commit -m "refactor(match): re-theme PlayerPanel to paper surface + hair border

Swap dark-mode tailwind classes (bg-gray-900/80, border-white/10) for
Warm Editorial tokens (bg-paper, border-hair, shadow-wottle-sm). Props
and layout unchanged."
```

---

## Task 7: Audit and flip `components/match/FinalSummary.tsx` for light mode

**Files:**
- Modify: `components/match/FinalSummary.tsx`
- Modify: `tests/unit/components/FinalSummary.test.tsx`

- [ ] **Step 1: Enumerate dark classes**

Run: `grep -nE "bg-(gray|slate|neutral|zinc)-|border-white|text-white|text-(gray|slate|neutral|zinc)-[456]00" components/match/FinalSummary.tsx`

Record each match.

- [ ] **Step 2: Ensure the `FinalSummary` root has a `data-testid`, then add a regression test**

First, open `components/match/FinalSummary.tsx` and confirm the outermost returned element has `data-testid="final-summary-root"`. If it does not, add that attribute to the root element (do not change any other markup).

Then append this block inside the existing `describe("FinalSummary", …)` in `tests/unit/components/FinalSummary.test.tsx`, immediately before the closing `});` of the `describe`:

```tsx
it("uses paper surface classes, not dark-mode", () => {
  render(<FinalSummary {...makeProps()} />);
  const summary = screen.getByTestId("final-summary-root");
  expect(summary.className).not.toContain("bg-gray-");
  expect(summary.className).not.toContain("bg-slate-");
  expect(summary.className).toMatch(/bg-paper|bg-surface-0/);
});
```

The file already defines `makeProps()` at the top; reuse it verbatim.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/FinalSummary.test.tsx`
Expected: failure because dark-mode classes still present.

- [ ] **Step 4: Replace dark-mode class strings in FinalSummary.tsx**

For each match from Step 1:
- `bg-gray-900` / `bg-slate-900` → `bg-paper` or `bg-paper-2` depending on stack depth
- `border-white/N` → `border-hair` (or `border-hair-strong` for N ≥ 20)
- `text-white` → `text-ink`
- `text-gray-400` / `text-gray-500` → `text-ink-soft`
- `text-gray-300` → `text-ink-3`

- [ ] **Step 5: Run the test**

Run: `pnpm test -- --run tests/unit/components/FinalSummary.test.tsx`
Expected: pass.

- [ ] **Step 6: Run the full unit suite**

Run: `pnpm test -- --run`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/match/FinalSummary.tsx tests/unit/components/FinalSummary.test.tsx
git commit -m "refactor(match): re-theme FinalSummary to paper surface + hair borders

Mechanical dark-to-light class swap. No behavioural change."
```

---

## Task 8: Grep-and-flip any remaining `bg-gray-9XX` / `bg-slate-9XX` / `border-white/N` classes across `components/` and `app/`

**Files:**
- Modify: any component flagged by the grep.

This task catches leftover dark-mode classes in components that are not directly on the hot path of Tasks 4–7.

- [ ] **Step 1: Enumerate all remaining usages**

Run: `grep -rnE "bg-(gray|slate|neutral|zinc)-(8|9)00|border-white/|text-white" components/ app/ --include="*.tsx" --include="*.ts"`

Record every file and line.

- [ ] **Step 2: For each match, choose a token-referenced replacement**

Apply the same mapping as Tasks 6–7:
- `bg-{gray,slate}-900` → `bg-paper` (base surface) or `bg-paper-2` (inset surface)
- `bg-{gray,slate}-800` → `bg-paper-2` or `bg-paper-3`
- `border-white/10` → `border-hair`
- `border-white/20` → `border-hair-strong`
- `text-white` → `text-ink`
- `text-{gray,slate}-400` → `text-ink-soft`
- `text-{gray,slate}-300` → `text-ink-3`

Edit each file.

- [ ] **Step 3: Verify nothing dark remains**

Run: `grep -rnE "bg-(gray|slate|neutral|zinc)-(8|9)00|border-white/|text-white" components/ app/ --include="*.tsx" --include="*.ts"`
Expected: no matches.

- [ ] **Step 4: Run the full unit suite**

Run: `pnpm test -- --run`
Expected: pass.

- [ ] **Step 5: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(theme): flip remaining dark-mode classes to Warm Editorial tokens

Sweep components/ and app/ for bg-gray-9XX, bg-slate-9XX, border-white/N,
text-white — replace with paper/ink/hair tokens. No behavioural change."
```

---

## Task 9: Create `TopBar` component

**Files:**
- Create: `components/ui/TopBar.tsx`
- Create: `tests/unit/components/ui/TopBar.test.tsx`

The TopBar is a sticky strip across the top of every screen: wordmark on the left (Fraunces italic "Wottle" + mono "word · battle"), nav links on the right for Lobby / Profile. No language switch per spec §2.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/ui/TopBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TopBar } from "@/components/ui/TopBar";

describe("TopBar", () => {
  test("renders the Wottle wordmark", () => {
    render(<TopBar />);
    expect(screen.getByText("Wottle")).toBeInTheDocument();
  });

  test("renders the tagline", () => {
    render(<TopBar />);
    expect(screen.getByText("word · battle")).toBeInTheDocument();
  });

  test("renders a link to /lobby labelled 'Lobby'", () => {
    render(<TopBar />);
    const lobbyLink = screen.getByRole("link", { name: /lobby/i });
    expect(lobbyLink).toHaveAttribute("href", "/lobby");
  });

  test("renders a link to /profile labelled 'Profile'", () => {
    render(<TopBar />);
    const profileLink = screen.getByRole("link", { name: /profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  test("root element is sticky with top-0", () => {
    render(<TopBar />);
    const root = screen.getByTestId("topbar");
    expect(root.className).toContain("sticky");
    expect(root.className).toContain("top-0");
  });

  test("root element uses paper background with backdrop blur", () => {
    render(<TopBar />);
    const root = screen.getByTestId("topbar");
    expect(root.className).toMatch(/bg-paper/);
    expect(root.className).toMatch(/backdrop-blur/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/ui/TopBar.test.tsx`
Expected: the import itself fails (`TopBar` does not exist).

- [ ] **Step 3: Create the component**

Create `components/ui/TopBar.tsx`:

```tsx
import Link from "next/link";

export function TopBar() {
  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-20 flex items-center justify-between border-b border-hair bg-paper/85 px-7 py-3.5 backdrop-blur-md"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[22px] italic leading-none tracking-tight text-ink">
          Wottle
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          word · battle
        </span>
      </div>
      <nav className="flex items-center gap-5 text-[13px] text-ink-3">
        <Link href="/lobby" className="hover:text-ink">
          Lobby
        </Link>
        <Link href="/profile" className="hover:text-ink">
          Profile
        </Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/unit/components/ui/TopBar.test.tsx`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/TopBar.tsx tests/unit/components/ui/TopBar.test.tsx
git commit -m "feat(ui): add sticky TopBar with Wottle wordmark and nav

Mount-ready header that anchors every screen. Fraunces-italic 'Wottle'
paired with mono 'word · battle' eyebrow; lobby + profile nav links;
paper/85 background with backdrop blur for the scroll-pinned look."
```

---

## Task 10: Mount `TopBar` in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update the existing layout test to assert TopBar is present**

Append to `tests/unit/app/layout.test.tsx`:

```tsx
test("imports and renders TopBar", () => {
  expect(layoutSource).toMatch(
    /import\s*\{\s*TopBar\s*\}\s*from\s*"@\/components\/ui\/TopBar"/,
  );
  expect(layoutSource).toMatch(/<TopBar\s*\/>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/app/layout.test.tsx`
Expected: the new test fails — TopBar is neither imported nor rendered yet.

- [ ] **Step 3: Implement**

Edit `app/layout.tsx`. Find:

```tsx
import { GearMenu } from "@/components/ui/GearMenu";
import { ToastProvider } from "@/components/ui/ToastProvider";
```

Append:

```tsx
import { TopBar } from "@/components/ui/TopBar";
```

Find:

```tsx
<div className="relative flex min-h-screen flex-col">
  <div className="pointer-events-none absolute right-4 top-4 z-20">
    <div className="pointer-events-auto">
      <GearMenu />
    </div>
  </div>
  {children}
</div>
```

Replace with:

```tsx
<div className="relative flex min-h-screen flex-col">
  <TopBar />
  <div className="pointer-events-none absolute right-4 top-4 z-30">
    <div className="pointer-events-auto">
      <GearMenu />
    </div>
  </div>
  {children}
</div>
```

(`z-30` bump keeps the gear menu above the sticky header.)

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/app/layout.test.tsx`
Expected: pass.

- [ ] **Step 5: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx tests/unit/app/layout.test.tsx
git commit -m "feat(ui): mount TopBar across every route via root layout

TopBar now sticks to the top of every page. GearMenu z-index bumped so
it continues to float above the sticky header."
```

---

## Task 11: Playwright visual smoke that the app renders in light mode

**Files:**
- Create: `tests/integration/ui/theme-flip.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/ui/theme-flip.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("@theme-flip Warm Editorial theme", () => {
  test("lobby body background resolves to the paper token", async ({
    page,
  }) => {
    await page.goto("/lobby");
    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor,
    );
    // OKLCH may serialize as an rgb(…) or oklch(…) depending on browser.
    // Either way, lightness should be high — not the old #0B1220 navy.
    expect(bodyBg).not.toMatch(/^rgb\(\s*11,\s*18,\s*32\s*\)$/);
    expect(bodyBg).not.toBe("rgb(11, 18, 32)");
    // Parse the colour, assert lightness > 0.8 via a simple heuristic:
    const [, r = "0", g = "0", b = "0"] =
      bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/) ?? [];
    const luminance = 0.2126 * +r + 0.7152 * +g + 0.0722 * +b;
    expect(luminance).toBeGreaterThan(200);
  });

  test("TopBar renders on lobby", async ({ page }) => {
    await page.goto("/lobby");
    const topbar = page.getByTestId("topbar");
    await expect(topbar).toBeVisible();
    await expect(topbar.getByText("Wottle")).toBeVisible();
    await expect(topbar.getByText("word · battle")).toBeVisible();
  });

  test("TopBar is position: sticky", async ({ page }) => {
    await page.goto("/lobby");
    const position = await page
      .getByTestId("topbar")
      .evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe("sticky");
  });
});
```

- [ ] **Step 2: Run test to verify it passes against the new theme**

Run: `pnpm exec playwright test --grep @theme-flip`
Expected: all three tests pass. (If any fail due to route availability, confirm the lobby is reachable without auth or log in via existing test helper.)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ui/theme-flip.spec.ts
git commit -m "test(theme): Playwright smoke locking in Warm Editorial light theme

Assert /lobby renders on a high-luminance paper background and the
TopBar is sticky with brand + tagline visible."
```

---

## Task 12: Full verification sweep

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test -- --run`
Expected: all unit tests pass.

- [ ] **Step 2: Run the full Playwright suite**

Run: `pnpm exec playwright test`
Expected: all tests pass. If any fail because they asserted a dark-mode colour, update the assertion to the new light-mode expectation and record the change in the task commit.

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 4: Manual visual sanity check (describe, do not automate)**

Run: `pnpm dev` and load:
- `/lobby` — should render on cream paper with ochre halos, TopBar sticky.
- `/match/<valid-match-id>` via an existing playwright login if needed — PlayerPanel should render as a paper card.
- `/match/<valid-match-id>/summary` — FinalSummary should render on paper.

If anything reads poorly, file a follow-up task; do NOT attempt visual fixes in this plan — they belong to Phase 1b (match surfaces) or a focused cleanup.

- [ ] **Step 5: Commit nothing, record findings**

If Playwright assertion updates were required in Step 2, those are already committed in Task 11 or earlier. If anything else shifted during verification, commit it with:

```bash
git add -A
git commit -m "fix(theme): sweep remaining regressions from theme flip"
```

---

## Self-Review Checklist (for the author of this plan)

- [x] Every token declared in Task 1 is consumed somewhere downstream (Task 2 Tailwind alias, Task 9 TopBar, Task 11 Playwright smoke).
- [x] Every dark-mode hex removed (Tasks 4, 5, 6, 7, 8) has a replacement token named explicitly.
- [x] `JetBrains_Mono` wiring (Task 3) → Tailwind `font-mono` family (Task 2) → `font-mono` class usage (Task 9 TopBar) form a closed loop.
- [x] `TopBar` unit tests (Task 9) cover brand, tagline, links, sticky positioning, paper background.
- [x] `TopBar` mounted in layout (Task 10) has its own regression check.
- [x] Playwright smoke (Task 11) covers `TopBar` presence + paper background across a real route.
- [x] No placeholder words like "appropriate", "reasonable", "TBD" in any task body.
- [x] Every code change is anchored to an exact file path.
- [x] Task 12 verifies the plan holistically before hand-off.

---

## Out-of-scope (deferred to Phase 1b)

- Letterpress tile CSS (two-stop gradient, inset highlight/shadow).
- A-J / 1-10 coord labels on the board.
- HUD classic refresh — `.hud-card` left-stripe accent, avatar, italic Fraunces score, mono clock pill.
- Round pip bar (10 pips, current ochre).
- Left rail cards (How to play, Legend, Your move).
- Right rail "Tiles claimed" widget.

Phase 1b's plan will be written in a follow-up once Phase 1a merges and the team confirms the light theme reads well in practice.

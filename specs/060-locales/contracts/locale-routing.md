# Contract: locale routing

## `decideLocaleRoute(pathname): RouteDecision` (`lib/i18n/routing.ts`, pure)

| Input path | Result |
| --- | --- |
| `/` | `{ kind: "rewrite", to: "/is" }` |
| `/lobby` | `{ kind: "rewrite", to: "/is/lobby" }` |
| `/is` | `{ kind: "redirect", to: "/", status: 308 }` |
| `/is/match/abc?x=1` | `{ kind: "redirect", to: "/match/abc", status: 308 }` (query preserved by caller) |
| `/en`, `/en/lobby` | `{ kind: "next" }` |
| `/xx/lobby` | `{ kind: "rewrite", to: "/is/xx/lobby" }` → 404 |

`proxy.ts` matcher: `['/((?!api|_next|.*\\..*).*)']`.

## `localePath(locale, path): string`

- `localePath("is", "/lobby") === "/lobby"`; `localePath("en", "/lobby") === "/en/lobby"`; `localePath("en", "/") === "/en"`.
- `path` must start with `/`; throws otherwise.

## `switchLocalePath(pathname, from, to): string`

Strips `from`'s segment and applies `to`'s: `switchLocalePath("/en/lobby","en","is") === "/lobby"`.

## `isLandingPath(pathname, locale): boolean`

Replaces `pathname === "/"` in `LobbyRoomController`: true for `/` (is) and `/en` (en).

## Guard

A unit grep test fails on `href="/`, `href={\`/`, `push("/`, `replace("/`, `redirect("/`, `replaceState(…"/` in `app/[locale]`, `components/` outside `lib/i18n` and API routes.

# Wottle Staging Deployment Analysis

_March 2026 — CTO assessment for playtest deployment_

---

## Context

Wottle currently runs locally as dev only. Goal: deploy to a cloud staging environment to conduct internet playtests with a select group (~tens of players), with a shareable URL and minimal ops overhead.

---

## Stack Constraints

- **Next.js 16** (App Router, Server Actions) — requires a Node.js server, not static hosting
- **Supabase** — Auth, PostgreSQL, Realtime (WebSockets via broadcast channels), RLS policies, migrations
- **52MB Icelandic word list** (`data/wordlists/word_list_is.txt`) — loaded at runtime via `readFileSync`, stays cached in memory
- **No Docker, no custom server** — pure `next build` + `next start`
- **pnpm** workspaces, GitHub Actions CI already in place

---

## Platform Comparison

| Platform | Next.js fit | Supabase | Auto-deploy | Free tier | Notes |
|---|---|---|---|---|---|
| **Vercel** | ⭐⭐⭐⭐⭐ native | ✅ | ✅ push-to-deploy | Generous free | **Recommended** |
| **Netlify** | ⭐⭐⭐⭐ | ✅ | ✅ | Good free | Strong alternative |
| **Cloudflare Pages** | ⭐⭐⭐ | ⚠️ | ✅ | Excellent free | Edge runtime breaks Server Actions |
| **Render** | ⭐⭐⭐ | ✅ | ✅ | Free (cold starts) | Cold starts kill real-time game UX |
| **Railway** | ⭐⭐⭐⭐ | ✅ | ✅ | ~$5/mo | Solid, more DevOps overhead |
| **Fly.io** | ⭐⭐ | ✅ | Needs config | Free/cheap | Requires Docker, overkill for playtest |
| **AWS / GCP** | ✅ | ✅ | Needs setup | Minimal | Too much setup for a playtest |

---

## Recommendation: Vercel + Supabase Cloud

### Why Vercel

1. **Zero config for Next.js** — Vercel built Next.js. Server Actions, App Router, streaming all work out of the box without any configuration
2. **Push = deploy** — merge to `main` or a `staging` branch → live in ~60 seconds. No extra CI config beyond env vars
3. **Preview deployments** — every PR gets its own unique URL automatically. Ideal for sending targeted links to playtesters
4. **Word list bundling** — Vercel bundles server-side files with the function. The 52MB list stays in memory after cold start; subsequent requests are instant
5. **Free at this scale** — tens of players is well within Vercel's Hobby plan (free, no credit card required)
6. **First-class Supabase integration** — 1-click connector in Vercel's marketplace auto-injects env vars

### Why Supabase Cloud

- Free tier: 500MB DB, unlimited auth, Realtime included
- `supabase db push` runs all existing migrations cleanly against the cloud project
- Realtime broadcast channels (used for match state sync) are fully supported on free tier

---

## Setup Plan (~2–3 hours total)

### Step 1 — Supabase Cloud project (~30 min)

1. Create project at [supabase.com](https://supabase.com) (e.g. `wottle-staging`)
2. Run migrations against cloud:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. Copy credentials: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2 — Vercel deploy (~15 min)

1. [vercel.com](https://vercel.com) → Import Git repo (`minniai/wottle`)
2. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<from step 1>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from step 1>
   ```
3. Deploy → receive `https://wottle-staging.vercel.app`

### Step 3 — Staging branch (~15 min)

```bash
git checkout -b staging
git push origin staging
```

Vercel auto-deploys the `staging` branch to a fixed URL. `main` can be reserved for a production deploy later.

### Step 4 — Invite playtesters

Wottle already has playtest invite logic (`PLAYTEST_INVITE_EXPIRY_SECONDS` env var). Generate invite links and send players the staging URL.

---

## Cost

| Service | Cost |
|---|---|
| Vercel Hobby plan | **Free** |
| Supabase Free tier | **Free** |
| **Total** | **$0/month** |

Upgrade only becomes necessary if Supabase's 500MB DB limit or Vercel's bandwidth limits are exceeded — neither is realistic for a small playtest cohort.

---

## Watch-outs

### 52MB word list bundle size

Vercel has a **250MB compressed limit per serverless function**. The raw Icelandic word list is ~52MB uncompressed; after compression it should be well within limits. Verify on first deploy.

If it becomes an issue, the fix is to pre-build the word `Set` at build time and export it as a module constant — approximately 1 hour of work.

### Supabase Realtime on free tier

Free tier Supabase limits concurrent Realtime connections to 200. For a small playtest this is not a concern. Each active match uses 2 connections (one per player).

### Cold starts

Vercel serverless functions cold-start when idle. The dictionary load adds ~1–2 seconds on cold start. This is acceptable for a playtest; for production, Vercel's Fluid compute (always-warm) would eliminate it.

---

## Future path

Once playtest validates the concept:

1. Custom domain (`wottle.is` or similar)
2. Vercel Pro (~$20/mo) for always-on compute and higher limits
3. Supabase Pro ($25/mo) for larger DB, daily backups, priority support
4. Add `staging` and `production` Supabase projects as separate environments

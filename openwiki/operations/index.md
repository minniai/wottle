# Files

- [Environment, Configuration & Local Setup](environment-and-setup.md) - How to bring up a working local Wottle stack with pnpm quickstart, plus the environment variables, feature flags, game-config constants, and supabase:* operational scripts that configure the app and its Supabase backend.
- [Database Migrations & Scheduled Jobs](migrations-and-cron.md) - How Supabase SQL migrations define the schema source of truth and how the pg_cron stale-match sweep finalizes matches stuck in_progress with no live presence, including production setup and verification.
- [Observability & Logging](observability.md) - How the app emits structured JSON logs, tracks match and round events, records instant-scoring diagnostics, times operations for latency budgets, and exports per-match audit logs from Supabase.
- [Security, RLS & Rate Limiting](security-and-rate-limiting.md)

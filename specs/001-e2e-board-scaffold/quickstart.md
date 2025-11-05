 # Quickstart: MVP E2E Board Scaffold
 
 Follow these steps to run the local Supabase-backed environment and the app scaffold.
 
 ## Prerequisites
 
 - Docker Desktop (running)
 - Supabase CLI (v2+)
 - Node.js 20.x and PNPM 9+
 - macOS/Linux/WSL2 environment with Git
 
 ## 1) Clone and install
 
 ```bash
 cd /Users/arividar/git/wottle
 pnpm install
 ```
 
 ## 2) Environment setup
 
 - Copy templates and set local keys (anon for client, service_role for server-only):
 
 ```bash
 cp .env.example .env.local
 # Edit .env.local with values from `supabase status` after start (below)
 ```
 
 ## 3) Start local Supabase stack
 
 ```bash
 supabase start
 # Wait until database, auth, realtime, storage are healthy
 supabase status
 ```
 
 ## 4) Apply schema and seed baseline board
 
 ```bash
 # Apply migrations (when present)
 # supabase db reset --linked # or supabase db push
 
 # Seed baseline board (script placeholder; to be added during implementation)
 # pnpm ts-node scripts/supabase/seed.ts
 ```
 
 ## 5) Run the app
 
 ```bash
 pnpm dev
 # Open http://localhost:3000
 ```
 
 Expected:
 - Home page renders a 16×16 grid
 - Swap two tiles triggers a server-authoritative update
 
 ## 6) Troubleshooting
 
 - Missing Docker or CLI: Install per Supabase documentation
 - Port conflicts: `supabase stop && supabase start` or adjust ports in config
 - Wrong keys in client: Ensure anon key is used client-side; service_role only on server
 - Already running Supabase: Stop prior instance before starting a new one
 
 ## 7) CI pipeline (overview)
 
 - GitHub Actions workflow installs Node, caches deps, runs typecheck/lint/tests
 - Optional integration job spins up Supabase CLI on the runner for DB-backed tests
 
 ## 8) Clean up
 
 ```bash
 supabase stop
 ```


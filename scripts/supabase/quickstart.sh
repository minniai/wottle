#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
ENV_FILE="${QUICKSTART_ENV_FILE:-.env.local}"
PROD_ENV_FILE="${QUICKSTART_PROD_ENV_FILE:-.env.production.local}"
MATCH_ID="${QUICKSTART_MATCH_ID:-quickstart-$(node -p 'Date.now()')}"
DISABLE_STOP="${QUICKSTART_DISABLE_STOP:-}"
DRY_RUN="${QUICKSTART_DRY_RUN:-}"

function emit_json() {
  node - <<'NODE' "$@"
const [, , ...args] = process.argv;
const [event, ...rest] = args;
const payload = { event, timestamp: new Date().toISOString() };
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (key === undefined || value === undefined) continue;
  const numeric = Number(value);
  payload[key] = Number.isNaN(numeric) ? value : numeric;
}
console.log(JSON.stringify(payload));
NODE
}

function now_ms() {
  node -p 'Date.now()'
}

function update_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  node - "$file" "$key" "$value" <<'NODE'
const fs = require('fs');
const [, , path, key, value] = process.argv;
const escape = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let lines = [];
if (fs.existsSync(path)) {
  lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
}
const pattern = new RegExp(`^${escape(key)}=`); 
let updated = false;
lines = lines.filter(Boolean).map((line) => {
  if (pattern.test(line)) {
    updated = true;
    return `${key}=${value}`;
  }
  return line;
});
if (!updated) {
  lines.push(`${key}=${value}`);
}
fs.writeFileSync(path, lines.join('\n') + '\n', 'utf8');
NODE
}

function sync_env_values() {
  local target="$1"
  update_env_var "$target" "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
  update_env_var "$target" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
  update_env_var "$target" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
  update_env_var "$target" "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
}

function start_supabase_with_retry() {
  # Retry supabase start with exponential backoff
  # Sometimes containers exist but aren't ready yet
  local max_retries="${1:-1}"
  local retry_count=0
  local start_success=false

  while [[ $retry_count -lt $max_retries ]]; do
    if "$SUPABASE_BIN" start >/dev/null 2>&1; then
      start_success=true
      break
    fi
    retry_count=$((retry_count + 1))
    local wait_seconds=$((2 ** retry_count)) # Exponential backoff: 2, 4, 8, 16 seconds
    echo "Supabase start attempt $retry_count failed, waiting ${wait_seconds}s before retry..." >&2
    sleep "$wait_seconds"
  done

  if [[ "$start_success" != "true" ]]; then
    echo "Supabase start failed after $max_retries attempts. Trying to stop and restart..." >&2
    "$SUPABASE_BIN" stop >/dev/null 2>&1 || true
    sleep 2
    "$SUPABASE_BIN" start >/dev/null || {
      emit_json "supabase.quickstart.error" "message" "Supabase start failed. Ensure Docker is running and accessible. If using act, run 'pnpm quickstart' on host first, then use --env-file .env.local"
      exit 1
    }
  fi
}

function on_error() {
  local exit_code=$?
  emit_json "supabase.quickstart.error" "exitCode" "$exit_code" "message" "${BASH_COMMAND:-quickstart failed}"
  exit "$exit_code"
}

trap on_error ERR

cd "$ROOT_DIR"

PRE_PRECHECK_MS="$(now_ms)"

# Check if Supabase credentials are pre-set (useful when running inside act with host Supabase)
# If all three are set, skip Supabase start entirely and just write .env.local
if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Using pre-set Supabase credentials from environment..." >&2
  SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
  SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
  # Skip to env file creation
  SKIP_SUPABASE_START=true
  # Also skip preflight since we already have credentials
  emit_json "supabase.preflight.skipped" "reason" "credentials pre-set"
else
  SKIP_SUPABASE_START=false
  # Run preflight (Docker check auto-skipped when ACT=true)
  "$PNPM_BIN" tsx scripts/supabase/preflight.ts
fi

SUPABASE_START_BEGIN_MS="$(now_ms)"

if [[ "$SKIP_SUPABASE_START" == "true" ]]; then
  echo "Skipping Supabase start (using pre-set credentials)..." >&2
else
  # Check if Supabase is already running (useful when Docker socket mount fails in act)
  if "$SUPABASE_BIN" status >/dev/null 2>&1; then
    echo "Supabase is already running, skipping start..." >&2
  else
    start_supabase_with_retry 3
  fi
fi

SUPABASE_START_END_MS="$(now_ms)"

# Only fetch credentials from supabase status if not pre-set
if [[ "$SKIP_SUPABASE_START" != "true" ]]; then
  STATUS_JSON="$(mktemp)"
  "$SUPABASE_BIN" status --output json | tr -d '\n' >"$STATUS_JSON"

  SUPABASE_URL="$(node - "$STATUS_JSON" <<'NODE'
const fs = require('fs');
const statusPath = process.argv.at(-1);
const raw = fs.readFileSync(statusPath, 'utf8');
const jsonLine = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .reverse()
  .find((line) => line.startsWith('{'));
if (!jsonLine) {
  process.stderr.write('supabase status output did not contain JSON payload\n');
  process.exit(1);
}
const data = JSON.parse(jsonLine);
const apiUrl = data?.API_URL ?? data?.status?.credentials?.apiUrl ?? data?.status?.services?.api?.url ?? '';
process.stdout.write(apiUrl);
NODE
)"

  SUPABASE_ANON_KEY="$(node - "$STATUS_JSON" <<'NODE'
const fs = require('fs');
const statusPath = process.argv.at(-1);
const raw = fs.readFileSync(statusPath, 'utf8');
const jsonLine = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .reverse()
  .find((line) => line.startsWith('{'));
if (!jsonLine) {
  process.stderr.write('supabase status output did not contain JSON payload\n');
  process.exit(1);
}
const data = JSON.parse(jsonLine);
const anon = data?.ANON_KEY ?? data?.status?.credentials?.anonKey ?? '';
process.stdout.write(anon);
NODE
)"

  SUPABASE_SERVICE_ROLE_KEY="$(node - "$STATUS_JSON" <<'NODE'
const fs = require('fs');
const statusPath = process.argv.at(-1);
const raw = fs.readFileSync(statusPath, 'utf8');
const jsonLine = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .reverse()
  .find((line) => line.startsWith('{'));
if (!jsonLine) {
  process.stderr.write('supabase status output did not contain JSON payload\n');
  process.exit(1);
}
const data = JSON.parse(jsonLine);
const key = data?.SERVICE_ROLE_KEY ?? data?.status?.credentials?.serviceRoleKey ?? '';
process.stdout.write(key);
NODE
)"

  rm -f "$STATUS_JSON"

  if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    emit_json "supabase.quickstart.error" "message" "Supabase status did not return credentials"
    exit 1
  fi
fi

# Validate credentials are set (either pre-set or from supabase status)
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  emit_json "supabase.quickstart.error" "message" "Missing Supabase credentials"
  exit 1
fi

sync_env_values "$ENV_FILE"
if [[ -n "$PROD_ENV_FILE" ]]; then
  sync_env_values "$PROD_ENV_FILE"
fi

export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export BOARD_MATCH_ID="$MATCH_ID"

MIGRATE_BEGIN_MS="$(now_ms)"
# Skip migration/seed when using pre-set credentials (assume already done on host)
if [[ -z "$DRY_RUN" && "$SKIP_SUPABASE_START" != "true" ]]; then
  "$PNPM_BIN" supabase:migrate >/dev/null
fi
MIGRATE_END_MS="$(now_ms)"

SEED_BEGIN_MS="$(now_ms)"
if [[ -z "$DRY_RUN" && "$SKIP_SUPABASE_START" != "true" ]]; then
  "$PNPM_BIN" tsx scripts/supabase/seed.ts >/dev/null
  "$PNPM_BIN" tsx scripts/supabase/verify.ts >/dev/null
fi
SEED_END_MS="$(now_ms)"

if [[ -z "$DISABLE_STOP" && "$SKIP_SUPABASE_START" != "true" ]]; then
  "$SUPABASE_BIN" stop >/dev/null || true
fi

emit_json \
  "supabase.quickstart.success" \
  "startupDurationMs" "$((SUPABASE_START_END_MS - SUPABASE_START_BEGIN_MS))" \
  "migrationDurationMs" "$((MIGRATE_END_MS - MIGRATE_BEGIN_MS))" \
  "seedDurationMs" "$((SEED_END_MS - SEED_BEGIN_MS))" \
  "supabaseUrl" "$SUPABASE_URL" \
  "matchId" "$MATCH_ID" \
  "skippedSupabaseStart" "$SKIP_SUPABASE_START"


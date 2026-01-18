#!/usr/bin/env bash
# Helper script to run act with Docker socket mounted and artifact server enabled
# This is required for jobs that use Supabase (which needs Docker) and artifact uploads
#
# Usage:
#   bash scripts/act.sh                                    # Run all jobs
#   bash scripts/act.sh -j lint                           # Run specific job
#   bash scripts/act.sh -j playwright --matrix suite:baseline  # Run with matrix
#
# Requirements:
#   - act (GitHub Actions local runner): https://github.com/nektos/act
#   - Docker running and accessible
#   - Run from project root directory

set -euo pipefail

# Ensure we're in the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$(pwd)" != "$PROJECT_ROOT" ]; then
    echo "Warning: Not in project root. Changing directory to: $PROJECT_ROOT" >&2
    cd "$PROJECT_ROOT"
fi

# Determine Docker socket path
DOCKER_SOCK="${DOCKER_HOST:-/var/run/docker.sock}"
# Ensure unix:// prefix for act
if [[ ! "$DOCKER_SOCK" =~ ^unix:// ]]; then
    DOCKER_SOCK="unix://$DOCKER_SOCK"
fi

# Check if Docker socket exists (remove unix:// prefix for file check)
SOCK_FILE="${DOCKER_SOCK#unix://}"
if [ ! -S "$SOCK_FILE" ]; then
    echo "Error: Docker socket not found at $SOCK_FILE" >&2
    echo "Make sure Docker is running and accessible." >&2
    exit 1
fi

# Create a directory for artifact server if not provided
# Use a persistent location in the project or a temp directory
ARTIFACT_DIR="${ACT_ARTIFACT_DIR:-$(mktemp -d -t act-artifacts-XXXXXX)}"
mkdir -p "$ARTIFACT_DIR"
echo "Artifact server directory: $ARTIFACT_DIR" >&2

# Use act's built-in flags:
# - --container-daemon-socket: Mount Docker socket (for Supabase)
# - --artifact-server-path: Enable artifact uploads (for upload-artifact actions)
echo "Running act from: $(pwd)" >&2
echo "Docker socket: $DOCKER_SOCK" >&2
echo "Artifact directory: $ARTIFACT_DIR" >&2

# Check if .secrets file exists
if [ -f .secrets ]; then
    echo "✓ Using secrets from .secrets file" >&2
elif [ -f .secrets.example ]; then
    echo "⚠ Warning: .secrets file not found. Create it from .secrets.example if you need Supabase access token" >&2
    echo "  For local development without cloud features, you can skip this by setting:" >&2
    echo "  export ACT_SKIP_TOKEN_CHECK=1" >&2
fi

# Allow skipping token check for local development
# Use array to build additional arguments
declare -a ACT_EXTRA_ARGS=()

if [ "${ACT_SKIP_TOKEN_CHECK:-}" = "1" ]; then
    echo "✓ Skipping Supabase access token check (ACT_SKIP_TOKEN_CHECK=1)" >&2
    ACT_EXTRA_ARGS+=(--env "QUICKSTART_SKIP_TOKEN_CHECK=1")
fi

# Allow skipping Docker check for local development (useful when Docker socket mount fails)
if [ "${ACT_SKIP_DOCKER_CHECK:-}" = "1" ]; then
    echo "✓ Skipping Docker prerequisite check (ACT_SKIP_DOCKER_CHECK=1)" >&2
    ACT_EXTRA_ARGS+=(--env "QUICKSTART_SKIP_DOCKER_CHECK=1")
fi

# By default, we do NOT pass .env.local credentials to act.
# This forces quickstart inside act to start its own Supabase instance,
# which is more reliable because:
# 1. If we pass credentials, quickstart skips starting Supabase
# 2. But those credentials point to localhost:54321 on the HOST
# 3. We can't guarantee Supabase is running on the host
#
# To use a pre-running Supabase (faster iteration), set ACT_USE_HOST_SUPABASE=1
# and ensure Supabase is running: `supabase start && ACT_USE_HOST_SUPABASE=1 bash scripts/act.sh ...`
if [ "${ACT_USE_HOST_SUPABASE:-}" = "1" ] && [ -f .env.local ]; then
    # Source .env.local to get the values
    set -a
    # shellcheck disable=SC1091
    . ./.env.local
    set +a

    if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
        echo "✓ ACT_USE_HOST_SUPABASE=1: Passing Supabase credentials from .env.local to act container" >&2
        echo "  Make sure Supabase is running on the host: supabase status" >&2

        # For act/Docker, we need to access the host's network for Supabase
        # If the URL points to localhost/127.0.0.1, rewrite it to host.docker.internal
        SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
        if [[ "$SUPABASE_URL" == *"127.0.0.1"* ]] || [[ "$SUPABASE_URL" == *"localhost"* ]]; then
            # Replace 127.0.0.1 or localhost with host.docker.internal
            SUPABASE_URL="${SUPABASE_URL/127.0.0.1/host.docker.internal}"
            SUPABASE_URL="${SUPABASE_URL/localhost/host.docker.internal}"
            echo "  ℹ Rewriting Supabase URL to $SUPABASE_URL for container access" >&2
        fi

        # Pass the (potentially rewritten) URL as the standard env var
        ACT_EXTRA_ARGS+=(--env "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL")
        # Also pass it as an override to ensure it survives .env.local sourcing in CI
        ACT_EXTRA_ARGS+=(--env "ACT_SUPABASE_URL_OVERRIDE=$SUPABASE_URL")

        ACT_EXTRA_ARGS+=(--env "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY")
        ACT_EXTRA_ARGS+=(--env "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}")
        ACT_EXTRA_ARGS+=(--env "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}")
    fi
fi

echo "" >&2

# Execute act with original args plus any extra args
# Use ${arr[@]+"${arr[@]}"} pattern to handle empty arrays with set -u
# Enforce --concurrent-jobs 1 to avoid port collisions in matrix jobs
# Container options:
#   --pid=host: Allow cleanup scripts to see and kill ghost processes on the host
#   --add-host: Allow containers to resolve host.docker.internal to the host IP
#   --env-file /dev/null: Disable act's default .env loading. The repo's .env has
#     placeholder Supabase values that would cause quickstart to skip starting Supabase.

exec act "$@" ${ACT_EXTRA_ARGS[@]+"${ACT_EXTRA_ARGS[@]}"} \
    --container-daemon-socket "$DOCKER_SOCK" \
    --artifact-server-path "$ARTIFACT_DIR" \
    --concurrent-jobs 1 \
    --container-options "--pid=host --add-host=host.docker.internal:host-gateway" \
    --env-file /dev/null

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
ACT_ARGS=("$@")
if [ "${ACT_SKIP_TOKEN_CHECK:-}" = "1" ]; then
  echo "✓ Skipping Supabase access token check (ACT_SKIP_TOKEN_CHECK=1)" >&2
  ACT_ARGS+=(--env "QUICKSTART_SKIP_TOKEN_CHECK=1")
fi

echo "" >&2

exec act "${ACT_ARGS[@]}" \
  --container-daemon-socket "$DOCKER_SOCK" \
  --artifact-server-path "$ARTIFACT_DIR"


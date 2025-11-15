#!/usr/bin/env bash
# Helper script to run act with Docker socket mounted and artifact server enabled
# This is required for jobs that use Supabase (which needs Docker) and artifact uploads

set -euo pipefail

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
exec act "$@" \
  --container-daemon-socket "$DOCKER_SOCK" \
  --artifact-server-path "$ARTIFACT_DIR"


#!/usr/bin/env bash
# Wrapper script to start Next.js server and keep it alive
# This prevents the server from becoming a zombie process

set -euo pipefail

# Load environment variables if .env.local exists
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

# Start the server - exec replaces the shell process
exec pnpm start --hostname 0.0.0.0 --port 3000


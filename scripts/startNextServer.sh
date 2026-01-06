# Ensure the port is free before starting
echo "Checking for processes on port ${APP_PORT:-3100}..."
if command -v lsof &> /dev/null; then
  lsof -ti :${APP_PORT:-3100} | xargs kill -9 2>/dev/null || true
fi
# Fallback to pkill with broader patterns
pkill -9 -f "next.*start.*${APP_PORT:-3100}" 2>/dev/null || true
pkill -9 -f "pnpm.*start.*${APP_PORT:-3100}" 2>/dev/null || true

# Verify .env.local exists and load environment variables
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found! Server will fail without Supabase credentials"
  echo "Expected .env.local to be created by quickstart step"
  exit 1
fi
# Load environment variables
set -a
source .env.local
set +a
# Start the server directly with proper signal handling.
# Prefer setsid when available; macOS images often lack it, so fall back to nohup.
if command -v setsid >/dev/null 2>&1; then
  setsid bash -c "CI=${CI} PLAYTEST_SESSION_SECURE=${PLAYTEST_SESSION_SECURE} exec pnpm start --hostname 0.0.0.0 --port ${APP_PORT:-3100}" < /dev/null > next.log 2>&1 &
  SERVER_PID=$!
else
  nohup bash -c "CI=${CI} PLAYTEST_SESSION_SECURE=${PLAYTEST_SESSION_SECURE} exec pnpm start --hostname 0.0.0.0 --port ${APP_PORT:-3100}" < /dev/null > next.log 2>&1 &
  SERVER_PID=$!
fi
echo $SERVER_PID > .next-pid
echo "Started server with PID: $SERVER_PID"
# Wait for server to initialize
sleep 5
# Check process state - must check state, not just kill -0 (which works on zombies)
PROC_STATE=$(ps -o state= -p $SERVER_PID 2>/dev/null | tr -d ' ' || echo "")
if [ -z "$PROC_STATE" ]; then
  echo "ERROR: Server process $SERVER_PID not found"
  echo "=== Server log ==="
  cat next.log
  exit 1
fi
if [ "$PROC_STATE" = "Z" ]; then
  echo "ERROR: Server process $SERVER_PID is a zombie (defunct)"
  echo "=== Server log ==="
  cat next.log
  exit 1
fi
echo "Server process $SERVER_PID is running (state: $PROC_STATE)"
# Find the actual Node.js process (pnpm spawns node)
NODE_PID=$(pgrep -P $SERVER_PID 2>/dev/null | head -1 || pgrep -f "next.*start" 2>/dev/null | head -1 || echo "")
if [ -n "$NODE_PID" ] && [ "$NODE_PID" != "$SERVER_PID" ]; then
  echo "Found Node.js process: $NODE_PID"
  echo $NODE_PID > .next-node-pid
  NODE_STATE=$(ps -o state= -p $NODE_PID 2>/dev/null | tr -d ' ' || echo "")
  if [ "$NODE_STATE" = "Z" ]; then
    echo "ERROR: Node.js process $NODE_PID is a zombie"
    exit 1
  fi
fi
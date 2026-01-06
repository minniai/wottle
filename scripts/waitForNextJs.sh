 echo "Waiting for Next.js server to be ready..."
echo "Checking server logs..."
tail -30 next.log || true
echo ""
echo "=== Checking if server process is still running ==="
if [ -f .next-pid ]; then
  PID=$(cat .next-pid)
  if kill -0 $PID 2>/dev/null; then
    echo "Server process $PID is running"
    ps aux | grep -E "^[^ ]+ +$PID " | grep -v grep || true
  else
    echo "ERROR: Server process $PID is NOT running!"
    echo "=== Full server log ==="
    cat next.log
    exit 1
  fi
else
  echo "ERROR: .next-pid file not found!"
  exit 1
fi
echo ""
echo "=== Testing server connection ==="
# Try multiple methods to test connectivity
for url in "http://127.0.0.1:${APP_PORT:-3100}" "http://localhost:${APP_PORT:-3100}" "http://0.0.0.0:${APP_PORT:-3100}"; do
  echo "Testing $url..."
  if command -v curl &> /dev/null; then
    if curl -f -s -o /dev/null --max-time 2 "$url" 2>&1; then
      echo "✓ $url is accessible via curl"
      break
    else
      echo "✗ $url not accessible via curl"
    fi
  elif command -v wget &> /dev/null; then
    if wget -q -O /dev/null --timeout=2 "$url" 2>&1; then
      echo "✓ $url is accessible via wget"
      break
    else
      echo "✗ $url not accessible via wget"
    fi
  else
    echo "curl/wget not available, skipping connection test"
  fi
done
echo ""
echo "=== Using wait-on to verify server ==="
pnpm exec wait-on "http://127.0.0.1:${APP_PORT:-3100}" --timeout 60000 --interval 1000 || {
  echo "=== wait-on failed ==="
  echo "=== Full server log ==="
  cat next.log
  echo "=== Process status ==="
  if [ -f .next-pid ]; then
    PID=$(cat .next-pid)
    ps aux | grep -E "(^[^ ]+ +$PID |node|next)" | grep -v grep || true
  fi
  exit 1
}
echo "✓ Server is ready!"
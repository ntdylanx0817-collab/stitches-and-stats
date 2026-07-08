#!/usr/bin/env bash
# Supervisor for the Savant XL live-feed WebSocket mini-service.
# Restarts the service on crash with a 2-second back-off.

SERVICE_DIR="/home/z/my-project/mini-services/live-feed"
STDOUT_LOG="$SERVICE_DIR/stdout.log"
PIDFILE="$SERVICE_DIR/supervisor.pid"

# Prevent double-supervision
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[$(date -Iseconds)] Supervisor already running (PID $OLD_PID). Exiting."
    exit 0
  fi
fi
echo $$ > "$PIDFILE"

echo "[$(date -Iseconds)] Savant XL live-feed supervisor started (PID $$)"

while true; do
  echo "[$(date -Iseconds)] Starting live-feed service..."
  cd "$SERVICE_DIR"
  bun start >> "$STDOUT_LOG" 2>&1 &
  CHILD=$!
  echo "[$(date -Iseconds)] Service child PID: $CHILD"
  wait $CHILD
  EXIT_CODE=$?
  echo "[$(date -Iseconds)] Service exited with code $EXIT_CODE. Restarting in 2s..."
  sleep 2
done

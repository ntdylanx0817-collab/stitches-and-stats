#!/usr/bin/env bash
# Keepalive: check every 3s if the service is running, restart if not.
SERVICE_DIR="/home/z/my-project/mini-services/live-feed"
PIDFILE="$SERVICE_DIR/service.pid"

while true; do
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE" 2>/dev/null || echo "")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      # Service is running, wait
      sleep 3
      continue
    fi
  fi
  # Service not running, start it
  echo "[$(date -Iseconds)] Starting live-feed service..."
  cd "$SERVICE_DIR"
  bun start >> "$SERVICE_DIR/stdout.log" 2>&1 &
  PID=$!
  echo $PID > "$PIDFILE"
  echo "[$(date -Iseconds)] Service PID: $PID"
  sleep 2
done

#!/usr/bin/env bash
# Persistent start script for the live-feed service.
# Runs the service directly (no supervisor) with auto-restart.
# Resolve the service directory from this script's own location so it works
# from any checkout path.
SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SERVICE_DIR"

while true; do
  echo "[$(date -Iseconds)] Starting live-feed service..."
  bun start 2>&1 | tee -a stdout.log
  echo "[$(date -Iseconds)] Service exited with code $?. Restarting in 2s..."
  sleep 2
done

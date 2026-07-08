#!/usr/bin/env bash
# Persistent start script for the live-feed service.
# Runs the service directly (no supervisor) with auto-restart.
SERVICE_DIR="/home/z/my-project/mini-services/live-feed"
cd "$SERVICE_DIR"

while true; do
  echo "[$(date -Iseconds)] Starting live-feed service..."
  bun start 2>&1 | tee -a stdout.log
  echo "[$(date -Iseconds)] Service exited with code $?. Restarting in 2s..."
  sleep 2
done

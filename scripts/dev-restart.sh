#!/bin/sh
# Restart the local API (serves the built web app too) with demo auth. Windows-safe: kills whatever listens on :8787.
PID=$(netstat -ano 2>/dev/null | grep ":8787" | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
sleep 1
DEMO_AUTH=true RATE_LIMIT_PER_MIN=100000 npx tsx server/src/index.ts > /tmp/api.log 2>&1 &
sleep 7
head -2 /tmp/api.log

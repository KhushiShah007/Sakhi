#!/bin/sh
# Stop the local API (the embedded database allows one process), seed the fictional demo data, restart with demo auth.
PID=$(netstat -ano 2>/dev/null | grep ":8787" | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
sleep 1
DEMO_AUTH=true npx tsx server/src/seed.ts
sh scripts/dev-restart.sh

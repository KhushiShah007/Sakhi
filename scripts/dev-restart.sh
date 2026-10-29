#!/bin/sh
# Restart the local API (serves the built web app too) with demo auth. Windows-safe: kills whatever listens on :8787.
PID=$(netstat -ano 2>/dev/null | grep ":8787" | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
sleep 1
eval "$(node -e "const k=require(\"web-push\").generateVAPIDKeys();console.log(\"export VAPID_PUBLIC_KEY=\"+k.publicKey+\" VAPID_PRIVATE_KEY=\"+k.privateKey)")"
DEMO_AUTH=true ADMIN_KEY=admin-demo-key RATE_LIMIT_PER_MIN=100000 npx tsx server/src/index.ts > /tmp/api.log 2>&1 &
sleep 7
head -2 /tmp/api.log

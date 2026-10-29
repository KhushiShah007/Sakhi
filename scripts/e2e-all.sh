#!/bin/sh
# Runs every real-browser suite, prints failing checks, and fails at the end (so CI shows all failures, not just the first).
rc=0
for f in onboarding vent home checkin voice mic translator privacy brief tools ivr family hr admin pwa; do
  out=$(node scripts/e2e-$f.mjs 2>&1); code=$?
  if [ $code -ne 0 ]; then echo "=== e2e-$f FAILED"; echo "$out" | grep -vE '^PASS' | tail -25; rc=1; else echo "ok  e2e-$f"; fi
done
exit $rc

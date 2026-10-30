#!/bin/sh
# Runs every real-browser suite, prints failing checks, and fails at the end (so CI shows all failures, not just the first).
rc=0
for f in onboarding vent home checkin voice voiceprefs voicefix reminders mic a11y translator privacy brief tools ivr family hr admin pwa; do
  out=$(node scripts/e2e-$f.mjs 2>&1); code=$?
  if [ $code -ne 0 ]; then
    echo "=== e2e-$f FAILED"; echo "$out" | grep -vE '^PASS' | tail -25
    # GitHub turns this into an annotation on the run, readable without opening the raw log
    msg=$(echo "$out" | grep -E 'FAIL|Error|waiting for' | head -4 | tr '\n' ' ' | cut -c1-400)
    echo "::error title=e2e-$f::$msg"
    rc=1
  else echo "ok  e2e-$f"; fi
done
exit $rc

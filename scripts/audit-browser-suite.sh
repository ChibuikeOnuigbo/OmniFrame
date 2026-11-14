#!/usr/bin/env bash
set -u

audit_url="${1:-http://localhost:5173/#studio}"
audit_log_dir="${2:-/tmp/omniframe-audit-browser}"
mkdir -p "$audit_log_dir"
audit_total=0
audit_failed=0
for audit_test in \
  qa/animation-entry-e2e.mjs \
  qa/effect-mask-shapes-e2e.mjs \
  qa/context-menu-viewport-e2e.mjs \
  qa/mcp-live-bridge-e2e.mjs \
  qa/timeline-controls-e2e.mjs \
  qa/clip-filmstrip-e2e.mjs \
  qa/cursor-click-burst-e2e.mjs \
  qa/settings-quality-e2e.mjs \
  qa/three-d-video-plane-e2e.mjs; do
  audit_total=$((audit_total + 1))
  audit_name="${audit_test##*/}"
  URL="$audit_url" TEST_URL="$audit_url" timeout 120s node "$audit_test" > "$audit_log_dir/$audit_name.log" 2>&1
  audit_status=$?
  if [ "$audit_status" -ne 0 ]; then
    audit_failed=$((audit_failed + 1))
    printf 'FAIL %s (exit %s)\n' "$audit_test" "$audit_status"
    tail -n 10 "$audit_log_dir/$audit_name.log"
  fi
done
printf 'Browser smoke: %s run, %s failed; logs: %s\n' "$audit_total" "$audit_failed" "$audit_log_dir"
test "$audit_failed" -eq 0

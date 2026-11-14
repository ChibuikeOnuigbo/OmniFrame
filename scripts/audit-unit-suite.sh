#!/usr/bin/env bash
set -u

audit_log_dir="${1:-/tmp/omniframe-audit-units}"
mkdir -p "$audit_log_dir"
audit_total=0
audit_failed=0
for audit_test in qa/*-unit.mjs; do
  audit_total=$((audit_total + 1))
  audit_name="${audit_test##*/}"
  timeout 120s node "$audit_test" > "$audit_log_dir/$audit_name.log" 2>&1
  audit_status=$?
  if [ "$audit_status" -ne 0 ]; then
    audit_failed=$((audit_failed + 1))
    printf 'FAIL %s (exit %s)\n' "$audit_test" "$audit_status"
    tail -n 8 "$audit_log_dir/$audit_name.log"
  fi
done
printf 'Unit suite: %s run, %s failed; logs: %s\n' "$audit_total" "$audit_failed" "$audit_log_dir"
test "$audit_failed" -eq 0

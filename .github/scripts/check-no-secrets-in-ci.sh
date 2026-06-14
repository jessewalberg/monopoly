#!/usr/bin/env bash
# Dependency-free "no secrets in CI" guard for .github/workflows.
#
# Vendored copy of the secretkit deploy-gate check (the executable counterpart
# to secretkit's `lint-ci` / `ci-drift.ts`). It fails CLOSED if any committed
# workflow reverts to the pre-secretkit, resolve-secrets-in-CI model. Under the
# secretkit model the HOST resolves runtime secrets and CI carries only the
# deploy-bootstrap creds (CONVEX_DEPLOY_KEY, CLOUDFLARE_API_TOKEN,
# CLOUDFLARE_ACCOUNT_ID) as GitHub *Environment* secrets.
#
# Pure POSIX-ish bash + grep — no node, no yaml, no network, no install step —
# so it runs identically on push and on pull_request with no toolchain.
#
# Forbidden markers (mirrors secretkit ci-drift.ts FORBIDDEN_TOKENS):
#   - any 1Password service-account token env name: <NAME>SERVICE_ACCOUNT<NAME>TOKEN<NAME>
#   - an `op://` reference resolved in CI
#   - an `op run` wrapper
#   - a `doppler run` wrapper
#   - an in-CI `secretkit sync`
# Comment lines (those whose first non-blank char is `#`) are excluded, matching
# the parser-based gate which never surfaces comments as scalar values.
#
# Usage:
#   check-no-secrets-in-ci.sh [WORKFLOWS_DIR]   # scan (default .github/workflows)
#   check-no-secrets-in-ci.sh --self-test       # run embedded fixtures, assert behavior
set -euo pipefail

# The forbidden-marker table. Each entry: "<label>::<extended-regex>". The
# service-account matcher is by SHAPE, not an exact name, so any
# …SERVICE_ACCOUNT…TOKEN… identifier trips it. Defined once and used by both the
# real scan and --self-test, so the self-test exercises the SAME table the real
# scan uses — a PR that weakens a matcher here is caught by the fixtures below.
PATTERNS=(
  "1Password service-account token in CI::\b[A-Z][A-Z0-9_]*SERVICE_ACCOUNT[A-Z0-9_]*TOKEN[A-Z0-9_]*\b"
  "op:// reference resolved in CI::op://"
  "\`op run\`::\bop[[:space:]]+run\b"
  "\`doppler run\`::\bdoppler[[:space:]]+run\b"
  "in-CI \`secretkit sync\`::\bsecretkit[[:space:]]+sync\b"
)

# scan_dir DIR — print one DRIFT line per forbidden marker found in any
# *.yml/*.yaml under DIR (comment lines excluded), then a final "COUNT=<n>"
# line. -print0 / read -d '' keeps paths with spaces safe.
scan_dir() {
  local dir="$1" findings=0 file noncomment entry label regex matches hit
  while IFS= read -r -d '' file; do
    # Strip comment lines (first non-blank char is `#`) before matching, so a
    # documented marker in a comment never trips the gate.
    noncomment="$(grep -vE '^[[:space:]]*#' "$file" || true)"
    for entry in "${PATTERNS[@]}"; do
      label="${entry%%::*}"
      regex="${entry#*::}"
      matches="$(printf '%s\n' "$noncomment" | grep -nE "$regex" || true)"
      [ -z "$matches" ] && continue
      while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        echo "DRIFT — ${file} — forbidden in CI: ${label} (line ${hit%%:*})"
        findings=$((findings + 1))
      done <<< "$matches"
    done
  done < <(find "$dir" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
  echo "COUNT=${findings}"
}

# --self-test: run scan_dir against embedded known-bad / comment-only fixtures
# and assert the guard still detects all five markers AND ignores commented
# markers. A diff that neuters a matcher makes the planted markers go
# undetected, so this fails — the guard cannot be silently disabled in the same
# PR that reverts to in-CI secrets (closes the same-diff bypass).
if [ "${1:-}" = "--self-test" ]; then
  fixroot="$(mktemp -d)"
  trap 'rm -rf "$fixroot"' EXIT
  mkdir -p "$fixroot/bad" "$fixroot/good"
  cat > "$fixroot/bad/bad.yml" <<'FIX'
name: bad
jobs:
  x:
    env:
      OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
      A_REF: op://vault/item/field
    steps:
      - run: op run -- echo hi
      - run: doppler run -- echo hi
      - run: secretkit sync
FIX
  cat > "$fixroot/good/good.yml" <<'FIX'
# commented markers must be IGNORED: op://x OP_SERVICE_ACCOUNT_TOKEN op run doppler run secretkit sync
name: good
jobs:
  y:
    steps:
      - run: echo ok
      - run: shop run
FIX
  bad_count="$(scan_dir "$fixroot/bad" | sed -n 's/^COUNT=//p')"
  good_count="$(scan_dir "$fixroot/good" | sed -n 's/^COUNT=//p')"
  if [ "$bad_count" -lt 5 ]; then
    echo "SELF-TEST FAIL — known-bad fixture: expected >=5 findings, got ${bad_count} (matchers weakened?)" >&2
    exit 1
  fi
  if [ "$good_count" -ne 0 ]; then
    echo "SELF-TEST FAIL — comment-only fixture: expected 0 findings, got ${good_count} (comments not excluded?)" >&2
    exit 1
  fi
  echo "SELF-TEST PASS — known-bad=${bad_count} finding(s), comment-only=0"
  exit 0
fi

WORKFLOWS_DIR="${1:-.github/workflows}"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo "check-no-secrets-in-ci: no $WORKFLOWS_DIR directory — nothing to scan; PASS"
  exit 0
fi

# Real scan: print findings (if any), then gate on the trailing COUNT.
output="$(scan_dir "$WORKFLOWS_DIR")"
count="$(printf '%s\n' "$output" | sed -n 's/^COUNT=//p')"
printf '%s\n' "$output" | grep -v '^COUNT=' || true

if [ "${count:-0}" -gt 0 ]; then
  echo "FAIL — ${count} secrets-in-CI drift finding(s)"
  exit 1
fi

echo "PASS — 0 secrets-in-CI drift findings"

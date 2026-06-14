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
set -euo pipefail

WORKFLOWS_DIR="${1:-.github/workflows}"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo "check-no-secrets-in-ci: no $WORKFLOWS_DIR directory — nothing to scan; PASS"
  exit 0
fi

# Each entry: "<label>::<extended-regex>". The service-account matcher is by
# SHAPE, not an exact name, so any …SERVICE_ACCOUNT…TOKEN… identifier trips it.
PATTERNS=(
  "1Password service-account token in CI::\b[A-Z][A-Z0-9_]*SERVICE_ACCOUNT[A-Z0-9_]*TOKEN[A-Z0-9_]*\b"
  "op:// reference resolved in CI::op://"
  "\`op run\`::\bop[[:space:]]+run\b"
  "\`doppler run\`::\bdoppler[[:space:]]+run\b"
  "in-CI \`secretkit sync\`::\bsecretkit[[:space:]]+sync\b"
)

findings=0

# Scan every *.yml / *.yaml under the workflows dir. -print0 / read -d '' keeps
# paths with spaces safe; failing closed on an unreadable file is implicit since
# `set -e` aborts on a grep I/O error.
while IFS= read -r -d '' file; do
  # Strip comment lines (first non-blank char is `#`) before matching, so a
  # documented marker in a comment never trips the gate.
  noncomment="$(grep -vE '^[[:space:]]*#' "$file" || true)"
  for entry in "${PATTERNS[@]}"; do
    label="${entry%%::*}"
    regex="${entry#*::}"
    if matches="$(printf '%s\n' "$noncomment" | grep -nE "$regex" || true)"; then
      if [ -n "$matches" ]; then
        while IFS= read -r hit; do
          [ -z "$hit" ] && continue
          echo "DRIFT — ${file} — forbidden in CI: ${label} (line ${hit%%:*})"
          findings=$((findings + 1))
        done <<< "$matches"
      fi
    fi
  done
done < <(find "$WORKFLOWS_DIR" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)

if [ "$findings" -gt 0 ]; then
  echo "FAIL — ${findings} secrets-in-CI drift finding(s)"
  exit 1
fi

echo "PASS — 0 secrets-in-CI drift findings"

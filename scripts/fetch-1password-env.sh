#!/usr/bin/env bash
set -euo pipefail

# Fetch a .env file from 1Password and save it locally.
# Usage: ./scripts/fetch-1password-env.sh [op-ref] [out-file]
# Example: ./scripts/fetch-1password-env.sh op://Private/64vemiaz6crtuooztbqfv6gd34/.env.local .env.local

OP_REF="${1:-op://Private/64vemiaz6crtuooztbqfv6gd34/.env.local}"
OUT_FILE="${2:-.env.local}"

if ! command -v op >/dev/null 2>&1; then
  echo "1Password CLI (op) is not installed. Install it first: https://developer.1password.com/docs/cli/get-started/"
  exit 1
fi

if ! op whoami >/dev/null 2>&1; then
  echo "You are not signed in to 1Password CLI. Run: op signin"
  exit 1
fi

tmp_file="$(mktemp "${TMPDIR:-/tmp}/monopoly-env.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

if ! op read "$OP_REF" > "$tmp_file"; then
  echo "Failed to read item: $OP_REF" >&2
  exit 1
fi

if [ ! -s "$tmp_file" ]; then
  echo "No content returned from: $OP_REF"
  exit 1
fi

mv "$tmp_file" "$OUT_FILE"
chmod 600 "$OUT_FILE" 2>/dev/null || true

echo "Wrote $OUT_FILE from $OP_REF"
echo "Load and export vars into current shell:"
echo "  set -a; source $OUT_FILE; set +a"

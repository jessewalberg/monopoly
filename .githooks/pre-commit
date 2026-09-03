#!/usr/bin/env bash
# Pre-commit secret scan (P-2-2026-09-04).
# Blocks a commit if a staged file looks like it carries a real secret.
# Bypass, only when you are certain: git commit --no-verify
set -uo pipefail

fail=0
staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

for f in $staged; do
  [ -f "$f" ] || continue

  case "$f" in
    *.example|*.sample|*.md|*secrets.manifest.json) continue ;;
  esac

  # 1. Real .env files should never be tracked at all.
  case "$f" in
    .env|.env.*|*/.env|*/.env.*)
      echo "BLOCKED: $f is an env file and must not be committed."
      echo "  Use $f.example with placeholder values instead."
      fail=1
      continue
      ;;
  esac

  # 2. Assignment of a long literal to a secret-looking name.
  if git show ":$f" 2>/dev/null | grep -nEi \
      '(passphrase|password|secret|api[_-]?key|token|private[_-]?key)[^=:]{0,20}[=:][[:space:]]*["'"'"']?[A-Za-z0-9/+_-]{16,}' \
      | grep -vEi 'REPLACE_ME|process\.env|import\.meta\.env|op://|\$\{|<[A-Z_]+>|example|placeholder|xxxx' ; then
    echo "BLOCKED: $f appears to contain a hardcoded secret (above)."
    fail=1
  fi

  # 3. Well-known credential prefixes.
  if git show ":$f" 2>/dev/null | grep -nE \
      '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' ; then
    echo "BLOCKED: $f contains what looks like a live credential (above)."
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Commit refused by the secret scan. Move the value to Proton Pass and"
  echo "reference it from an untracked .env.local, or use --no-verify if this"
  echo "is genuinely a false positive."
  exit 1
fi
exit 0

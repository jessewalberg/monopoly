# Secrets

## The short version

Never put a real secret in a tracked file. A `pre-commit` hook refuses the
commit if you try.

```bash
git config core.hooksPath .githooks   # once per clone
```

## What lives where

| Value | Where it lives | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | `.env.dev`, `.env.production` (tracked) | genuinely public; ships in the bundle by design |
| `VITE_ADMIN_PASSPHRASE` | `.env.local` (untracked) + Proton Pass + GitHub Environment secret `VITE_ADMIN_PASSPHRASE` on `production` | rotated 2026-09-03 |
| `CONVEX_DEPLOY_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Environment secrets on `production` | never local |

Local setup:

```bash
cp .env.local.example .env.local   # then paste the real passphrase from Proton Pass
```

## About `VITE_ADMIN_PASSPHRASE` specifically

Vite inlines every `VITE_`-prefixed variable into the client bundle at build
time. **Anyone who loads the site can read this value out of the JavaScript.**
It is a speed bump on the analytics rebuild button, not access control.

Between 2026-07 and 2026-09-03 the value was also committed in
`.env.production`, so it is in the git history permanently. It was rotated on
2026-09-03; the old value is burned.

If the rebuild button ever needs to be genuinely protected, the fix is
server-side: move `recalculateAllStats` behind a Convex action that checks a
server-only secret. A `VITE_` variable can never do that job.

## The pre-commit hook

`scripts/pre-commit-secret-scan.sh`, installed at `.githooks/pre-commit`. It
refuses a commit that stages:

1. `.env` / `.env.local` / `.env.*.local`
2. a long literal assigned to a name containing passphrase / password / secret /
   api key / token / private key
3. a known credential prefix (`sk-`, `ghp_`, `gho_`, `AKIA`, `xox*`, PEM private keys)

`.example`, `.sample`, and `.md` files are skipped. Genuine false positive:
`git commit --no-verify`, and then think about why.

# LLM Monopoly Arena (Static Museum)

A Cloudflare-hosted **static museum** of completed AI Monopoly games and analytics. Live arena play (Convex + OpenRouter) has been retired.

## What remains

- `/` — museum landing
- `/games` — completed game history
- `/games/:gameId` — turn-by-turn replay from static JSON
- `/analytics` (+ leaderboard / head-to-head / model detail) — offline aggregates
- `/play` — explicit retired/read-only status (not a live control surface)

Archive contents are generated from a Convex document snapshot and checked into `public/museum/`:

- 224 completed games retained
- abandoned games excluded
- `decisions`, `trades`, and `rentPayments` omitted from deployed payloads

See [docs/adr/0001-static-museum-sunset.md](./docs/adr/0001-static-museum-sunset.md).

## Tech stack

| Layer           | Technology                                      |
| --------------- | ----------------------------------------------- |
| Frontend        | React 19, TanStack Start/Router/Query           |
| Data            | Static JSON under `public/museum/`              |
| Styling         | Tailwind CSS v4                                 |
| Charts          | Recharts                                        |
| Hosting         | Cloudflare (Worker shell serves static museum)  |
| Package Manager | pnpm                                            |

## Local development

```bash
pnpm install
pnpm run dev
```

No Convex deployment URL or OpenRouter API key is required for local museum browsing.

### Regenerate museum assets

Provide a Convex snapshot zip (export of documents) via env or CLI args. Do not commit private absolute paths into scripts.

```bash
# Example:
MUSEUM_SNAPSHOT_PATH=/path/to/snapshot.zip \
  pnpm museum:generate "$MUSEUM_SNAPSHOT_PATH" public/museum
```

Generation validates referential integrity and fails closed on malformed/missing required data.

## Scripts

```bash
pnpm run dev          # Vite dev server
pnpm run build        # Production build + typecheck
pnpm run test         # Vitest
pnpm run lint         # tsc + eslint
pnpm museum:generate  # Snapshot → public/museum
pnpm run deploy       # build + wrangler deploy (reviewer-owned)
```

## Retired architecture

Historically this app used:

- **Convex** for realtime game state, scheduling, and analytics aggregation
- **OpenRouter** for LLM turn decisions

Those runtime integrations are removed from the application code. Historical docs (`ARCHITECTURE.md`, older notes) may still describe the retired system.

## Sunset completion (2026-07-18)

1. Static museum deployed and smoke-verified at https://monopoly-llm.jessewalberg.com
2. monopoly-llm Convex project and both deployments deleted (irreversible)
3. Retired OpenRouter key revoked; GitHub production `CONVEX_DEPLOY_KEY` removed; production and development monopoly-app 1Password items archived (each held only the retired `OPENROUTER_API_KEY`)
4. Durable offline backups (verified SHA-256):

| Deployment | SHA-256 |
| ---------- | ------- |
| prod | `00a4626aae16d60699d046131b186ac7c38217c5372addfbb4000b643523b16e` |
| dev | `ea11d496fcfcefb537f7462d8b3d1e63716d5082e227b536b3745ef497fd9678` |

Backup directory: `/Volumes/home-ext/portfolio-sunset-2026-06-02/monopoly-convex-backups/2026-07-18`

Project deletion is irreversible; offline data remains recoverable from these verified backups.

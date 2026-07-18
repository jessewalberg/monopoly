# ADR 0001: Static Museum Sunset

## Status

Accepted and completed. Static museum deployed and smoke-verified on 2026-07-18 at https://monopoly-llm.jessewalberg.com. The monopoly-llm Convex project and both deployments were then deleted.

## Context

LLM Monopoly Arena ran automated AI Monopoly games through Convex (realtime DB + scheduling) and OpenRouter (model decisions). Ongoing runtime cost made live play unsustainable. The product still has historical value as an archive of completed games and analytics.

## Decision

Convert the public site into a **static Cloudflare-hosted museum**:

- Serve checked-in JSON assets generated from an authoritative Convex document snapshot.
- Retain **completed** games only (224 in the sunset snapshot).
- Exclude abandoned games from the archive.
- Omit `decisions`, `trades`, and `rentPayments` payloads from the deployed archive (strategy/trade/rent aggregates may still be baked into analytics during generation).
- Remove runtime Convex providers/queries/mutations and OpenRouter clients from the app.
- Retire `/play` as an explicit read-only museum status page (never a live control surface).
- Keep analytics subroutes that can be served from static aggregates (`/analytics`, `/analytics/leaderboard`, `/analytics/head-to-head`, `/analytics/model/$modelId`).

## Retained data

Checked into `public/museum/`:

- `index.json` — compact completed-game index
- `analytics.json` — global/model/property/head-to-head/strategy/win-rate aggregates
- `games/<gameId>.json` — per-game replay payloads containing only:
  - `game`, `players`, `properties`, `turns`, `propertyTransfers`, `propertyStateEvents`

Per-game files are split so normal pages do not download every turn for every game.

## Backup location

Authoritative Convex exports for regeneration live outside the application repo:

`/Volumes/home-ext/portfolio-sunset-2026-06-02/monopoly-convex-backups/2026-07-18`

Verified SHA-256 checksums:

| Deployment | SHA-256 |
| ---------- | ------- |
| prod | `00a4626aae16d60699d046131b186ac7c38217c5372addfbb4000b643523b16e` |
| dev | `ea11d496fcfcefb537f7462d8b3d1e63716d5082e227b536b3745ef497fd9678` |

Museum generation still accepts snapshots via `MUSEUM_SNAPSHOT_PATH` or CLI args to `pnpm museum:generate`. Do not embed unrelated private paths in scripts.

Convex project deletion is irreversible; offline data remains recoverable from these verified backups.

## Secret retirement (completed 2026-07-18)

- Retired OpenRouter key revoked
- GitHub production `CONVEX_DEPLOY_KEY` removed
- Production and development monopoly-app 1Password items archived (each held only the retired `OPENROUTER_API_KEY`)

Retired secret names remain in `secrets.manifest.json` as `ignore` / non-delivered. Cloudflare active delivery is unchanged.

## Consequences

- No new games can be started from the public site.
- Replays and analytics are frozen to the snapshot generation point.
- Regenerating museum assets requires an offline snapshot zip and `pnpm museum:generate`.
- Worker/SSR shell (TanStack Start on Cloudflare), if present, must only serve the static museum and must not call backends.
- Live Convex and OpenRouter runtime dependencies are fully retired.

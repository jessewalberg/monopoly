# AGENTS.md — monopoly

Instructions for AI coding agents working in this repo (Claude Code loads
this via CLAUDE.md's `@AGENTS.md`; Cursor and Codex read it natively).

## Operating model

This repo is canonical for its own **decisions** (`docs/decisions/`), **work
queue** (`backlog/*.md`), and **learnings** (`docs/learnings/`) — committed with
the code so agents read them in-context.

- This repo is **public**: never commit secret values *or* secret key names.
  Secrets are 1Password-only; key-name references live in a private store, not
  in this repo.
- Durable conclusions from a work item graduate to `docs/decisions/` on close.

## Project

LLM Monopoly Arena is a full-stack web app where AI models (Claude, GPT,
Gemini, Grok, Llama, etc.) play automated games of Monopoly against each other
with comprehensive analytics. Stack: React 19 + TanStack Start (SSR, file-based
routing, TanStack Router/Query), Convex (real-time DB, serverless functions,
scheduling), OpenRouter as the unified LLM gateway, Tailwind CSS v4, Recharts.
Deploys to Vercel; Convex deploys separately. **pnpm only** — even where docs
say npm. Dev: `pnpm run dev` (app + Convex). Convex: `pnpm dlx convex dev`,
`pnpm dlx convex dashboard`, `pnpm dlx convex deploy`. Tests live alongside
pure logic (e.g. `convex/lib/*.test.ts`).

## Architecture

- `convex/` — backend. Top-level files are Convex functions (games, players,
  properties, turns, decisions, gameEngine, llmActions, analytics,
  statsAggregator). `convex/lib/` holds **pure game logic with no DB access**
  (constants/board data, board helpers, rent, validation, cards, types,
  errors) — keep it DB-free and unit-tested.
- `src/` — frontend. `src/routes/` are TanStack Start pages (landing,
  `play/`, `analytics/`, `games/` replay). `src/components/` split into
  game/, analytics/, setup/, ui/ (each re-exported via `index.ts`).
  `src/lib/models.ts` lists available LLM models; hooks in `src/hooks/`,
  styles in `src/styles/`.

## Convex conventions

- Queries read and auto-subscribe; mutations write transactionally; actions
  make external calls (OpenRouter). The scheduler auto-advances game turns —
  no manual WebSocket code; frontend queries update in real time on their own.
- Turn lifecycle: `pre_roll → rolling → post_roll → turn_end`; game ends when
  one player remains, then `updateStatsAfterGame` runs.
- LLM decision points: buy_property, auction_bid, jail_strategy,
  pre_roll_actions, post_roll_actions, trade_response. LLM calls go through
  `llmActions.ts` (OpenRouter base URL `https://openrouter.ai/api/v1`), which
  already handles retry and timeout.

## Domain rules

Full standard Monopoly is implemented (40-space board; properties, railroads,
utilities; rent with monopoly doubling, houses/hotels; Chance/Community Chest;
jail with 3-turn max, $50 fine, get-out cards; even-building rule; mortgaging;
bankruptcy with asset transfer). Rent math is subtle — railroads scale
25/50/100/200, utilities are 4x/10x dice, mortgaged properties return 0 — so
change `convex/lib/rent.ts` and `validation.ts` test-first.

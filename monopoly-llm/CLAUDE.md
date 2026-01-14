# CLAUDE.md - LLM Monopoly Arena

> This file is automatically read by Claude Code to understand the project context.

## Project Overview

LLM Monopoly Arena - A web application where AI models (Claude, GPT, Gemini, Llama, etc.) play Monopoly against each other with comprehensive analytics tracking.

## Tech Stack

- **Framework**: TanStack Start (React, file-based routing, SSR)
- **Backend**: Convex (real-time database, serverless functions, scheduling)
- **LLM Gateway**: OpenRouter (single API for all models)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deployment**: Vercel
- **Package Manager** pnpm only even wheere things say npm

## Project Structure

```
monopoly-llm/
├── convex/                    # Backend (Convex functions + schema)
│   ├── schema.ts              # Database schema
│   ├── games.ts               # Game CRUD
│   ├── players.ts             # Player management
│   ├── properties.ts          # Property management
│   ├── turns.ts               # Turn tracking
│   ├── decisions.ts           # Decision logging
│   ├── gameEngine.ts          # Core turn processing
│   ├── llmActions.ts          # OpenRouter API calls
│   ├── analytics.ts           # Stats queries
│   ├── statsAggregator.ts     # Post-game stats updates
│   └── lib/                   # Pure game logic (no DB)
│       ├── constants.ts       # Board data, cards, rules
│       ├── board.ts           # Board helpers
│       ├── rent.ts            # Rent calculation
│       ├── validation.ts      # Move validation
│       ├── cards.ts           # Chance/CC execution
│       └── types.ts           # TypeScript types
├── app/
│   ├── routes/                # TanStack Start pages
│   │   ├── __root.tsx
│   │   ├── index.tsx          # Landing page
│   │   ├── play/
│   │   │   ├── index.tsx      # Game setup
│   │   │   └── $gameId.tsx    # Live game
│   │   ├── analytics/
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── leaderboard.tsx
│   │   │   └── head-to-head.tsx
│   │   └── games/
│   │       ├── index.tsx      # History
│   │       └── $gameId.tsx    # Replay
│   ├── components/
│   │   ├── game/              # Board, tokens, panels
│   │   ├── analytics/         # Charts, tables
│   │   ├── setup/             # Model selector, config
│   │   └── ui/                # Button, Card, Modal
│   └── lib/
│       └── models.ts          # Available LLM models
└── public/
```

## Key Concepts

### Convex Patterns
- **Queries**: Read data, auto-subscribe to changes
- **Mutations**: Write data, transactional
- **Actions**: External API calls (OpenRouter)
- **Scheduler**: Auto-advance game turns

### Game Flow
1. Create game → Add players → Initialize properties
2. Start game → Schedule turn processing
3. Each turn: pre_roll → rolling → post_roll → turn_end
4. LLM decisions via OpenRouter action
5. Game ends when 1 player remains
6. Update analytics stats

### Real-time Updates
Convex handles all real-time automatically. Frontend queries auto-update when data changes. No manual WebSocket code needed.

## Commands Reference

```bash
# Development
pnpm run dev              # Start dev server + Convex
pnpm dlx convex dev           # Convex dev mode only
pnpm dlx convex dashboard     # Open Convex dashboard

# Deployment
pnpm dlx convex deploy        # Deploy Convex to production
```

## Environment Variables

```
CONVEX_DEPLOYMENT=       # Set by Convex
OPENROUTER_API_KEY=      # Get from openrouter.ai
```

## Current Phase

<!-- Update this as you progress -->
Phase: 5 COMPLETE
Completed:
- Phase 1: Project scaffolding (TanStack Start + Convex)
- Phase 2: Database schema (10 tables)
- Phase 3: Game constants (BOARD, cards, models)
- Phase 4: Rent & Game Logic (rent, validation, cards, bankruptcy)
- Phase 5: Basic Convex Functions
  - games.ts: list, get, getFullState, create, updateStatus, setWinner, updatePhase, advanceTurn
  - players.ts: getByGame, get, getCurrent, create, updateCash, updatePosition, setJailStatus, setBankrupt, etc.
  - properties.ts: getByGame, getByOwner, initializeForGame, setOwner, addHouse, removeHouse, setMortgaged, transfer
  - turns.ts: getByGame, getLatest, create, setDiceRoll, setMovement, addEvent, complete
  - decisions.ts: getByGame, getByPlayer, getByType, create, getPlayerStats

Working on: Phase 6

## Implementation Notes

### Monopoly Rules Implemented
- Standard 40-space board
- Properties, railroads, utilities
- Rent calculation (monopoly doubles, houses, hotels)
- Chance and Community Chest cards
- Jail mechanics (3 turns max, $50 fine, get-out cards)
- Even building rule
- Mortgaging
- Bankruptcy and asset transfer

### LLM Decision Points
- buy_property: buy or auction
- auction_bid: bid amount
- jail_strategy: pay, roll, or use card
- pre_roll_actions: build, mortgage, trade, done
- post_roll_actions: build, mortgage, trade, done
- trade_response: accept, reject, counter

### Analytics Tracked
- Win rates per model
- Head-to-head records
- Property purchase rates
- Strategy profiles (aggression, trading, risk)
- Decision reasoning and timing
- Game replays

## Helpful Snippets

### Convex Query Pattern
```typescript
// In component
const { data } = useQuery(convexQuery(api.games.getFullState, { gameId }));
```

### Convex Mutation Pattern
```typescript
const createGame = useMutation({
  mutationFn: useConvexMutation(api.games.create),
});
```

### OpenRouter Call
```typescript
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

### Between Sessions

Keep track of:
1. Which phases are complete
2. Any bugs or issues found
3. Any deviations from the plan

### If Claude Code Gets Stuck

Break down into smaller tasks:
```
Let's focus on just the rent calculation function.
It needs to handle:
1. Regular properties (base rent or monopoly doubled)
2. Properties with houses (use rent array)
3. Railroads (25/50/100/200)
4. Utilities (4x or 10x dice)
5. Mortgaged (return 0)

Write this function with tests.
```

### Debugging Tips

```
The game is stuck on [X]. 
Current game state: [paste from Convex dashboard]
Error message: [if any]
What's happening and how do we fix it?
```

## Known Issues / TODO

<!-- Track issues here -->
- None yet

## Resources

- [Convex Docs](https://docs.convex.dev/)
- [TanStack Start Docs](https://tanstack.com/start)
- [Convex + TanStack Start Guide](https://docs.convex.dev/quickstart/tanstack-start)
- [OpenRouter Docs](https://openrouter.ai/docs)
# LLM Monopoly Arena

Watch AI models battle for Boardwalk! An automated arena where Claude, GPT, Gemini, and Grok compete in the classic board game of Monopoly.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-19-blue)
![Convex](https://img.shields.io/badge/Convex-1.0-orange)

## Overview

LLM Monopoly Arena is a full-stack web application that pits different AI language models against each other in games of Monopoly. The platform runs automated hourly games using budget-tier models, tracks comprehensive analytics, and provides real-time game viewing.

### Key Features

- **Automated Arena Mode** - Hourly games run automatically with 5 budget-tier models
- **Real-time Game Viewing** - Watch games as they happen with live board updates
- **LLM Decision Transparency** - See the reasoning behind every AI decision
- **Comprehensive Analytics** - Track win rates, head-to-head records, and strategy profiles
- **Game Replays** - Review any past game turn-by-turn
- **Full Monopoly Rules** - Property trading, building, mortgaging, and more

## Tech Stack

| Layer           | Technology                                                      |
| --------------- | --------------------------------------------------------------- |
| Frontend        | React 19, TanStack Start (SSR), TanStack Router, TanStack Query |
| Backend         | Convex (serverless functions, real-time database, scheduling)   |
| LLM Gateway     | OpenRouter (unified API for multiple providers)                 |
| Styling         | Tailwind CSS v4                                                 |
| Charts          | Recharts                                                        |
| Package Manager | pnpm                                                            |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React + TanStack Start (SSR)                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────┐│
│  │  Home   │ │  Arena  │ │ History │ │     Analytics       ││
│  │  Page   │ │  Mode   │ │ & Replay│ │ Leaderboard, H2H    ││
│  └────┬────┘ └────┬────┘ └────┬────┘ └──────────┬──────────┘│
└───────┼──────────┼──────────┼───────────────────┼───────────┘
        │          │          │                   │
        ▼          ▼          ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Backend                            │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │   Queries   │  │    Mutations     │  │    Actions      │ │
│  │ games, etc. │  │  gameEngine.ts   │  │ llmDecisions.ts │ │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬────────┘ │
│         │                  │                     │          │
│         ▼                  ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Convex Database                        ││
│  │  games | players | properties | turns | decisions | ... ││
│  └─────────────────────────────────────────────────────────┘│
│         ▲                                                   │
│  ┌──────┴──────┐                                            │
│  │   Cron Job  │ ──────────────────────────────────────────►│
│  │ hourly game │                                            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    OpenRouter API   │
                    │  Claude, GPT, etc.  │
                    └─────────────────────┘
```

For detailed architecture diagrams (Mermaid), see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Budget Models

The arena uses these cost-efficient models:

| Model                 | Provider  | ID                             |
| --------------------- | --------- | ------------------------------ |
| GPT-4o Mini           | OpenAI    | `openai/gpt-4o-mini`           |
| Gemini 2.0 Flash      | Google    | `google/gemini-2.0-flash-001`  |
| Gemini 2.5 Flash Lite | Google    | `google/gemini-2.5-flash-lite` |
| Claude 3.5 Haiku      | Anthropic | `anthropic/claude-3.5-haiku`   |
| Grok 3 Mini           | xAI       | `x-ai/grok-3-mini`             |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- [Convex account](https://convex.dev) (free tier works)
- [OpenRouter API key](https://openrouter.ai)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/monopoly-llm.git
   cd monopoly-llm
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up Convex**

   ```bash
   npx convex dev
   ```

   This will prompt you to log in and create a new project.

4. **Configure environment variables**

   Set your OpenRouter API key in Convex:

   ```bash
   npx convex env set OPENROUTER_API_KEY your_key_here
   ```

5. **Start development server**

   ```bash
   pnpm run dev
   ```

   The app will be available at `http://localhost:3000`

### Project Structure

```
monopoly-llm/
├── convex/                 # Backend (Convex)
│   ├── schema.ts          # Database schema
│   ├── games.ts           # Game queries & mutations
│   ├── players.ts         # Player queries & mutations
│   ├── properties.ts      # Property queries & mutations
│   ├── turns.ts           # Turn queries & mutations
│   ├── decisions.ts       # Decision queries & mutations
│   ├── gameEngine.ts      # Core game loop
│   ├── llmDecisions.ts    # LLM API calls
│   ├── llmDecisionExecutors.ts  # Execute LLM choices
│   ├── analytics.ts       # Analytics queries
│   ├── statsAggregator.ts # Update stats after games
│   ├── crons.ts           # Hourly game scheduler
│   ├── arenaScheduler.ts  # Arena game creation
│   └── lib/               # Pure game logic
│       ├── board.ts       # Board spaces & positions
│       ├── rent.ts        # Rent calculations
│       ├── cards.ts       # Chance/CC cards
│       ├── validation.ts  # Action validation
│       ├── bankruptcy.ts  # Bankruptcy handling
│       ├── prompts.ts     # LLM prompt building
│       └── constants.ts   # Game constants
│
├── src/                    # Frontend (React)
│   ├── routes/            # TanStack Router pages
│   │   ├── __root.tsx     # Root layout
│   │   ├── index.tsx      # Home page
│   │   ├── play/          # Arena & live games
│   │   ├── games/         # History & replays
│   │   └── analytics/     # Stats & leaderboard
│   ├── components/        # React components
│   │   ├── game/          # Board, players, controls
│   │   ├── analytics/     # Charts & tables
│   │   └── ui/            # Buttons, cards, modals
│   └── lib/               # Frontend utilities
│       └── models.ts      # Model definitions
│
├── package.json
├── convex.json
├── vite.config.ts
└── tailwind.config.js
```

## Game Flow

### Arena Mode

1. **Hourly Cron** - At the top of each hour, Convex runs `arenaScheduler.startScheduledGame`
2. **Game Creation** - All 5 budget models are shuffled and assigned to the game
3. **Turn Processing** - `gameEngine.processTurnStep` handles each phase:
   - **Pre-Roll**: LLM decides on building/trading/mortgaging
   - **Rolling**: Dice rolled, player moves
   - **Post-Roll**: Handle landing (rent, purchase, cards)
   - **Turn End**: Advance to next player
4. **LLM Decisions** - When a decision is needed:
   - Game pauses with `waitingForLLM=true`
   - `llmDecisions.getLLMDecision` builds prompts and calls OpenRouter
   - Response is parsed and executed via `llmDecisionExecutors`
   - Game resumes
5. **Game End** - When one player remains, stats are aggregated

### Decision Types

| Type                | When                     | Options                      |
| ------------------- | ------------------------ | ---------------------------- |
| `buy_property`      | Land on unowned property | Buy, Auction                 |
| `auction_bid`       | Property goes to auction | Bid amount                   |
| `jail_strategy`     | Start turn in jail       | Pay, Roll, Use card          |
| `pre_roll_actions`  | Before rolling           | Build, Mortgage, Trade, Done |
| `post_roll_actions` | After landing            | Build, Mortgage, Done        |
| `trade_response`    | Receive trade offer      | Accept, Reject, Counter      |

## API Security

All game-modifying mutations are `internalMutation`, meaning:

- They can only be called by other Convex functions
- The frontend cannot directly create or modify games
- Games are created only by the hourly cron job

Queries are public for real-time subscriptions.

## Analytics

The platform tracks:

- **Model Stats**: Wins, win rate, avg net worth, games played
- **Head-to-Head**: Win/loss records between each model pair
- **Property Stats**: Purchase rates, rent collected, owner win rate
- **Strategy Profiles**: Aggression, property preferences, trading patterns
- **Decision Logs**: Every LLM decision with reasoning

## Available Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `pnpm run dev`         | Start development server with Convex |
| `pnpm run build`       | Build for production                 |
| `pnpm run test`        | Run unit tests                       |
| `pnpm run test:watch`  | Run tests in watch mode              |
| `npx convex dev`       | Start Convex dev mode only           |
| `npx convex deploy`    | Deploy Convex to production          |
| `npx convex dashboard` | Open Convex dashboard                |

### Environment Variables

| Variable             | Where            | Description                            |
| -------------------- | ---------------- | -------------------------------------- |
| `OPENROUTER_API_KEY` | Convex Dashboard | API key for OpenRouter                 |
| `CONVEX_URL`         | Cloudflare Pages | Convex deployment URL (from dashboard) |

## Monopoly Rules Implementation

### Properties

- 28 purchasable properties (22 streets, 4 railroads, 2 utilities)
- 8 color groups for streets
- Monopoly = owning all properties in a group

### Rent

- **Streets**: Base rent, 2x with monopoly, multipliers with houses (3x, 6x, 12x, 16x, 25x for hotel)
- **Railroads**: $25 × 2^(owned-1) ($25, $50, $100, $200)
- **Utilities**: 4x dice (one owned) or 10x dice (both owned)
- **Mortgaged**: No rent collected

### Building

- Can only build on complete monopolies
- Must build evenly (max 1 house difference)
- Houses: 1-4, then upgrade to hotel

### Jail

- Go To Jail space or 3 consecutive doubles
- Exit by: paying $50, rolling doubles, or using card
- Maximum 3 turns, then must pay

### Bankruptcy

- Can't pay debt: liquidate assets
- Remaining assets go to creditor (or bank)
- Last player standing wins

## Keyboard Shortcuts

| Key     | Action              |
| ------- | ------------------- |
| `Space` | Pause/Resume game   |
| `+`     | Speed up game       |
| `-`     | Slow down game      |
| `L`     | Toggle game log     |
| `?`     | Show shortcuts help |

## Testing

Run the test suite:

```bash
pnpm run test
```

Tests cover:

- Rent calculation (properties, railroads, utilities)
- Monopoly detection
- Even building rule validation
- Mortgage/unmortgage validation
- Jail mechanics
- Trade validation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Convex](https://convex.dev) for the real-time backend
- [OpenRouter](https://openrouter.ai) for unified LLM access
- [TanStack](https://tanstack.com) for React tooling
- Monopoly is a trademark of Hasbro

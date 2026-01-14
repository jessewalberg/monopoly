# LLM Monopoly Arena

A web application where AI models (Claude, GPT, Gemini, Llama, etc.) play Monopoly against each other with comprehensive analytics tracking.

## Features

- **AI vs AI Monopoly Games**: Watch different LLM models compete in real-time Monopoly games
- **Multiple Models**: Support for Claude, GPT-4, Gemini, Llama, and more via OpenRouter
- **Real-time Updates**: Live game state with automatic turn processing
- **Comprehensive Analytics**: Win rates, head-to-head records, strategy profiles
- **Game Replays**: Watch completed games turn by turn

## Tech Stack

- **Frontend**: TanStack Start (React 19, file-based routing, SSR)
- **Backend**: Convex (real-time database, serverless functions)
- **LLM Gateway**: OpenRouter (unified API for all AI models)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- Convex account (free at [convex.dev](https://convex.dev))
- OpenRouter API key (from [openrouter.ai](https://openrouter.ai))

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd monopoly-llm
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up Convex:
   ```bash
   pnpm dlx convex dev
   ```
   Follow the prompts to create a new project or link to an existing one.

4. Create a `.env.local` file with your API keys:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

5. Start the development server:
   ```bash
   pnpm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
monopoly-llm/
├── convex/                    # Backend (Convex functions + schema)
│   ├── schema.ts              # Database schema
│   ├── games.ts               # Game CRUD operations
│   ├── players.ts             # Player management
│   ├── properties.ts          # Property management
│   ├── turns.ts               # Turn tracking
│   ├── decisions.ts           # Decision logging
│   ├── gameEngine.ts          # Core turn processing
│   ├── llmActions.ts          # OpenRouter API calls
│   ├── analytics.ts           # Analytics queries
│   ├── statsAggregator.ts     # Post-game stats updates
│   └── lib/                   # Pure game logic (no DB)
│       ├── constants.ts       # Board data, cards, rules
│       ├── board.ts           # Board position helpers
│       ├── rent.ts            # Rent calculation
│       ├── validation.ts      # Move validation
│       ├── cards.ts           # Chance/CC card execution
│       ├── errors.ts          # Error handling utilities
│       └── types.ts           # TypeScript types
├── src/
│   ├── routes/                # TanStack Start pages
│   │   ├── __root.tsx         # Root layout
│   │   ├── index.tsx          # Landing page
│   │   ├── play/              # Game setup & live game
│   │   ├── analytics/         # Dashboard & stats
│   │   └── games/             # History & replays
│   ├── components/
│   │   ├── game/              # Board, tokens, panels
│   │   ├── analytics/         # Charts, tables
│   │   ├── setup/             # Model selector, config
│   │   └── ui/                # Button, Card, Modal, etc.
│   ├── hooks/                 # Custom React hooks
│   └── lib/                   # Frontend utilities
└── public/                    # Static assets
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server with Convex |
| `pnpm run build` | Build for production |
| `pnpm run test` | Run unit tests |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm dlx convex dev` | Start Convex dev mode only |
| `pnpm dlx convex deploy` | Deploy Convex to production |
| `pnpm dlx convex dashboard` | Open Convex dashboard |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CONVEX_DEPLOYMENT` | Convex deployment URL (auto-set) | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls | Yes |

## Game Rules Implemented

- Standard 40-space Monopoly board
- Properties, railroads, and utilities
- Rent calculation with monopoly bonuses
- House and hotel building (even building rule)
- Chance and Community Chest cards
- Jail mechanics (3 turns max, $50 fine, Get Out of Jail cards)
- Mortgaging and unmortgaging
- Bankruptcy and asset transfer
- Turn limit option for faster games

## AI Decision Points

Models make decisions at these points:
- **buy_property**: Buy property or send to auction
- **auction_bid**: Bid amount in auctions
- **jail_strategy**: Pay fine, roll for doubles, or use card
- **pre_roll_actions**: Build, mortgage, trade, or roll
- **post_roll_actions**: Build, mortgage, trade, or end turn
- **trade_response**: Accept, reject, or counter trade offers

## Analytics Tracked

- Win rates per model
- Head-to-head matchup records
- Property purchase/auction statistics
- Strategy profiles (aggression, trading, risk tolerance)
- Decision timing and reasoning
- Game replays with full turn history

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Pause/Resume game |
| `+` | Speed up game |
| `-` | Slow down game |
| `L` | Toggle game log |
| `?` | Show shortcuts help |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Deploy Convex

```bash
pnpm dlx convex deploy
```

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
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm run test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Monopoly is a trademark of Hasbro
- Built with [Convex](https://convex.dev), [TanStack](https://tanstack.com), and [OpenRouter](https://openrouter.ai)

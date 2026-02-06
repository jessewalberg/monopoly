import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { BOARD } from './lib/constants'
import { shuffleArray } from './lib/random'

// Budget models from src/lib/models.ts - duplicated here to avoid import issues
// These should match the budget tier models in the frontend
const BUDGET_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
  },
  { id: 'x-ai/grok-3-mini', name: 'Grok 3 Mini', provider: 'xAI' },
] as const

const TOKEN_COLORS = [
  { name: 'Red', hex: '#EF4444', textColor: '#FFFFFF' },
  { name: 'Blue', hex: '#3B82F6', textColor: '#FFFFFF' },
  { name: 'Green', hex: '#22C55E', textColor: '#FFFFFF' },
  { name: 'Yellow', hex: '#EAB308', textColor: '#000000' },
  { name: 'Purple', hex: '#A855F7', textColor: '#FFFFFF' },
] as const

// Maximum time a game can be in_progress before being considered stuck (30 minutes)
const STALE_GAME_THRESHOLD_MS = 30 * 60 * 1000

/**
 * Start a scheduled arena game with all budget models
 * This is called by the cron job every hour
 */
export const startScheduledGame = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if arena is enabled via environment variable
    const arenaEnabled = process.env.ARENA_ENABLED !== 'false'
    if (!arenaEnabled) {
      console.log('[ARENA] Scheduled games disabled via ARENA_ENABLED env var')
      return null
    }

    // Check for active games - skip if one is already running
    const activeGame = await ctx.db
      .query('games')
      .filter((q) => q.eq(q.field('status'), 'in_progress'))
      .first()

    if (activeGame) {
      // Check if the game is stale (stuck for more than 30 minutes)
      const gameAge = Date.now() - (activeGame.startedAt || activeGame.createdAt || 0)

      if (gameAge > STALE_GAME_THRESHOLD_MS) {
        console.log(
          '[ARENA] Abandoning stale game:',
          activeGame._id,
          `(stuck for ${Math.round(gameAge / 60000)} minutes)`,
        )

        // Abandon the stale game
        await ctx.db.patch("games", activeGame._id, {
          status: 'abandoned',
          endingReason: 'error',
          currentPhase: 'game_over',
          endedAt: Date.now(),
        })

        await ctx.scheduler.runAfter(
          0,
          internal.statsAggregator.trackGameAbandoned,
          {},
        )

        // Continue to start new game below
      } else {
        console.log(
          '[ARENA] Skipping scheduled game - active game in progress:',
          activeGame._id,
        )
        return null
      }
    }

    console.log('[ARENA] Starting scheduled arena game with all budget models')

    // Shuffle the models to randomize turn order
    const shuffledModels = shuffleArray([...BUDGET_MODELS])

    // Create game with arena config
    const gameId = await ctx.db.insert('games', {
      status: 'setup',
      currentPlayerIndex: 0,
      currentTurnNumber: 0,
      currentPhase: 'pre_roll',
      config: {
        speedMs: 2000, // 2 seconds between turns
        turnLimit: 200, // Max 200 turns
        startingMoney: 1500, // Standard Monopoly
      },
      createdAt: Date.now(),
      isScheduledArena: true,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.statsAggregator.trackGameCreated,
      {},
    )

    console.log('[ARENA] Created game:', gameId)

    // Create players with assigned colors and random turn order
    for (let i = 0; i < shuffledModels.length; i++) {
      const model = shuffledModels[i]
      const color = TOKEN_COLORS[i]

      await ctx.db.insert('players', {
        gameId,
        modelId: model.id,
        modelDisplayName: model.name,
        modelProvider: model.provider,
        tokenColor: color.hex,
        textColor: color.textColor,
        turnOrder: i,
        cash: 1500,
        position: 0,
        inJail: false,
        jailTurnsRemaining: 0,
        getOutOfJailCards: 0,
        isBankrupt: false,
        consecutiveDoubles: 0,
      })

      console.log(
        `[ARENA] Created player ${i + 1}: ${model.name} (${color.name})`,
      )
    }

    // Initialize properties (same as startGame in gameEngine.ts)
    for (const space of BOARD) {
      if (
        space.type === 'property' ||
        space.type === 'railroad' ||
        space.type === 'utility'
      ) {
        const group = space.type === 'property' ? space.group : space.type
        await ctx.db.insert('properties', {
          gameId,
          position: space.pos,
          name: space.name,
          group,
          ownerId: undefined,
          houses: 0,
          isMortgaged: false,
        })
      }
    }

    // Get players in turn order
    const players = await ctx.db
      .query('players')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect()
    players.sort((a, b) => a.turnOrder - b.turnOrder)
    const firstPlayer = players[0]

    // Create first turn record
    await ctx.db.insert('turns', {
      gameId,
      playerId: firstPlayer._id,
      turnNumber: 1,
      positionBefore: firstPlayer.position,
      cashBefore: firstPlayer.cash,
      events: ['Scheduled arena game started'],
      startedAt: Date.now(),
    })

    // Initialize shuffled card decks (16 Chance, 16 Community Chest)
    const chanceDeck = shuffleArray(Array.from({ length: 16 }, (_, i) => i))
    const communityChestDeck = shuffleArray(
      Array.from({ length: 16 }, (_, i) => i),
    )

    // Update game status to in_progress
    await ctx.db.patch("games", gameId, {
      status: 'in_progress',
      currentPhase: 'pre_roll',
      currentPlayerIndex: 0,
      currentTurnNumber: 1,
      startedAt: Date.now(),
      chanceDeck,
      communityChestDeck,
    })

    await ctx.scheduler.runAfter(
      0,
      internal.statsAggregator.trackGameStarted,
      {},
    )

    console.log('[ARENA] Game started, scheduling first turn processing')

    // Schedule first turn processing
    await ctx.scheduler.runAfter(2000, internal.gameEngine.processTurnStep, {
      gameId,
    })

    return gameId
  },
})

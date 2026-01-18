import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// ============================================================
// QUERIES
// ============================================================

/**
 * Get turns for a game, newest first
 */
export const getByGame = query({
  args: {
    gameId: v.id('games'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const turnsQuery = ctx.db
      .query('turns')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .order('desc')

    if (args.limit) {
      return await turnsQuery.take(args.limit)
    }

    return await turnsQuery.collect()
  },
})

/**
 * Get the most recent turn for a game
 */
export const getLatest = query({
  args: {
    gameId: v.id('games'),
  },
  handler: async (ctx, args) => {
    const turns = await ctx.db
      .query('turns')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .order('desc')
      .take(1)

    return turns[0] || null
  },
})

/**
 * Get a specific turn by game and turn number
 */
export const getByTurnNumber = query({
  args: {
    gameId: v.id('games'),
    turnNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const turns = await ctx.db
      .query('turns')
      .withIndex('by_game_turn', (q) =>
        q.eq('gameId', args.gameId).eq('turnNumber', args.turnNumber),
      )
      .collect()

    return turns[0] || null
  },
})

/**
 * Get a single turn by ID
 */
export const get = query({
  args: {
    turnId: v.id('turns'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get("turns", args.turnId)
  },
})

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new turn
 */
export const create = mutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    turnNumber: v.number(),
    positionBefore: v.number(),
    cashBefore: v.number(),
  },
  handler: async (ctx, args) => {
    const turnId = await ctx.db.insert('turns', {
      gameId: args.gameId,
      playerId: args.playerId,
      turnNumber: args.turnNumber,
      positionBefore: args.positionBefore,
      cashBefore: args.cashBefore,
      events: [],
      startedAt: Date.now(),
    })

    return turnId
  },
})

/**
 * Update turn with dice roll
 */
export const setDiceRoll = mutation({
  args: {
    turnId: v.id('turns'),
    diceRoll: v.array(v.number()),
    wasDoubles: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("turns", args.turnId, {
      diceRoll: args.diceRoll,
      wasDoubles: args.wasDoubles,
    })
  },
})

/**
 * Update turn with movement info
 */
export const setMovement = mutation({
  args: {
    turnId: v.id('turns'),
    positionAfter: v.number(),
    passedGo: v.boolean(),
    landedOn: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("turns", args.turnId, {
      positionAfter: args.positionAfter,
      passedGo: args.passedGo,
      landedOn: args.landedOn,
    })
  },
})

/**
 * Add an event to the turn log
 */
export const addEvent = mutation({
  args: {
    turnId: v.id('turns'),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const turn = await ctx.db.get("turns", args.turnId)
    if (!turn) throw new Error('Turn not found')

    await ctx.db.patch("turns", args.turnId, {
      events: [...turn.events, args.event],
    })
  },
})

/**
 * Add multiple events at once
 */
export const addEvents = mutation({
  args: {
    turnId: v.id('turns'),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const turn = await ctx.db.get("turns", args.turnId)
    if (!turn) throw new Error('Turn not found')

    await ctx.db.patch("turns", args.turnId, {
      events: [...turn.events, ...args.events],
    })
  },
})

/**
 * Complete a turn with final state
 */
export const complete = mutation({
  args: {
    turnId: v.id('turns'),
    positionAfter: v.number(),
    cashAfter: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("turns", args.turnId, {
      positionAfter: args.positionAfter,
      cashAfter: args.cashAfter,
      endedAt: Date.now(),
    })
  },
})

/**
 * General update for any turn fields
 */
export const update = mutation({
  args: {
    turnId: v.id('turns'),
    diceRoll: v.optional(v.array(v.number())),
    wasDoubles: v.optional(v.boolean()),
    positionAfter: v.optional(v.number()),
    passedGo: v.optional(v.boolean()),
    landedOn: v.optional(v.string()),
    cashAfter: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { turnId, ...updates } = args

    const filteredUpdates: Record<string, unknown> = {}
    if (updates.diceRoll !== undefined) filteredUpdates.diceRoll = updates.diceRoll
    if (updates.wasDoubles !== undefined)
      filteredUpdates.wasDoubles = updates.wasDoubles
    if (updates.positionAfter !== undefined)
      filteredUpdates.positionAfter = updates.positionAfter
    if (updates.passedGo !== undefined) filteredUpdates.passedGo = updates.passedGo
    if (updates.landedOn !== undefined) filteredUpdates.landedOn = updates.landedOn
    if (updates.cashAfter !== undefined) filteredUpdates.cashAfter = updates.cashAfter

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch("turns", turnId, filteredUpdates)
    }
  },
})

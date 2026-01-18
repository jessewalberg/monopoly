import { v } from 'convex/values'
import {
  
  internalMutation,
  mutation
} from './_generated/server'
import { BOARD } from './lib/constants'
import { getPurchasePrice } from './lib/board'
import type {MutationCtx} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel'

// ============================================================
// GLOBAL STATS HELPERS
// ============================================================

const GLOBAL_STATS_KEY = 'global'

async function getOrCreateGlobalStats(ctx: MutationCtx) {
  const existing = await ctx.db
    .query('globalStats')
    .withIndex('by_key', (q) => q.eq('key', GLOBAL_STATS_KEY))
    .first()

  if (existing) return existing

  const id = await ctx.db.insert('globalStats', {
    key: GLOBAL_STATS_KEY,
    totalGames: 0,
    completedGames: 0,
    inProgressGames: 0,
    abandonedGames: 0,
    totalDecisions: 0,
    totalTrades: 0,
    acceptedTrades: 0,
    totalRentPaid: 0,
    avgGameLength: 0,
    avgDurationMs: 0,
    durationGames: 0,
    totalModelsPlayed: 0,
    mostWinningModel: undefined,
    updatedAt: Date.now(),
  })

  const created = await ctx.db.get("globalStats", id)
  if (!created) {
    throw new Error('Failed to create global stats')
  }
  return created
}

export const trackGameCreated = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await getOrCreateGlobalStats(ctx)
    await ctx.db.patch("globalStats", existing._id, {
      totalGames: existing.totalGames + 1,
      updatedAt: Date.now(),
    })
  },
})

export const trackGameStarted = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await getOrCreateGlobalStats(ctx)
    await ctx.db.patch("globalStats", existing._id, {
      inProgressGames: existing.inProgressGames + 1,
      updatedAt: Date.now(),
    })
  },
})

export const trackGameAbandoned = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await getOrCreateGlobalStats(ctx)
    await ctx.db.patch("globalStats", existing._id, {
      inProgressGames: Math.max(0, existing.inProgressGames - 1),
      abandonedGames: existing.abandonedGames + 1,
      updatedAt: Date.now(),
    })
  },
})

// ============================================================
// UPDATE STATS AFTER GAME
// ============================================================

/**
 * Update all stats after a game ends.
 * Called from gameEngine when game completes.
 */
export const updateStatsAfterGame = internalMutation({
  args: {
    gameId: v.id('games'),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get("games", args.gameId)
    if (!game || (game.status !== 'completed' && game.status !== 'abandoned')) {
      throw new Error('Game not found or not completed')
    }

    if (game.status === 'abandoned') {
      return
    }

    // Get all players for this game
    const players = await ctx.db
      .query('players')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Get all decisions for this game
    const decisions = await ctx.db
      .query('decisions')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Get all rent payments for this game
    const rentPayments = await ctx.db
      .query('rentPayments')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Get all trades for this game
    const trades = await ctx.db
      .query('trades')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Get all properties for this game
    const properties = await ctx.db
      .query('properties')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Update modelStats for each player
    for (const player of players) {
      await updateModelStats(ctx, {
        player,
        game,
        decisions: decisions.filter((d) => d.playerId === player._id),
        rentReceived: rentPayments
          .filter((r) => r.receiverId === player._id)
          .reduce((sum, r) => sum + r.amount, 0),
        rentPaid: rentPayments
          .filter((r) => r.payerId === player._id)
          .reduce((sum, r) => sum + r.amount, 0),
        propertiesOwned: properties.filter((p) => p.ownerId === player._id)
          .length,
        tradesProposed: trades.filter((t) => t.proposerId === player._id)
          .length,
        tradesAccepted: trades.filter(
          (t) => t.proposerId === player._id && t.status === 'accepted',
        ).length,
      })
    }

    // Update head-to-head records for each player pair
    if (game.winnerId) {
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const playerA = players[i]
          const playerB = players[j]
          await updateHeadToHead(ctx, {
            playerA,
            playerB,
            winnerId: game.winnerId,
            gameLength: game.currentTurnNumber,
          })
        }
      }
    }

    // Get property transfers for this game
    const propertyTransfers = await ctx.db
      .query('propertyTransfers')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    // Update property stats
    await updatePropertyStats(ctx, {
      gameId: args.gameId,
      properties,
      rentPayments,
      propertyTransfers,
      winnerId: game.winnerId,
    })

    // Update global stats (incremental)
    const globalStats = await getOrCreateGlobalStats(ctx)
    const decisionsCount = decisions.length
    const tradesCount = trades.length
    const acceptedTradesCount = trades.filter(
      (t) => t.status === 'accepted',
    ).length
    const rentPaid = rentPayments.reduce((sum, r) => sum + r.amount, 0)
    const gameLength = game.currentTurnNumber
    const durationMs =
      game.startedAt && game.endedAt ? game.endedAt - game.startedAt : null

    const nextCompletedGames = globalStats.completedGames + 1
    const nextDurationGames =
      durationMs !== null
        ? globalStats.durationGames + 1
        : globalStats.durationGames

    const avgGameLength =
      nextCompletedGames > 0
        ? (globalStats.avgGameLength * globalStats.completedGames +
            gameLength) /
          nextCompletedGames
        : 0

    const avgDurationMs =
      nextDurationGames > 0 && durationMs !== null
        ? (globalStats.avgDurationMs * globalStats.durationGames + durationMs) /
          nextDurationGames
        : globalStats.avgDurationMs

    const modelStats = await ctx.db.query('modelStats').collect()
    const mostWins = modelStats.reduce(
      (max, stat) => (stat.wins > max.wins ? stat : max),
      { wins: 0, modelDisplayName: 'None', modelId: '' },
    )

    await ctx.db.patch("globalStats", globalStats._id, {
      completedGames: nextCompletedGames,
      inProgressGames: Math.max(0, globalStats.inProgressGames - 1),
      totalDecisions: globalStats.totalDecisions + decisionsCount,
      totalTrades: globalStats.totalTrades + tradesCount,
      acceptedTrades: globalStats.acceptedTrades + acceptedTradesCount,
      totalRentPaid: globalStats.totalRentPaid + rentPaid,
      avgGameLength,
      avgDurationMs,
      durationGames: nextDurationGames,
      totalModelsPlayed: modelStats.length,
      mostWinningModel:
        mostWins.wins > 0
          ? {
              modelId: mostWins.modelId,
              modelDisplayName: mostWins.modelDisplayName,
              wins: mostWins.wins,
            }
          : undefined,
      updatedAt: Date.now(),
    })
  },
})

// ============================================================
// MODEL STATS HELPER
// ============================================================

async function updateModelStats(
  ctx: MutationCtx,
  data: {
    player: Doc<'players'>
    game: Doc<'games'>
    decisions: Array<Doc<'decisions'>>
    rentReceived: number
    rentPaid: number
    propertiesOwned: number
    tradesProposed: number
    tradesAccepted: number
  },
) {
  const { player, game, decisions, rentReceived, rentPaid, propertiesOwned } =
    data

  // Find or create model stats record
  const existing = await ctx.db
    .query('modelStats')
    .withIndex('by_model', (q) => q.eq('modelId', player.modelId))
    .first()

  // Determine placement
  const isWinner = game.winnerId === player._id
  const placement = player.finalPosition || (isWinner ? 1 : 4)

  // Calculate average decision time
  const avgDecisionTime =
    decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.decisionTimeMs, 0) /
        decisions.length
      : 0

  if (existing) {
    // Update running averages
    const newGamesPlayed = existing.gamesPlayed + 1

    await ctx.db.patch("modelStats", existing._id, {
      gamesPlayed: newGamesPlayed,
      wins: existing.wins + (isWinner ? 1 : 0),
      secondPlace: existing.secondPlace + (placement === 2 ? 1 : 0),
      thirdPlace: existing.thirdPlace + (placement === 3 ? 1 : 0),
      bankruptcies: existing.bankruptcies + (player.isBankrupt ? 1 : 0),
      // Running averages
      avgFinalNetWorth:
        (existing.avgFinalNetWorth * existing.gamesPlayed +
          (player.finalNetWorth || player.cash)) /
        newGamesPlayed,
      avgFinalCash:
        (existing.avgFinalCash * existing.gamesPlayed + player.cash) /
        newGamesPlayed,
      totalRentCollected: existing.totalRentCollected + rentReceived,
      totalRentPaid: existing.totalRentPaid + rentPaid,
      avgPropertiesOwned:
        (existing.avgPropertiesOwned * existing.gamesPlayed + propertiesOwned) /
        newGamesPlayed,
      // Trade stats
      tradesProposed: existing.tradesProposed + data.tradesProposed,
      tradesAccepted: existing.tradesAccepted + data.tradesAccepted,
      tradeAcceptRate:
        existing.tradesProposed + data.tradesProposed > 0
          ? (existing.tradesAccepted + data.tradesAccepted) /
            (existing.tradesProposed + data.tradesProposed)
          : 0,
      // Performance stats
      avgDecisionTimeMs:
        (existing.avgDecisionTimeMs * existing.gamesPlayed + avgDecisionTime) /
        newGamesPlayed,
      avgGameLength:
        (existing.avgGameLength * existing.gamesPlayed +
          game.currentTurnNumber) /
        newGamesPlayed,
      updatedAt: Date.now(),
    })
  } else {
    // Create new record
    await ctx.db.insert('modelStats', {
      modelId: player.modelId,
      modelDisplayName: player.modelDisplayName,
      modelProvider: player.modelProvider,
      gamesPlayed: 1,
      wins: isWinner ? 1 : 0,
      secondPlace: placement === 2 ? 1 : 0,
      thirdPlace: placement === 3 ? 1 : 0,
      bankruptcies: player.isBankrupt ? 1 : 0,
      avgFinalNetWorth: player.finalNetWorth || player.cash,
      avgFinalCash: player.cash,
      totalRentCollected: rentReceived,
      totalRentPaid: rentPaid,
      avgPropertiesOwned: propertiesOwned,
      monopoliesCompleted: 0, // Would need to calculate from game state
      tradesProposed: data.tradesProposed,
      tradesAccepted: data.tradesAccepted,
      tradeAcceptRate:
        data.tradesProposed > 0 ? data.tradesAccepted / data.tradesProposed : 0,
      avgDecisionTimeMs: avgDecisionTime,
      avgGameLength: game.currentTurnNumber,
      updatedAt: Date.now(),
    })
  }
}

// ============================================================
// HEAD-TO-HEAD HELPER
// ============================================================

async function updateHeadToHead(
  ctx: MutationCtx,
  data: {
    playerA: Doc<'players'>
    playerB: Doc<'players'>
    winnerId: Id<'players'>
    gameLength: number
  },
) {
  const { playerA, playerB, winnerId, gameLength } = data

  // Create alphabetically sorted pair key
  const [firstId, secondId] = [playerA.modelId, playerB.modelId].sort()
  const pairKey = `${firstId}|${secondId}`

  // Determine which model is A and which is B based on alphabetical order
  const modelAIsFirst = playerA.modelId === firstId
  const modelA = modelAIsFirst ? playerA : playerB
  const modelB = modelAIsFirst ? playerB : playerA

  // Determine winner
  const modelAWon = winnerId === modelA._id
  const modelBWon = winnerId === modelB._id

  // Find or create record
  const existing = await ctx.db
    .query('headToHead')
    .withIndex('by_pair', (q) => q.eq('pairKey', pairKey))
    .first()

  if (existing) {
    const newTotalGames = existing.totalGames + 1
    await ctx.db.patch("headToHead", existing._id, {
      modelAWins: existing.modelAWins + (modelAWon ? 1 : 0),
      modelBWins: existing.modelBWins + (modelBWon ? 1 : 0),
      totalGames: newTotalGames,
      avgGameLength:
        (existing.avgGameLength * existing.totalGames + gameLength) /
        newTotalGames,
      updatedAt: Date.now(),
    })
  } else {
    await ctx.db.insert('headToHead', {
      pairKey,
      modelAId: modelA.modelId,
      modelADisplayName: modelA.modelDisplayName,
      modelBId: modelB.modelId,
      modelBDisplayName: modelB.modelDisplayName,
      modelAWins: modelAWon ? 1 : 0,
      modelBWins: modelBWon ? 1 : 0,
      totalGames: 1,
      avgGameLength: gameLength,
      updatedAt: Date.now(),
    })
  }
}

// ============================================================
// PROPERTY STATS HELPER
// ============================================================

async function updatePropertyStats(
  ctx: MutationCtx,
  data: {
    gameId: Id<'games'>
    properties: Array<Doc<'properties'>>
    rentPayments: Array<Doc<'rentPayments'>>
    propertyTransfers: Array<Doc<'propertyTransfers'>>
    winnerId?: Id<'players'>
  },
) {
  const { properties, rentPayments, propertyTransfers, winnerId } = data

  const acquisitionTransfers = propertyTransfers.filter(
    (transfer) =>
      !transfer.fromOwnerId &&
      transfer.toOwnerId &&
      (transfer.reason === 'purchase' || transfer.reason === 'auction'),
  )

  const acquisitionByProperty = new Map<
    Id<'properties'>,
    {
      toOwnerId: Id<'players'>
      reason: string
      turnNumber: number
      createdAt: number
      price?: number
    }
  >()

  for (const transfer of acquisitionTransfers) {
    const existing = acquisitionByProperty.get(transfer.propertyId)
    if (
      !existing ||
      transfer.turnNumber < existing.turnNumber ||
      (transfer.turnNumber === existing.turnNumber &&
        transfer.createdAt < existing.createdAt)
    ) {
      acquisitionByProperty.set(transfer.propertyId, {
        toOwnerId: transfer.toOwnerId!,
        reason: transfer.reason,
        turnNumber: transfer.turnNumber,
        createdAt: transfer.createdAt,
        price: transfer.price,
      })
    }
  }

  // Group rent payments by property
  const rentByProperty: Record<string, number> = {}
  for (const rent of rentPayments) {
    rentByProperty[rent.propertyName] =
      (rentByProperty[rent.propertyName] || 0) + rent.amount
  }

  // Update stats for each property
  for (const property of properties) {
    const acquisition = acquisitionByProperty.get(property._id)
    const wasAcquired = Boolean(acquisition)
    const wasAuction = acquisition ? acquisition.reason === 'auction' : false
    const buyerWon = Boolean(winnerId && acquisition?.toOwnerId === winnerId)

    // Find existing stats
    const existing = await ctx.db
      .query('propertyStats')
      .withIndex('by_property', (q) => q.eq('propertyName', property.name))
      .first()

    const rentCollectedThisGame = rentByProperty[property.name] || 0

    if (existing) {
      const purchaseCount = existing.timesPurchased - existing.timesAuctioned
      const newTimesPurchased = existing.timesPurchased + (wasAcquired ? 1 : 0)
      const newTimesAuctioned = existing.timesAuctioned + (wasAuction ? 1 : 0)
      const newPurchaseCount =
        purchaseCount + (wasAcquired && !wasAuction ? 1 : 0)
      const purchasePrice = !wasAuction
        ? getPurchasePrice(property.position)
        : undefined
      const auctionPrice =
        wasAuction && acquisition ? acquisition.price : undefined

      await ctx.db.patch("propertyStats", existing._id, {
        timesPurchased: newTimesPurchased,
        timesAuctioned: newTimesAuctioned,
        avgPurchasePrice:
          newPurchaseCount > 0
            ? (existing.avgPurchasePrice * purchaseCount +
                (purchasePrice || 0)) /
              newPurchaseCount
            : 0,
        avgAuctionPrice:
          wasAuction && auctionPrice !== undefined && newTimesAuctioned > 0
            ? (existing.avgAuctionPrice * existing.timesAuctioned +
                auctionPrice) /
              newTimesAuctioned
            : existing.avgAuctionPrice,
        totalRentCollected: existing.totalRentCollected + rentCollectedThisGame,
        avgRentPerGame:
          newTimesPurchased > 0
            ? (existing.totalRentCollected + rentCollectedThisGame) /
              newTimesPurchased
            : 0,
        ownerWinRate:
          newTimesPurchased > 0
            ? (existing.ownerWinRate * existing.timesPurchased +
                (wasAcquired && buyerWon ? 1 : 0)) /
              newTimesPurchased
            : 0,
        updatedAt: Date.now(),
      })
    } else {
      // Get property info from BOARD
      const boardSpace = BOARD.find((s) => s.name === property.name)
      const group = property.group || 'unknown'
      const position = boardSpace?.pos || property.position
      const purchasePrice = !wasAuction ? getPurchasePrice(position) : undefined
      const auctionPrice =
        wasAuction && acquisition ? acquisition.price : undefined
      const timesPurchased = wasAcquired ? 1 : 0
      const timesAuctioned = wasAuction ? 1 : 0

      await ctx.db.insert('propertyStats', {
        propertyName: property.name,
        propertyGroup: group,
        position,
        timesPurchased,
        timesAuctioned,
        avgPurchasePrice:
          timesPurchased && !wasAuction && purchasePrice !== undefined
            ? purchasePrice
            : 0,
        avgAuctionPrice:
          timesAuctioned && auctionPrice !== undefined ? auctionPrice : 0,
        totalRentCollected: rentCollectedThisGame,
        avgRentPerGame: timesPurchased > 0 ? rentCollectedThisGame : 0,
        ownerWinRate: wasAcquired && buyerWon ? 1 : 0,
        updatedAt: Date.now(),
      })
    }
  }
}

// ============================================================
// RECALCULATE ALL STATS
// ============================================================

/**
 * Wipe and rebuild all stats from scratch.
 * Use this for corrections or after schema changes.
 */
export const recalculateAllStats = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing stats
    const existingModelStats = await ctx.db.query('modelStats').collect()
    for (const stat of existingModelStats) {
      await ctx.db.delete("modelStats", stat._id)
    }

    const existingH2H = await ctx.db.query('headToHead').collect()
    for (const h2h of existingH2H) {
      await ctx.db.delete("headToHead", h2h._id)
    }

    const existingPropertyStats = await ctx.db.query('propertyStats').collect()
    for (const ps of existingPropertyStats) {
      await ctx.db.delete("propertyStats", ps._id)
    }

    const existingGlobalStats = await ctx.db.query('globalStats').collect()
    for (const gs of existingGlobalStats) {
      await ctx.db.delete("globalStats", gs._id)
    }

    // Get all completed games
    const games = await ctx.db.query('games').collect()
    const completedGames = games.filter((g) => g.status === 'completed')
    const inProgressGames = games.filter((g) => g.status === 'in_progress')
    const abandonedGames = games.filter((g) => g.status === 'abandoned')

    let totalDecisions = 0
    let totalTrades = 0
    let acceptedTrades = 0
    let totalRentPaid = 0
    let totalGameLength = 0
    let totalDurationMs = 0
    let durationGames = 0

    // Rebuild stats for each game
    for (const game of completedGames) {
      // Get all players for this game
      const players = await ctx.db
        .query('players')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      // Get all decisions for this game
      const decisions = await ctx.db
        .query('decisions')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      // Get all rent payments for this game
      const rentPayments = await ctx.db
        .query('rentPayments')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      // Get all trades for this game
      const trades = await ctx.db
        .query('trades')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      // Get all properties for this game
      const properties = await ctx.db
        .query('properties')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      totalGameLength += game.currentTurnNumber
      if (game.startedAt && game.endedAt) {
        totalDurationMs += game.endedAt - game.startedAt
        durationGames += 1
      }

      totalDecisions += decisions.length
      totalTrades += trades.length
      acceptedTrades += trades.filter((t) => t.status === 'accepted').length
      totalRentPaid += rentPayments.reduce((sum, r) => sum + r.amount, 0)

      // Update modelStats for each player
      for (const player of players) {
        await updateModelStats(ctx, {
          player,
          game,
          decisions: decisions.filter((d) => d.playerId === player._id),
          rentReceived: rentPayments
            .filter((r) => r.receiverId === player._id)
            .reduce((sum, r) => sum + r.amount, 0),
          rentPaid: rentPayments
            .filter((r) => r.payerId === player._id)
            .reduce((sum, r) => sum + r.amount, 0),
          propertiesOwned: properties.filter((p) => p.ownerId === player._id)
            .length,
          tradesProposed: trades.filter((t) => t.proposerId === player._id)
            .length,
          tradesAccepted: trades.filter(
            (t) => t.proposerId === player._id && t.status === 'accepted',
          ).length,
        })
      }

      // Update head-to-head records
      if (game.winnerId) {
        for (let i = 0; i < players.length; i++) {
          for (let j = i + 1; j < players.length; j++) {
            await updateHeadToHead(ctx, {
              playerA: players[i],
              playerB: players[j],
              winnerId: game.winnerId,
              gameLength: game.currentTurnNumber,
            })
          }
        }
      }

      // Get property transfers for this game
      const propertyTransfers = await ctx.db
        .query('propertyTransfers')
        .withIndex('by_game', (q) => q.eq('gameId', game._id))
        .collect()

      // Update property stats
      await updatePropertyStats(ctx, {
        gameId: game._id,
        properties,
        rentPayments,
        propertyTransfers,
        winnerId: game.winnerId,
      })
    }

    const modelStats = await ctx.db.query('modelStats').collect()
    const mostWins = modelStats.reduce(
      (max, stat) => (stat.wins > max.wins ? stat : max),
      { wins: 0, modelDisplayName: 'None', modelId: '' },
    )

    await ctx.db.insert('globalStats', {
      key: GLOBAL_STATS_KEY,
      totalGames: games.length,
      completedGames: completedGames.length,
      inProgressGames: inProgressGames.length,
      abandonedGames: abandonedGames.length,
      totalDecisions,
      totalTrades,
      acceptedTrades,
      totalRentPaid,
      avgGameLength:
        completedGames.length > 0 ? totalGameLength / completedGames.length : 0,
      avgDurationMs: durationGames > 0 ? totalDurationMs / durationGames : 0,
      durationGames,
      totalModelsPlayed: modelStats.length,
      mostWinningModel:
        mostWins.wins > 0
          ? {
              modelId: mostWins.modelId,
              modelDisplayName: mostWins.modelDisplayName,
              wins: mostWins.wins,
            }
          : undefined,
      updatedAt: Date.now(),
    })

    return {
      gamesProcessed: completedGames.length,
      success: true,
    }
  },
})

// ============================================================
// CALCULATE STRATEGY PROFILE
// ============================================================

/**
 * Calculate and store strategy profile for a model.
 * Can be called periodically to update profiles.
 */
export const calculateStrategyProfile = mutation({
  args: {
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all players for this model
    const allPlayers = await ctx.db.query('players').collect()
    const modelPlayers = allPlayers.filter((p) => p.modelId === args.modelId)

    if (modelPlayers.length === 0) {
      return null
    }

    const playerIds = modelPlayers.map((p) => p._id)

    // Get all decisions for these players
    const allDecisions = await ctx.db.query('decisions').collect()
    const modelDecisions = allDecisions.filter((d) =>
      playerIds.includes(d.playerId),
    )

    // Calculate buy rate
    const buyDecisions = modelDecisions.filter(
      (d) => d.decisionType === 'buy_property',
    )
    const buyCount = buyDecisions.filter((d) => d.decisionMade === 'buy').length
    const buyRate = buyDecisions.length > 0 ? buyCount / buyDecisions.length : 0

    // Calculate trade frequency
    const actionDecisions = modelDecisions.filter(
      (d) =>
        d.decisionType === 'pre_roll_actions' ||
        d.decisionType === 'post_roll_actions',
    )
    const tradeProposals = actionDecisions.filter((d) =>
      d.decisionMade.includes('trade'),
    ).length
    const tradeFrequency =
      actionDecisions.length > 0 ? tradeProposals / actionDecisions.length : 0

    // Calculate build speed
    const buildDecisions = actionDecisions.filter((d) =>
      d.decisionMade.includes('build'),
    ).length
    const buildSpeed =
      actionDecisions.length > 0 ? buildDecisions / actionDecisions.length : 0

    // Risk tolerance (buy rate as proxy)
    const riskTolerance = buyRate

    return {
      modelId: args.modelId,
      buyRate: Math.round(buyRate * 100) / 100,
      tradeFrequency: Math.round(tradeFrequency * 100) / 100,
      buildSpeed: Math.round(buildSpeed * 100) / 100,
      riskTolerance: Math.round(riskTolerance * 100) / 100,
      decisionsAnalyzed: modelDecisions.length,
    }
  },
})

// ============================================================
// UPDATE AUCTION STATS
// ============================================================

/**
 * Update property stats when a property is auctioned.
 * Called from gameEngine after an auction completes.
 */
export const updateAuctionStats = internalMutation({
  args: {
    propertyName: v.string(),
    auctionPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('propertyStats')
      .withIndex('by_property', (q) => q.eq('propertyName', args.propertyName))
      .first()

    if (existing) {
      const newTimesAuctioned = existing.timesAuctioned + 1
      const newAvgAuctionPrice =
        (existing.avgAuctionPrice * existing.timesAuctioned +
          args.auctionPrice) /
        newTimesAuctioned

      await ctx.db.patch("propertyStats", existing._id, {
        timesAuctioned: newTimesAuctioned,
        avgAuctionPrice: newAvgAuctionPrice,
        updatedAt: Date.now(),
      })
    }
  },
})

// ============================================================
// UPDATE PURCHASE STATS
// ============================================================

/**
 * Update property stats when a property is purchased.
 * Called from gameEngine after a purchase.
 */
export const updatePurchaseStats = internalMutation({
  args: {
    propertyName: v.string(),
    purchasePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('propertyStats')
      .withIndex('by_property', (q) => q.eq('propertyName', args.propertyName))
      .first()

    if (existing) {
      const newTimesPurchased = existing.timesPurchased + 1
      const newAvgPurchasePrice =
        (existing.avgPurchasePrice *
          (existing.timesPurchased - existing.timesAuctioned) +
          args.purchasePrice) /
        (newTimesPurchased - existing.timesAuctioned)

      await ctx.db.patch("propertyStats", existing._id, {
        timesPurchased: newTimesPurchased,
        avgPurchasePrice: newAvgPurchasePrice,
        updatedAt: Date.now(),
      })
    }
  },
})

import { v } from 'convex/values'
import {  internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getHouseCost,
  getMortgageValue,
  getPurchasePrice,
  getSpace,
  getUnmortgageCost,
} from './lib/board'
import { JAIL_FINE, MAX_TRADE_ATTEMPTS_PER_TURN } from './lib/constants'
import {
  
  canBuildHouse,
  canMortgage,
  canProposeTrade,
  canUnmortgage
} from './lib/validation'
import { extractBuildCount, extractPropertyName } from './lib/parseResponse'
import type {TradeOffer} from './lib/validation';
import type {MutationCtx} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel'

// ============================================================
// DECISION EXECUTION MUTATIONS
// These must be in a separate file from llmDecisions.ts because
// that file uses "use node" which only allows actions
// ============================================================

/**
 * Clear the waiting state and continue game processing
 */
export const clearWaitingState = internalMutation({
  args: {
    gameId: v.id('games'),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get("games", args.gameId)
    if (!game) return

    await ctx.db.patch("games", args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
    })

    await ctx.scheduler.runAfter(
      game.config.speedMs,
      internal.gameEngine.processTurnStep,
      {
        gameId: args.gameId,
      },
    )
  },
})

/**
 * Execute a buy property decision
 */
export const executeBuyPropertyDecision = internalMutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    turnId: v.id('turns'),
    action: v.string(),
    propertyPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get("games", args.gameId)
    const player = await ctx.db.get("players", args.playerId)
    const property = await ctx.db
      .query('properties')
      .withIndex('by_game')
      .filter((q) =>
        q.and(
          q.eq(q.field('gameId'), args.gameId),
          q.eq(q.field('position'), args.propertyPosition),
        ),
      )
      .first()

    if (!game || !player || !property) return

    const space = getSpace(args.propertyPosition)
    const cost = getPurchasePrice(args.propertyPosition)

    // Add turn event helper
    const addEvent = async (event: string) => {
      const turn = await ctx.db.get("turns", args.turnId)
      if (turn) {
        await ctx.db.patch("turns", args.turnId, {
          events: [...turn.events, event],
        })
      }
    }

    if (args.action === 'buy' && player.cash >= cost) {
      // Execute purchase
      await ctx.db.patch("properties", property._id, { ownerId: args.playerId })
      await ctx.db.patch("players", args.playerId, { cash: player.cash - cost })
      await addEvent(`Decided to buy ${space.name} for $${cost}`)
    } else {
      // Go to auction (LLM-driven)
      await addEvent(`Declined to buy ${space.name} - starting auction`)
      await startAuctionFlow(ctx, {
        gameId: args.gameId,
        turnId: args.turnId,
        propertyId: property._id,
        propertyPosition: property.position,
        propertyName: space.name,
      })
      return
    }

    // Clear waiting state and continue game
    // After buy decision, check for doubles to see if we roll again or end turn
    const turn = await ctx.db.get("turns", args.turnId)
    const wasDoubles = turn?.wasDoubles
    const playerData = await ctx.db.get("players", args.playerId)

    if (wasDoubles && !playerData?.inJail) {
      await addEvent('Rolled doubles - rolling again!')
      await ctx.db.patch("games", args.gameId, {
        waitingForLLM: false,
        pendingDecision: undefined,
        currentPhase: 'rolling',
      })
    } else {
      await ctx.db.patch("games", args.gameId, {
        waitingForLLM: false,
        pendingDecision: undefined,
        currentPhase: 'turn_end',
      })
    }

    await ctx.scheduler.runAfter(
      game.config.speedMs,
      internal.gameEngine.processTurnStep,
      {
        gameId: args.gameId,
      },
    )
  },
})

/**
 * Execute a jail strategy decision
 */
export const executeJailDecision = internalMutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    turnId: v.id('turns'),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get("games", args.gameId)
    const player = await ctx.db.get("players", args.playerId)
    if (!game || !player) return

    const addEvent = async (event: string) => {
      const turn = await ctx.db.get("turns", args.turnId)
      if (turn) {
        await ctx.db.patch("turns", args.turnId, {
          events: [...turn.events, event],
        })
      }
    }

    if (args.action === 'pay' && player.cash >= JAIL_FINE) {
      // Pay fine to get out
      await ctx.db.patch("players", args.playerId, {
        cash: player.cash - JAIL_FINE,
        inJail: false,
        jailTurnsRemaining: 0,
      })
      await addEvent(`Paid $${JAIL_FINE} to get out of jail`)
    } else if (args.action === 'use_card' && player.getOutOfJailCards > 0) {
      // Use get out of jail card
      await ctx.db.patch("players", args.playerId, {
        getOutOfJailCards: player.getOutOfJailCards - 1,
        inJail: false,
        jailTurnsRemaining: 0,
      })
      await addEvent('Used Get Out of Jail Free card')
    } else {
      // Roll for doubles (default)
      await addEvent('Choosing to roll for doubles')
    }

    // Clear waiting state and continue to rolling phase
    await ctx.db.patch("games", args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: 'rolling',
    })

    await ctx.scheduler.runAfter(
      game.config.speedMs,
      internal.gameEngine.processTurnStep,
      {
        gameId: args.gameId,
      },
    )
  },
})

/**
 * Execute an auction bid decision
 */
export const executeAuctionBidDecision = internalMutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    propertyId: v.id('properties'),
    bidAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // This would be part of a more complex auction system
    // For now, just record the bid
    const player = await ctx.db.get("players", args.playerId)
    if (!player) return

    // Validate bid
    const validBid = Math.min(args.bidAmount, player.cash)

    // Store bid for auction resolution
    // (In a full implementation, we'd track all bids and resolve)
    console.log(`Player ${player.modelDisplayName} bids $${validBid}`)
  },
})

/**
 * Execute pre/post roll actions decision
 */
export const executePrePostRollDecision = internalMutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    turnId: v.id('turns'),
    action: v.string(),
    parameters: v.any(),
    phase: v.string(),
    reasoning: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await executePrePostRollHandler(ctx, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      action: args.action,
      parameters: args.parameters,
      phase: args.phase,
      reasoning: args.reasoning,
    })
  },
})

/**
 * Process the LLM decision result and update game state
 * This is called by the LLM action after getting a response
 */
export const processDecisionResult = internalMutation({
  args: {
    gameId: v.id('games'),
    playerId: v.id('players'),
    turnId: v.id('turns'),
    turnNumber: v.number(),
    decisionType: v.union(
      v.literal('buy_property'),
      v.literal('auction_bid'),
      v.literal('jail_strategy'),
      v.literal('pre_roll_actions'),
      v.literal('post_roll_actions'),
      v.literal('trade_response'),
      v.literal('bankruptcy_resolution'),
    ),
    action: v.string(),
    parameters: v.any(),
    reasoning: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    latencyMs: v.number(),
    rawResponse: v.string(),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const decisionContext = safeParseContext(args.context)
    let action = args.action

    if (args.decisionType === 'buy_property' && action === 'buy') {
      const canAffordContext = decisionContext.canAfford
      let canAfford =
        typeof canAffordContext === 'boolean' ? canAffordContext : undefined

      if (canAfford === undefined) {
        const propertyCost = Number(
          (decisionContext.propertyCost as number | undefined) ??
            (decisionContext.cost as number | undefined),
        )
        if (Number.isFinite(propertyCost)) {
          const player = await ctx.db.get("players", args.playerId)
          canAfford = player ? player.cash >= propertyCost : undefined
        }
      }

      if (canAfford === false) {
        action = 'auction'
      }
    }

    // Log the decision to the database
    await ctx.db.insert('decisions', {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      turnNumber: args.turnNumber,
      decisionType: args.decisionType,
      context: args.context,
      optionsAvailable: getValidActions(args.decisionType, decisionContext),
      decisionMade: action,
      parameters: JSON.stringify(args.parameters),
      reasoning: args.reasoning,
      rawResponse: args.rawResponse,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      decisionTimeMs: args.latencyMs,
    })

    // Execute the decision based on type
    const game = await ctx.db.get("games", args.gameId)
    if (!game) return

    switch (args.decisionType) {
      case 'buy_property': {
        // Call the buy property executor directly since we're in a mutation
        const propertyPosition = Number(decisionContext.propertyPosition)
        if (!Number.isFinite(propertyPosition)) {
          await clearWaitingHandler(ctx, { gameId: args.gameId })
          break
        }
        await executeBuyPropertyHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action,
          propertyPosition,
        })
        break
      }

      case 'jail_strategy':
        await executeJailHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action: args.action,
        })
        break

      case 'auction_bid':
        await executeAuctionBidHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action,
          parameters: args.parameters,
          context: decisionContext,
        })
        break

      case 'pre_roll_actions':
      case 'post_roll_actions':
        await executePrePostRollHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action,
          parameters: args.parameters,
          phase: args.decisionType,
          reasoning: args.reasoning,
        })
        break

      case 'trade_response':
        await executeTradeResponseHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action,
          parameters: args.parameters,
          context: decisionContext,
          reasoning: args.reasoning,
        })
        break

      default:
        // For unhandled decision types, clear waiting state and continue
        await clearWaitingHandler(ctx, { gameId: args.gameId })
    }
  },
})

// ============================================================
// INLINE HANDLERS (to avoid circular scheduling issues)
// ============================================================

async function clearWaitingHandler(
  ctx: MutationCtx,
  args: { gameId: Id<'games'> },
) {
  const game = await ctx.db.get("games", args.gameId)
  if (!game) return

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
  })

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

async function executeBuyPropertyHandler(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    action: string
    propertyPosition: number
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  const player = await ctx.db.get("players", args.playerId)
  const property = await ctx.db
    .query('properties')
    .withIndex('by_game')
    .filter((q) =>
      q.and(
        q.eq(q.field('gameId'), args.gameId),
        q.eq(q.field('position'), args.propertyPosition),
      ),
    )
    .first()

  if (!game || !player || !property) return

  const space = getSpace(args.propertyPosition)
  const cost = getPurchasePrice(args.propertyPosition)

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get("turns", args.turnId)
    if (turn) {
      await ctx.db.patch("turns", args.turnId, {
        events: [...turn.events, event],
      })
    }
  }

  if (args.action === 'buy' && player.cash >= cost) {
    await ctx.db.patch("properties", property._id, { ownerId: args.playerId })
    await ctx.db.patch("players", args.playerId, { cash: player.cash - cost })
    await addEvent(`Decided to buy ${space.name} for $${cost}`)
    await recordPropertyTransfer(ctx, {
      gameId: args.gameId,
      turnId: args.turnId,
      propertyId: property._id,
      fromOwnerId: undefined,
      toOwnerId: args.playerId,
      reason: 'purchase',
      price: cost,
    })
  } else {
    await addEvent(`Declined to buy ${space.name} - starting auction`)
    await startAuctionFlow(ctx, {
      gameId: args.gameId,
      turnId: args.turnId,
      propertyId: property._id,
      propertyPosition: property.position,
      propertyName: space.name,
    })
    return
  }

  const turn = await ctx.db.get("turns", args.turnId)
  const wasDoubles = turn?.wasDoubles
  const playerData = await ctx.db.get("players", args.playerId)

  if (wasDoubles && !playerData?.inJail) {
    await addEvent('Rolled doubles - rolling again!')
    await ctx.db.patch("games", args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: 'rolling',
    })
  } else {
    await ctx.db.patch("games", args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: 'turn_end',
    })
  }

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

async function executeJailHandler(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    action: string
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  const player = await ctx.db.get("players", args.playerId)
  if (!game || !player) return

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get("turns", args.turnId)
    if (turn) {
      await ctx.db.patch("turns", args.turnId, {
        events: [...turn.events, event],
      })
    }
  }

  if (args.action === 'pay' && player.cash >= JAIL_FINE) {
    await ctx.db.patch("players", args.playerId, {
      cash: player.cash - JAIL_FINE,
      inJail: false,
      jailTurnsRemaining: 0,
    })
    await addEvent(`Paid $${JAIL_FINE} to get out of jail`)
  } else if (args.action === 'use_card' && player.getOutOfJailCards > 0) {
    await ctx.db.patch("players", args.playerId, {
      getOutOfJailCards: player.getOutOfJailCards - 1,
      inJail: false,
      jailTurnsRemaining: 0,
    })
    await addEvent('Used Get Out of Jail Free card')
  } else {
    await addEvent('Choosing to roll for doubles')
  }

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: 'rolling',
  })

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

async function executePrePostRollHandler(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    action: string
    parameters: Record<string, unknown>
    phase: string
    reasoning?: string
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  const player = await ctx.db.get("players", args.playerId)
  if (!game || !player) return

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get("turns", args.turnId)
    if (turn) {
      await ctx.db.patch("turns", args.turnId, {
        events: [...turn.events, event],
      })
    }
  }

  let nextPhase = game.currentPhase

  if (args.action === 'done') {
    const turn = await ctx.db.get("turns", args.turnId)
    if (args.phase === 'pre_roll_actions') {
      nextPhase = 'rolling'
    } else {
      if (turn?.wasDoubles && !player.inJail) {
        await addEvent('Rolled doubles - rolling again!')
        nextPhase = 'rolling'
      } else {
        nextPhase = 'turn_end'
      }
    }
  } else if (args.action === 'build') {
    const result = await applyBuildAction(ctx, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      parameters: args.parameters,
    })
    await addEvent(result.message)
    // If build failed, end the turn to prevent infinite retry loops
    if (result.message.startsWith('Build failed')) {
      const turn = await ctx.db.get("turns", args.turnId)
      if (turn?.wasDoubles && !player.inJail) {
        nextPhase = 'rolling'
      } else {
        nextPhase = 'turn_end'
      }
    }
  } else if (args.action === 'mortgage') {
    const result = await applyMortgageAction(ctx, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      parameters: args.parameters,
    })
    await addEvent(result.message)
    // If mortgage failed, end the turn to prevent infinite retry loops
    if (result.message.startsWith('Mortgage failed')) {
      const turn = await ctx.db.get("turns", args.turnId)
      if (turn?.wasDoubles && !player.inJail) {
        nextPhase = 'rolling'
      } else {
        nextPhase = 'turn_end'
      }
    }
  } else if (args.action === 'unmortgage') {
    const result = await applyUnmortgageAction(ctx, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      parameters: args.parameters,
    })
    await addEvent(result.message)
    // If unmortgage failed, end the turn to prevent infinite retry loops
    if (result.message.startsWith('Unmortgage failed')) {
      const turn = await ctx.db.get("turns", args.turnId)
      if (turn?.wasDoubles && !player.inJail) {
        nextPhase = 'rolling'
      } else {
        nextPhase = 'turn_end'
      }
    }
  } else if (args.action === 'trade') {
    const tradeStarted = await applyTradeAction(ctx, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      parameters: args.parameters,
      reasoning: args.reasoning,
    })
    if (tradeStarted) {
      return
    }
    // If trade failed or was skipped (e.g., limit reached), advance the phase
    // to prevent infinite loops where the LLM keeps trying to trade
    const turn = await ctx.db.get("turns", args.turnId)
    if (args.phase === 'pre_roll_actions') {
      nextPhase = 'rolling'
    } else {
      if (turn?.wasDoubles && !player.inJail) {
        nextPhase = 'rolling'
      } else {
        nextPhase = 'turn_end'
      }
    }
  }

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: nextPhase,
  })

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

async function executeAuctionBidHandler(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    action: string
    parameters: Record<string, unknown>
    context: Record<string, unknown>
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  if (!game) return

  const auctionContext = args.context as AuctionContext
  const player = await ctx.db.get("players", args.playerId)

  if (!player || !Array.isArray(auctionContext.bidderOrder)) {
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  const currentBid = auctionContext.currentBid
  const minBid = currentBid + 1

  let bidAmount = Math.floor(Number(args.parameters.amount ?? 0))
  if (!Number.isFinite(bidAmount)) bidAmount = 0
  bidAmount = Math.max(0, Math.min(bidAmount, player.cash))

  if (bidAmount < minBid) {
    bidAmount = 0
  }

  const bids = { ...auctionContext.bids }
  bids[args.playerId] = bidAmount

  const nextBid = bidAmount > currentBid ? bidAmount : currentBid
  const nextIndex = auctionContext.bidderIndex + 1

  if (nextIndex < auctionContext.bidderOrder.length) {
    const nextContext: AuctionContext = {
      ...auctionContext,
      currentBid: nextBid,
      minBid: nextBid + 1,
      bids,
      bidderIndex: nextIndex,
    }

    const nextBidderId = auctionContext.bidderOrder[nextIndex]

    await ctx.db.patch("games", args.gameId, {
      waitingForLLM: true,
      pendingDecision: {
        type: 'auction_bid',
        context: JSON.stringify(nextContext),
      },
    })

     
    await ctx.scheduler.runAfter(
      0,
      (internal as any).llmDecisions.getLLMDecision,
      {
        gameId: args.gameId,
        playerId: nextBidderId,
        turnId: args.turnId,
        decisionType: 'auction_bid',
        context: JSON.stringify(nextContext),
      },
    )
    return
  }

  await resolveAuction(ctx, {
    gameId: args.gameId,
    turnId: args.turnId,
    auctionContext: {
      ...auctionContext,
      currentBid: nextBid,
      bids,
      bidderIndex: nextIndex,
    },
  })
}

async function executeTradeResponseHandler(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    action: string
    parameters: Record<string, unknown>
    context: Record<string, unknown>
    reasoning: string
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  if (!game) return

  const tradeId = args.context.tradeId as Id<'trades'> | undefined
  if (!tradeId) {
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  const trade = await ctx.db.get("trades", tradeId)
  if (!trade || trade.status !== 'pending') {
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  const proposer = await ctx.db.get("players", trade.proposerId)
  const recipient = await ctx.db.get("players", trade.recipientId)
  if (!proposer || !recipient) {
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  const allProperties = await ctx.db
    .query('properties')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const offer: TradeOffer = {
    offerMoney: trade.offerMoney,
    offerProperties: trade.offerProperties,
    offerGetOutOfJailCards: trade.offerGetOutOfJailCards,
    requestMoney: trade.requestMoney,
    requestProperties: trade.requestProperties,
    requestGetOutOfJailCards: trade.requestGetOutOfJailCards,
  }

  if (args.action === 'accept') {
    // Re-validate with current state - players' assets may have changed since trade was proposed
    const validation = canProposeTrade(
      proposer,
      recipient,
      offer,
      allProperties,
    )
    if (!validation.valid) {
      await ctx.db.patch("trades", tradeId, {
        status: 'rejected',
        recipientReasoning:
          args.reasoning || validation.reason || 'Trade no longer valid',
      })
      await appendTurnEvent(
        ctx,
        args.turnId,
        `Trade rejected: ${validation.reason ?? 'trade conditions no longer met'}`,
      )
      await clearWaitingHandler(ctx, { gameId: args.gameId })
      return
    }

    // Verify property ownership hasn't changed
    const proposerProps = allProperties.filter(
      (p: Doc<'properties'>) => p.ownerId === proposer._id,
    )
    const recipientProps = allProperties.filter(
      (p: Doc<'properties'>) => p.ownerId === recipient._id,
    )

    const proposerOwnsOffered = trade.offerProperties.every(
      (propId: Id<'properties'>) =>
        proposerProps.some((p: Doc<'properties'>) => p._id === propId),
    )
    const recipientOwnsRequested = trade.requestProperties.every(
      (propId: Id<'properties'>) =>
        recipientProps.some((p: Doc<'properties'>) => p._id === propId),
    )

    if (!proposerOwnsOffered || !recipientOwnsRequested) {
      await ctx.db.patch("trades", tradeId, {
        status: 'rejected',
        recipientReasoning:
          'Property ownership changed since trade was proposed',
      })
      await appendTurnEvent(
        ctx,
        args.turnId,
        'Trade rejected: property ownership changed',
      )
      await clearWaitingHandler(ctx, { gameId: args.gameId })
      return
    }

    await ctx.db.patch("trades", tradeId, {
      status: 'accepted',
      recipientReasoning: args.reasoning,
    })

    await ctx.db.patch("players", proposer._id, {
      cash: proposer.cash - trade.offerMoney + trade.requestMoney,
      getOutOfJailCards:
        proposer.getOutOfJailCards -
        trade.offerGetOutOfJailCards +
        trade.requestGetOutOfJailCards,
    })

    await ctx.db.patch("players", recipient._id, {
      cash: recipient.cash - trade.requestMoney + trade.offerMoney,
      getOutOfJailCards:
        recipient.getOutOfJailCards -
        trade.requestGetOutOfJailCards +
        trade.offerGetOutOfJailCards,
    })

    for (const propId of trade.offerProperties) {
      await ctx.db.patch("properties", propId, { ownerId: recipient._id })
      await recordPropertyTransfer(ctx, {
        gameId: args.gameId,
        turnId: args.turnId,
        propertyId: propId,
        fromOwnerId: proposer._id,
        toOwnerId: recipient._id,
        reason: 'trade',
      })
    }
    for (const propId of trade.requestProperties) {
      await ctx.db.patch("properties", propId, { ownerId: proposer._id })
      await recordPropertyTransfer(ctx, {
        gameId: args.gameId,
        turnId: args.turnId,
        propertyId: propId,
        fromOwnerId: recipient._id,
        toOwnerId: proposer._id,
        reason: 'trade',
      })
    }

    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade accepted: ${recipient.modelDisplayName} accepted ${proposer.modelDisplayName}'s offer`,
    )
  } else if (args.action === 'counter') {
    const counter = await createCounterOffer(ctx, {
      gameId: args.gameId,
      turnId: args.turnId,
      originalTradeId: tradeId,
      proposer,
      recipient,
      parameters: args.parameters,
      reasoning: args.reasoning,
      allProperties,
    })
    if (counter.started) {
      return
    }
  } else {
    await ctx.db.patch("trades", tradeId, {
      status: 'rejected',
      recipientReasoning: args.reasoning,
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade rejected by ${recipient.modelDisplayName}`,
    )
  }

  // After a trade response (accept/reject), advance the phase to prevent trade loops
  // The proposer initiated the trade during their pre_roll or post_roll phase
  // After the trade is resolved, we should move their turn forward
  const turn = await ctx.db.get("turns", args.turnId)
  const currentPlayer = turn ? await ctx.db.get("players", turn.playerId) : null

  let nextPhase = game.currentPhase
  if (game.currentPhase === 'pre_roll') {
    nextPhase = 'rolling'
  } else if (game.currentPhase === 'post_roll') {
    if (turn?.wasDoubles && currentPlayer && !currentPlayer.inJail) {
      nextPhase = 'rolling'
    } else {
      nextPhase = 'turn_end'
    }
  }

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: nextPhase,
  })

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

type AuctionContext = {
  propertyId: Id<'properties'>
  propertyName: string
  propertyPosition: number
  currentBid: number
  minBid: number
  bidderOrder: Array<Id<'players'>>
  bidderIndex: number
  bids: Record<string, number>
}

async function startAuctionFlow(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    turnId: Id<'turns'>
    propertyId: Id<'properties'>
    propertyPosition: number
    propertyName: string
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  if (!game) return

  const players = await ctx.db
    .query('players')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const activePlayers = players.filter((p) => !p.isBankrupt)
  activePlayers.sort((a, b) => a.turnOrder - b.turnOrder)

  if (activePlayers.length === 0) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Auction canceled for ${args.propertyName}`,
    )
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  const bidderOrder = activePlayers.map((p) => p._id)
  const context: AuctionContext = {
    propertyId: args.propertyId,
    propertyName: args.propertyName,
    propertyPosition: args.propertyPosition,
    currentBid: 0,
    minBid: 1,
    bidderOrder,
    bidderIndex: 0,
    bids: {},
  }

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: true,
    pendingDecision: { type: 'auction_bid', context: JSON.stringify(context) },
  })

   
  await ctx.scheduler.runAfter(
    0,
    (internal as any).llmDecisions.getLLMDecision,
    {
      gameId: args.gameId,
      playerId: bidderOrder[0],
      turnId: args.turnId,
      decisionType: 'auction_bid',
      context: JSON.stringify(context),
    },
  )
}

async function resolveAuction(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    turnId: Id<'turns'>
    auctionContext: AuctionContext
  },
) {
  const game = await ctx.db.get("games", args.gameId)
  if (!game) return

  const property = await ctx.db.get("properties", args.auctionContext.propertyId)
  if (!property) {
    await clearWaitingHandler(ctx, { gameId: args.gameId })
    return
  }

  let highestBid = 0
  let winnerId: Id<'players'> | null = null

  for (const bidderId of args.auctionContext.bidderOrder) {
    const bid = args.auctionContext.bids[bidderId] ?? 0
    if (bid > highestBid) {
      highestBid = bid
      winnerId = bidderId
    }
  }

  if (winnerId && highestBid > 0) {
    const winner = await ctx.db.get("players", winnerId)
    if (winner) {
      await ctx.db.patch("properties", property._id, { ownerId: winnerId })
      await ctx.db.patch("players", winnerId, { cash: winner.cash - highestBid })
      await appendTurnEvent(
        ctx,
        args.turnId,
        `Auction: ${winner.modelDisplayName} won ${args.auctionContext.propertyName} for $${highestBid}`,
      )
      await recordPropertyTransfer(ctx, {
        gameId: args.gameId,
        turnId: args.turnId,
        propertyId: property._id,
        fromOwnerId: undefined,
        toOwnerId: winnerId,
        reason: 'auction',
        price: highestBid,
      })
    }
  } else {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Auction: No valid bids for ${args.auctionContext.propertyName}`,
    )
  }

  const turn = await ctx.db.get("turns", args.turnId)
  const currentPlayer = turn ? await ctx.db.get("players", turn.playerId) : null

  const nextPhase =
    turn?.wasDoubles && currentPlayer && !currentPlayer.inJail
      ? 'rolling'
      : 'turn_end'

  if (nextPhase === 'rolling') {
    await appendTurnEvent(ctx, args.turnId, 'Rolled doubles - rolling again!')
  }

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: nextPhase,
  })

  await ctx.scheduler.runAfter(
    game.config.speedMs,
    internal.gameEngine.processTurnStep,
    {
      gameId: args.gameId,
    },
  )
}

async function applyBuildAction(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    parameters: Record<string, unknown>
  },
): Promise<{ message: string }> {
  const propertyName = extractPropertyName(args.parameters)
  if (!propertyName) {
    return { message: 'Build failed: missing property name' }
  }

  const player = await ctx.db.get("players", args.playerId)
  if (!player) return { message: 'Build failed: player not found' }

  const allProperties = await ctx.db
    .query('properties')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const property = findPropertyByName(allProperties, propertyName)
  if (!property) {
    return { message: `Build failed: property "${propertyName}" not found` }
  }

  const count = extractBuildCount(args.parameters)
  const houseCost = getHouseCost(property.position)
  let housesBuilt = 0
  let remainingCash = player.cash
  let lastReason = 'Invalid build'

  const updatedProperties = allProperties.map((p) =>
    p._id === property._id ? { ...p } : p,
  )
  const target = updatedProperties.find((p) => p._id === property._id)

  if (!target) {
    return {
      message: `Build failed: property "${propertyName}" not found in game`,
    }
  }

  for (let i = 0; i < count; i++) {
    const validation = canBuildHouse(
      { ...player, cash: remainingCash },
      target,
      updatedProperties,
    )
    if (!validation.valid) {
      lastReason = validation.reason ?? lastReason
      break
    }
    remainingCash -= houseCost
    target.houses += 1
    housesBuilt += 1
  }

  if (housesBuilt > 0) {
    await ctx.db.patch("properties", target._id, { houses: target.houses })
    await ctx.db.patch("players", player._id, { cash: remainingCash })
    await recordPropertyStateEvent(ctx, {
      gameId: args.gameId,
      turnId: args.turnId,
      propertyId: target._id,
      houses: target.houses,
      reason: 'build',
    })
    return {
      message: `Built ${housesBuilt} house(s) on ${target.name} for $${housesBuilt * houseCost}`,
    }
  }

  return { message: `Build failed: ${lastReason}` }
}

async function applyMortgageAction(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    parameters: Record<string, unknown>
  },
): Promise<{ message: string }> {
  const propertyName = extractPropertyName(args.parameters)
  if (!propertyName) {
    return { message: 'Mortgage failed: missing property name' }
  }

  const player = await ctx.db.get("players", args.playerId)
  if (!player) return { message: 'Mortgage failed: player not found' }

  const allProperties = await ctx.db
    .query('properties')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const property = findPropertyByName(allProperties, propertyName)
  if (!property) {
    return { message: `Mortgage failed: property "${propertyName}" not found` }
  }

  const validation = canMortgage(player, property, allProperties)
  if (!validation.valid) {
    return { message: `Mortgage failed: ${validation.reason ?? 'invalid'}` }
  }

  const mortgageValue = getMortgageValue(property.position)
  await ctx.db.patch("properties", property._id, { isMortgaged: true })
  await ctx.db.patch("players", player._id, { cash: player.cash + mortgageValue })
  await recordPropertyStateEvent(ctx, {
    gameId: args.gameId,
    turnId: args.turnId,
    propertyId: property._id,
    isMortgaged: true,
    reason: 'mortgage',
  })

  return { message: `Mortgaged ${property.name} for $${mortgageValue}` }
}

async function applyUnmortgageAction(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    parameters: Record<string, unknown>
  },
): Promise<{ message: string }> {
  const propertyName = extractPropertyName(args.parameters)
  if (!propertyName) {
    return { message: 'Unmortgage failed: missing property name' }
  }

  const player = await ctx.db.get("players", args.playerId)
  if (!player) return { message: 'Unmortgage failed: player not found' }

  const allProperties = await ctx.db
    .query('properties')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const property = findPropertyByName(allProperties, propertyName)
  if (!property) {
    return {
      message: `Unmortgage failed: property "${propertyName}" not found`,
    }
  }

  const validation = canUnmortgage(player, property)
  if (!validation.valid) {
    return { message: `Unmortgage failed: ${validation.reason ?? 'invalid'}` }
  }

  const unmortgageCost = getUnmortgageCost(property.position)
  await ctx.db.patch("properties", property._id, { isMortgaged: false })
  await ctx.db.patch("players", player._id, { cash: player.cash - unmortgageCost })
  await recordPropertyStateEvent(ctx, {
    gameId: args.gameId,
    turnId: args.turnId,
    propertyId: property._id,
    isMortgaged: false,
    reason: 'unmortgage',
  })

  return { message: `Unmortgaged ${property.name} for $${unmortgageCost}` }
}

async function applyTradeAction(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    playerId: Id<'players'>
    turnId: Id<'turns'>
    parameters: Record<string, unknown>
    reasoning?: string
  },
): Promise<boolean> {
  // Check trade attempt limit to prevent infinite loops
  const turn = await ctx.db.get("turns", args.turnId)
  if (!turn) return false

  const currentAttempts = turn.tradeAttempts ?? 0
  if (currentAttempts >= MAX_TRADE_ATTEMPTS_PER_TURN) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade skipped: reached limit of ${MAX_TRADE_ATTEMPTS_PER_TURN} trade attempts per turn`,
    )
    return false
  }

  // Increment trade attempts
  await ctx.db.patch("turns", args.turnId, { tradeAttempts: currentAttempts + 1 })

  const recipientName =
    (args.parameters.recipientName as string) ||
    (args.parameters.recipient as string)

  if (!recipientName) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      'Trade failed: missing recipient name',
    )
    return false
  }

  const game = await ctx.db.get("games", args.gameId)
  const proposer = await ctx.db.get("players", args.playerId)
  if (!game || !proposer) return false

  const allPlayers = await ctx.db
    .query('players')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const recipient = findPlayerByName(allPlayers, recipientName)
  if (!recipient || recipient._id === proposer._id || recipient.isBankrupt) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade failed: recipient "${recipientName}" not found`,
    )
    return false
  }

  const allProperties = await ctx.db
    .query('properties')
    .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
    .collect()

  const offerPropertyNames = normalizeStringArray(
    args.parameters.offerProperties,
  )
  const requestPropertyNames = normalizeStringArray(
    args.parameters.requestProperties,
  )

  const offerProperties = mapPropertyNamesToIds(
    allProperties,
    offerPropertyNames,
    proposer._id,
  )
  const requestProperties = mapPropertyNamesToIds(
    allProperties,
    requestPropertyNames,
    recipient._id,
  )

  if (offerProperties.missing.length > 0) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade failed: proposer missing ${offerProperties.missing.join(', ')}`,
    )
    return false
  }
  if (requestProperties.missing.length > 0) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade failed: recipient missing ${requestProperties.missing.join(', ')}`,
    )
    return false
  }

  const offerMoney = coerceNumber(args.parameters.offerMoney)
  const requestMoney = coerceNumber(args.parameters.requestMoney)
  const offerGetOutOfJailCards = coerceNumber(
    args.parameters.offerGetOutOfJailCards,
  )
  const requestGetOutOfJailCards = coerceNumber(
    args.parameters.requestGetOutOfJailCards,
  )

  const offer: TradeOffer = {
    offerMoney,
    offerProperties: offerProperties.ids,
    offerGetOutOfJailCards,
    requestMoney,
    requestProperties: requestProperties.ids,
    requestGetOutOfJailCards,
  }

  const validation = canProposeTrade(proposer, recipient, offer, allProperties)
  if (!validation.valid) {
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade failed: ${validation.reason ?? 'invalid offer'}`,
    )
    return false
  }

  const tradeId = await ctx.db.insert('trades', {
    gameId: args.gameId,
    turnNumber: game.currentTurnNumber,
    proposerId: proposer._id,
    recipientId: recipient._id,
    offerMoney,
    offerProperties: offerProperties.ids,
    offerGetOutOfJailCards,
    requestMoney,
    requestProperties: requestProperties.ids,
    requestGetOutOfJailCards,
    status: 'pending',
    proposerReasoning: args.reasoning ?? '',
    counterDepth: 0,
  })

  const context = buildTradeContext(
    tradeId,
    proposer,
    {
      offerMoney,
      offerProperties: offerProperties.ids,
      offerGetOutOfJailCards,
      requestMoney,
      requestProperties: requestProperties.ids,
      requestGetOutOfJailCards,
    },
    allProperties,
  )

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: true,
    pendingDecision: { type: 'trade_response', context },
  })

   
  await ctx.scheduler.runAfter(
    0,
    (internal as any).llmDecisions.getLLMDecision,
    {
      gameId: args.gameId,
      playerId: recipient._id,
      turnId: args.turnId,
      decisionType: 'trade_response',
      context,
    },
  )

  await appendTurnEvent(
    ctx,
    args.turnId,
    `Proposed trade to ${recipient.modelDisplayName}`,
  )

  return true
}

async function createCounterOffer(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    turnId: Id<'turns'>
    originalTradeId: Id<'trades'>
    proposer: Doc<'players'>
    recipient: Doc<'players'>
    parameters: Record<string, unknown>
    reasoning: string
    allProperties: Array<Doc<'properties'>>
  },
): Promise<{ started: boolean }> {
  // Check trade attempt limit to prevent infinite loops
  // Counter offers also count against the per-turn trade limit
  const turn = await ctx.db.get("turns", args.turnId)
  if (!turn) return { started: false }

  const currentAttempts = turn.tradeAttempts ?? 0
  if (currentAttempts >= MAX_TRADE_ATTEMPTS_PER_TURN) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning: args.reasoning || 'Trade limit reached for this turn',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade rejected: reached limit of ${MAX_TRADE_ATTEMPTS_PER_TURN} trade attempts per turn`,
    )
    return { started: false }
  }

  // Increment trade attempts for counter offers too
  await ctx.db.patch("turns", args.turnId, { tradeAttempts: currentAttempts + 1 })

  const originalTrade = await ctx.db.get("trades", args.originalTradeId)
  const currentDepth = originalTrade?.counterDepth ?? 0
  const maxDepth = 3

  if (currentDepth >= maxDepth) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning: args.reasoning || 'Counter limit reached',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade rejected: counter limit of ${maxDepth} reached`,
    )
    return { started: false }
  }

  const counterProposer = args.recipient
  const counterRecipient = args.proposer

  const offerPropertyNames = normalizeStringArray(
    args.parameters.offerProperties,
  )
  const requestPropertyNames = normalizeStringArray(
    args.parameters.requestProperties,
  )

  const offerProperties = mapPropertyNamesToIds(
    args.allProperties,
    offerPropertyNames,
    counterProposer._id,
  )
  const requestProperties = mapPropertyNamesToIds(
    args.allProperties,
    requestPropertyNames,
    counterRecipient._id,
  )

  const offerMoney = coerceNumber(args.parameters.offerMoney)
  const requestMoney = coerceNumber(args.parameters.requestMoney)
  const offerGetOutOfJailCards = coerceNumber(
    args.parameters.offerGetOutOfJailCards,
  )
  const requestGetOutOfJailCards = coerceNumber(
    args.parameters.requestGetOutOfJailCards,
  )

  const hasAnyTerms =
    offerMoney > 0 ||
    requestMoney > 0 ||
    offerGetOutOfJailCards > 0 ||
    requestGetOutOfJailCards > 0 ||
    offerProperties.ids.length > 0 ||
    requestProperties.ids.length > 0

  if (!hasAnyTerms) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning: args.reasoning || 'Invalid counter offer',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade counter failed: ${args.recipient.modelDisplayName} provided no terms`,
    )
    return { started: false }
  }

  if (
    offerProperties.missing.length > 0 ||
    requestProperties.missing.length > 0
  ) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning: args.reasoning || 'Invalid counter offer',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      'Trade counter failed: invalid properties requested',
    )
    return { started: false }
  }

  const counterOffer: TradeOffer = {
    offerMoney,
    offerProperties: offerProperties.ids,
    offerGetOutOfJailCards,
    requestMoney,
    requestProperties: requestProperties.ids,
    requestGetOutOfJailCards,
  }

  if (originalTrade && isEquivalentCounter(counterOffer, originalTrade)) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning:
        args.reasoning || 'Counter offer matches original terms',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      'Trade rejected: counter offer matches original terms',
    )
    return { started: false }
  }

  const validation = canProposeTrade(
    counterProposer,
    counterRecipient,
    counterOffer,
    args.allProperties,
  )
  if (!validation.valid) {
    await ctx.db.patch("trades", args.originalTradeId, {
      status: 'rejected',
      recipientReasoning:
        args.reasoning || validation.reason || 'Invalid counter offer',
    })
    await appendTurnEvent(
      ctx,
      args.turnId,
      `Trade counter failed: ${validation.reason ?? 'invalid offer'}`,
    )
    return { started: false }
  }

  await ctx.db.patch("trades", args.originalTradeId, {
    status: 'countered',
    recipientReasoning: args.reasoning,
  })

  const game = await ctx.db.get("games", args.gameId)
  const counterTradeId = await ctx.db.insert('trades', {
    gameId: args.gameId,
    turnNumber: game?.currentTurnNumber ?? 0,
    proposerId: counterProposer._id,
    recipientId: counterRecipient._id,
    offerMoney,
    offerProperties: offerProperties.ids,
    offerGetOutOfJailCards,
    requestMoney,
    requestProperties: requestProperties.ids,
    requestGetOutOfJailCards,
    status: 'pending',
    proposerReasoning: args.reasoning,
    counterDepth: currentDepth + 1,
  })

  const context = buildTradeContext(
    counterTradeId,
    counterProposer,
    {
      offerMoney,
      offerProperties: offerProperties.ids,
      offerGetOutOfJailCards,
      requestMoney,
      requestProperties: requestProperties.ids,
      requestGetOutOfJailCards,
    },
    args.allProperties,
  )

  await ctx.db.patch("games", args.gameId, {
    waitingForLLM: true,
    pendingDecision: { type: 'trade_response', context },
  })

   
  await ctx.scheduler.runAfter(
    0,
    (internal as any).llmDecisions.getLLMDecision,
    {
      gameId: args.gameId,
      playerId: counterRecipient._id,
      turnId: args.turnId,
      decisionType: 'trade_response',
      context,
    },
  )

  await appendTurnEvent(
    ctx,
    args.turnId,
    `Trade countered by ${counterProposer.modelDisplayName}`,
  )

  return { started: true }
}

function safeParseContext(context: string): Record<string, unknown> {
  try {
    return JSON.parse(context) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function appendTurnEvent(
  ctx: MutationCtx,
  turnId: Id<'turns'>,
  event: string,
) {
  const turn = await ctx.db.get("turns", turnId)
  if (turn) {
    await ctx.db.patch("turns", turnId, {
      events: [...turn.events, event],
    })
  }
}

async function recordPropertyTransfer(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    turnId: Id<'turns'>
    propertyId: Id<'properties'>
    fromOwnerId?: Id<'players'>
    toOwnerId?: Id<'players'>
    reason: string
    price?: number
  },
) {
  const turn = await ctx.db.get("turns", args.turnId)
  if (!turn) return

  await ctx.db.insert('propertyTransfers', {
    gameId: args.gameId,
    turnNumber: turn.turnNumber,
    propertyId: args.propertyId,
    fromOwnerId: args.fromOwnerId,
    toOwnerId: args.toOwnerId,
    reason: args.reason,
    price: args.price,
    createdAt: Date.now(),
  })
}

async function recordPropertyStateEvent(
  ctx: MutationCtx,
  args: {
    gameId: Id<'games'>
    turnId: Id<'turns'>
    propertyId: Id<'properties'>
    houses?: number
    isMortgaged?: boolean
    reason: string
  },
) {
  const turn = await ctx.db.get("turns", args.turnId)
  if (!turn) return

  await ctx.db.insert('propertyStateEvents', {
    gameId: args.gameId,
    turnNumber: turn.turnNumber,
    propertyId: args.propertyId,
    houses: args.houses,
    isMortgaged: args.isMortgaged,
    reason: args.reason,
    createdAt: Date.now(),
  })
}

function normalizeString(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeIdArray(ids: Array<Id<'properties'>>): Array<string> {
  return ids.map((id) => id.toString()).sort()
}

function arraysEqual(a: Array<string>, b: Array<string>): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function isEquivalentCounter(
  counter: TradeOffer,
  original: Doc<'trades'>,
): boolean {
  const offerMatchesRequest =
    counter.offerMoney === original.requestMoney &&
    counter.offerGetOutOfJailCards === original.requestGetOutOfJailCards &&
    arraysEqual(
      normalizeIdArray(counter.offerProperties),
      normalizeIdArray(original.requestProperties),
    )

  const requestMatchesOffer =
    counter.requestMoney === original.offerMoney &&
    counter.requestGetOutOfJailCards === original.offerGetOutOfJailCards &&
    arraysEqual(
      normalizeIdArray(counter.requestProperties),
      normalizeIdArray(original.offerProperties),
    )

  return offerMatchesRequest && requestMatchesOffer
}

function buildTradeContext(
  tradeId: Id<'trades'>,
  proposer: Doc<'players'>,
  offer: TradeOffer,
  allProperties: Array<Doc<'properties'>>,
): string {
  const offerPropertyDisplay = offer.offerProperties.map(
    (id) => allProperties.find((p) => p._id === id)?.name ?? id,
  )
  const requestPropertyDisplay = offer.requestProperties.map(
    (id) => allProperties.find((p) => p._id === id)?.name ?? id,
  )

  return JSON.stringify({
    tradeId,
    proposerName: proposer.modelDisplayName,
    offer: {
      money: offer.offerMoney,
      properties: offerPropertyDisplay,
      jailCards: offer.offerGetOutOfJailCards,
    },
    request: {
      money: offer.requestMoney,
      properties: requestPropertyDisplay,
      jailCards: offer.requestGetOutOfJailCards,
    },
  })
}

function normalizeStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0)
}

function mapPropertyNamesToIds(
  properties: Array<Doc<'properties'>>,
  names: Array<string>,
  ownerId: Id<'players'>,
): { ids: Array<Id<'properties'>>; missing: Array<string> } {
  const ids: Array<Id<'properties'>> = []
  const missing: Array<string> = []

  for (const name of names) {
    const property = properties.find(
      (p) => normalizeString(p.name) === name && p.ownerId === ownerId,
    )
    if (property) {
      ids.push(property._id)
    } else {
      missing.push(name)
    }
  }

  return { ids, missing }
}

function findPropertyByName(
  properties: Array<Doc<'properties'>>,
  name: string,
) {
  const target = normalizeString(name)
  return (
    properties.find((property) => normalizeString(property.name) === target) ??
    null
  )
}

function findPlayerByName(players: Array<Doc<'players'>>, name: string) {
  const target = normalizeString(name)
  return (
    players.find(
      (player) => normalizeString(player.modelDisplayName) === target,
    ) ?? null
  )
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) return parsed
  }
  return 0
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

type DecisionType =
  | 'buy_property'
  | 'auction_bid'
  | 'jail_strategy'
  | 'pre_roll_actions'
  | 'post_roll_actions'
  | 'trade_response'
  | 'bankruptcy_resolution'

function getValidActions(
  decisionType: DecisionType,
  context: Record<string, unknown>,
): Array<string> {
  switch (decisionType) {
    case 'buy_property':
      return ['buy', 'auction']
    case 'auction_bid':
      return ['bid']
    case 'jail_strategy': {
      const actions = ['roll']
      if (context.canPayFine) actions.push('pay')
      if (context.hasJailCard) actions.push('use_card')
      return actions
    }
    case 'pre_roll_actions':
      return ['build', 'mortgage', 'unmortgage', 'trade', 'done']
    case 'post_roll_actions':
      return ['build', 'mortgage', 'unmortgage', 'done']
    case 'trade_response':
      return ['accept', 'reject', 'counter']
    default:
      return ['done']
  }
}

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================
  // GAME STATE TABLES
  // ============================================================

  games: defineTable({
    status: v.union(
      v.literal("setup"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    currentPlayerIndex: v.number(),
    currentTurnNumber: v.number(),
    currentPhase: v.union(
      v.literal("pre_roll"),
      v.literal("rolling"),
      v.literal("post_roll"),
      v.literal("turn_end"),
      v.literal("game_over")
    ),
    winnerId: v.optional(v.id("players")),
    endingReason: v.optional(
      v.union(
        v.literal("last_player_standing"),
        v.literal("turn_limit_reached"),
        v.literal("manual_stop"),
        v.literal("error")
      )
    ),
    config: v.object({
      turnLimit: v.optional(v.number()),
      speedMs: v.number(),
      startingMoney: v.number(),
    }),
    // Card decks - arrays of card indices representing remaining cards
    // Cards are drawn from the front, when empty the deck is reshuffled
    chanceDeck: v.optional(v.array(v.number())),
    communityChestDeck: v.optional(v.array(v.number())),
    // Pause state - separate from status since paused games are still "in_progress"
    isPaused: v.optional(v.boolean()),
    // LLM decision waiting state
    waitingForLLM: v.optional(v.boolean()),
    pendingDecision: v.optional(
      v.object({
        type: v.union(
          v.literal("buy_property"),
          v.literal("auction_bid"),
          v.literal("jail_strategy"),
          v.literal("pre_roll_actions"),
          v.literal("post_roll_actions"),
          v.literal("trade_response"),
          v.literal("bankruptcy_resolution")
        ),
        context: v.string(), // JSON with decision context
      })
    ),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    // Scheduled arena games (automatic hourly games)
    isScheduledArena: v.optional(v.boolean()),
  }),

  players: defineTable({
    gameId: v.id("games"),
    modelId: v.string(),
    modelDisplayName: v.string(),
    modelProvider: v.string(),
    tokenColor: v.string(),
    textColor: v.optional(v.string()), // For contrast on token color
    turnOrder: v.number(),
    // Live game state
    cash: v.number(),
    position: v.number(), // 0-39
    inJail: v.boolean(),
    jailTurnsRemaining: v.number(),
    getOutOfJailCards: v.number(),
    isBankrupt: v.boolean(),
    consecutiveDoubles: v.number(),
    // Final stats (set when game ends or player bankrupts)
    finalPosition: v.optional(v.number()), // 1st, 2nd, 3rd, etc.
    finalNetWorth: v.optional(v.number()),
    bankruptcyTurn: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_turn_order", ["gameId", "turnOrder"]),

  properties: defineTable({
    gameId: v.id("games"),
    position: v.number(), // Board position 0-39
    name: v.string(),
    group: v.string(), // "brown", "lightBlue", "pink", etc., "railroad", "utility"
    ownerId: v.optional(v.id("players")),
    houses: v.number(), // 0-4 houses, 5 = hotel
    isMortgaged: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_owner", ["ownerId"]),

  // ============================================================
  // TURN & DECISION TRACKING (for replay and analytics)
  // ============================================================

  turns: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnNumber: v.number(),
    diceRoll: v.optional(v.array(v.number())), // [die1, die2]
    wasDoubles: v.optional(v.boolean()),
    positionBefore: v.number(),
    positionAfter: v.optional(v.number()),
    passedGo: v.optional(v.boolean()),
    landedOn: v.optional(v.string()), // Space name
    cashBefore: v.number(),
    cashAfter: v.optional(v.number()),
    events: v.array(v.string()), // ["Rolled 7", "Landed on Park Place", "Paid $35 rent"]
    tradeAttempts: v.optional(v.number()), // Track trade attempts per turn to prevent infinite loops
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_turn", ["gameId", "turnNumber"]),

  decisions: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    turnNumber: v.number(),
    decisionType: v.union(
      v.literal("buy_property"),
      v.literal("auction_bid"),
      v.literal("jail_strategy"),
      v.literal("pre_roll_actions"),
      v.literal("post_roll_actions"),
      v.literal("trade_response"),
      v.literal("bankruptcy_resolution")
    ),
    context: v.string(), // JSON string with game state context
    optionsAvailable: v.array(v.string()),
    decisionMade: v.string(),
    parameters: v.optional(v.string()), // JSON string for decision-specific params
    reasoning: v.string(),
    rawResponse: v.optional(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    decisionTimeMs: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_type", ["decisionType"]),

  trades: defineTable({
    gameId: v.id("games"),
    turnNumber: v.number(),
    proposerId: v.id("players"),
    recipientId: v.id("players"),
    // What proposer offers
    offerMoney: v.number(),
    offerProperties: v.array(v.id("properties")),
    offerGetOutOfJailCards: v.number(),
    // What proposer requests
    requestMoney: v.number(),
    requestProperties: v.array(v.id("properties")),
    requestGetOutOfJailCards: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("countered")
    ),
    proposerReasoning: v.string(),
    recipientReasoning: v.optional(v.string()),
    counterDepth: v.optional(v.number()),
  }).index("by_game", ["gameId"]),

  rentPayments: defineTable({
    gameId: v.id("games"),
    turnNumber: v.number(),
    payerId: v.id("players"),
    receiverId: v.id("players"),
    propertyName: v.string(),
    amount: v.number(),
    diceTotal: v.optional(v.number()), // For utilities
    payerCashAfter: v.number(),
    receiverCashAfter: v.number(),
  }).index("by_game", ["gameId"]),

  propertyTransfers: defineTable({
    gameId: v.id("games"),
    turnNumber: v.number(),
    propertyId: v.id("properties"),
    fromOwnerId: v.optional(v.id("players")),
    toOwnerId: v.optional(v.id("players")),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_turn", ["gameId", "turnNumber"]),

  propertyStateEvents: defineTable({
    gameId: v.id("games"),
    turnNumber: v.number(),
    propertyId: v.id("properties"),
    houses: v.optional(v.number()),
    isMortgaged: v.optional(v.boolean()),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_game_turn", ["gameId", "turnNumber"]),

  // ============================================================
  // ANALYTICS AGGREGATES
  // ============================================================

  modelStats: defineTable({
    modelId: v.string(), // e.g., "anthropic/claude-3-opus"
    modelDisplayName: v.string(),
    modelProvider: v.string(),
    // Win/loss stats
    gamesPlayed: v.number(),
    wins: v.number(),
    secondPlace: v.number(),
    thirdPlace: v.number(),
    bankruptcies: v.number(),
    // Financial stats
    avgFinalNetWorth: v.number(),
    avgFinalCash: v.number(),
    totalRentCollected: v.number(),
    totalRentPaid: v.number(),
    // Property stats
    avgPropertiesOwned: v.number(),
    monopoliesCompleted: v.number(),
    // Trading stats
    tradesProposed: v.number(),
    tradesAccepted: v.number(),
    tradeAcceptRate: v.number(),
    // Performance stats
    avgDecisionTimeMs: v.number(),
    avgGameLength: v.number(), // In turns
    updatedAt: v.number(),
  })
    .index("by_model", ["modelId"])
    .index("by_wins", ["wins"]),

  headToHead: defineTable({
    pairKey: v.string(), // Alphabetically sorted: "modelA|modelB"
    modelAId: v.string(),
    modelADisplayName: v.string(),
    modelBId: v.string(),
    modelBDisplayName: v.string(),
    modelAWins: v.number(),
    modelBWins: v.number(),
    totalGames: v.number(),
    avgGameLength: v.number(),
    updatedAt: v.number(),
  }).index("by_pair", ["pairKey"]),

  propertyStats: defineTable({
    propertyName: v.string(),
    propertyGroup: v.string(),
    position: v.number(),
    timesPurchased: v.number(),
    timesAuctioned: v.number(),
    avgPurchasePrice: v.number(),
    avgAuctionPrice: v.number(),
    totalRentCollected: v.number(),
    avgRentPerGame: v.number(),
    ownerWinRate: v.number(), // % of games where owner won
    updatedAt: v.number(),
  })
    .index("by_property", ["propertyName"])
    .index("by_win_rate", ["ownerWinRate"]),
});

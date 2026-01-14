import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { BOARD } from "./lib/constants";

// ============================================================
// UPDATE STATS AFTER GAME
// ============================================================

/**
 * Update all stats after a game ends.
 * Called from gameEngine when game completes.
 */
export const updateStatsAfterGame = internalMutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "completed") {
      throw new Error("Game not found or not completed");
    }

    // Get all players for this game
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get all decisions for this game
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get all rent payments for this game
    const rentPayments = await ctx.db
      .query("rentPayments")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get all trades for this game
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get all properties for this game
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

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
          (t) => t.proposerId === player._id && t.status === "accepted"
        ).length,
      });
    }

    // Update head-to-head records for each player pair
    if (game.winnerId) {
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const playerA = players[i];
          const playerB = players[j];
          await updateHeadToHead(ctx, {
            playerA,
            playerB,
            winnerId: game.winnerId,
            gameLength: game.currentTurnNumber,
          });
        }
      }
    }

    // Update property stats
    await updatePropertyStats(ctx, {
      gameId: args.gameId,
      properties,
      rentPayments,
      winnerId: game.winnerId,
    });
  },
});

// ============================================================
// MODEL STATS HELPER
// ============================================================

async function updateModelStats(
  ctx: { db: any },
  data: {
    player: Doc<"players">;
    game: Doc<"games">;
    decisions: Doc<"decisions">[];
    rentReceived: number;
    rentPaid: number;
    propertiesOwned: number;
    tradesProposed: number;
    tradesAccepted: number;
  }
) {
  const { player, game, decisions, rentReceived, rentPaid, propertiesOwned } =
    data;

  // Find or create model stats record
  const existing = await ctx.db
    .query("modelStats")
    .withIndex("by_model", (q: any) => q.eq("modelId", player.modelId))
    .first();

  // Determine placement
  const isWinner = game.winnerId === player._id;
  const placement = player.finalPosition || (isWinner ? 1 : 4);

  // Calculate average decision time
  const avgDecisionTime =
    decisions.length > 0
      ? decisions.reduce((sum, d) => sum + d.decisionTimeMs, 0) /
        decisions.length
      : 0;

  if (existing) {
    // Update running averages
    const newGamesPlayed = existing.gamesPlayed + 1;

    await ctx.db.patch(existing._id, {
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
    });
  } else {
    // Create new record
    await ctx.db.insert("modelStats", {
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
        data.tradesProposed > 0
          ? data.tradesAccepted / data.tradesProposed
          : 0,
      avgDecisionTimeMs: avgDecisionTime,
      avgGameLength: game.currentTurnNumber,
      updatedAt: Date.now(),
    });
  }
}

// ============================================================
// HEAD-TO-HEAD HELPER
// ============================================================

async function updateHeadToHead(
  ctx: { db: any },
  data: {
    playerA: Doc<"players">;
    playerB: Doc<"players">;
    winnerId: Id<"players">;
    gameLength: number;
  }
) {
  const { playerA, playerB, winnerId, gameLength } = data;

  // Create alphabetically sorted pair key
  const [firstId, secondId] = [playerA.modelId, playerB.modelId].sort();
  const pairKey = `${firstId}|${secondId}`;

  // Determine which model is A and which is B based on alphabetical order
  const modelAIsFirst = playerA.modelId === firstId;
  const modelA = modelAIsFirst ? playerA : playerB;
  const modelB = modelAIsFirst ? playerB : playerA;

  // Determine winner
  const modelAWon = winnerId === modelA._id;
  const modelBWon = winnerId === modelB._id;

  // Find or create record
  const existing = await ctx.db
    .query("headToHead")
    .withIndex("by_pair", (q: any) => q.eq("pairKey", pairKey))
    .first();

  if (existing) {
    const newTotalGames = existing.totalGames + 1;
    await ctx.db.patch(existing._id, {
      modelAWins: existing.modelAWins + (modelAWon ? 1 : 0),
      modelBWins: existing.modelBWins + (modelBWon ? 1 : 0),
      totalGames: newTotalGames,
      avgGameLength:
        (existing.avgGameLength * existing.totalGames + gameLength) /
        newTotalGames,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("headToHead", {
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
    });
  }
}

// ============================================================
// PROPERTY STATS HELPER
// ============================================================

async function updatePropertyStats(
  ctx: { db: any },
  data: {
    gameId: Id<"games">;
    properties: Doc<"properties">[];
    rentPayments: Doc<"rentPayments">[];
    winnerId?: Id<"players">;
  }
) {
  const { properties, rentPayments, winnerId } = data;

  // Group rent payments by property
  const rentByProperty: Record<string, number> = {};
  for (const rent of rentPayments) {
    rentByProperty[rent.propertyName] =
      (rentByProperty[rent.propertyName] || 0) + rent.amount;
  }

  // Update stats for each property
  for (const property of properties) {
    // Check if owner won (for owner win rate calculation)
    const ownerWon = property.ownerId === winnerId;

    // Find existing stats
    const existing = await ctx.db
      .query("propertyStats")
      .withIndex("by_property", (q: any) => q.eq("propertyName", property.name))
      .first();

    const rentCollectedThisGame = rentByProperty[property.name] || 0;

    if (existing) {
      const newTimesPurchased = existing.timesPurchased + (property.ownerId ? 1 : 0);
      const totalGamesWithOwner = newTimesPurchased;

      await ctx.db.patch(existing._id, {
        timesPurchased: newTimesPurchased,
        totalRentCollected: existing.totalRentCollected + rentCollectedThisGame,
        avgRentPerGame:
          totalGamesWithOwner > 0
            ? (existing.totalRentCollected + rentCollectedThisGame) /
              totalGamesWithOwner
            : 0,
        ownerWinRate:
          totalGamesWithOwner > 0
            ? ((existing.ownerWinRate * existing.timesPurchased) + (ownerWon && property.ownerId ? 1 : 0)) /
              totalGamesWithOwner
            : 0,
        updatedAt: Date.now(),
      });
    } else {
      // Get property info from BOARD
      const boardSpace = BOARD.find((s) => s.name === property.name);
      const group = property.group || "unknown";
      const position = boardSpace?.pos || property.position;

      await ctx.db.insert("propertyStats", {
        propertyName: property.name,
        propertyGroup: group,
        position,
        timesPurchased: property.ownerId ? 1 : 0,
        timesAuctioned: 0,
        avgPurchasePrice: 0,
        avgAuctionPrice: 0,
        totalRentCollected: rentCollectedThisGame,
        avgRentPerGame: rentCollectedThisGame,
        ownerWinRate: ownerWon && property.ownerId ? 1 : 0,
        updatedAt: Date.now(),
      });
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
    const existingModelStats = await ctx.db.query("modelStats").collect();
    for (const stat of existingModelStats) {
      await ctx.db.delete(stat._id);
    }

    const existingH2H = await ctx.db.query("headToHead").collect();
    for (const h2h of existingH2H) {
      await ctx.db.delete(h2h._id);
    }

    const existingPropertyStats = await ctx.db.query("propertyStats").collect();
    for (const ps of existingPropertyStats) {
      await ctx.db.delete(ps._id);
    }

    // Get all completed games
    const games = await ctx.db.query("games").collect();
    const completedGames = games.filter((g) => g.status === "completed");

    // Rebuild stats for each game
    for (const game of completedGames) {
      // Get all players for this game
      const players = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      // Get all decisions for this game
      const decisions = await ctx.db
        .query("decisions")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      // Get all rent payments for this game
      const rentPayments = await ctx.db
        .query("rentPayments")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      // Get all trades for this game
      const trades = await ctx.db
        .query("trades")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      // Get all properties for this game
      const properties = await ctx.db
        .query("properties")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

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
            (t) => t.proposerId === player._id && t.status === "accepted"
          ).length,
        });
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
            });
          }
        }
      }

      // Update property stats
      await updatePropertyStats(ctx, {
        gameId: game._id,
        properties,
        rentPayments,
        winnerId: game.winnerId,
      });
    }

    return {
      gamesProcessed: completedGames.length,
      success: true,
    };
  },
});

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
    const allPlayers = await ctx.db.query("players").collect();
    const modelPlayers = allPlayers.filter((p) => p.modelId === args.modelId);

    if (modelPlayers.length === 0) {
      return null;
    }

    const playerIds = modelPlayers.map((p) => p._id);

    // Get all decisions for these players
    const allDecisions = await ctx.db.query("decisions").collect();
    const modelDecisions = allDecisions.filter((d) =>
      playerIds.includes(d.playerId)
    );

    // Calculate buy rate
    const buyDecisions = modelDecisions.filter(
      (d) => d.decisionType === "buy_property"
    );
    const buyCount = buyDecisions.filter((d) => d.decisionMade === "buy").length;
    const buyRate =
      buyDecisions.length > 0 ? buyCount / buyDecisions.length : 0;

    // Calculate trade frequency
    const actionDecisions = modelDecisions.filter(
      (d) =>
        d.decisionType === "pre_roll_actions" ||
        d.decisionType === "post_roll_actions"
    );
    const tradeProposals = actionDecisions.filter((d) =>
      d.decisionMade.includes("trade")
    ).length;
    const tradeFrequency =
      modelPlayers.length > 0 ? tradeProposals / modelPlayers.length : 0;

    // Calculate build speed
    const buildDecisions = actionDecisions.filter((d) =>
      d.decisionMade.includes("build")
    ).length;
    const buildSpeed =
      actionDecisions.length > 0 ? buildDecisions / actionDecisions.length : 0;

    // Risk tolerance (buy rate as proxy)
    const riskTolerance = buyRate;

    return {
      modelId: args.modelId,
      buyRate: Math.round(buyRate * 100) / 100,
      tradeFrequency: Math.round(tradeFrequency * 100) / 100,
      buildSpeed: Math.round(buildSpeed * 100) / 100,
      riskTolerance: Math.round(riskTolerance * 100) / 100,
      decisionsAnalyzed: modelDecisions.length,
    };
  },
});

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
      .query("propertyStats")
      .withIndex("by_property", (q) => q.eq("propertyName", args.propertyName))
      .first();

    if (existing) {
      const newTimesAuctioned = existing.timesAuctioned + 1;
      const newAvgAuctionPrice =
        (existing.avgAuctionPrice * existing.timesAuctioned +
          args.auctionPrice) /
        newTimesAuctioned;

      await ctx.db.patch(existing._id, {
        timesAuctioned: newTimesAuctioned,
        avgAuctionPrice: newAvgAuctionPrice,
        updatedAt: Date.now(),
      });
    }
  },
});

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
      .query("propertyStats")
      .withIndex("by_property", (q) => q.eq("propertyName", args.propertyName))
      .first();

    if (existing) {
      const newTimesPurchased = existing.timesPurchased + 1;
      const newAvgPurchasePrice =
        (existing.avgPurchasePrice * (existing.timesPurchased - existing.timesAuctioned) +
          args.purchasePrice) /
        (newTimesPurchased - existing.timesAuctioned);

      await ctx.db.patch(existing._id, {
        timesPurchased: newTimesPurchased,
        avgPurchasePrice: newAvgPurchasePrice,
        updatedAt: Date.now(),
      });
    }
  },
});

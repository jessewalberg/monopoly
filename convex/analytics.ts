import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================================
// LEADERBOARD
// ============================================================

/**
 * Get the leaderboard of all models sorted by wins
 */
export const getLeaderboard = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal("wins"),
        v.literal("winRate"),
        v.literal("gamesPlayed"),
        v.literal("avgNetWorth")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const modelStats = await ctx.db.query("modelStats").collect();

    // Calculate win rate for each model
    const leaderboard = modelStats.map((stat) => ({
      ...stat,
      winRate: stat.gamesPlayed > 0 ? stat.wins / stat.gamesPlayed : 0,
    }));

    // Sort based on criteria
    const sortBy = args.sortBy || "wins";
    leaderboard.sort((a, b) => {
      switch (sortBy) {
        case "winRate":
          return b.winRate - a.winRate;
        case "gamesPlayed":
          return b.gamesPlayed - a.gamesPlayed;
        case "avgNetWorth":
          return b.avgFinalNetWorth - a.avgFinalNetWorth;
        case "wins":
        default:
          return b.wins - a.wins;
      }
    });

    // Apply limit
    if (args.limit) {
      return leaderboard.slice(0, args.limit);
    }

    return leaderboard;
  },
});

// ============================================================
// HEAD-TO-HEAD
// ============================================================

/**
 * Get the head-to-head matrix for all models
 */
export const getHeadToHeadMatrix = query({
  args: {},
  handler: async (ctx) => {
    const headToHead = await ctx.db.query("headToHead").collect();

    // Build a map for easy lookup
    const matrix: Record<
      string,
      Record<
        string,
        { wins: number; losses: number; totalGames: number }
      >
    > = {};

    for (const h2h of headToHead) {
      // Initialize if needed
      if (!matrix[h2h.modelAId]) {
        matrix[h2h.modelAId] = {};
      }
      if (!matrix[h2h.modelBId]) {
        matrix[h2h.modelBId] = {};
      }

      // Model A's record against Model B
      matrix[h2h.modelAId][h2h.modelBId] = {
        wins: h2h.modelAWins,
        losses: h2h.modelBWins,
        totalGames: h2h.totalGames,
      };

      // Model B's record against Model A (inverse)
      matrix[h2h.modelBId][h2h.modelAId] = {
        wins: h2h.modelBWins,
        losses: h2h.modelAWins,
        totalGames: h2h.totalGames,
      };
    }

    // Get all model IDs and display names
    const modelStats = await ctx.db.query("modelStats").collect();
    const modelDisplayNames: Record<string, string> = {};
    for (const stat of modelStats) {
      modelDisplayNames[stat.modelId] = stat.modelDisplayName;
    }

    return {
      matrix,
      modelDisplayNames,
      models: Object.keys(matrix),
    };
  },
});

/**
 * Get head-to-head record between two specific models
 */
export const getHeadToHead = query({
  args: {
    modelAId: v.string(),
    modelBId: v.string(),
  },
  handler: async (ctx, args) => {
    // Create alphabetically sorted pair key
    const [first, second] = [args.modelAId, args.modelBId].sort();
    const pairKey = `${first}|${second}`;

    const h2h = await ctx.db
      .query("headToHead")
      .withIndex("by_pair", (q) => q.eq("pairKey", pairKey))
      .first();

    if (!h2h) {
      return {
        totalGames: 0,
        modelAWins: 0,
        modelBWins: 0,
        modelAId: args.modelAId,
        modelBId: args.modelBId,
      };
    }

    // Return with correct orientation based on input order
    if (h2h.modelAId === args.modelAId) {
      return {
        totalGames: h2h.totalGames,
        modelAWins: h2h.modelAWins,
        modelBWins: h2h.modelBWins,
        modelAId: h2h.modelAId,
        modelADisplayName: h2h.modelADisplayName,
        modelBId: h2h.modelBId,
        modelBDisplayName: h2h.modelBDisplayName,
        avgGameLength: h2h.avgGameLength,
      };
    } else {
      // Swap A and B to match input order
      return {
        totalGames: h2h.totalGames,
        modelAWins: h2h.modelBWins,
        modelBWins: h2h.modelAWins,
        modelAId: args.modelAId,
        modelADisplayName: h2h.modelBDisplayName,
        modelBId: args.modelBId,
        modelBDisplayName: h2h.modelADisplayName,
        avgGameLength: h2h.avgGameLength,
      };
    }
  },
});

// ============================================================
// MODEL DETAILS
// ============================================================

/**
 * Get detailed stats for a specific model
 */
export const getModelDetail = query({
  args: {
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get model stats
    const modelStats = await ctx.db
      .query("modelStats")
      .withIndex("by_model", (q) => q.eq("modelId", args.modelId))
      .first();

    if (!modelStats) {
      return null;
    }

    // Get recent games where this model played
    const allPlayers = await ctx.db.query("players").collect();

    // Get unique game IDs
    const gameIds = new Set<Id<"games">>();
    for (const player of allPlayers.filter(
      (p) => p.modelId === args.modelId
    )) {
      gameIds.add(player.gameId);
    }

    // Fetch recent games
    const recentGames: Array<{
      gameId: Id<"games">;
      status: string;
      turnNumber: number;
      won: boolean;
      finalPosition?: number;
      finalNetWorth?: number;
    }> = [];

    for (const gameId of Array.from(gameIds).slice(0, 10)) {
      const game = await ctx.db.get(gameId);
      if (game && game.status === "completed") {
        const player = allPlayers.find(
          (p) => p.gameId === gameId && p.modelId === args.modelId
        );
        if (player) {
          recentGames.push({
            gameId,
            status: game.status,
            turnNumber: game.currentTurnNumber,
            won: game.winnerId === player._id,
            finalPosition: player.finalPosition,
            finalNetWorth: player.finalNetWorth,
          });
        }
      }
    }

    // Calculate trends from last 10 games
    const last10 = recentGames.slice(0, 10);
    const winTrend =
      last10.length > 0
        ? last10.filter((g) => g.won).length / last10.length
        : 0;

    return {
      stats: modelStats,
      recentGames,
      trends: {
        recentWinRate: winTrend,
        gamesAnalyzed: last10.length,
      },
    };
  },
});

// ============================================================
// PROPERTY STATS
// ============================================================

/**
 * Get property statistics
 */
export const getPropertyStats = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal("ownerWinRate"),
        v.literal("timesPurchased"),
        v.literal("avgRentPerGame"),
        v.literal("position")
      )
    ),
  },
  handler: async (ctx, args) => {
    const propertyStats = await ctx.db.query("propertyStats").collect();

    const sortBy = args.sortBy || "ownerWinRate";

    propertyStats.sort((a, b) => {
      switch (sortBy) {
        case "timesPurchased":
          return b.timesPurchased - a.timesPurchased;
        case "avgRentPerGame":
          return b.avgRentPerGame - a.avgRentPerGame;
        case "position":
          return a.position - b.position;
        case "ownerWinRate":
        default:
          return b.ownerWinRate - a.ownerWinRate;
      }
    });

    return propertyStats;
  },
});

/**
 * Get stats for a specific property group
 */
export const getPropertyGroupStats = query({
  args: {
    group: v.string(),
  },
  handler: async (ctx, args) => {
    const propertyStats = await ctx.db.query("propertyStats").collect();

    const groupStats = propertyStats.filter(
      (p) => p.propertyGroup === args.group
    );

    // Calculate aggregates
    const totalPurchases = groupStats.reduce(
      (sum, p) => sum + p.timesPurchased,
      0
    );
    const avgWinRate =
      groupStats.length > 0
        ? groupStats.reduce((sum, p) => sum + p.ownerWinRate, 0) /
          groupStats.length
        : 0;
    const totalRentCollected = groupStats.reduce(
      (sum, p) => sum + p.totalRentCollected,
      0
    );

    return {
      properties: groupStats,
      aggregates: {
        totalPurchases,
        avgWinRate,
        totalRentCollected,
      },
    };
  },
});

// ============================================================
// RECENT GAMES
// ============================================================

/**
 * Get recent completed games with winner info
 */
export const getRecentGames = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    const games = await ctx.db
      .query("games")
      .order("desc")
      .collect();

    const completedGames = games
      .filter((g) => g.status === "completed")
      .slice(0, limit);

    // Enrich with winner info
    const enrichedGames = await Promise.all(
      completedGames.map(async (game) => {
        let winner: Doc<"players"> | null = null;
        if (game.winnerId) {
          winner = await ctx.db.get(game.winnerId);
        }

        // Get all players for this game
        const players = await ctx.db
          .query("players")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();

        return {
          ...game,
          winner: winner
            ? {
                _id: winner._id,
                modelId: winner.modelId,
                modelDisplayName: winner.modelDisplayName,
                modelProvider: winner.modelProvider,
                finalNetWorth: winner.finalNetWorth,
              }
            : null,
          playerCount: players.length,
          players: players.map((p) => ({
            modelDisplayName: p.modelDisplayName,
            finalPosition: p.finalPosition,
            isBankrupt: p.isBankrupt,
          })),
        };
      })
    );

    return enrichedGames;
  },
});

// ============================================================
// GLOBAL STATS
// ============================================================

/**
 * Get global statistics across all games
 */
export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    // Get all games
    const games = await ctx.db.query("games").collect();
    const completedGames = games.filter((g) => g.status === "completed");
    const inProgressGames = games.filter((g) => g.status === "in_progress");

    // Get all decisions for total count
    const decisions = await ctx.db.query("decisions").collect();

    // Calculate average game length
    const avgGameLength =
      completedGames.length > 0
        ? completedGames.reduce((sum, g) => sum + g.currentTurnNumber, 0) /
          completedGames.length
        : 0;

    // Calculate average game duration
    const gamesWithDuration = completedGames.filter(
      (g) => g.startedAt && g.endedAt
    );
    const avgDurationMs =
      gamesWithDuration.length > 0
        ? gamesWithDuration.reduce(
            (sum, g) => sum + ((g.endedAt || 0) - (g.startedAt || 0)),
            0
          ) / gamesWithDuration.length
        : 0;

    // Find most common winning model
    const modelStats = await ctx.db.query("modelStats").collect();
    const mostWins = modelStats.reduce(
      (max, stat) => (stat.wins > max.wins ? stat : max),
      { wins: 0, modelDisplayName: "None", modelId: "" }
    );

    // Get total rent payments
    const rentPayments = await ctx.db.query("rentPayments").collect();
    const totalRentPaid = rentPayments.reduce((sum, r) => sum + r.amount, 0);

    // Get total trades
    const trades = await ctx.db.query("trades").collect();
    const completedTrades = trades.filter((t) => t.status === "accepted");

    return {
      totalGames: games.length,
      completedGames: completedGames.length,
      inProgressGames: inProgressGames.length,
      totalDecisions: decisions.length,
      totalTrades: trades.length,
      acceptedTrades: completedTrades.length,
      totalRentPaid,
      avgGameLength: Math.round(avgGameLength),
      avgDurationMs: Math.round(avgDurationMs),
      totalModelsPlayed: modelStats.length,
      mostWinningModel: mostWins.wins > 0
        ? {
            modelId: mostWins.modelId,
            modelDisplayName: mostWins.modelDisplayName,
            wins: mostWins.wins,
          }
        : null,
    };
  },
});

// ============================================================
// STRATEGY PROFILES
// ============================================================

/**
 * Calculate strategy profile for a model based on their decisions
 */
export const getStrategyProfile = query({
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

    if (modelDecisions.length === 0) {
      return {
        modelId: args.modelId,
        buyRate: 0,
        tradeFrequency: 0,
        buildSpeed: 0,
        riskTolerance: 0.5,
        jailStrategy: "unknown",
        decisionsAnalyzed: 0,
      };
    }

    // Calculate buy rate (purchases / opportunities)
    const buyDecisions = modelDecisions.filter(
      (d) => d.decisionType === "buy_property"
    );
    const buyCount = buyDecisions.filter((d) => d.decisionMade === "buy").length;
    const buyRate =
      buyDecisions.length > 0 ? buyCount / buyDecisions.length : 0;

    // Calculate trade frequency (trades proposed / games played)
    const tradeDecisions = modelDecisions.filter(
      (d) =>
        d.decisionType === "pre_roll_actions" ||
        d.decisionType === "post_roll_actions"
    );
    const tradeProposals = tradeDecisions.filter((d) =>
      d.decisionMade.includes("trade")
    ).length;
    const gamesPlayed = modelPlayers.length;
    const tradeFrequency = gamesPlayed > 0 ? tradeProposals / gamesPlayed : 0;

    // Calculate build speed (build decisions / turns with opportunity)
    const buildDecisions = tradeDecisions.filter((d) =>
      d.decisionMade.includes("build")
    ).length;
    const buildOpportunities = tradeDecisions.length;
    const buildSpeed =
      buildOpportunities > 0 ? buildDecisions / buildOpportunities : 0;

    // Calculate risk tolerance based on cash reserves
    // Higher values mean more willing to spend down to low cash
    // This is approximated from buy decisions vs available cash
    let riskTolerance = 0.5; // Default medium risk
    if (buyDecisions.length > 0) {
      // If they buy a lot when they can, they're more aggressive
      riskTolerance = buyRate;
    }

    // Determine jail strategy preference
    const jailDecisions = modelDecisions.filter(
      (d) => d.decisionType === "jail_strategy"
    );
    let jailStrategy = "unknown";
    if (jailDecisions.length > 0) {
      const payCount = jailDecisions.filter((d) =>
        d.decisionMade === "pay"
      ).length;
      const rollCount = jailDecisions.filter((d) =>
        d.decisionMade === "roll"
      ).length;
      const cardCount = jailDecisions.filter((d) =>
        d.decisionMade === "use_card"
      ).length;

      if (payCount >= rollCount && payCount >= cardCount) {
        jailStrategy = "pay";
      } else if (rollCount >= cardCount) {
        jailStrategy = "roll";
      } else {
        jailStrategy = "use_card";
      }
    }

    return {
      modelId: args.modelId,
      buyRate: Math.round(buyRate * 100) / 100,
      tradeFrequency: Math.round(tradeFrequency * 100) / 100,
      buildSpeed: Math.round(buildSpeed * 100) / 100,
      riskTolerance: Math.round(riskTolerance * 100) / 100,
      jailStrategy,
      decisionsAnalyzed: modelDecisions.length,
    };
  },
});

/**
 * Get strategy profiles for multiple models (for comparison)
 */
export const getStrategyProfiles = query({
  args: {
    modelIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all players
    const allPlayers = await ctx.db.query("players").collect();

    // Get all decisions
    const allDecisions = await ctx.db.query("decisions").collect();

    const profiles: Array<{
      modelId: string;
      modelDisplayName: string;
      buyRate: number;
      tradeFrequency: number;
      buildSpeed: number;
      riskTolerance: number;
      jailStrategy: string;
    }> = [];

    for (const modelId of args.modelIds) {
      const modelPlayers = allPlayers.filter((p) => p.modelId === modelId);
      if (modelPlayers.length === 0) continue;

      const playerIds = modelPlayers.map((p) => p._id);
      const modelDecisions = allDecisions.filter((d) =>
        playerIds.includes(d.playerId)
      );

      // Calculate metrics (same logic as getStrategyProfile)
      const buyDecisions = modelDecisions.filter(
        (d) => d.decisionType === "buy_property"
      );
      const buyCount = buyDecisions.filter((d) => d.decisionMade === "buy").length;
      const buyRate = buyDecisions.length > 0 ? buyCount / buyDecisions.length : 0;

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

      const buildDecisions = actionDecisions.filter((d) =>
        d.decisionMade.includes("build")
      ).length;
      const buildSpeed =
        actionDecisions.length > 0 ? buildDecisions / actionDecisions.length : 0;

      const jailDecisions = modelDecisions.filter(
        (d) => d.decisionType === "jail_strategy"
      );
      let jailStrategy = "unknown";
      if (jailDecisions.length > 0) {
        const payCount = jailDecisions.filter((d) => d.decisionMade === "pay").length;
        const rollCount = jailDecisions.filter((d) => d.decisionMade === "roll").length;
        if (payCount >= rollCount) {
          jailStrategy = "pay";
        } else {
          jailStrategy = "roll";
        }
      }

      profiles.push({
        modelId,
        modelDisplayName: modelPlayers[0].modelDisplayName,
        buyRate: Math.round(buyRate * 100) / 100,
        tradeFrequency: Math.round(tradeFrequency * 100) / 100,
        buildSpeed: Math.round(buildSpeed * 100) / 100,
        riskTolerance: Math.round(buyRate * 100) / 100, // Use buy rate as proxy
        jailStrategy,
      });
    }

    return profiles;
  },
});

// ============================================================
// WIN RATE TRENDS
// ============================================================

/**
 * Get win rate data over time for charts
 */
export const getWinRateTrends = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get completed games in chronological order
    const games = await ctx.db
      .query("games")
      .order("asc")
      .collect();

    const completedGames = games
      .filter((g) => g.status === "completed" && g.winnerId)
      .slice(-limit);

    // Track cumulative wins by model
    const cumulativeWins: Record<
      string,
      Array<{ gameNumber: number; cumulativeWins: number; modelName: string }>
    > = {};

    let gameNumber = 1;
    for (const game of completedGames) {
      if (game.winnerId) {
        const winner = await ctx.db.get(game.winnerId);
        if (winner) {
          const modelId = winner.modelId;
          if (!cumulativeWins[modelId]) {
            cumulativeWins[modelId] = [];
          }

          const prevWins =
            cumulativeWins[modelId].length > 0
              ? cumulativeWins[modelId][cumulativeWins[modelId].length - 1]
                  .cumulativeWins
              : 0;

          cumulativeWins[modelId].push({
            gameNumber,
            cumulativeWins: prevWins + 1,
            modelName: winner.modelDisplayName,
          });
        }
      }
      gameNumber++;
    }

    return {
      trends: cumulativeWins,
      totalGames: completedGames.length,
    };
  },
});

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Decision type validator
const decisionTypeValidator = v.union(
  v.literal("buy_property"),
  v.literal("auction_bid"),
  v.literal("jail_strategy"),
  v.literal("pre_roll_actions"),
  v.literal("post_roll_actions"),
  v.literal("trade_response"),
  v.literal("bankruptcy_resolution")
);

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all decisions for a game
 */
export const getByGame = query({
  args: {
    gameId: v.id("games"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let decisionsQuery = ctx.db
      .query("decisions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc");

    if (args.limit) {
      return await decisionsQuery.take(args.limit);
    }

    return await decisionsQuery.collect();
  },
});

/**
 * Get all decisions for a player
 */
export const getByPlayer = query({
  args: {
    playerId: v.id("players"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let decisionsQuery = ctx.db
      .query("decisions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .order("desc");

    if (args.limit) {
      return await decisionsQuery.take(args.limit);
    }

    return await decisionsQuery.collect();
  },
});

/**
 * Get decisions by type (for analytics)
 */
export const getByType = query({
  args: {
    decisionType: decisionTypeValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let decisionsQuery = ctx.db
      .query("decisions")
      .withIndex("by_type", (q) => q.eq("decisionType", args.decisionType))
      .order("desc");

    if (args.limit) {
      return await decisionsQuery.take(args.limit);
    }

    return await decisionsQuery.collect();
  },
});

/**
 * Get a single decision by ID
 */
export const get = query({
  args: {
    decisionId: v.id("decisions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.decisionId);
  },
});

/**
 * Get decisions for a specific turn
 */
export const getByTurn = query({
  args: {
    turnId: v.id("turns"),
  },
  handler: async (ctx, args) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_game")
      .collect();

    return decisions.filter((d) => d.turnId === args.turnId);
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Log a decision made by an LLM
 */
export const create = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    turnNumber: v.number(),
    decisionType: decisionTypeValidator,
    context: v.string(), // JSON string with game state context
    optionsAvailable: v.array(v.string()),
    decisionMade: v.string(),
    parameters: v.optional(v.string()), // JSON string for decision-specific params
    reasoning: v.string(),
    rawResponse: v.optional(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    decisionTimeMs: v.number(),
  },
  handler: async (ctx, args) => {
    const decisionId = await ctx.db.insert("decisions", {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      turnNumber: args.turnNumber,
      decisionType: args.decisionType,
      context: args.context,
      optionsAvailable: args.optionsAvailable,
      decisionMade: args.decisionMade,
      parameters: args.parameters,
      reasoning: args.reasoning,
      rawResponse: args.rawResponse,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      decisionTimeMs: args.decisionTimeMs,
    });

    return decisionId;
  },
});

// ============================================================
// ANALYTICS HELPERS
// ============================================================

/**
 * Get decision stats for a player
 */
export const getPlayerStats = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .collect();

    // Aggregate stats
    const stats = {
      totalDecisions: decisions.length,
      byType: {} as Record<string, number>,
      avgDecisionTimeMs: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    };

    let totalTime = 0;

    for (const decision of decisions) {
      // Count by type
      stats.byType[decision.decisionType] =
        (stats.byType[decision.decisionType] || 0) + 1;

      // Sum up metrics
      totalTime += decision.decisionTimeMs;
      stats.totalPromptTokens += decision.promptTokens;
      stats.totalCompletionTokens += decision.completionTokens;
    }

    stats.avgDecisionTimeMs =
      decisions.length > 0 ? totalTime / decisions.length : 0;

    return stats;
  },
});

/**
 * Get buy decision patterns (for property analytics)
 */
export const getBuyDecisionStats = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let decisionsQuery = ctx.db
      .query("decisions")
      .withIndex("by_type", (q) => q.eq("decisionType", "buy_property"))
      .order("desc");

    const decisions = args.limit
      ? await decisionsQuery.take(args.limit)
      : await decisionsQuery.collect();

    // Count buy vs auction decisions
    const buyCount = decisions.filter((d) => d.decisionMade === "buy").length;
    const auctionCount = decisions.filter(
      (d) => d.decisionMade === "auction"
    ).length;

    return {
      total: decisions.length,
      bought: buyCount,
      auctioned: auctionCount,
      buyRate: decisions.length > 0 ? buyCount / decisions.length : 0,
    };
  },
});

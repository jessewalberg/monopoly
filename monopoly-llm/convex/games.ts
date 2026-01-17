import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// ============================================================
// QUERIES
// ============================================================

/**
 * List games with optional filtering by status
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("setup"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("abandoned")
      )
    ),
  },
  handler: async (ctx, args) => {
    let gamesQuery = ctx.db.query("games").order("desc");

    const games = await gamesQuery.collect();

    // Filter by status if provided
    let filtered = games;
    if (args.status) {
      filtered = games.filter((g) => g.status === args.status);
    }

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

/**
 * Get a single game by ID
 */
export const get = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

/**
 * Get full game state including players, properties, and recent turns
 */
export const getFullState = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    // Get all players for this game
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Sort by turn order
    players.sort((a, b) => a.turnOrder - b.turnOrder);

    // Get all properties for this game
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get recent turns (last 10)
    const turns = await ctx.db
      .query("turns")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(10);

    // Get current turn if exists
    const currentTurn = turns.length > 0 ? turns[0] : null;

    return {
      game,
      players,
      properties,
      recentTurns: turns,
      currentTurn,
    };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new game in "setup" status
 */
export const create = internalMutation({
  args: {
    config: v.object({
      turnLimit: v.optional(v.number()),
      speedMs: v.number(),
      startingMoney: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const gameId = await ctx.db.insert("games", {
      status: "setup",
      currentPlayerIndex: 0,
      currentTurnNumber: 0,
      currentPhase: "pre_roll",
      config: args.config,
      createdAt: Date.now(),
    });

    return gameId;
  },
});

/**
 * Update game status
 */
export const updateStatus = internalMutation({
  args: {
    gameId: v.id("games"),
    status: v.union(
      v.literal("setup"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    // Set timestamps based on status
    if (args.status === "in_progress") {
      updates.startedAt = Date.now();
    } else if (args.status === "completed" || args.status === "abandoned") {
      updates.endedAt = Date.now();
    }

    await ctx.db.patch(args.gameId, updates);
  },
});

/**
 * Set the winner of a game
 */
export const setWinner = internalMutation({
  args: {
    gameId: v.id("games"),
    winnerId: v.id("players"),
    endingReason: v.union(
      v.literal("last_player_standing"),
      v.literal("turn_limit_reached"),
      v.literal("manual_stop"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      status: "completed",
      winnerId: args.winnerId,
      endingReason: args.endingReason,
      endedAt: Date.now(),
      currentPhase: "game_over",
    });
  },
});

/**
 * Update the current game phase
 */
export const updatePhase = internalMutation({
  args: {
    gameId: v.id("games"),
    phase: v.union(
      v.literal("pre_roll"),
      v.literal("rolling"),
      v.literal("post_roll"),
      v.literal("turn_end"),
      v.literal("game_over")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      currentPhase: args.phase,
    });
  },
});

/**
 * Advance to the next player's turn
 */
export const advanceTurn = internalMutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    // Get active (non-bankrupt) players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const activePlayers = players
      .filter((p) => !p.isBankrupt)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    if (activePlayers.length === 0) {
      throw new Error("No active players");
    }

    // Find next player index
    const currentIndex = game.currentPlayerIndex;
    let nextIndex = (currentIndex + 1) % activePlayers.length;

    await ctx.db.patch(args.gameId, {
      currentPlayerIndex: nextIndex,
      currentTurnNumber: game.currentTurnNumber + 1,
      currentPhase: "pre_roll",
    });

    return {
      nextPlayerIndex: nextIndex,
      nextPlayerId: activePlayers[nextIndex]._id,
      turnNumber: game.currentTurnNumber + 1,
    };
  },
});

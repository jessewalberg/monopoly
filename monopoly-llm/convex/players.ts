import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all players for a game
 */
export const getByGame = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Sort by turn order
    return players.sort((a, b) => a.turnOrder - b.turnOrder);
  },
});

/**
 * Get a single player by ID
 */
export const get = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId);
  },
});

/**
 * Get the current player for a game
 */
export const getCurrent = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const activePlayers = players
      .filter((p) => !p.isBankrupt)
      .sort((a, b) => a.turnOrder - b.turnOrder);

    if (activePlayers.length === 0) return null;

    return activePlayers[game.currentPlayerIndex] || activePlayers[0];
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new player for a game
 */
export const create = mutation({
  args: {
    gameId: v.id("games"),
    modelId: v.string(),
    modelDisplayName: v.string(),
    modelProvider: v.string(),
    tokenColor: v.string(),
    turnOrder: v.number(),
  },
  handler: async (ctx, args) => {
    // Get game to check starting money
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    const playerId = await ctx.db.insert("players", {
      gameId: args.gameId,
      modelId: args.modelId,
      modelDisplayName: args.modelDisplayName,
      modelProvider: args.modelProvider,
      tokenColor: args.tokenColor,
      turnOrder: args.turnOrder,
      // Initial state
      cash: game.config.startingMoney,
      position: 0, // Start on GO
      inJail: false,
      jailTurnsRemaining: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
      consecutiveDoubles: 0,
    });

    return playerId;
  },
});

/**
 * Update player's cash (add or subtract)
 */
export const updateCash = mutation({
  args: {
    playerId: v.id("players"),
    amount: v.number(), // Positive to add, negative to subtract
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const newCash = player.cash + args.amount;
    await ctx.db.patch(args.playerId, { cash: newCash });

    return newCash;
  },
});

/**
 * Set player's cash to a specific amount
 */
export const setCash = mutation({
  args: {
    playerId: v.id("players"),
    cash: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, { cash: args.cash });
  },
});

/**
 * Update player's position on the board
 */
export const updatePosition = mutation({
  args: {
    playerId: v.id("players"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    // Normalize position to 0-39
    const normalizedPosition = ((args.position % 40) + 40) % 40;
    await ctx.db.patch(args.playerId, { position: normalizedPosition });
  },
});

/**
 * Set player's jail status
 */
export const setJailStatus = mutation({
  args: {
    playerId: v.id("players"),
    inJail: v.boolean(),
    turnsRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      inJail: args.inJail,
      jailTurnsRemaining: args.turnsRemaining,
    });
  },
});

/**
 * Mark a player as bankrupt
 */
export const setBankrupt = mutation({
  args: {
    playerId: v.id("players"),
    turn: v.number(),
    finalPosition: v.number(), // 2nd, 3rd, 4th place
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(args.playerId, {
      isBankrupt: true,
      bankruptcyTurn: args.turn,
      finalPosition: args.finalPosition,
      finalNetWorth: 0,
    });
  },
});

/**
 * Update consecutive doubles count
 */
export const updateDoubles = mutation({
  args: {
    playerId: v.id("players"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      consecutiveDoubles: args.count,
    });
  },
});

/**
 * Add a Get Out of Jail Free card
 */
export const addJailCard = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(args.playerId, {
      getOutOfJailCards: player.getOutOfJailCards + 1,
    });
  },
});

/**
 * Use a Get Out of Jail Free card
 */
export const useJailCard = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.getOutOfJailCards === 0) {
      throw new Error("No Get Out of Jail Free cards");
    }

    await ctx.db.patch(args.playerId, {
      getOutOfJailCards: player.getOutOfJailCards - 1,
      inJail: false,
      jailTurnsRemaining: 0,
    });
  },
});

/**
 * Set final stats when game ends
 */
export const setFinalStats = mutation({
  args: {
    playerId: v.id("players"),
    finalPosition: v.number(),
    finalNetWorth: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      finalPosition: args.finalPosition,
      finalNetWorth: args.finalNetWorth,
    });
  },
});

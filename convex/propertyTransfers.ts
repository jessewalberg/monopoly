import { v } from "convex/values";
import { query } from "./_generated/server";

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all property transfers for a game
 */
export const getByGame = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("propertyTransfers")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .collect();
  },
});

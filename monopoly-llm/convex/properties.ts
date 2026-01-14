import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { BOARD } from "./lib/constants";

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all properties for a game
 */
export const getByGame = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

/**
 * Get all properties owned by a player
 */
export const getByOwner = query({
  args: {
    ownerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("properties")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

/**
 * Get a single property by ID
 */
export const get = query({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.propertyId);
  },
});

/**
 * Get property at a specific board position for a game
 */
export const getByPosition = query({
  args: {
    gameId: v.id("games"),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    return properties.find((p) => p.position === args.position) || null;
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Initialize all 28 purchasable properties for a new game
 */
export const initializeForGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const propertyIds: string[] = [];

    for (const space of BOARD) {
      // Only create entries for purchasable spaces
      if (
        space.type === "property" ||
        space.type === "railroad" ||
        space.type === "utility"
      ) {
        const group =
          space.type === "property"
            ? space.group
            : space.type === "railroad"
              ? "railroad"
              : "utility";

        const propertyId = await ctx.db.insert("properties", {
          gameId: args.gameId,
          position: space.pos,
          name: space.name,
          group,
          ownerId: undefined,
          houses: 0,
          isMortgaged: false,
        });

        propertyIds.push(propertyId);
      }
    }

    return propertyIds;
  },
});

/**
 * Set the owner of a property (null to return to bank)
 */
export const setOwner = mutation({
  args: {
    propertyId: v.id("properties"),
    ownerId: v.optional(v.id("players")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.propertyId, {
      ownerId: args.ownerId,
    });
  },
});

/**
 * Add a house to a property (max 5 = hotel)
 */
export const addHouse = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.houses >= 5) throw new Error("Property already has hotel");

    await ctx.db.patch(args.propertyId, {
      houses: property.houses + 1,
    });

    return property.houses + 1;
  },
});

/**
 * Remove a house from a property
 */
export const removeHouse = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.houses === 0) throw new Error("Property has no houses");

    await ctx.db.patch(args.propertyId, {
      houses: property.houses - 1,
    });

    return property.houses - 1;
  },
});

/**
 * Set multiple houses at once (for building/selling multiple)
 */
export const setHouses = mutation({
  args: {
    propertyId: v.id("properties"),
    houses: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.houses < 0 || args.houses > 5) {
      throw new Error("Houses must be between 0 and 5");
    }

    await ctx.db.patch(args.propertyId, {
      houses: args.houses,
    });
  },
});

/**
 * Set mortgage status of a property
 */
export const setMortgaged = mutation({
  args: {
    propertyId: v.id("properties"),
    mortgaged: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.propertyId, {
      isMortgaged: args.mortgaged,
    });
  },
});

/**
 * Transfer property ownership (for trades or bankruptcy)
 */
export const transfer = mutation({
  args: {
    propertyId: v.id("properties"),
    fromPlayerId: v.optional(v.id("players")),
    toPlayerId: v.optional(v.id("players")),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    // Verify current owner matches
    if (args.fromPlayerId && property.ownerId !== args.fromPlayerId) {
      throw new Error("Property not owned by specified player");
    }

    await ctx.db.patch(args.propertyId, {
      ownerId: args.toPlayerId,
    });
  },
});

/**
 * Transfer all properties from one player to another (bankruptcy)
 */
export const transferAll = mutation({
  args: {
    fromPlayerId: v.id("players"),
    toPlayerId: v.optional(v.id("players")), // undefined = return to bank
  },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.fromPlayerId))
      .collect();

    for (const property of properties) {
      await ctx.db.patch(property._id, {
        ownerId: args.toPlayerId,
        // If going to bank, unmortgage and remove houses
        ...(args.toPlayerId === undefined
          ? { isMortgaged: false, houses: 0 }
          : {}),
      });
    }

    return properties.length;
  },
});

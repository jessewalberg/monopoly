import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getSpace } from "./lib/board";
import { JAIL_FINE } from "./lib/constants";

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
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return;

    await ctx.db.patch(args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
    });

    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

/**
 * Execute a buy property decision
 */
export const executeBuyPropertyDecision = internalMutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    action: v.string(),
    propertyPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    const player = await ctx.db.get(args.playerId);
    const property = await ctx.db
      .query("properties")
      .withIndex("by_game")
      .filter((q) =>
        q.and(
          q.eq(q.field("gameId"), args.gameId),
          q.eq(q.field("position"), args.propertyPosition)
        )
      )
      .first();

    if (!game || !player || !property) return;

    const space = getSpace(args.propertyPosition);
    const cost = (space as any).cost || 0;

    // Add turn event helper
    const addEvent = async (event: string) => {
      const turn = await ctx.db.get(args.turnId);
      if (turn) {
        await ctx.db.patch(args.turnId, {
          events: [...turn.events, event],
        });
      }
    };

    if (args.action === "buy" && player.cash >= cost) {
      // Execute purchase
      await ctx.db.patch(property._id, { ownerId: args.playerId });
      await ctx.db.patch(args.playerId, { cash: player.cash - cost });
      await addEvent(`Decided to buy ${space.name} for $${cost}`);
    } else {
      // Go to auction
      await addEvent(`Declined to buy ${space.name} - going to auction`);

      // Run automated auction (will be enhanced with LLM bids later)
      const allPlayers = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
        .collect();

      const activePlayers = allPlayers.filter((p) => !p.isBankrupt);

      // Simple auction: each player bids up to 50% of cash
      let highestBid = 0;
      let winnerId: Id<"players"> | null = null;

      for (const p of activePlayers) {
        const maxBid = Math.floor(p.cash * 0.5);
        const bid = maxBid >= 1 ? Math.min(maxBid, cost - 1) : 0;
        if (bid > highestBid && bid <= p.cash) {
          highestBid = bid;
          winnerId = p._id;
        }
      }

      if (winnerId && highestBid > 0) {
        const winner = await ctx.db.get(winnerId);
        if (winner) {
          await ctx.db.patch(property._id, { ownerId: winnerId });
          await ctx.db.patch(winnerId, { cash: winner.cash - highestBid });
          await addEvent(`Auction: ${winner.modelDisplayName} won ${space.name} for $${highestBid}`);
        }
      } else {
        await addEvent(`Auction: No valid bids for ${space.name}`);
      }
    }

    // Clear waiting state and continue game
    // After buy decision, check for doubles to see if we roll again or end turn
    const turn = await ctx.db.get(args.turnId);
    const wasDoubles = turn?.wasDoubles;
    const playerData = await ctx.db.get(args.playerId);

    if (wasDoubles && !playerData?.inJail) {
      await ctx.db.patch(args.gameId, {
        waitingForLLM: false,
        pendingDecision: undefined,
        currentPhase: "rolling",
      });
    } else {
      await ctx.db.patch(args.gameId, {
        waitingForLLM: false,
        pendingDecision: undefined,
        currentPhase: "turn_end",
      });
    }

    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

/**
 * Execute a jail strategy decision
 */
export const executeJailDecision = internalMutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    const player = await ctx.db.get(args.playerId);
    if (!game || !player) return;

    const addEvent = async (event: string) => {
      const turn = await ctx.db.get(args.turnId);
      if (turn) {
        await ctx.db.patch(args.turnId, {
          events: [...turn.events, event],
        });
      }
    };

    if (args.action === "pay" && player.cash >= JAIL_FINE) {
      // Pay fine to get out
      await ctx.db.patch(args.playerId, {
        cash: player.cash - JAIL_FINE,
        inJail: false,
        jailTurnsRemaining: 0,
      });
      await addEvent(`Paid $${JAIL_FINE} to get out of jail`);
    } else if (args.action === "use_card" && player.getOutOfJailCards > 0) {
      // Use get out of jail card
      await ctx.db.patch(args.playerId, {
        getOutOfJailCards: player.getOutOfJailCards - 1,
        inJail: false,
        jailTurnsRemaining: 0,
      });
      await addEvent("Used Get Out of Jail Free card");
    } else {
      // Roll for doubles (default)
      await addEvent("Choosing to roll for doubles");
    }

    // Clear waiting state and continue to rolling phase
    await ctx.db.patch(args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: "rolling",
    });

    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

/**
 * Execute an auction bid decision
 */
export const executeAuctionBidDecision = internalMutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    propertyId: v.id("properties"),
    bidAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // This would be part of a more complex auction system
    // For now, just record the bid
    const player = await ctx.db.get(args.playerId);
    if (!player) return;

    // Validate bid
    const validBid = Math.min(args.bidAmount, player.cash);

    // Store bid for auction resolution
    // (In a full implementation, we'd track all bids and resolve)
    console.log(`Player ${player.modelDisplayName} bids $${validBid}`);
  },
});

/**
 * Execute pre/post roll actions decision
 */
export const executePrePostRollDecision = internalMutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    action: v.string(),
    parameters: v.any(),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    const player = await ctx.db.get(args.playerId);
    if (!game || !player) return;

    const addEvent = async (event: string) => {
      const turn = await ctx.db.get(args.turnId);
      if (turn) {
        await ctx.db.patch(args.turnId, {
          events: [...turn.events, event],
        });
      }
    };

    let nextPhase = game.currentPhase;

    if (args.action === "done") {
      // Move to next phase
      if (args.phase === "pre_roll_actions") {
        nextPhase = "rolling";
      } else {
        nextPhase = "turn_end";
      }
    } else if (args.action === "build" && args.parameters?.propertyName) {
      // Build house (simplified)
      await addEvent(`Building on ${args.parameters.propertyName}`);
      // Would need full implementation
    } else if (args.action === "mortgage" && args.parameters?.propertyName) {
      await addEvent(`Mortgaging ${args.parameters.propertyName}`);
      // Would need full implementation
    }

    // Clear waiting state and continue
    await ctx.db.patch(args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: nextPhase,
    });

    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

/**
 * Process the LLM decision result and update game state
 * This is called by the LLM action after getting a response
 */
export const processDecisionResult = internalMutation({
  args: {
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
    // Log the decision to the database
    await ctx.db.insert("decisions", {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      turnNumber: args.turnNumber,
      decisionType: args.decisionType,
      context: args.context,
      optionsAvailable: getValidActions(args.decisionType, JSON.parse(args.context)),
      decisionMade: args.action,
      parameters: JSON.stringify(args.parameters),
      reasoning: args.reasoning,
      rawResponse: args.rawResponse,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      decisionTimeMs: args.latencyMs,
    });

    // Execute the decision based on type
    const decisionContext = JSON.parse(args.context);
    const game = await ctx.db.get(args.gameId);
    if (!game) return;

    switch (args.decisionType) {
      case "buy_property":
        // Call the buy property executor directly since we're in a mutation
        await executeBuyPropertyHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action: args.action,
          propertyPosition: decisionContext.propertyPosition,
        });
        break;

      case "jail_strategy":
        await executeJailHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action: args.action,
        });
        break;

      case "auction_bid":
        // Just log for now
        console.log(`Auction bid: ${args.action} with amount ${args.parameters?.amount}`);
        await clearWaitingHandler(ctx, { gameId: args.gameId });
        break;

      case "pre_roll_actions":
      case "post_roll_actions":
        await executePrePostRollHandler(ctx, {
          gameId: args.gameId,
          playerId: args.playerId,
          turnId: args.turnId,
          action: args.action,
          parameters: args.parameters,
          phase: args.decisionType,
        });
        break;

      default:
        // For unhandled decision types, clear waiting state and continue
        await clearWaitingHandler(ctx, { gameId: args.gameId });
    }
  },
});

// ============================================================
// INLINE HANDLERS (to avoid circular scheduling issues)
// ============================================================

async function clearWaitingHandler(ctx: any, args: { gameId: Id<"games"> }) {
  const game = await ctx.db.get(args.gameId);
  if (!game) return;

  await ctx.db.patch(args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
  });

  await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
    gameId: args.gameId,
  });
}

async function executeBuyPropertyHandler(
  ctx: any,
  args: {
    gameId: Id<"games">;
    playerId: Id<"players">;
    turnId: Id<"turns">;
    action: string;
    propertyPosition: number;
  }
) {
  const game = await ctx.db.get(args.gameId);
  const player = await ctx.db.get(args.playerId);
  const property = await ctx.db
    .query("properties")
    .withIndex("by_game")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("gameId"), args.gameId),
        q.eq(q.field("position"), args.propertyPosition)
      )
    )
    .first();

  if (!game || !player || !property) return;

  const space = getSpace(args.propertyPosition);
  const cost = (space as any).cost || 0;

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get(args.turnId);
    if (turn) {
      await ctx.db.patch(args.turnId, {
        events: [...turn.events, event],
      });
    }
  };

  if (args.action === "buy" && player.cash >= cost) {
    await ctx.db.patch(property._id, { ownerId: args.playerId });
    await ctx.db.patch(args.playerId, { cash: player.cash - cost });
    await addEvent(`Decided to buy ${space.name} for $${cost}`);
  } else {
    await addEvent(`Declined to buy ${space.name} - going to auction`);

    const allPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    const activePlayers = allPlayers.filter((p: any) => !p.isBankrupt);

    let highestBid = 0;
    let winnerId: Id<"players"> | null = null;

    for (const p of activePlayers) {
      const maxBid = Math.floor(p.cash * 0.5);
      const bid = maxBid >= 1 ? Math.min(maxBid, cost - 1) : 0;
      if (bid > highestBid && bid <= p.cash) {
        highestBid = bid;
        winnerId = p._id;
      }
    }

    if (winnerId && highestBid > 0) {
      const winner = await ctx.db.get(winnerId);
      if (winner) {
        await ctx.db.patch(property._id, { ownerId: winnerId });
        await ctx.db.patch(winnerId, { cash: winner.cash - highestBid });
        await addEvent(`Auction: ${winner.modelDisplayName} won ${space.name} for $${highestBid}`);
      }
    } else {
      await addEvent(`Auction: No valid bids for ${space.name}`);
    }
  }

  const turn = await ctx.db.get(args.turnId);
  const wasDoubles = turn?.wasDoubles;
  const playerData = await ctx.db.get(args.playerId);

  if (wasDoubles && !playerData?.inJail) {
    await ctx.db.patch(args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: "rolling",
    });
  } else {
    await ctx.db.patch(args.gameId, {
      waitingForLLM: false,
      pendingDecision: undefined,
      currentPhase: "turn_end",
    });
  }

  await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
    gameId: args.gameId,
  });
}

async function executeJailHandler(
  ctx: any,
  args: {
    gameId: Id<"games">;
    playerId: Id<"players">;
    turnId: Id<"turns">;
    action: string;
  }
) {
  const game = await ctx.db.get(args.gameId);
  const player = await ctx.db.get(args.playerId);
  if (!game || !player) return;

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get(args.turnId);
    if (turn) {
      await ctx.db.patch(args.turnId, {
        events: [...turn.events, event],
      });
    }
  };

  if (args.action === "pay" && player.cash >= JAIL_FINE) {
    await ctx.db.patch(args.playerId, {
      cash: player.cash - JAIL_FINE,
      inJail: false,
      jailTurnsRemaining: 0,
    });
    await addEvent(`Paid $${JAIL_FINE} to get out of jail`);
  } else if (args.action === "use_card" && player.getOutOfJailCards > 0) {
    await ctx.db.patch(args.playerId, {
      getOutOfJailCards: player.getOutOfJailCards - 1,
      inJail: false,
      jailTurnsRemaining: 0,
    });
    await addEvent("Used Get Out of Jail Free card");
  } else {
    await addEvent("Choosing to roll for doubles");
  }

  await ctx.db.patch(args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: "rolling",
  });

  await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
    gameId: args.gameId,
  });
}

async function executePrePostRollHandler(
  ctx: any,
  args: {
    gameId: Id<"games">;
    playerId: Id<"players">;
    turnId: Id<"turns">;
    action: string;
    parameters: any;
    phase: string;
  }
) {
  const game = await ctx.db.get(args.gameId);
  const player = await ctx.db.get(args.playerId);
  if (!game || !player) return;

  const addEvent = async (event: string) => {
    const turn = await ctx.db.get(args.turnId);
    if (turn) {
      await ctx.db.patch(args.turnId, {
        events: [...turn.events, event],
      });
    }
  };

  let nextPhase = game.currentPhase;

  if (args.action === "done") {
    if (args.phase === "pre_roll_actions") {
      nextPhase = "rolling";
    } else {
      nextPhase = "turn_end";
    }
  } else if (args.action === "build" && args.parameters?.propertyName) {
    await addEvent(`Building on ${args.parameters.propertyName}`);
  } else if (args.action === "mortgage" && args.parameters?.propertyName) {
    await addEvent(`Mortgaging ${args.parameters.propertyName}`);
  }

  await ctx.db.patch(args.gameId, {
    waitingForLLM: false,
    pendingDecision: undefined,
    currentPhase: nextPhase,
  });

  await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
    gameId: args.gameId,
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

type DecisionType =
  | "buy_property"
  | "auction_bid"
  | "jail_strategy"
  | "pre_roll_actions"
  | "post_roll_actions"
  | "trade_response"
  | "bankruptcy_resolution";

function getValidActions(
  decisionType: DecisionType,
  context: Record<string, unknown>
): string[] {
  switch (decisionType) {
    case "buy_property":
      return ["buy", "auction"];
    case "auction_bid":
      return ["bid"];
    case "jail_strategy": {
      const actions = ["roll"];
      if (context.canPayFine) actions.push("pay");
      if (context.hasJailCard) actions.push("use_card");
      return actions;
    }
    case "pre_roll_actions":
      return ["build", "mortgage", "unmortgage", "trade", "done"];
    case "post_roll_actions":
      return ["build", "mortgage", "unmortgage", "done"];
    case "trade_response":
      return ["accept", "reject", "counter"];
    default:
      return ["done"];
  }
}

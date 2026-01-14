import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  BOARD,
  GO_SALARY,
  JAIL_POSITION,
  JAIL_FINE,
  MAX_JAIL_TURNS,
} from "./lib/constants";
import { getSpace, calculateNewPosition, passedGo } from "./lib/board";
import { calculateRent, hasMonopoly } from "./lib/rent";
import {
  executeChanceCard,
  executeCommunityChestCard,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
} from "./lib/cards";

// ============================================================
// GAME LIFECYCLE
// ============================================================

/**
 * Start a game that's in setup status
 */
export const startGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "setup") throw new Error("Game is not in setup status");

    // Get players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    if (players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    // Initialize properties
    for (const space of BOARD) {
      if (space.type === "property" || space.type === "railroad" || space.type === "utility") {
        const group = space.type === "property" ? space.group : space.type;
        await ctx.db.insert("properties", {
          gameId: args.gameId,
          position: space.pos,
          name: space.name,
          group,
          ownerId: undefined,
          houses: 0,
          isMortgaged: false,
        });
      }
    }

    // Sort players by turn order
    players.sort((a, b) => a.turnOrder - b.turnOrder);
    const firstPlayer = players[0];

    // Create first turn record
    const turnId = await ctx.db.insert("turns", {
      gameId: args.gameId,
      playerId: firstPlayer._id,
      turnNumber: 1,
      positionBefore: firstPlayer.position,
      cashBefore: firstPlayer.cash,
      events: ["Game started"],
      startedAt: Date.now(),
    });

    // Update game status
    await ctx.db.patch(args.gameId, {
      status: "in_progress",
      currentPhase: "pre_roll",
      currentPlayerIndex: 0,
      currentTurnNumber: 1,
      startedAt: Date.now(),
    });

    // Schedule first turn processing
    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });

    return { gameId: args.gameId, turnId };
  },
});

/**
 * Main turn processor - handles one step at a time
 */
export const processTurnStep = internalMutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "in_progress") return;

    // Get all game data
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const activePlayers = players.filter((p) => !p.isBankrupt);
    if (activePlayers.length <= 1) {
      // Game over - we have a winner
      await handleGameEnd(ctx, args.gameId, activePlayers[0]?._id);
      return;
    }

    activePlayers.sort((a, b) => a.turnOrder - b.turnOrder);
    const currentPlayer = activePlayers[game.currentPlayerIndex % activePlayers.length];
    if (!currentPlayer) return;

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Get or create current turn
    let currentTurn = await ctx.db
      .query("turns")
      .withIndex("by_game_turn", (q) =>
        q.eq("gameId", args.gameId).eq("turnNumber", game.currentTurnNumber)
      )
      .first();

    if (!currentTurn) {
      const turnId = await ctx.db.insert("turns", {
        gameId: args.gameId,
        playerId: currentPlayer._id,
        turnNumber: game.currentTurnNumber,
        positionBefore: currentPlayer.position,
        cashBefore: currentPlayer.cash,
        events: [],
        startedAt: Date.now(),
      });
      currentTurn = await ctx.db.get(turnId);
    }

    if (!currentTurn) return;

    // Process based on current phase
    switch (game.currentPhase) {
      case "pre_roll":
        await processPreRoll(ctx, game, currentPlayer, activePlayers, properties, currentTurn);
        break;

      case "rolling":
        await processRolling(ctx, game, currentPlayer, properties, currentTurn);
        break;

      case "post_roll":
        await processPostRoll(ctx, game, currentPlayer, activePlayers, properties, currentTurn);
        break;

      case "turn_end":
        await processTurnEnd(ctx, game, currentPlayer, activePlayers, currentTurn);
        break;
    }

    // Schedule next step (check if game still in progress)
    const updatedGame = await ctx.db.get(args.gameId);
    if (updatedGame?.status === "in_progress") {
      await ctx.scheduler.runAfter(updatedGame.config.speedMs, internal.gameEngine.processTurnStep, {
        gameId: args.gameId,
      });
    }
  },
});

// ============================================================
// PHASE PROCESSORS
// ============================================================

async function processPreRoll(
  ctx: any,
  game: any,
  player: any,
  _allPlayers: any[],
  _properties: any[],
  turn: any
) {
  // Handle jail
  if (player.inJail) {
    if (player.jailTurnsRemaining <= 0) {
      // Force pay on 3rd turn
      if (player.cash >= JAIL_FINE) {
        await ctx.db.patch(player._id, {
          cash: player.cash - JAIL_FINE,
          inJail: false,
          jailTurnsRemaining: 0,
        });
        await addTurnEvent(ctx, turn._id, `Forced to pay $${JAIL_FINE} jail fine`);
      } else {
        // Can't afford - will need to raise money or go bankrupt
        await addTurnEvent(ctx, turn._id, "Cannot afford jail fine - must raise funds");
      }
    } else {
      // Jail decision will be made in rolling phase
      await ctx.db.patch(player._id, {
        jailTurnsRemaining: player.jailTurnsRemaining - 1,
      });
    }
  }

  // For now, skip pre-roll actions and go to rolling
  // Full LLM integration would call for build/mortgage/trade decisions here
  await ctx.db.patch(game._id, { currentPhase: "rolling" });
}

async function processRolling(
  ctx: any,
  game: any,
  player: any,
  _properties: any[],
  turn: any
) {
  // Handle jail roll attempt
  if (player.inJail) {
    const [d1, d2] = rollDice();
    const isDoubles = d1 === d2;

    await ctx.db.patch(turn._id, {
      diceRoll: [d1, d2],
      wasDoubles: isDoubles,
    });

    if (isDoubles) {
      await ctx.db.patch(player._id, {
        inJail: false,
        jailTurnsRemaining: 0,
        consecutiveDoubles: 0,
      });
      await addTurnEvent(ctx, turn._id, `Rolled doubles (${d1},${d2}) - out of jail!`);

      // Move the player
      const total = d1 + d2;
      const newPosition = calculateNewPosition(player.position, total);
      const didPassGo = passedGo(player.position, newPosition, true);

      await ctx.db.patch(player._id, {
        position: newPosition,
        cash: didPassGo ? player.cash + GO_SALARY : player.cash,
      });

      await ctx.db.patch(turn._id, {
        positionAfter: newPosition,
        passedGo: didPassGo,
        landedOn: getSpace(newPosition).name,
      });

      if (didPassGo) {
        await addTurnEvent(ctx, turn._id, `Passed GO - collected $${GO_SALARY}`);
      }
      await addTurnEvent(ctx, turn._id, `Moved to ${getSpace(newPosition).name}`);
    } else {
      await addTurnEvent(ctx, turn._id, `Rolled (${d1},${d2}) - still in jail`);
      // Skip to turn end
      await ctx.db.patch(game._id, { currentPhase: "turn_end" });
      return;
    }
  } else {
    // Normal roll
    const [d1, d2] = rollDice();
    const isDoubles = d1 === d2;
    const total = d1 + d2;

    const newDoubles = isDoubles ? player.consecutiveDoubles + 1 : 0;

    await ctx.db.patch(turn._id, {
      diceRoll: [d1, d2],
      wasDoubles: isDoubles,
    });

    // Check for 3rd consecutive doubles
    if (newDoubles >= 3) {
      await ctx.db.patch(player._id, {
        position: JAIL_POSITION,
        inJail: true,
        jailTurnsRemaining: MAX_JAIL_TURNS,
        consecutiveDoubles: 0,
      });
      await addTurnEvent(ctx, turn._id, `Rolled 3rd doubles (${d1},${d2}) - GO TO JAIL!`);
      await ctx.db.patch(turn._id, {
        positionAfter: JAIL_POSITION,
        landedOn: "Jail",
      });
      await ctx.db.patch(game._id, { currentPhase: "turn_end" });
      return;
    }

    await ctx.db.patch(player._id, { consecutiveDoubles: newDoubles });

    // Calculate movement
    const newPosition = calculateNewPosition(player.position, total);
    const didPassGo = passedGo(player.position, newPosition, true);

    let newCash = player.cash;
    if (didPassGo) {
      newCash += GO_SALARY;
    }

    await ctx.db.patch(player._id, {
      position: newPosition,
      cash: newCash,
    });

    await ctx.db.patch(turn._id, {
      positionAfter: newPosition,
      passedGo: didPassGo,
      landedOn: getSpace(newPosition).name,
    });

    await addTurnEvent(ctx, turn._id, `Rolled ${total} (${d1},${d2})`);
    if (didPassGo) {
      await addTurnEvent(ctx, turn._id, `Passed GO - collected $${GO_SALARY}`);
    }
    await addTurnEvent(ctx, turn._id, `Moved to ${getSpace(newPosition).name}`);
  }

  await ctx.db.patch(game._id, { currentPhase: "post_roll" });
}

async function processPostRoll(
  ctx: any,
  game: any,
  player: any,
  allPlayers: any[],
  properties: any[],
  turn: any
) {
  const space = getSpace(player.position);

  switch (space.type) {
    case "property":
    case "railroad":
    case "utility": {
      const property = properties.find((p) => p.position === player.position);
      if (!property) break;

      if (!property.ownerId) {
        // Unowned - player can buy
        const cost = space.type === "property" ? space.cost : space.cost;
        if (player.cash >= cost) {
          // Auto-buy for now (full implementation would use LLM decision)
          await ctx.db.patch(property._id, { ownerId: player._id });
          await ctx.db.patch(player._id, { cash: player.cash - cost });
          await addTurnEvent(ctx, turn._id, `Bought ${space.name} for $${cost}`);
        } else {
          await addTurnEvent(ctx, turn._id, `Cannot afford ${space.name} ($${cost})`);
        }
      } else if (property.ownerId !== player._id && !property.isMortgaged) {
        // Pay rent
        const owner = allPlayers.find((p) => p._id === property.ownerId);
        if (owner && !owner.isBankrupt) {
          const diceTotal = turn.diceRoll ? turn.diceRoll[0] + turn.diceRoll[1] : 7;
          const rent = calculateRent(property, properties, property.ownerId, diceTotal);

          if (rent > 0) {
            const actualPayment = Math.min(rent, player.cash);
            await ctx.db.patch(player._id, { cash: player.cash - actualPayment });
            await ctx.db.patch(owner._id, { cash: owner.cash + actualPayment });
            await addTurnEvent(ctx, turn._id, `Paid $${actualPayment} rent to ${owner.modelDisplayName}`);

            // Log rent payment
            await ctx.db.insert("rentPayments", {
              gameId: game._id,
              turnNumber: game.currentTurnNumber,
              payerId: player._id,
              receiverId: owner._id,
              propertyName: space.name,
              amount: actualPayment,
              diceTotal: space.type === "utility" ? diceTotal : undefined,
              payerCashAfter: player.cash - actualPayment,
              receiverCashAfter: owner.cash + actualPayment,
            });

            // Check bankruptcy
            if (player.cash - actualPayment < 0) {
              await handleBankruptcy(ctx, game._id, player._id, owner._id, properties);
            }
          }
        }
      }
      break;
    }

    case "tax": {
      const taxAmount = space.amount;
      const actualPayment = Math.min(taxAmount, player.cash);
      await ctx.db.patch(player._id, { cash: player.cash - actualPayment });
      await addTurnEvent(ctx, turn._id, `Paid $${actualPayment} ${space.name}`);

      if (player.cash < taxAmount) {
        await handleBankruptcy(ctx, game._id, player._id, undefined, properties);
      }
      break;
    }

    case "chance":
    case "community_chest": {
      // Draw and execute card
      const cards = space.type === "chance" ? [...CHANCE_CARDS] : [...COMMUNITY_CHEST_CARDS];
      const card = cards[Math.floor(Math.random() * cards.length)];

      await addTurnEvent(ctx, turn._id, `Drew ${space.type === "chance" ? "Chance" : "Community Chest"}: "${card.text}"`);

      // Execute card effects
      const playerState = { _id: player._id, cash: player.cash, position: player.position };
      const allPlayerStates = allPlayers.map((p) => ({
        _id: p._id,
        cash: p.cash,
        position: p.position,
      }));

      const result = space.type === "chance"
        ? executeChanceCard(card as any, playerState, allPlayerStates, properties)
        : executeCommunityChestCard(card as any, playerState, allPlayerStates, properties);

      // Apply effects
      let updatedCash = player.cash;
      let updatedPosition = player.position;

      if (result.cashChange) {
        updatedCash += result.cashChange;
      }

      if (result.newPosition !== undefined) {
        updatedPosition = result.newPosition;
      }

      if (result.goToJail) {
        await ctx.db.patch(player._id, {
          position: JAIL_POSITION,
          inJail: true,
          jailTurnsRemaining: MAX_JAIL_TURNS,
          cash: updatedCash,
        });
        await addTurnEvent(ctx, turn._id, "Sent to Jail!");
      } else {
        await ctx.db.patch(player._id, {
          position: updatedPosition,
          cash: updatedCash,
          getOutOfJailCards: result.getOutOfJailCard
            ? player.getOutOfJailCards + 1
            : player.getOutOfJailCards,
        });

        if (result.passedGo) {
          await addTurnEvent(ctx, turn._id, `Passed GO - collected $${GO_SALARY}`);
        }
      }

      // Handle pay each player / collect from each
      if (result.payEachPlayer) {
        for (const other of allPlayers) {
          if (other._id !== player._id && !other.isBankrupt) {
            await ctx.db.patch(other._id, { cash: other.cash + result.payEachPlayer });
          }
        }
      }
      if (result.collectFromEach) {
        for (const other of allPlayers) {
          if (other._id !== player._id && !other.isBankrupt) {
            const payment = Math.min(result.collectFromEach, other.cash);
            await ctx.db.patch(other._id, { cash: other.cash - payment });
          }
        }
      }
      break;
    }

    case "go_to_jail": {
      await ctx.db.patch(player._id, {
        position: JAIL_POSITION,
        inJail: true,
        jailTurnsRemaining: MAX_JAIL_TURNS,
      });
      await addTurnEvent(ctx, turn._id, "GO TO JAIL!");
      break;
    }

    // go, jail (visiting), free_parking - nothing happens
  }

  // Check for doubles (another roll)
  const wasDoubles = turn.wasDoubles;
  const playerData = await ctx.db.get(player._id);

  if (wasDoubles && !playerData?.inJail) {
    await addTurnEvent(ctx, turn._id, "Rolled doubles - rolling again!");
    await ctx.db.patch(game._id, { currentPhase: "rolling" });
  } else {
    await ctx.db.patch(game._id, { currentPhase: "turn_end" });
  }
}

async function processTurnEnd(
  ctx: any,
  game: any,
  player: any,
  allPlayers: any[],
  turn: any
) {
  // Complete turn record
  const playerData = await ctx.db.get(player._id);
  await ctx.db.patch(turn._id, {
    positionAfter: playerData?.position ?? player.position,
    cashAfter: playerData?.cash ?? player.cash,
    endedAt: Date.now(),
  });

  // Check win condition
  const activePlayers = allPlayers.filter((p) => !p.isBankrupt);
  if (activePlayers.length <= 1) {
    await handleGameEnd(ctx, game._id, activePlayers[0]?._id);
    return;
  }

  // Check turn limit
  if (game.config.turnLimit && game.currentTurnNumber >= game.config.turnLimit) {
    // Find winner by net worth
    let winner = activePlayers[0];
    let highestNetWorth = 0;

    for (const p of activePlayers) {
      const playerProps = await ctx.db
        .query("properties")
        .withIndex("by_owner", (q: any) => q.eq("ownerId", p._id))
        .collect();

      let netWorth = p.cash;
      for (const prop of playerProps) {
        netWorth += prop.isMortgaged ? 0 : getSpace(prop.position).type === "property"
          ? (getSpace(prop.position) as any).cost
          : 200;
      }

      if (netWorth > highestNetWorth) {
        highestNetWorth = netWorth;
        winner = p;
      }
    }

    await ctx.db.patch(game._id, {
      status: "completed",
      winnerId: winner._id,
      endingReason: "turn_limit_reached",
      currentPhase: "game_over",
      endedAt: Date.now(),
    });
    return;
  }

  // Advance to next player
  const nextPlayerIndex = (game.currentPlayerIndex + 1) % activePlayers.length;
  const nextPlayer = activePlayers[nextPlayerIndex];

  // Create new turn
  await ctx.db.insert("turns", {
    gameId: game._id,
    playerId: nextPlayer._id,
    turnNumber: game.currentTurnNumber + 1,
    positionBefore: nextPlayer.position,
    cashBefore: nextPlayer.cash,
    events: [],
    startedAt: Date.now(),
  });

  await ctx.db.patch(game._id, {
    currentPlayerIndex: nextPlayerIndex,
    currentTurnNumber: game.currentTurnNumber + 1,
    currentPhase: "pre_roll",
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function rollDice(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

async function addTurnEvent(ctx: any, turnId: Id<"turns">, event: string) {
  const turn = await ctx.db.get(turnId);
  if (turn) {
    await ctx.db.patch(turnId, {
      events: [...turn.events, event],
    });
  }
}

async function handleBankruptcy(
  ctx: any,
  gameId: Id<"games">,
  playerId: Id<"players">,
  creditorId: Id<"players"> | undefined,
  properties: any[]
) {
  const player = await ctx.db.get(playerId);
  if (!player) return;

  const game = await ctx.db.get(gameId);
  if (!game) return;

  // Get remaining active players to determine final position
  const allPlayers = await ctx.db
    .query("players")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  const activePlayers = allPlayers.filter((p: any) => !p.isBankrupt && p._id !== playerId);
  const finalPosition = activePlayers.length + 1; // e.g., 2nd place if 1 remaining

  // Mark player as bankrupt
  await ctx.db.patch(playerId, {
    isBankrupt: true,
    bankruptcyTurn: game.currentTurnNumber,
    finalPosition,
    finalNetWorth: 0,
    cash: 0,
  });

  // Transfer properties to creditor or bank
  const playerProperties = properties.filter((p) => p.ownerId === playerId);
  for (const prop of playerProperties) {
    await ctx.db.patch(prop._id, {
      ownerId: creditorId, // undefined means bank
      houses: creditorId ? prop.houses : 0,
      isMortgaged: creditorId ? prop.isMortgaged : false,
    });
  }
}

async function handleGameEnd(
  ctx: any,
  gameId: Id<"games">,
  winnerId: Id<"players"> | undefined
) {
  if (winnerId) {
    await ctx.db.patch(winnerId, {
      finalPosition: 1,
    });
  }

  await ctx.db.patch(gameId, {
    status: "completed",
    winnerId,
    endingReason: "last_player_standing",
    currentPhase: "game_over",
    endedAt: Date.now(),
  });
}

// ============================================================
// GAME CONTROL MUTATIONS
// ============================================================

/**
 * Pause a running game
 */
export const pauseGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "in_progress") throw new Error("Game is not in progress");

    await ctx.db.patch(args.gameId, {
      status: "setup", // Use setup as "paused" state
    });
  },
});

/**
 * Resume a paused game
 */
export const resumeGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    await ctx.db.patch(args.gameId, {
      status: "in_progress",
    });

    // Schedule next turn
    await ctx.scheduler.runAfter(game.config.speedMs, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

/**
 * Update game speed
 */
export const setSpeed = mutation({
  args: {
    gameId: v.id("games"),
    speedMs: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    await ctx.db.patch(args.gameId, {
      config: {
        ...game.config,
        speedMs: args.speedMs,
      },
    });
  },
});

/**
 * Abandon a game without a winner
 */
export const abandonGame = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      status: "abandoned",
      endingReason: "manual_stop",
      currentPhase: "game_over",
      endedAt: Date.now(),
    });
  },
});

/**
 * Manually trigger the next turn step (for testing)
 */
export const triggerNextStep = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.gameEngine.processTurnStep, {
      gameId: args.gameId,
    });
  },
});

// ============================================================
// HELPER MUTATIONS (used by game engine and can be called directly)
// ============================================================

/**
 * Move a player by a number of spaces
 */
export const movePlayer = mutation({
  args: {
    playerId: v.id("players"),
    spaces: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const newPosition = calculateNewPosition(player.position, args.spaces);
    const didPassGo = passedGo(player.position, newPosition, args.spaces > 0);

    let newCash = player.cash;
    if (didPassGo) {
      newCash += GO_SALARY;
    }

    await ctx.db.patch(args.playerId, {
      position: newPosition,
      cash: newCash,
    });

    return {
      newPosition,
      passedGo: didPassGo,
      newCash,
    };
  },
});

/**
 * Pay rent from one player to another
 */
export const payRent = mutation({
  args: {
    gameId: v.id("games"),
    payerId: v.id("players"),
    receiverId: v.id("players"),
    propertyId: v.id("properties"),
    diceTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payer = await ctx.db.get(args.payerId);
    const receiver = await ctx.db.get(args.receiverId);
    const property = await ctx.db.get(args.propertyId);
    const game = await ctx.db.get(args.gameId);

    if (!payer || !receiver || !property || !game) {
      throw new Error("Missing payer, receiver, property, or game");
    }

    if (property.isMortgaged) {
      return { rentPaid: 0, payerBankrupt: false };
    }

    // Get all properties for rent calculation
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const diceTotal = args.diceTotal ?? 7;
    const rent = calculateRent(property, properties, receiver._id, diceTotal);

    if (rent <= 0) {
      return { rentPaid: 0, payerBankrupt: false };
    }

    const actualPayment = Math.min(rent, payer.cash);
    const payerBankrupt = payer.cash < rent;

    await ctx.db.patch(args.payerId, { cash: payer.cash - actualPayment });
    await ctx.db.patch(args.receiverId, { cash: receiver.cash + actualPayment });

    // Log rent payment
    await ctx.db.insert("rentPayments", {
      gameId: args.gameId,
      turnNumber: game.currentTurnNumber,
      payerId: args.payerId,
      receiverId: args.receiverId,
      propertyName: property.name,
      amount: actualPayment,
      diceTotal: getSpace(property.position).type === "utility" ? diceTotal : undefined,
      payerCashAfter: payer.cash - actualPayment,
      receiverCashAfter: receiver.cash + actualPayment,
    });

    return { rentPaid: actualPayment, payerBankrupt };
  },
});

/**
 * Buy a property for a player
 */
export const buyProperty = mutation({
  args: {
    playerId: v.id("players"),
    propertyId: v.id("properties"),
    price: v.optional(v.number()), // Optional override for auction price
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    const property = await ctx.db.get(args.propertyId);

    if (!player || !property) {
      throw new Error("Player or property not found");
    }

    if (property.ownerId) {
      throw new Error("Property already owned");
    }

    const space = getSpace(property.position);
    const cost = args.price ?? (space as any).cost;

    if (player.cash < cost) {
      throw new Error("Not enough cash");
    }

    await ctx.db.patch(args.propertyId, { ownerId: args.playerId });
    await ctx.db.patch(args.playerId, { cash: player.cash - cost });

    return { propertyName: property.name, cost };
  },
});

/**
 * Run a simplified auction for a property
 * Each player bids once in turn order, highest bid wins
 */
export const runAuction = mutation({
  args: {
    gameId: v.id("games"),
    propertyId: v.id("properties"),
    bids: v.array(v.object({
      playerId: v.id("players"),
      amount: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (property.ownerId) throw new Error("Property already owned");

    // Find highest valid bid
    let highestBid = 0;
    let winnerId: Id<"players"> | null = null;

    for (const bid of args.bids) {
      const player = await ctx.db.get(bid.playerId);
      if (player && !player.isBankrupt && bid.amount > highestBid && bid.amount <= player.cash) {
        highestBid = bid.amount;
        winnerId = bid.playerId;
      }
    }

    if (winnerId && highestBid > 0) {
      const winner = await ctx.db.get(winnerId);
      if (winner) {
        await ctx.db.patch(args.propertyId, { ownerId: winnerId });
        await ctx.db.patch(winnerId, { cash: winner.cash - highestBid });
      }
    }

    return {
      winnerId,
      winningBid: highestBid,
      propertyName: property.name,
    };
  },
});

/**
 * Build houses on a property
 */
export const buildHouse = mutation({
  args: {
    playerId: v.id("players"),
    propertyId: v.id("properties"),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    const property = await ctx.db.get(args.propertyId);

    if (!player || !property) {
      throw new Error("Player or property not found");
    }

    if (property.ownerId !== args.playerId) {
      throw new Error("Player does not own this property");
    }

    const space = getSpace(property.position);
    if (space.type !== "property") {
      throw new Error("Can only build on color properties");
    }

    // Get all properties to check monopoly
    const game = await ctx.db.get(property.gameId);
    if (!game) throw new Error("Game not found");

    const allProperties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", property.gameId))
      .collect();

    if (!hasMonopoly(args.playerId, property.group, allProperties)) {
      throw new Error("Need monopoly to build");
    }

    const count = args.count ?? 1;
    const houseCost = (space as any).houseCost ?? 50;
    const totalCost = houseCost * count;

    if (player.cash < totalCost) {
      throw new Error("Not enough cash");
    }

    const newHouseCount = Math.min(property.houses + count, 5);
    const actualCount = newHouseCount - property.houses;
    const actualCost = houseCost * actualCount;

    await ctx.db.patch(args.propertyId, { houses: newHouseCount });
    await ctx.db.patch(args.playerId, { cash: player.cash - actualCost });

    return {
      housesBuilt: actualCount,
      totalHouses: newHouseCount,
      cost: actualCost,
    };
  },
});

/**
 * Mortgage a property
 */
export const mortgageProperty = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (!property.ownerId) throw new Error("Property not owned");
    if (property.isMortgaged) throw new Error("Property already mortgaged");
    if (property.houses > 0) throw new Error("Sell houses before mortgaging");

    const player = await ctx.db.get(property.ownerId);
    if (!player) throw new Error("Owner not found");

    const space = getSpace(property.position);
    const mortgageValue = Math.floor((space as any).cost / 2);

    await ctx.db.patch(args.propertyId, { isMortgaged: true });
    await ctx.db.patch(property.ownerId, { cash: player.cash + mortgageValue });

    return { mortgageValue, propertyName: property.name };
  },
});

/**
 * Unmortgage a property
 */
export const unmortgageProperty = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");
    if (!property.ownerId) throw new Error("Property not owned");
    if (!property.isMortgaged) throw new Error("Property not mortgaged");

    const player = await ctx.db.get(property.ownerId);
    if (!player) throw new Error("Owner not found");

    const space = getSpace(property.position);
    const mortgageValue = Math.floor((space as any).cost / 2);
    const unmortgageCost = Math.floor(mortgageValue * 1.1); // 10% interest

    if (player.cash < unmortgageCost) {
      throw new Error("Not enough cash to unmortgage");
    }

    await ctx.db.patch(args.propertyId, { isMortgaged: false });
    await ctx.db.patch(property.ownerId, { cash: player.cash - unmortgageCost });

    return { unmortgageCost, propertyName: property.name };
  },
});

/**
 * Process bankruptcy for a player
 */
export const processBankruptcyMutation = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    creditorId: v.optional(v.id("players")),
  },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    await handleBankruptcy(ctx, args.gameId, args.playerId, args.creditorId, properties);

    return { bankrupt: true };
  },
});

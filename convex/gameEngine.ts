import { v } from "convex/values";
import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import {
  BOARD,
  GO_SALARY,
  JAIL_POSITION,
  JAIL_FINE,
  MAX_JAIL_TURNS,
} from "./lib/constants";
import { getSpace, calculateNewPosition, passedGo, getPurchasePrice, getMortgageValue, getHouseCost } from "./lib/board";
import { calculateRent, hasMonopoly } from "./lib/rent";
import {
  executeChanceCard,
  executeCommunityChestCard,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
} from "./lib/cards";
import {
  canBuildAny,
  canMortgageAny,
  canUnmortgageAny,
  type PlayerState,
} from "./lib/validation";

// ============================================================
// HELPERS
// ============================================================

/**
 * Fisher-Yates shuffle for card deck indices
 */
function shuffleDeckIndices(count: number): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

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

    // Initialize shuffled card decks
    const chanceDeck = shuffleDeckIndices(CHANCE_CARDS.length);
    const communityChestDeck = shuffleDeckIndices(COMMUNITY_CHEST_CARDS.length);

    // Update game status
    await ctx.db.patch(args.gameId, {
      status: "in_progress",
      currentPhase: "pre_roll",
      currentPlayerIndex: 0,
      currentTurnNumber: 1,
      startedAt: Date.now(),
      chanceDeck,
      communityChestDeck,
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

    console.log(`[GAME] ${args.gameId} | Turn ${game.currentTurnNumber} | Phase: ${game.currentPhase}`);

    // Don't process if game is paused
    if (game.isPaused) return;

    // Don't process if waiting for LLM decision
    if (game.waitingForLLM) return;

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
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  _allPlayers: Doc<"players">[],
  properties: Doc<"properties">[],
  turn: Doc<"turns">
) {
  // If player is in jail, ask LLM for jail strategy decision
  if (player.inJail) {
    const canPayFine = player.cash >= JAIL_FINE;
    const hasJailCard = player.getOutOfJailCards > 0;

    const context = JSON.stringify({
      canPayFine,
      hasJailCard,
      jailTurnsRemaining: player.jailTurnsRemaining,
      playerCash: player.cash,
    });

    // Set waiting state and trigger LLM decision
    await ctx.db.patch(game._id, {
      waitingForLLM: true,
      pendingDecision: { type: "jail_strategy", context },
    });

    // Call LLM for decision
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.scheduler.runAfter(0, (internal as any).llmDecisions.getLLMDecision, {
      gameId: game._id,
      playerId: player._id,
      turnId: turn._id,
      decisionType: "jail_strategy",
      context,
    });
    return; // Don't continue - LLM will call back when done
  }

  // Build player state for validation checks
  const playerState: PlayerState = {
    _id: player._id,
    cash: player.cash,
    position: player.position,
    inJail: player.inJail,
    jailTurnsRemaining: player.jailTurnsRemaining,
    getOutOfJailCards: player.getOutOfJailCards,
    isBankrupt: player.isBankrupt,
  };

  // Check what actions are actually available for this player
  const canBuild = canBuildAny(playerState, properties);
  const canMortgageProps = canMortgageAny(playerState, properties);
  const canUnmortgageProps = canUnmortgageAny(playerState, properties);

  // For non-jail turns, ask LLM for pre-roll actions
  const context = JSON.stringify({
    phase: "pre_roll",
    playerCash: player.cash,
    canBuild,
    canMortgage: canMortgageProps,
    canUnmortgage: canUnmortgageProps,
  });

  await ctx.db.patch(game._id, {
    waitingForLLM: true,
    pendingDecision: { type: "pre_roll_actions", context },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ctx.scheduler.runAfter(0, (internal as any).llmDecisions.getLLMDecision, {
    gameId: game._id,
    playerId: player._id,
    turnId: turn._id,
    decisionType: "pre_roll_actions",
    context,
  });
  return;
}

async function processRolling(
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  _properties: Doc<"properties">[],
  turn: Doc<"turns">
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
        consecutiveDoubles: 1, // Rolling doubles to exit jail counts as first consecutive double
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
      // Failed to roll doubles - decrement jail turns
      const newJailTurns = player.jailTurnsRemaining - 1;

      if (newJailTurns <= 0) {
        // 3rd failed attempt - must pay fine to get out
        await addTurnEvent(ctx, turn._id, `Rolled (${d1},${d2}) - 3rd failed attempt, must pay fine`);

        if (player.cash >= JAIL_FINE) {
          await ctx.db.patch(player._id, {
            cash: player.cash - JAIL_FINE,
            inJail: false,
            jailTurnsRemaining: 0,
          });
          await addTurnEvent(ctx, turn._id, `Paid $${JAIL_FINE} jail fine - now free`);

          // Player is free but doesn't move this turn (per official rules)
          await ctx.db.patch(game._id, { currentPhase: "turn_end" });
          return;
        } else {
          // Can't afford fine - bankruptcy (owed to the bank)
          await addTurnEvent(ctx, turn._id, `Cannot afford $${JAIL_FINE} jail fine - BANKRUPT!`);
          const properties = await ctx.db
            .query("properties")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();
          await handleBankruptcy(ctx, game._id, player._id, undefined, properties);
          await ctx.db.patch(game._id, { currentPhase: "turn_end" });
          return;
        }
      } else {
        // Still have attempts remaining
        await ctx.db.patch(player._id, { jailTurnsRemaining: newJailTurns });
        await addTurnEvent(ctx, turn._id, `Rolled (${d1},${d2}) - still in jail (${newJailTurns} attempts remaining)`);
        await ctx.db.patch(game._id, { currentPhase: "turn_end" });
        return;
      }
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
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  allPlayers: Doc<"players">[],
  properties: Doc<"properties">[],
  turn: Doc<"turns">
) {
  const space = getSpace(player.position);

  switch (space.type) {
    case "property":
    case "railroad":
    case "utility": {
      const property = properties.find((p) => p.position === player.position);
      if (!property) break;

      if (!property.ownerId) {
        // Unowned - player can buy or auction
        const cost = getPurchasePrice(property.position);

        // Ask LLM for buy/auction decision
        const context = JSON.stringify({
          propertyPosition: property.position,
          propertyName: space.name,
          propertyCost: cost,
          propertyGroup: property.group,
          playerCash: player.cash,
          canAfford: player.cash >= cost,
        });

        // Set waiting state and trigger LLM decision
        await ctx.db.patch(game._id, {
          waitingForLLM: true,
          pendingDecision: { type: "buy_property", context },
        });

        // Call LLM for decision
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.scheduler.runAfter(0, (internal as any).llmDecisions.getLLMDecision, {
          gameId: game._id,
          playerId: player._id,
          turnId: turn._id,
          decisionType: "buy_property",
          context,
        });
        return; // Don't continue - LLM will call back when done
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

            // Check bankruptcy - player couldn't afford full rent
            if (player.cash < rent) {
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
      // Draw card from deck (proper Monopoly rules - draw in order, reshuffle when empty)
      const isChance = space.type === "chance";
      let deck = isChance ? (game.chanceDeck ?? []) : (game.communityChestDeck ?? []);
      const deckLength = isChance ? CHANCE_CARDS.length : COMMUNITY_CHEST_CARDS.length;

      // Reshuffle if deck is empty
      if (deck.length === 0) {
        deck = shuffleDeckIndices(deckLength);
        await addTurnEvent(ctx, turn._id, `${isChance ? "Chance" : "Community Chest"} deck reshuffled`);
      }

      // Draw from front of deck
      const cardIndex = deck[0];
      const remainingDeck = deck.slice(1);

      // Update deck in game state
      if (isChance) {
        await ctx.db.patch(game._id, { chanceDeck: remainingDeck });
      } else {
        await ctx.db.patch(game._id, { communityChestDeck: remainingDeck });
      }

      // Execute card effects with proper typing
      const playerState = { _id: player._id, cash: player.cash, position: player.position };
      const allPlayerStates = allPlayers.map((p) => ({
        _id: p._id,
        cash: p.cash,
        position: p.position,
      }));

      const result = isChance
        ? (() => {
            const card = CHANCE_CARDS[cardIndex];
            addTurnEvent(ctx, turn._id, `Drew Chance: "${card.text}"`);
            return executeChanceCard(card, playerState, allPlayerStates, properties);
          })()
        : (() => {
            const card = COMMUNITY_CHEST_CARDS[cardIndex];
            addTurnEvent(ctx, turn._id, `Drew Community Chest: "${card.text}"`);
            return executeCommunityChestCard(card, playerState, allPlayerStates, properties);
          })();

      // Apply effects
      let updatedCash = player.cash;
      let updatedPosition = player.position;

      if (result.cashChange && !result.payEachPlayer && !result.collectFromEach) {
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

        // Check if card moved player to owned property - charge rent with special rules
        if (result.newPosition !== undefined && !result.goToJail) {
          const landedSpace = getSpace(result.newPosition);
          if (landedSpace.type === "property" || landedSpace.type === "railroad" || landedSpace.type === "utility") {
            const landedProperty = properties.find((p) => p.position === result.newPosition);
            if (landedProperty && landedProperty.ownerId && landedProperty.ownerId !== player._id && !landedProperty.isMortgaged) {
              const owner = allPlayers.find((p) => p._id === landedProperty.ownerId);
              if (owner && !owner.isBankrupt) {
                const diceTotal = turn.diceRoll ? turn.diceRoll[0] + turn.diceRoll[1] : 7;
                let rent = calculateRent(landedProperty, properties, landedProperty.ownerId, diceTotal);

                // Apply special card rent rules
                if (result.doubleRent && landedSpace.type === "railroad") {
                  rent = rent * 2;
                  await addTurnEvent(ctx, turn._id, `Card doubles railroad rent!`);
                }
                if (result.useMultiplierTen && landedSpace.type === "utility") {
                  // Use 10x multiplier regardless of how many utilities owned
                  rent = diceTotal * 10;
                  await addTurnEvent(ctx, turn._id, `Card applies 10x utility multiplier!`);
                }

                if (rent > 0) {
                  // Refetch player for current cash after GO salary
                  const currentPlayer = await ctx.db.get(player._id);
                  const currentCash = currentPlayer?.cash ?? updatedCash;
                  const actualPayment = Math.min(rent, currentCash);

                  await ctx.db.patch(player._id, { cash: currentCash - actualPayment });
                  await ctx.db.patch(owner._id, { cash: owner.cash + actualPayment });
                  await addTurnEvent(ctx, turn._id, `Paid $${actualPayment} rent to ${owner.modelDisplayName}`);

                  // Check bankruptcy
                  if (currentCash < rent) {
                    await handleBankruptcy(ctx, game._id, player._id, owner._id, properties);
                  }
                }
              }
            }
          }
          // Check if card moved player to another Chance/Community Chest space
          // This happens with "Go Back 3 Spaces" from Chance at position 36 -> Community Chest at 33
          else if (landedSpace.type === "chance" || landedSpace.type === "community_chest") {
            // Draw another card from the new deck
            const isChance2 = landedSpace.type === "chance";
            const deckLength2 = isChance2 ? CHANCE_CARDS.length : COMMUNITY_CHEST_CARDS.length;

            // Get fresh game state for deck
            const freshGame = await ctx.db.get(game._id);
            let deck2 = isChance2 ? (freshGame?.chanceDeck ?? []) : (freshGame?.communityChestDeck ?? []);

            // Reshuffle if deck is empty
            if (deck2.length === 0) {
              deck2 = shuffleDeckIndices(deckLength2);
              await addTurnEvent(ctx, turn._id, `${isChance2 ? "Chance" : "Community Chest"} deck reshuffled`);
            }

            // Draw from front of deck
            const cardIndex2 = deck2[0];
            const remainingDeck2 = deck2.slice(1);

            // Update deck in game state
            if (isChance2) {
              await ctx.db.patch(game._id, { chanceDeck: remainingDeck2 });
            } else {
              await ctx.db.patch(game._id, { communityChestDeck: remainingDeck2 });
            }

            // Execute the second card
            const freshPlayer = await ctx.db.get(player._id);
            const playerState2 = {
              _id: player._id,
              cash: freshPlayer?.cash ?? updatedCash,
              position: freshPlayer?.position ?? updatedPosition
            };
            const allPlayerStates2 = await Promise.all(
              allPlayers.map(async (p) => {
                const fresh = await ctx.db.get(p._id);
                return { _id: p._id, cash: fresh?.cash ?? p.cash, position: fresh?.position ?? p.position };
              })
            );

            const result2 = isChance2
              ? (() => {
                  const card2 = CHANCE_CARDS[cardIndex2];
                  addTurnEvent(ctx, turn._id, `Drew Chance: "${card2.text}"`);
                  return executeChanceCard(card2, playerState2, allPlayerStates2, properties);
                })()
              : (() => {
                  const card2 = COMMUNITY_CHEST_CARDS[cardIndex2];
                  addTurnEvent(ctx, turn._id, `Drew Community Chest: "${card2.text}"`);
                  return executeCommunityChestCard(card2, playerState2, allPlayerStates2, properties);
                })();

            // Apply second card effects
            let updatedCash2 = playerState2.cash;
            let updatedPosition2 = playerState2.position;

            if (result2.cashChange && !result2.payEachPlayer && !result2.collectFromEach) {
              updatedCash2 += result2.cashChange;
            }

            if (result2.newPosition !== undefined) {
              updatedPosition2 = result2.newPosition;
            }

            if (result2.goToJail) {
              await ctx.db.patch(player._id, {
                position: JAIL_POSITION,
                inJail: true,
                jailTurnsRemaining: MAX_JAIL_TURNS,
                cash: updatedCash2,
              });
              await addTurnEvent(ctx, turn._id, "Sent to Jail!");
            } else {
              await ctx.db.patch(player._id, {
                position: updatedPosition2,
                cash: updatedCash2,
                getOutOfJailCards: result2.getOutOfJailCard
                  ? (freshPlayer?.getOutOfJailCards ?? player.getOutOfJailCards) + 1
                  : freshPlayer?.getOutOfJailCards ?? player.getOutOfJailCards,
              });

              if (result2.passedGo) {
                await addTurnEvent(ctx, turn._id, `Passed GO - collected $${GO_SALARY}`);
              }
            }

            // Handle second card's pay each player / collect from each
            if (result2.payEachPlayer) {
              const currentPlayer2 = await ctx.db.get(player._id);
              let remainingCash2 = currentPlayer2?.cash ?? updatedCash2;
              for (const other of allPlayers) {
                if (other._id !== player._id && !other.isBankrupt) {
                  const freshOther = await ctx.db.get(other._id);
                  const payment = Math.min(result2.payEachPlayer, remainingCash2);
                  if (payment > 0) {
                    await ctx.db.patch(other._id, { cash: (freshOther?.cash ?? other.cash) + payment });
                    remainingCash2 -= payment;
                  }
                }
              }
              await ctx.db.patch(player._id, { cash: remainingCash2 });
            }
            if (result2.collectFromEach) {
              const currentPlayer2 = await ctx.db.get(player._id);
              let totalCollected2 = 0;
              for (const other of allPlayers) {
                if (other._id !== player._id && !other.isBankrupt) {
                  const freshOther = await ctx.db.get(other._id);
                  const otherCash = freshOther?.cash ?? other.cash;
                  const payment = Math.min(result2.collectFromEach, otherCash);
                  await ctx.db.patch(other._id, { cash: otherCash - payment });
                  totalCollected2 += payment;
                }
              }
              if (currentPlayer2) {
                await ctx.db.patch(player._id, { cash: currentPlayer2.cash + totalCollected2 });
              }
            }
          }
        }
      }

      // Handle pay each player / collect from each
      if (result.payEachPlayer) {
        const currentPlayer = await ctx.db.get(player._id);
        let remainingCash = currentPlayer?.cash ?? updatedCash;
        let totalPaid = 0;
        for (const other of allPlayers) {
          if (other._id !== player._id && !other.isBankrupt) {
            const payment = Math.min(result.payEachPlayer, remainingCash);
            if (payment > 0) {
              await ctx.db.patch(other._id, { cash: other.cash + payment });
              remainingCash -= payment;
              totalPaid += payment;
            }
          }
        }
        await ctx.db.patch(player._id, { cash: remainingCash });

        const eligibleRecipients = allPlayers.filter(
          (p) => p._id !== player._id && !p.isBankrupt
        ).length;
        const requiredTotal = result.payEachPlayer * eligibleRecipients;
        if (totalPaid < requiredTotal) {
          await handleBankruptcy(ctx, game._id, player._id, undefined, properties);
        }
      }
      if (result.collectFromEach) {
        const currentPlayer = await ctx.db.get(player._id);
        let totalCollected = 0;
        for (const other of allPlayers) {
          if (other._id !== player._id && !other.isBankrupt) {
            const payment = Math.min(result.collectFromEach, other.cash);
            await ctx.db.patch(other._id, { cash: other.cash - payment });
            totalCollected += payment;
            if (other.cash < result.collectFromEach) {
              await handleBankruptcy(ctx, game._id, other._id, player._id, properties);
            }
          }
        }
        if (currentPlayer) {
          await ctx.db.patch(player._id, { cash: currentPlayer.cash + totalCollected });
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

  const playerData = await ctx.db.get(player._id);
  if (playerData?.isBankrupt || playerData?.inJail) {
    await ctx.db.patch(game._id, { currentPhase: "turn_end" });
    return;
  }

  // Build player state for validation checks
  const playerState: PlayerState = {
    _id: player._id,
    cash: playerData?.cash ?? player.cash,
    position: playerData?.position ?? player.position,
    inJail: playerData?.inJail ?? player.inJail,
    jailTurnsRemaining: playerData?.jailTurnsRemaining ?? player.jailTurnsRemaining,
    getOutOfJailCards: playerData?.getOutOfJailCards ?? player.getOutOfJailCards,
    isBankrupt: playerData?.isBankrupt ?? player.isBankrupt,
  };

  // Check what actions are actually available for this player
  const canBuild = canBuildAny(playerState, properties);
  const canMortgageProps = canMortgageAny(playerState, properties);
  const canUnmortgageProps = canUnmortgageAny(playerState, properties);

  const context = JSON.stringify({
    phase: "post_roll",
    playerCash: playerData?.cash ?? player.cash,
    canBuild,
    canMortgage: canMortgageProps,
    canUnmortgage: canUnmortgageProps,
  });

  await ctx.db.patch(game._id, {
    waitingForLLM: true,
    pendingDecision: { type: "post_roll_actions", context },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ctx.scheduler.runAfter(0, (internal as any).llmDecisions.getLLMDecision, {
    gameId: game._id,
    playerId: player._id,
    turnId: turn._id,
    decisionType: "post_roll_actions",
    context,
  });
}

async function processTurnEnd(
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  allPlayers: Doc<"players">[],
  turn: Doc<"turns">
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
        .withIndex("by_owner", (q) => q.eq("ownerId", p._id))
        .collect();

      let netWorth = p.cash;
      for (const prop of playerProps) {
        netWorth += prop.isMortgaged ? 0 : getPurchasePrice(prop.position);
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

  // Advance to next player using turnOrder (handles bankruptcy correctly)
  // Find next player by turnOrder, wrapping around if needed
  const currentTurnOrder = player.turnOrder;
  const totalPlayers = (await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .collect()).length;

  // Find next active player by turnOrder
  let nextPlayer = null;
  for (let offset = 1; offset <= totalPlayers; offset++) {
    const nextTurnOrder = (currentTurnOrder + offset) % totalPlayers;
    nextPlayer = activePlayers.find((p) => p.turnOrder === nextTurnOrder);
    if (nextPlayer) break;
  }

  if (!nextPlayer) {
    // Fallback to first active player
    nextPlayer = activePlayers[0];
  }

  // Find index of next player in sorted activePlayers array
  const nextPlayerIndex = activePlayers.findIndex((p) => p._id === nextPlayer!._id);

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

async function addTurnEvent(ctx: MutationCtx, turnId: Id<"turns">, event: string) {
  const turn = await ctx.db.get(turnId);
  if (turn) {
    await ctx.db.patch(turnId, {
      events: [...turn.events, event],
    });
  }
}

async function handleBankruptcy(
  ctx: MutationCtx,
  gameId: Id<"games">,
  playerId: Id<"players">,
  creditorId: Id<"players"> | undefined,
  properties: Doc<"properties">[]
) {
  const player = await ctx.db.get(playerId);
  if (!player) return;

  const game = await ctx.db.get(gameId);
  if (!game) return;

  // Get remaining active players to determine final position
  const allPlayers = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();

  const activePlayers = allPlayers.filter((p) => !p.isBankrupt && p._id !== playerId);
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

    await ctx.db.insert("propertyTransfers", {
      gameId,
      turnNumber: game.currentTurnNumber,
      propertyId: prop._id,
      fromOwnerId: playerId,
      toOwnerId: creditorId,
      reason: creditorId ? "bankruptcy" : "bankruptcy_bank",
      createdAt: Date.now(),
    });

    if (!creditorId) {
      await ctx.db.insert("propertyStateEvents", {
        gameId,
        turnNumber: game.currentTurnNumber,
        propertyId: prop._id,
        houses: 0,
        isMortgaged: false,
        reason: "bankruptcy_reset",
        createdAt: Date.now(),
      });
    }
  }
}

async function handleGameEnd(
  ctx: MutationCtx,
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

  // Update analytics stats
  await ctx.scheduler.runAfter(0, internal.statsAggregator.updateStatsAfterGame, {
    gameId,
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
    if (game.isPaused) throw new Error("Game is already paused");

    await ctx.db.patch(args.gameId, {
      isPaused: true,
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
    if (game.status !== "in_progress") throw new Error("Game is not in progress");
    if (!game.isPaused) throw new Error("Game is not paused");

    await ctx.db.patch(args.gameId, {
      isPaused: false,
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

    // Still update stats for abandoned games (partial data is better than none)
    await ctx.scheduler.runAfter(0, internal.statsAggregator.updateStatsAfterGame, {
      gameId: args.gameId,
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

    const game = await ctx.db.get(property.gameId);
    if (!game) throw new Error("Game not found");

    const cost = args.price ?? getPurchasePrice(property.position);

    if (player.cash < cost) {
      throw new Error("Not enough cash");
    }

    await ctx.db.patch(args.propertyId, { ownerId: args.playerId });
    await ctx.db.patch(args.playerId, { cash: player.cash - cost });

    await ctx.db.insert("propertyTransfers", {
      gameId: property.gameId,
      turnNumber: game.currentTurnNumber,
      propertyId: args.propertyId,
      fromOwnerId: undefined,
      toOwnerId: args.playerId,
      reason: args.price ? "auction" : "purchase",
      createdAt: Date.now(),
    });

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

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

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

        await ctx.db.insert("propertyTransfers", {
          gameId: args.gameId,
          turnNumber: game.currentTurnNumber,
          propertyId: args.propertyId,
          fromOwnerId: undefined,
          toOwnerId: winnerId,
          reason: "auction",
          createdAt: Date.now(),
        });
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
    const houseCost = getHouseCost(property.position);
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

    const mortgageValue = getMortgageValue(property.position);

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

    const mortgageValue = getMortgageValue(property.position);
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

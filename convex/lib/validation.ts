import type { Id } from "../_generated/dataModel";
import {
  UNMORTGAGE_INTEREST,
  HOTEL_LEVEL,
  JAIL_FINE,
} from "./constants";
import { getSpace, getHouseCost, getMortgageValue, isProperty } from "./board";
import type { PropertyState } from "./rent";
import {
  hasMonopoly,
  getPropertiesInGroup,
  getMinHousesInGroup,
  getMaxHousesInGroup,
  getOwnedProperties,
} from "./rent";
import type { GamePhase } from "./types";

// ============================================================
// TYPES
// ============================================================

export interface PlayerState {
  _id: Id<"players">;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurnsRemaining: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
}

export interface GameState {
  currentPhase: GamePhase;
  currentPlayerIndex: number;
}

export type ValidAction =
  | { type: "roll_dice" }
  | { type: "buy_property"; position: number; cost: number }
  | { type: "auction_property"; position: number }
  | { type: "build_house"; position: number; cost: number }
  | { type: "sell_house"; position: number; value: number }
  | { type: "mortgage"; position: number; value: number }
  | { type: "unmortgage"; position: number; cost: number }
  | { type: "pay_jail_fine"; cost: number }
  | { type: "use_jail_card" }
  | { type: "roll_for_doubles" }
  | { type: "propose_trade" }
  | { type: "end_turn" };

// ============================================================
// PURCHASE VALIDATION
// ============================================================

/**
 * Check if a player can buy a property
 */
export function canBuyProperty(
  player: PlayerState,
  property: PropertyState,
  position: number
): { valid: boolean; reason?: string } {
  const space = getSpace(position);

  // Must be an ownable space
  if (space.type !== "property" && space.type !== "railroad" && space.type !== "utility") {
    return { valid: false, reason: "This space cannot be purchased" };
  }

  // Must be unowned
  if (property.ownerId) {
    return { valid: false, reason: "Property is already owned" };
  }

  // Player must have enough cash
  const cost = space.type === "property" ? space.cost : space.cost;
  if (player.cash < cost) {
    return { valid: false, reason: `Not enough cash. Need $${cost}, have $${player.cash}` };
  }

  return { valid: true };
}

// ============================================================
// BUILDING VALIDATION
// ============================================================

/**
 * Check if a player can build a house on a property
 */
export function canBuildHouse(
  player: PlayerState,
  property: PropertyState,
  allProperties: PropertyState[]
): { valid: boolean; reason?: string } {
  // Must be a property (not railroad/utility)
  if (!isProperty(property.position)) {
    return { valid: false, reason: "Can only build on color properties" };
  }

  // Must own the property
  if (property.ownerId !== player._id) {
    return { valid: false, reason: "You don't own this property" };
  }

  // Must have monopoly
  if (!hasMonopoly(player._id, property.group, allProperties)) {
    return { valid: false, reason: "Must own all properties in this color group" };
  }

  // Property must not be mortgaged
  if (property.isMortgaged) {
    return { valid: false, reason: "Cannot build on mortgaged property" };
  }

  // No property in group can be mortgaged
  const groupProps = getPropertiesInGroup(property.group, allProperties);
  if (groupProps.some((p) => p.isMortgaged)) {
    return { valid: false, reason: "Cannot build while any property in group is mortgaged" };
  }

  // Can't exceed hotel (5 houses)
  if (property.houses >= HOTEL_LEVEL) {
    return { valid: false, reason: "Property already has a hotel" };
  }

  // Even building rule: can't have more than 1 house difference in group
  const minHouses = getMinHousesInGroup(property.group, allProperties);
  if (property.houses > minHouses) {
    return { valid: false, reason: "Must build evenly across all properties in group" };
  }

  // Player must afford house cost
  const houseCost = getHouseCost(property.position);
  if (player.cash < houseCost) {
    return { valid: false, reason: `Not enough cash. Need $${houseCost}` };
  }

  return { valid: true };
}

/**
 * Check if a player can sell a house from a property
 */
export function canSellHouse(
  player: PlayerState,
  property: PropertyState,
  allProperties: PropertyState[]
): { valid: boolean; reason?: string } {
  // Must own the property
  if (property.ownerId !== player._id) {
    return { valid: false, reason: "You don't own this property" };
  }

  // Must have at least one house
  if (property.houses === 0) {
    return { valid: false, reason: "No houses to sell" };
  }

  // Even building rule: can't have more than 1 house difference in group
  const maxHouses = getMaxHousesInGroup(property.group, allProperties);
  if (property.houses < maxHouses) {
    return { valid: false, reason: "Must sell evenly across all properties in group" };
  }

  return { valid: true };
}

// ============================================================
// MORTGAGE VALIDATION
// ============================================================

/**
 * Check if a property can be mortgaged
 */
export function canMortgage(
  player: PlayerState,
  property: PropertyState,
  allProperties: PropertyState[]
): { valid: boolean; reason?: string } {
  // Must own the property
  if (property.ownerId !== player._id) {
    return { valid: false, reason: "You don't own this property" };
  }

  // Must not already be mortgaged
  if (property.isMortgaged) {
    return { valid: false, reason: "Property is already mortgaged" };
  }

  // No houses on ANY property in group (must sell houses first)
  const groupProps = getPropertiesInGroup(property.group, allProperties);
  if (groupProps.some((p) => p.houses > 0)) {
    return { valid: false, reason: "Must sell all houses in group before mortgaging" };
  }

  return { valid: true };
}

/**
 * Check if a player can unmortgage a property
 */
export function canUnmortgage(
  player: PlayerState,
  property: PropertyState
): { valid: boolean; reason?: string } {
  // Must own the property
  if (property.ownerId !== player._id) {
    return { valid: false, reason: "You don't own this property" };
  }

  // Must be mortgaged
  if (!property.isMortgaged) {
    return { valid: false, reason: "Property is not mortgaged" };
  }

  // Calculate unmortgage cost (mortgage value + 10% interest)
  const mortgageValue = getMortgageValue(property.position);
  const unmortgageCost = Math.ceil(mortgageValue * (1 + UNMORTGAGE_INTEREST));

  if (player.cash < unmortgageCost) {
    return { valid: false, reason: `Not enough cash. Need $${unmortgageCost}` };
  }

  return { valid: true };
}

// ============================================================
// JAIL VALIDATION
// ============================================================

/**
 * Check if player can pay jail fine
 */
export function canPayJailFine(player: PlayerState): { valid: boolean; reason?: string } {
  if (!player.inJail) {
    return { valid: false, reason: "Not in jail" };
  }

  if (player.cash < JAIL_FINE) {
    return { valid: false, reason: `Not enough cash. Need $${JAIL_FINE}` };
  }

  return { valid: true };
}

/**
 * Check if player can use Get Out of Jail Free card
 */
export function canUseJailCard(player: PlayerState): { valid: boolean; reason?: string } {
  if (!player.inJail) {
    return { valid: false, reason: "Not in jail" };
  }

  if (player.getOutOfJailCards === 0) {
    return { valid: false, reason: "No Get Out of Jail Free cards" };
  }

  return { valid: true };
}

// ============================================================
// GET VALID ACTIONS
// ============================================================

/**
 * Get all valid actions for the current player based on game phase
 */
export function getValidActions(
  player: PlayerState,
  game: GameState,
  properties: PropertyState[],
  landedOnProperty?: PropertyState
): ValidAction[] {
  const actions: ValidAction[] = [];
  const ownedProperties = getOwnedProperties(player._id, properties);

  switch (game.currentPhase) {
    case "pre_roll":
      if (player.inJail) {
        // Jail options
        if (canPayJailFine(player).valid) {
          actions.push({ type: "pay_jail_fine", cost: JAIL_FINE });
        }
        if (canUseJailCard(player).valid) {
          actions.push({ type: "use_jail_card" });
        }
        actions.push({ type: "roll_for_doubles" });
      } else {
        // Normal pre-roll: can build, mortgage, trade, then roll
        addBuildingActions(player, ownedProperties, properties, actions);
        addMortgageActions(player, ownedProperties, properties, actions);
        actions.push({ type: "propose_trade" });
        actions.push({ type: "roll_dice" });
      }
      break;

    case "rolling":
      // During rolling phase, just waiting for dice result
      break;

    case "post_roll":
      // After landing: may need to buy or handle rent
      if (landedOnProperty && !landedOnProperty.ownerId) {
        const space = getSpace(landedOnProperty.position);
        if (space.type === "property" || space.type === "railroad" || space.type === "utility") {
          if (canBuyProperty(player, landedOnProperty, landedOnProperty.position).valid) {
            actions.push({
              type: "buy_property",
              position: landedOnProperty.position,
              cost: space.cost,
            });
          }
          actions.push({
            type: "auction_property",
            position: landedOnProperty.position,
          });
        }
      }

      // Can also build, mortgage, trade after landing
      addBuildingActions(player, ownedProperties, properties, actions);
      addMortgageActions(player, ownedProperties, properties, actions);
      actions.push({ type: "propose_trade" });
      actions.push({ type: "end_turn" });
      break;

    case "turn_end":
      // Turn is ending, no actions available
      break;

    case "game_over":
      // Game is over, no actions
      break;
  }

  return actions;
}

/**
 * Add building actions (build/sell house) to actions array
 */
function addBuildingActions(
  player: PlayerState,
  ownedProperties: PropertyState[],
  allProperties: PropertyState[],
  actions: ValidAction[]
): void {
  for (const prop of ownedProperties) {
    // Check if can build
    const buildResult = canBuildHouse(player, prop, allProperties);
    if (buildResult.valid) {
      const houseCost = getHouseCost(prop.position);
      actions.push({
        type: "build_house",
        position: prop.position,
        cost: houseCost,
      });
    }

    // Check if can sell
    const sellResult = canSellHouse(player, prop, allProperties);
    if (sellResult.valid) {
      const houseValue = Math.floor(getHouseCost(prop.position) / 2);
      actions.push({
        type: "sell_house",
        position: prop.position,
        value: houseValue,
      });
    }
  }
}

/**
 * Add mortgage/unmortgage actions to actions array
 */
function addMortgageActions(
  player: PlayerState,
  ownedProperties: PropertyState[],
  allProperties: PropertyState[],
  actions: ValidAction[]
): void {
  for (const prop of ownedProperties) {
    if (prop.isMortgaged) {
      // Check if can unmortgage
      const unmortgageResult = canUnmortgage(player, prop);
      if (unmortgageResult.valid) {
        const mortgageValue = getMortgageValue(prop.position);
        const unmortgageCost = Math.ceil(mortgageValue * (1 + UNMORTGAGE_INTEREST));
        actions.push({
          type: "unmortgage",
          position: prop.position,
          cost: unmortgageCost,
        });
      }
    } else {
      // Check if can mortgage
      const mortgageResult = canMortgage(player, prop, allProperties);
      if (mortgageResult.valid) {
        const mortgageValue = getMortgageValue(prop.position);
        actions.push({
          type: "mortgage",
          position: prop.position,
          value: mortgageValue,
        });
      }
    }
  }
}

// ============================================================
// QUICK CHECKS FOR AVAILABLE ACTIONS
// These return true if the player has at least one valid action of this type
// ============================================================

/**
 * Check if player can build on ANY of their properties
 */
export function canBuildAny(
  player: PlayerState,
  allProperties: PropertyState[]
): boolean {
  const ownedProperties = getOwnedProperties(player._id, allProperties);
  return ownedProperties.some((prop) => canBuildHouse(player, prop, allProperties).valid);
}

/**
 * Check if player can mortgage ANY of their properties
 */
export function canMortgageAny(
  player: PlayerState,
  allProperties: PropertyState[]
): boolean {
  const ownedProperties = getOwnedProperties(player._id, allProperties);
  return ownedProperties.some((prop) => canMortgage(player, prop, allProperties).valid);
}

/**
 * Check if player can unmortgage ANY of their properties
 */
export function canUnmortgageAny(
  player: PlayerState,
  allProperties: PropertyState[]
): boolean {
  const ownedProperties = getOwnedProperties(player._id, allProperties);
  return ownedProperties.some((prop) => canUnmortgage(player, prop).valid);
}

// ============================================================
// TRADE VALIDATION
// ============================================================

export interface TradeOffer {
  offerMoney: number;
  offerProperties: Id<"properties">[];
  offerGetOutOfJailCards: number;
  requestMoney: number;
  requestProperties: Id<"properties">[];
  requestGetOutOfJailCards: number;
}

/**
 * Validate a trade offer
 */
export function canProposeTrade(
  proposer: PlayerState,
  recipient: PlayerState,
  offer: TradeOffer,
  allProperties: PropertyState[]
): { valid: boolean; reason?: string } {
  // Proposer must have enough cash
  if (proposer.cash < offer.offerMoney) {
    return { valid: false, reason: "Proposer doesn't have enough cash" };
  }

  // Proposer must have enough jail cards
  if (proposer.getOutOfJailCards < offer.offerGetOutOfJailCards) {
    return { valid: false, reason: "Proposer doesn't have enough Get Out of Jail cards" };
  }

  // Proposer must own offered properties
  for (const propId of offer.offerProperties) {
    const prop = allProperties.find((p) => p._id === propId);
    if (!prop || prop.ownerId !== proposer._id) {
      return { valid: false, reason: "Proposer doesn't own one of the offered properties" };
    }
    // Cannot trade properties with houses
    if (prop.houses > 0) {
      return { valid: false, reason: "Cannot trade properties with houses" };
    }
  }

  // Recipient must have enough cash
  if (recipient.cash < offer.requestMoney) {
    return { valid: false, reason: "Recipient doesn't have enough cash" };
  }

  // Recipient must have enough jail cards
  if (recipient.getOutOfJailCards < offer.requestGetOutOfJailCards) {
    return { valid: false, reason: "Recipient doesn't have enough Get Out of Jail cards" };
  }

  // Recipient must own requested properties
  for (const propId of offer.requestProperties) {
    const prop = allProperties.find((p) => p._id === propId);
    if (!prop || prop.ownerId !== recipient._id) {
      return { valid: false, reason: "Recipient doesn't own one of the requested properties" };
    }
    // Cannot trade properties with houses
    if (prop.houses > 0) {
      return { valid: false, reason: "Cannot trade properties with houses" };
    }
  }

  return { valid: true };
}

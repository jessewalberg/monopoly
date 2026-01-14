import { Id } from "../_generated/dataModel";
import {
  MORTGAGE_RATE,
  HOTEL_LEVEL,
} from "./constants";
import {
  getSpace,
  getPurchasePrice,
  getMortgageValue,
  getHouseCost,
} from "./board";
import { PropertyState, getOwnedProperties } from "./rent";

// ============================================================
// TYPES
// ============================================================

export interface PlayerState {
  _id: Id<"players">;
  cash: number;
}

// ============================================================
// NET WORTH CALCULATION
// ============================================================

/**
 * Calculate a player's total net worth
 * Net worth = cash + property values + building values
 */
export function calculateNetWorth(
  player: PlayerState,
  properties: PropertyState[]
): number {
  let netWorth = player.cash;

  const ownedProperties = getOwnedProperties(player._id, properties);

  for (const prop of ownedProperties) {
    if (prop.isMortgaged) {
      // Mortgaged properties are worth half their value (mortgage amount)
      netWorth += getMortgageValue(prop.position);
    } else {
      // Unmortgaged properties worth full purchase price
      netWorth += getPurchasePrice(prop.position);
    }

    // Add building value (houses sell for half cost)
    if (prop.houses > 0) {
      const houseCost = getHouseCost(prop.position);
      const buildingCount = prop.houses >= HOTEL_LEVEL ? 5 : prop.houses;
      const buildingValue = Math.floor((buildingCount * houseCost) / 2);
      netWorth += buildingValue;
    }
  }

  return netWorth;
}

/**
 * Calculate the liquidation value of a player's assets
 * This is what they could raise by selling everything
 */
export function calculateLiquidationValue(
  player: PlayerState,
  properties: PropertyState[]
): number {
  let liquidValue = player.cash;

  const ownedProperties = getOwnedProperties(player._id, properties);

  for (const prop of ownedProperties) {
    // Can mortgage unmortgaged properties
    if (!prop.isMortgaged) {
      liquidValue += getMortgageValue(prop.position);
    }

    // Can sell buildings at half price
    if (prop.houses > 0) {
      const houseCost = getHouseCost(prop.position);
      const buildingCount = prop.houses >= HOTEL_LEVEL ? 5 : prop.houses;
      liquidValue += Math.floor((buildingCount * houseCost) / 2);
    }
  }

  return liquidValue;
}

/**
 * Check if a player could afford an amount by liquidating assets
 */
export function canAfford(
  player: PlayerState,
  amount: number,
  properties: PropertyState[]
): boolean {
  const liquidValue = calculateLiquidationValue(player, properties);
  return liquidValue >= amount;
}

/**
 * Check if a player is bankrupt (cannot pay a debt)
 */
export function isBankrupt(
  player: PlayerState,
  debtAmount: number,
  properties: PropertyState[]
): boolean {
  return !canAfford(player, debtAmount, properties);
}

// ============================================================
// ASSET LIQUIDATION HELPERS
// ============================================================

export interface LiquidationAction {
  type: "sell_house" | "mortgage";
  propertyId: Id<"properties">;
  propertyName: string;
  cashGained: number;
}

/**
 * Get suggested liquidation actions to raise a target amount
 * Returns actions in order of preference (sell houses first, then mortgage)
 */
export function getSuggestedLiquidation(
  player: PlayerState,
  targetAmount: number,
  properties: PropertyState[]
): LiquidationAction[] {
  const actions: LiquidationAction[] = [];
  let currentCash = player.cash;
  const ownedProperties = [...getOwnedProperties(player._id, properties)];

  // If already have enough, no liquidation needed
  if (currentCash >= targetAmount) {
    return [];
  }

  // First, try selling houses (must sell evenly, so we do one at a time from highest)
  // Sort by houses descending
  const propertiesWithHouses = ownedProperties
    .filter((p) => p.houses > 0)
    .sort((a, b) => b.houses - a.houses);

  while (currentCash < targetAmount && propertiesWithHouses.length > 0) {
    // Find property with most houses
    const prop = propertiesWithHouses[0];
    if (prop.houses === 0) break;

    const houseCost = getHouseCost(prop.position);
    const sellValue = Math.floor(houseCost / 2);

    actions.push({
      type: "sell_house",
      propertyId: prop._id,
      propertyName: prop.name,
      cashGained: sellValue,
    });

    currentCash += sellValue;
    prop.houses--;

    // Re-sort
    propertiesWithHouses.sort((a, b) => b.houses - a.houses);
    // Remove if no more houses
    if (propertiesWithHouses[0]?.houses === 0) {
      propertiesWithHouses.shift();
    }
  }

  // If still not enough, mortgage properties (prefer lower value first)
  if (currentCash < targetAmount) {
    const unmortgagedProps = ownedProperties
      .filter((p) => !p.isMortgaged && p.houses === 0)
      .sort((a, b) => getPurchasePrice(a.position) - getPurchasePrice(b.position));

    for (const prop of unmortgagedProps) {
      if (currentCash >= targetAmount) break;

      const mortgageValue = getMortgageValue(prop.position);

      actions.push({
        type: "mortgage",
        propertyId: prop._id,
        propertyName: prop.name,
        cashGained: mortgageValue,
      });

      currentCash += mortgageValue;
    }
  }

  return actions;
}

// ============================================================
// BANKRUPTCY RESOLUTION
// ============================================================

export interface BankruptcyResult {
  isBankrupt: boolean;
  canResolve: boolean;
  amountOwed: number;
  amountCanPay: number;
  liquidationActions: LiquidationAction[];
}

/**
 * Analyze a player's bankruptcy situation
 */
export function analyzeBankruptcy(
  player: PlayerState,
  debtAmount: number,
  properties: PropertyState[]
): BankruptcyResult {
  const liquidValue = calculateLiquidationValue(player, properties);
  const canResolve = liquidValue >= debtAmount;
  const amountCanPay = Math.min(liquidValue, debtAmount);

  return {
    isBankrupt: !canResolve,
    canResolve,
    amountOwed: debtAmount,
    amountCanPay,
    liquidationActions: canResolve
      ? getSuggestedLiquidation(player, debtAmount, properties)
      : getSuggestedLiquidation(player, liquidValue, properties), // Liquidate everything
  };
}

/**
 * Get all properties that would transfer to creditor on bankruptcy
 */
export function getPropertiesForBankruptcyTransfer(
  bankruptPlayerId: Id<"players">,
  properties: PropertyState[]
): PropertyState[] {
  return getOwnedProperties(bankruptPlayerId, properties);
}

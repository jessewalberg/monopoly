import {
  BOARD,
  
  HOTEL_LEVEL,
  MORTGAGE_RATE,
  PROPERTY_GROUPS,
  
  
  RAILROAD_RENT,
  
  UTILITY_MULTIPLIER_BOTH,
  UTILITY_MULTIPLIER_ONE
  
} from './constants'
import type {BoardSpace, PropertyGroup, PropertySpace, RailroadSpace, UtilitySpace} from './constants';

// ============================================================
// SPACE GETTERS
// ============================================================

/**
 * Get space data by position (0-39)
 */
export function getSpace(position: number): BoardSpace {
  const normalizedPos = ((position % 40) + 40) % 40
  return BOARD[normalizedPos]
}

/**
 * Get property data if position is a property, null otherwise
 */
export function getPropertyData(position: number): PropertySpace | null {
  const space = getSpace(position)
  return space.type === 'property' ? space : null
}

/**
 * Get railroad data if position is a railroad, null otherwise
 */
export function getRailroadData(position: number): RailroadSpace | null {
  const space = getSpace(position)
  return space.type === 'railroad' ? space : null
}

/**
 * Get utility data if position is a utility, null otherwise
 */
export function getUtilityData(position: number): UtilitySpace | null {
  const space = getSpace(position)
  return space.type === 'utility' ? space : null
}

// ============================================================
// TYPE CHECKS
// ============================================================

export function isProperty(position: number): boolean {
  return getSpace(position).type === 'property'
}

export function isRailroad(position: number): boolean {
  return getSpace(position).type === 'railroad'
}

export function isUtility(position: number): boolean {
  return getSpace(position).type === 'utility'
}

export function isOwnable(position: number): boolean {
  const type = getSpace(position).type
  return type === 'property' || type === 'railroad' || type === 'utility'
}

export function isChance(position: number): boolean {
  return getSpace(position).type === 'chance'
}

export function isCommunityChest(position: number): boolean {
  return getSpace(position).type === 'community_chest'
}

export function isTax(position: number): boolean {
  return getSpace(position).type === 'tax'
}

export function isGoToJail(position: number): boolean {
  return getSpace(position).type === 'go_to_jail'
}

// ============================================================
// GROUP HELPERS
// ============================================================

/**
 * Get all positions in a property group
 */
export function getGroupPositions(group: string): ReadonlyArray<number> {
  if (Object.prototype.hasOwnProperty.call(PROPERTY_GROUPS, group)) {
    return PROPERTY_GROUPS[group as keyof typeof PROPERTY_GROUPS]
  }
  return []
}

/**
 * Get the group for a position (property group, "railroad", or "utility")
 */
export function getGroupForPosition(position: number): string | null {
  const space = getSpace(position)
  if (space.type === 'property') {
    return space.group
  }
  if (space.type === 'railroad') {
    return 'railroad'
  }
  if (space.type === 'utility') {
    return 'utility'
  }
  return null
}

/**
 * Check if a player owns all properties in a group (monopoly)
 */
export function hasMonopoly(
  group: string,
  playerOwnedPositions: Array<number>,
): boolean {
  const groupPositions = getGroupPositions(group)
  return groupPositions.every((pos) => playerOwnedPositions.includes(pos))
}

/**
 * Get all property groups (excluding railroad and utility)
 */
export function getPropertyGroups(): Array<PropertyGroup> {
  return [
    'brown',
    'light_blue',
    'pink',
    'orange',
    'red',
    'yellow',
    'green',
    'dark_blue',
  ]
}

// ============================================================
// RENT CALCULATION
// ============================================================

/**
 * Calculate rent for a property based on houses and monopoly status
 */
export function calculatePropertyRent(
  position: number,
  houses: number,
  ownsMonopoly: boolean,
): number {
  const property = getPropertyData(position)
  if (!property) return 0

  // If has houses/hotel, use that rent level
  if (houses > 0) {
    return property.rent[Math.min(houses, 5)]
  }

  // Base rent, doubled if monopoly
  const baseRent = property.rent[0]
  return ownsMonopoly ? baseRent * 2 : baseRent
}

/**
 * Calculate rent for a railroad based on number owned
 */
export function calculateRailroadRent(railroadsOwned: number): number {
  if (railroadsOwned < 1 || railroadsOwned > 4) return 0
  return RAILROAD_RENT[railroadsOwned - 1]
}

/**
 * Calculate rent for a utility based on dice roll and utilities owned
 */
export function calculateUtilityRent(
  diceTotal: number,
  utilitiesOwned: number,
): number {
  if (utilitiesOwned === 1) {
    return diceTotal * UTILITY_MULTIPLIER_ONE
  }
  if (utilitiesOwned === 2) {
    return diceTotal * UTILITY_MULTIPLIER_BOTH
  }
  return 0
}

// ============================================================
// PRICE HELPERS
// ============================================================

/**
 * Get purchase price for any ownable space
 */
export function getPurchasePrice(position: number): number {
  const space = getSpace(position)
  if (
    space.type === 'property' ||
    space.type === 'railroad' ||
    space.type === 'utility'
  ) {
    return space.cost
  }
  return 0
}

/**
 * Get mortgage value for a property (half of purchase price)
 */
export function getMortgageValue(position: number): number {
  return Math.floor(getPurchasePrice(position) * MORTGAGE_RATE)
}

/**
 * Get unmortgage cost (mortgage value + 10% interest)
 */
export function getUnmortgageCost(position: number): number {
  const mortgageValue = getMortgageValue(position)
  return Math.ceil(mortgageValue * 1.1)
}

/**
 * Get house cost for a property
 */
export function getHouseCost(position: number): number {
  const property = getPropertyData(position)
  return property?.houseCost ?? 0
}

/**
 * Get hotel cost (same as house cost in standard Monopoly)
 */
export function getHotelCost(position: number): number {
  return getHouseCost(position)
}

// ============================================================
// BUILDING HELPERS
// ============================================================

/**
 * Check if a property can have houses built on it
 */
export function canBuildHouse(
  position: number,
  currentHouses: number,
  ownsMonopoly: boolean,
  isMortgaged: boolean,
): boolean {
  if (!isProperty(position)) return false
  if (!ownsMonopoly) return false
  if (isMortgaged) return false
  if (currentHouses >= HOTEL_LEVEL) return false // Already has hotel
  return true
}

/**
 * Check if a house can be sold from a property
 */
export function canSellHouse(position: number, currentHouses: number): boolean {
  if (!isProperty(position)) return false
  return currentHouses > 0
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================

/**
 * Calculate new position after moving, handling wraparound
 */
export function calculateNewPosition(
  currentPosition: number,
  spaces: number,
): number {
  return (((currentPosition + spaces) % 40) + 40) % 40
}

/**
 * Check if player passed GO when moving from one position to another
 */
export function passedGo(
  fromPosition: number,
  toPosition: number,
  movedForward: boolean = true,
): boolean {
  if (!movedForward) return false
  // Passed GO if we wrapped around (new position is less than old, and we moved forward)
  return toPosition < fromPosition
}

/**
 * Find nearest space of a type from current position (moving forward)
 */
export function findNearestSpace(
  currentPosition: number,
  type: 'railroad' | 'utility',
): number {
  const positions =
    type === 'railroad' ? PROPERTY_GROUPS.railroad : PROPERTY_GROUPS.utility

  // Find the next one ahead of current position
  for (const pos of positions) {
    if (pos > currentPosition) {
      return pos
    }
  }
  // Wrap around to first one
  return positions[0]
}

// ============================================================
// PROPERTY INFO HELPERS
// ============================================================

/**
 * Get all ownable positions on the board
 */
export function getAllOwnablePositions(): Array<number> {
  return BOARD.filter(
    (space) =>
      space.type === 'property' ||
      space.type === 'railroad' ||
      space.type === 'utility',
  ).map((space) => space.pos)
}

/**
 * Get all properties in a group with their data
 */
export function getPropertiesInGroup(group: string): Array<PropertySpace> {
  const positions = getGroupPositions(group)
  return positions
    .map((pos) => getPropertyData(pos))
    .filter((p): p is PropertySpace => p !== null)
}

/**
 * Get the space name by position
 */
export function getSpaceName(position: number): string {
  return getSpace(position).name
}

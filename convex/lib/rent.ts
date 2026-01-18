import {
  RAILROAD_RENT,
  UTILITY_MULTIPLIER_BOTH,
  UTILITY_MULTIPLIER_ONE,
} from './constants'
import { getGroupPositions, getSpace } from './board'
import type { Id } from '../_generated/dataModel'

// ============================================================
// TYPES
// ============================================================

export interface PropertyState {
  _id: Id<'properties'>
  position: number
  name: string
  group: string
  ownerId?: Id<'players'>
  houses: number
  isMortgaged: boolean
}

// ============================================================
// OWNERSHIP HELPERS
// ============================================================

/**
 * Check if a player owns all properties in a group (has monopoly)
 */
export function hasMonopoly(
  ownerId: Id<'players'>,
  group: string,
  properties: Array<PropertyState>,
): boolean {
  const groupPositions = getGroupPositions(group)
  if (groupPositions.length === 0) return false

  return groupPositions.every((pos) => {
    const prop = properties.find((p) => p.position === pos)
    return prop?.ownerId === ownerId
  })
}

/**
 * Count how many properties in a group are owned by a player
 */
export function countOwnedInGroup(
  ownerId: Id<'players'>,
  group: string,
  properties: Array<PropertyState>,
): number {
  const groupPositions = getGroupPositions(group)
  return groupPositions.filter((pos) => {
    const prop = properties.find((p) => p.position === pos)
    return prop?.ownerId === ownerId
  }).length
}

/**
 * Get all properties owned by a player
 */
export function getOwnedProperties(
  ownerId: Id<'players'>,
  properties: Array<PropertyState>,
): Array<PropertyState> {
  return properties.filter((p) => p.ownerId === ownerId)
}

/**
 * Get all properties in a group
 */
export function getPropertiesInGroup(
  group: string,
  properties: Array<PropertyState>,
): Array<PropertyState> {
  const groupPositions = getGroupPositions(group)
  return properties.filter((p) => groupPositions.includes(p.position))
}

// ============================================================
// RENT CALCULATION
// ============================================================

/**
 * Calculate rent for any property type
 * @param property - The property being landed on
 * @param allProperties - All properties in the game
 * @param ownerPlayerId - The owner of the property
 * @param diceTotal - Required for utility rent calculation
 */
export function calculateRent(
  property: PropertyState,
  allProperties: Array<PropertyState>,
  ownerPlayerId: Id<'players'>,
  diceTotal?: number,
): number {
  // No rent if mortgaged
  if (property.isMortgaged) {
    return 0
  }

  // No rent if unowned
  if (!property.ownerId || property.ownerId !== ownerPlayerId) {
    return 0
  }

  const space = getSpace(property.position)

  // Utility rent
  if (space.type === 'utility') {
    return calculateUtilityRent(ownerPlayerId, allProperties, diceTotal ?? 0)
  }

  // Railroad rent
  if (space.type === 'railroad') {
    return calculateRailroadRent(ownerPlayerId, allProperties)
  }

  // Property rent
  if (space.type === 'property') {
    return calculatePropertyRent(property, allProperties, ownerPlayerId)
  }

  return 0
}

/**
 * Calculate rent for a standard property
 */
export function calculatePropertyRent(
  property: PropertyState,
  allProperties: Array<PropertyState>,
  ownerId: Id<'players'>,
): number {
  const space = getSpace(property.position)
  if (space.type !== 'property') return 0

  // If has houses/hotel, use that rent level
  if (property.houses > 0) {
    const rentIndex = Math.min(property.houses, 5)
    return space.rent[rentIndex]
  }

  // Base rent
  const baseRent = space.rent[0]

  // Double rent if owner has monopoly
  if (hasMonopoly(ownerId, property.group, allProperties)) {
    return baseRent * 2
  }

  return baseRent
}

/**
 * Calculate rent for a railroad based on how many the owner has
 */
export function calculateRailroadRent(
  ownerId: Id<'players'>,
  allProperties: Array<PropertyState>,
): number {
  const railroadsOwned = countOwnedInGroup(ownerId, 'railroad', allProperties)

  // Check if any owned railroads are mortgaged - still count them for rent calculation
  // but if THIS railroad is mortgaged, rent would be 0 (handled by caller)

  if (railroadsOwned < 1 || railroadsOwned > 4) return 0
  return RAILROAD_RENT[railroadsOwned - 1]
}

/**
 * Calculate rent for a utility based on dice roll and utilities owned
 */
export function calculateUtilityRent(
  ownerId: Id<'players'>,
  allProperties: Array<PropertyState>,
  diceTotal: number,
): number {
  const utilitiesOwned = countOwnedInGroup(ownerId, 'utility', allProperties)

  if (utilitiesOwned === 1) {
    return diceTotal * UTILITY_MULTIPLIER_ONE
  }
  if (utilitiesOwned === 2) {
    return diceTotal * UTILITY_MULTIPLIER_BOTH
  }
  return 0
}

// ============================================================
// BUILDING HELPERS
// ============================================================

/**
 * Count total houses across all properties (not including hotels)
 */
export function countTotalHouses(properties: Array<PropertyState>): number {
  return properties.reduce((total, p) => {
    // Houses 1-4 count as houses, 5 is a hotel
    if (p.houses > 0 && p.houses < 5) {
      return total + p.houses
    }
    return total
  }, 0)
}

/**
 * Count total hotels across all properties
 */
export function countTotalHotels(properties: Array<PropertyState>): number {
  return properties.filter((p) => p.houses === 5).length
}

/**
 * Count houses/hotels owned by a specific player
 */
export function countPlayerBuildings(
  ownerId: Id<'players'>,
  properties: Array<PropertyState>,
): { houses: number; hotels: number } {
  const owned = getOwnedProperties(ownerId, properties)
  return {
    houses: countTotalHouses(owned),
    hotels: countTotalHotels(owned),
  }
}

/**
 * Get the minimum houses on any property in a group (for even building rule)
 */
export function getMinHousesInGroup(
  group: string,
  properties: Array<PropertyState>,
): number {
  const groupProps = getPropertiesInGroup(group, properties)
  if (groupProps.length === 0) return 0
  return Math.min(...groupProps.map((p) => p.houses))
}

/**
 * Get the maximum houses on any property in a group (for even building rule)
 */
export function getMaxHousesInGroup(
  group: string,
  properties: Array<PropertyState>,
): number {
  const groupProps = getPropertiesInGroup(group, properties)
  if (groupProps.length === 0) return 0
  return Math.max(...groupProps.map((p) => p.houses))
}

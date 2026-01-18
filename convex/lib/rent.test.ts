import { describe, expect, it } from 'vitest'
import {
  
  calculateRailroadRent,
  calculateRent,
  calculateUtilityRent,
  countOwnedInGroup,
  getMaxHousesInGroup,
  getMinHousesInGroup,
  hasMonopoly
} from './rent'
import type {PropertyState} from './rent';
import type { Id } from '../_generated/dataModel'

// ============================================================
// TEST HELPERS
// ============================================================

// Mock player IDs
const PLAYER_1 = 'player1' as Id<'players'>
const PLAYER_2 = 'player2' as Id<'players'>

// Create a property state helper
function createProperty(
  position: number,
  name: string,
  group: string,
  ownerId?: Id<'players'>,
  houses = 0,
  isMortgaged = false,
): PropertyState {
  return {
    _id: `prop_${position}` as Id<'properties'>,
    position,
    name,
    group,
    ownerId,
    houses,
    isMortgaged,
  }
}

// ============================================================
// PROPERTY RENT TESTS
// ============================================================

describe('calculatePropertyRent', () => {
  it('returns 0 for mortgaged property', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, true),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 0, false),
    ]

    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(0)
  })

  it('returns base rent for property without monopoly', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_2, 0, false),
    ]

    // Mediterranean base rent is $2
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(2)
  })

  it('returns double rent for property with monopoly (no houses)', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 0, false),
    ]

    // Mediterranean base rent is $2, doubled = $4
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(4)
  })

  it('returns correct rent with 1 house', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 1, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 1, false),
    ]

    // Mediterranean 1-house rent is $10
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(10)
  })

  it('returns correct rent with 2 houses', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 2, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 2, false),
    ]

    // Mediterranean 2-house rent is $30
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(30)
  })

  it('returns correct rent with 3 houses', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 3, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 3, false),
    ]

    // Mediterranean 3-house rent is $90
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(90)
  })

  it('returns correct rent with 4 houses', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 4, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 4, false),
    ]

    // Mediterranean 4-house rent is $160
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(160)
  })

  it('returns correct rent with hotel (5 houses)', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 5, false),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 5, false),
    ]

    // Mediterranean hotel rent is $250
    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(250)
  })

  it('returns correct rent for expensive property - Boardwalk', () => {
    const properties = [
      createProperty(37, 'Park Place', 'dark_blue', PLAYER_1, 0, false),
      createProperty(39, 'Boardwalk', 'dark_blue', PLAYER_1, 0, false),
    ]

    // Boardwalk base rent is $50, doubled with monopoly = $100
    const rent = calculateRent(properties[1], properties, PLAYER_1)
    expect(rent).toBe(100)
  })

  it('returns correct hotel rent for Boardwalk', () => {
    const properties = [
      createProperty(37, 'Park Place', 'dark_blue', PLAYER_1, 5, false),
      createProperty(39, 'Boardwalk', 'dark_blue', PLAYER_1, 5, false),
    ]

    // Boardwalk hotel rent is $2000
    const rent = calculateRent(properties[1], properties, PLAYER_1)
    expect(rent).toBe(2000)
  })
})

// ============================================================
// RAILROAD RENT TESTS
// ============================================================

describe('calculateRailroadRent', () => {
  it('returns $25 for 1 railroad', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1, 0, false),
    ]

    const rent = calculateRailroadRent(PLAYER_1, properties)
    expect(rent).toBe(25)
  })

  it('returns $50 for 2 railroads', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1, 0, false),
      createProperty(
        15,
        'Pennsylvania Railroad',
        'railroad',
        PLAYER_1,
        0,
        false,
      ),
    ]

    const rent = calculateRailroadRent(PLAYER_1, properties)
    expect(rent).toBe(50)
  })

  it('returns $100 for 3 railroads', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1, 0, false),
      createProperty(
        15,
        'Pennsylvania Railroad',
        'railroad',
        PLAYER_1,
        0,
        false,
      ),
      createProperty(25, 'B&O Railroad', 'railroad', PLAYER_1, 0, false),
    ]

    const rent = calculateRailroadRent(PLAYER_1, properties)
    expect(rent).toBe(100)
  })

  it('returns $200 for 4 railroads', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1, 0, false),
      createProperty(
        15,
        'Pennsylvania Railroad',
        'railroad',
        PLAYER_1,
        0,
        false,
      ),
      createProperty(25, 'B&O Railroad', 'railroad', PLAYER_1, 0, false),
      createProperty(35, 'Short Line', 'railroad', PLAYER_1, 0, false),
    ]

    const rent = calculateRailroadRent(PLAYER_1, properties)
    expect(rent).toBe(200)
  })

  it('returns 0 for mortgaged railroad', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1, 0, true),
    ]

    const rent = calculateRent(properties[0], properties, PLAYER_1)
    expect(rent).toBe(0)
  })
})

// ============================================================
// UTILITY RENT TESTS
// ============================================================

describe('calculateUtilityRent', () => {
  it('returns dice × 4 for 1 utility', () => {
    const properties = [
      createProperty(12, 'Electric Company', 'utility', PLAYER_1, 0, false),
    ]

    // Dice roll of 7: 7 × 4 = $28
    const rent = calculateUtilityRent(PLAYER_1, properties, 7)
    expect(rent).toBe(28)
  })

  it('returns dice × 10 for 2 utilities', () => {
    const properties = [
      createProperty(12, 'Electric Company', 'utility', PLAYER_1, 0, false),
      createProperty(28, 'Water Works', 'utility', PLAYER_1, 0, false),
    ]

    // Dice roll of 7: 7 × 10 = $70
    const rent = calculateUtilityRent(PLAYER_1, properties, 7)
    expect(rent).toBe(70)
  })

  it('returns dice × 10 for snake eyes (2)', () => {
    const properties = [
      createProperty(12, 'Electric Company', 'utility', PLAYER_1, 0, false),
      createProperty(28, 'Water Works', 'utility', PLAYER_1, 0, false),
    ]

    // Dice roll of 2: 2 × 10 = $20
    const rent = calculateUtilityRent(PLAYER_1, properties, 2)
    expect(rent).toBe(20)
  })

  it('returns dice × 10 for max roll (12)', () => {
    const properties = [
      createProperty(12, 'Electric Company', 'utility', PLAYER_1, 0, false),
      createProperty(28, 'Water Works', 'utility', PLAYER_1, 0, false),
    ]

    // Dice roll of 12: 12 × 10 = $120
    const rent = calculateUtilityRent(PLAYER_1, properties, 12)
    expect(rent).toBe(120)
  })

  it('returns 0 for mortgaged utility', () => {
    const properties = [
      createProperty(12, 'Electric Company', 'utility', PLAYER_1, 0, true),
    ]

    const rent = calculateRent(properties[0], properties, PLAYER_1, 7)
    expect(rent).toBe(0)
  })
})

// ============================================================
// MONOPOLY TESTS
// ============================================================

describe('hasMonopoly', () => {
  it('returns true when player owns all properties in 2-property group', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    expect(hasMonopoly(PLAYER_1, 'brown', properties)).toBe(true)
  })

  it('returns false when player owns only 1 of 2 properties', () => {
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_2),
    ]

    expect(hasMonopoly(PLAYER_1, 'brown', properties)).toBe(false)
  })

  it('returns true when player owns all properties in 3-property group', () => {
    const properties = [
      createProperty(6, 'Oriental Avenue', 'light_blue', PLAYER_1),
      createProperty(8, 'Vermont Avenue', 'light_blue', PLAYER_1),
      createProperty(9, 'Connecticut Avenue', 'light_blue', PLAYER_1),
    ]

    expect(hasMonopoly(PLAYER_1, 'light_blue', properties)).toBe(true)
  })

  it('returns false when player owns only 2 of 3 properties', () => {
    const properties = [
      createProperty(6, 'Oriental Avenue', 'light_blue', PLAYER_1),
      createProperty(8, 'Vermont Avenue', 'light_blue', PLAYER_1),
      createProperty(9, 'Connecticut Avenue', 'light_blue', PLAYER_2),
    ]

    expect(hasMonopoly(PLAYER_1, 'light_blue', properties)).toBe(false)
  })

  it('returns true when player owns all 4 railroads', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1),
      createProperty(15, 'Pennsylvania Railroad', 'railroad', PLAYER_1),
      createProperty(25, 'B&O Railroad', 'railroad', PLAYER_1),
      createProperty(35, 'Short Line', 'railroad', PLAYER_1),
    ]

    expect(hasMonopoly(PLAYER_1, 'railroad', properties)).toBe(true)
  })
})

// ============================================================
// COUNT OWNED IN GROUP TESTS
// ============================================================

describe('countOwnedInGroup', () => {
  it('returns correct count for railroads', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1),
      createProperty(15, 'Pennsylvania Railroad', 'railroad', PLAYER_1),
      createProperty(25, 'B&O Railroad', 'railroad', PLAYER_2),
      createProperty(35, 'Short Line', 'railroad', undefined),
    ]

    expect(countOwnedInGroup(PLAYER_1, 'railroad', properties)).toBe(2)
    expect(countOwnedInGroup(PLAYER_2, 'railroad', properties)).toBe(1)
  })

  it('returns 0 when player owns none', () => {
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_2),
    ]

    expect(countOwnedInGroup(PLAYER_1, 'railroad', properties)).toBe(0)
  })
})

// ============================================================
// EVEN BUILDING RULE TESTS
// ============================================================

describe('getMinHousesInGroup / getMaxHousesInGroup', () => {
  it('returns correct min/max for even houses', () => {
    const properties = [
      createProperty(6, 'Oriental Avenue', 'light_blue', PLAYER_1, 2),
      createProperty(8, 'Vermont Avenue', 'light_blue', PLAYER_1, 2),
      createProperty(9, 'Connecticut Avenue', 'light_blue', PLAYER_1, 2),
    ]

    expect(getMinHousesInGroup('light_blue', properties)).toBe(2)
    expect(getMaxHousesInGroup('light_blue', properties)).toBe(2)
  })

  it('returns correct min/max for uneven houses', () => {
    const properties = [
      createProperty(6, 'Oriental Avenue', 'light_blue', PLAYER_1, 1),
      createProperty(8, 'Vermont Avenue', 'light_blue', PLAYER_1, 2),
      createProperty(9, 'Connecticut Avenue', 'light_blue', PLAYER_1, 3),
    ]

    expect(getMinHousesInGroup('light_blue', properties)).toBe(1)
    expect(getMaxHousesInGroup('light_blue', properties)).toBe(3)
  })

  it('returns 0 for properties with no houses', () => {
    const properties = [
      createProperty(6, 'Oriental Avenue', 'light_blue', PLAYER_1, 0),
      createProperty(8, 'Vermont Avenue', 'light_blue', PLAYER_1, 0),
      createProperty(9, 'Connecticut Avenue', 'light_blue', PLAYER_1, 0),
    ]

    expect(getMinHousesInGroup('light_blue', properties)).toBe(0)
    expect(getMaxHousesInGroup('light_blue', properties)).toBe(0)
  })
})

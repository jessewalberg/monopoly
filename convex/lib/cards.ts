import {
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  
  
  GO_SALARY,
  JAIL_POSITION
} from './constants'
import { calculateNewPosition, findNearestSpace, passedGo } from './board'
import { countPlayerBuildings } from './rent'
import type {ChanceCard, CommunityChestCard} from './constants';
import type { Id } from '../_generated/dataModel'
import type { PropertyState } from './rent'

// Re-export for convenience
export { CHANCE_CARDS, COMMUNITY_CHEST_CARDS }

// ============================================================
// TYPES
// ============================================================

export interface PlayerState {
  _id: Id<'players'>
  cash: number
  position: number
}

export interface CardResult {
  newPosition?: number
  cashChange?: number
  goToJail?: boolean
  getOutOfJailCard?: boolean
  passedGo?: boolean
  // For "pay each player" cards
  payEachPlayer?: number
  // For "collect from each player" cards
  collectFromEach?: number
  // For building repair cards
  payPerBuilding?: { perHouse: number; perHotel: number }
  // Card text for logging
  cardText: string
  // Special handling for "advance to nearest" cards
  nearestType?: 'railroad' | 'utility'
  doubleRent?: boolean // For nearest railroad card
  useMultiplierTen?: boolean // For nearest utility card
}

// ============================================================
// DECK MANAGEMENT
// ============================================================

/**
 * Fisher-Yates shuffle - returns a new shuffled array
 */
export function shuffleDeck<T>(cards: ReadonlyArray<T>): Array<T> {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Create a shuffled Chance deck
 */
export function createChanceDeck(): Array<ChanceCard> {
  return shuffleDeck(CHANCE_CARDS)
}

/**
 * Create a shuffled Community Chest deck
 */
export function createCommunityChestDeck(): Array<CommunityChestCard> {
  return shuffleDeck(COMMUNITY_CHEST_CARDS)
}

// ============================================================
// CARD EXECUTION
// ============================================================

/**
 * Execute a Chance card and return the result
 */
export function executeChanceCard(
  card: ChanceCard,
  player: PlayerState,
  allPlayers: Array<PlayerState>,
  properties: Array<PropertyState>,
): CardResult {
  const result: CardResult = {
    cardText: card.text,
  }

  switch (card.action) {
    case 'move_to':
      if (card.destination !== undefined) {
        result.newPosition = card.destination
        // Check if passed GO (only if moving forward)
        if (
          card.destination !== 0 &&
          passedGo(player.position, card.destination, true)
        ) {
          result.passedGo = true
          result.cashChange = GO_SALARY
        }
        // Special case: "Advance to GO" gives $200
        if (card.destination === 0) {
          result.passedGo = true
          result.cashChange = GO_SALARY
        }
      }
      break

    case 'move_relative':
      if (card.spaces !== undefined) {
        const newPos = calculateNewPosition(player.position, card.spaces)
        result.newPosition = newPos
        // Moving back doesn't pass GO
      }
      break

    case 'move_to_nearest':
      if (card.nearestType) {
        const nearestPos = findNearestSpace(player.position, card.nearestType)
        result.newPosition = nearestPos
        result.nearestType = card.nearestType

        // Check if passed GO
        if (passedGo(player.position, nearestPos, true)) {
          result.passedGo = true
          result.cashChange = GO_SALARY
        }

        // Special rent rules for Chance "nearest" cards
        switch (card.nearestType) {
          case 'railroad':
            result.doubleRent = true // Pay double railroad rent
            break
          case 'utility':
            result.useMultiplierTen = true // Use 10x multiplier regardless of ownership
            break
          default:
            break
        }
      }
      break

    case 'receive':
      if (card.amount !== undefined) {
        result.cashChange = card.amount
      }
      break

    case 'pay':
      if (card.amount !== undefined) {
        result.cashChange = -card.amount
      }
      break

    case 'pay_each_player':
      if (card.amount !== undefined) {
        result.payEachPlayer = card.amount
        // Total cash change = amount × (number of other players)
        const otherPlayersCount = allPlayers.filter(
          (p) => p._id !== player._id,
        ).length
        result.cashChange = -card.amount * otherPlayersCount
      }
      break

    case 'pay_per_building':
      if (card.house !== undefined && card.hotel !== undefined) {
        result.payPerBuilding = {
          perHouse: card.house,
          perHotel: card.hotel,
        }
        // Calculate total cost based on player's buildings
        const buildings = countPlayerBuildings(player._id, properties)
        const totalCost =
          buildings.houses * card.house + buildings.hotels * card.hotel
        result.cashChange = -totalCost
      }
      break

    case 'go_to_jail':
      result.goToJail = true
      result.newPosition = JAIL_POSITION
      break

    case 'get_out_of_jail_card':
      result.getOutOfJailCard = true
      break
  }

  return result
}

/**
 * Execute a Community Chest card and return the result
 */
export function executeCommunityChestCard(
  card: CommunityChestCard,
  player: PlayerState,
  allPlayers: Array<PlayerState>,
  properties: Array<PropertyState>,
): CardResult {
  const result: CardResult = {
    cardText: card.text,
  }

  switch (card.action) {
    case 'move_to':
      if (card.destination !== undefined) {
        result.newPosition = card.destination
        // "Advance to GO" gives $200
        if (card.destination === 0) {
          result.passedGo = true
          result.cashChange = GO_SALARY
        }
      }
      break

    case 'receive':
      if (card.amount !== undefined) {
        result.cashChange = card.amount
      }
      break

    case 'pay':
      if (card.amount !== undefined) {
        result.cashChange = -card.amount
      }
      break

    case 'collect_from_each_player':
      if (card.amount !== undefined) {
        result.collectFromEach = card.amount
        // Total cash change = amount × (number of other players)
        const otherPlayersCount = allPlayers.filter(
          (p) => p._id !== player._id,
        ).length
        result.cashChange = card.amount * otherPlayersCount
      }
      break

    case 'pay_per_building':
      if (card.house !== undefined && card.hotel !== undefined) {
        result.payPerBuilding = {
          perHouse: card.house,
          perHotel: card.hotel,
        }
        // Calculate total cost based on player's buildings
        const buildings = countPlayerBuildings(player._id, properties)
        const totalCost =
          buildings.houses * card.house + buildings.hotels * card.hotel
        result.cashChange = -totalCost
      }
      break

    case 'go_to_jail':
      result.goToJail = true
      result.newPosition = JAIL_POSITION
      break

    case 'get_out_of_jail_card':
      result.getOutOfJailCard = true
      break
  }

  return result
}

// ============================================================
// CARD HELPERS
// ============================================================

/**
 * Get the Chance card at a specific index in the deck
 */
export function getChanceCard(deck: Array<ChanceCard>, index: number): ChanceCard {
  return deck[index % deck.length]
}

/**
 * Get the Community Chest card at a specific index in the deck
 */
export function getCommunityChestCard(
  deck: Array<CommunityChestCard>,
  index: number,
): CommunityChestCard {
  return deck[index % deck.length]
}

/**
 * Check if a card is a "Get Out of Jail Free" card
 */
export function isGetOutOfJailCard(
  card: ChanceCard | CommunityChestCard,
): boolean {
  return card.action === 'get_out_of_jail_card'
}

/**
 * Calculate building repair cost for a player
 */
export function calculateBuildingRepairCost(
  playerId: Id<'players'>,
  properties: Array<PropertyState>,
  perHouse: number,
  perHotel: number,
): number {
  const buildings = countPlayerBuildings(playerId, properties)
  return buildings.houses * perHouse + buildings.hotels * perHotel
}

import { describe, expect, it } from 'vitest'
import {
  
  
  
  canBuildHouse,
  canBuyProperty,
  canMortgage,
  canPayJailFine,
  canProposeTrade,
  canSellHouse,
  canUnmortgage,
  canUseJailCard,
  getValidActions
} from './validation'
import type {GameState, PlayerState, TradeOffer} from './validation';
import type { PropertyState } from './rent'
import type { Id } from '../_generated/dataModel'

// ============================================================
// TEST HELPERS
// ============================================================

const PLAYER_1 = 'player1' as Id<'players'>
const PLAYER_2 = 'player2' as Id<'players'>

function createPlayer(
  id: Id<'players'>,
  cash: number,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    _id: id,
    cash,
    position: 0,
    inJail: false,
    jailTurnsRemaining: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
    ...overrides,
  }
}

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

function createGameState(
  currentPhase: GameState['currentPhase'] = 'pre_roll',
): GameState {
  return {
    currentPhase,
    currentPlayerIndex: 0,
  }
}

// ============================================================
// BUY PROPERTY TESTS
// ============================================================

describe('canBuyProperty', () => {
  it('allows buying unowned property with sufficient cash', () => {
    const player = createPlayer(PLAYER_1, 500)
    const property = createProperty(1, 'Mediterranean Avenue', 'brown')

    const result = canBuyProperty(player, property, 1)
    expect(result.valid).toBe(true)
  })

  it('prevents buying property with insufficient cash', () => {
    const player = createPlayer(PLAYER_1, 50)
    const property = createProperty(1, 'Mediterranean Avenue', 'brown')

    // Mediterranean costs $60
    const result = canBuyProperty(player, property, 1)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not enough cash')
  })

  it('prevents buying already owned property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const property = createProperty(
      1,
      'Mediterranean Avenue',
      'brown',
      PLAYER_2,
    )

    const result = canBuyProperty(player, property, 1)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('already owned')
  })

  it('prevents buying non-purchasable spaces', () => {
    const player = createPlayer(PLAYER_1, 500)
    // Position 0 is GO
    const property = createProperty(0, 'GO', 'go')

    const result = canBuyProperty(player, property, 0)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('cannot be purchased')
  })
})

// ============================================================
// BUILD HOUSE TESTS
// ============================================================

describe('canBuildHouse', () => {
  it('allows building on property with monopoly and sufficient cash', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(true)
  })

  it('prevents building without monopoly', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_2),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('all properties')
  })

  it('prevents building on non-property (railroad)', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(5, 'Reading Railroad', 'railroad', PLAYER_1),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('color properties')
  })

  it('prevents building with insufficient cash', () => {
    const player = createPlayer(PLAYER_1, 10)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    // House cost for brown is $50
    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not enough cash')
  })

  it('prevents building on mortgaged property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, true),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('mortgaged')
  })

  it('prevents building when group has mortgaged property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 0, true),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('mortgaged')
  })

  it('prevents building beyond hotel (5 houses)', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 5),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 5),
    ]

    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('hotel')
  })

  it('enforces even building rule', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 2),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 1),
    ]

    // Mediterranean has 2 houses, Baltic has 1
    // Should not allow building on Mediterranean until Baltic catches up
    const result = canBuildHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('evenly')
  })
})

// ============================================================
// SELL HOUSE TESTS
// ============================================================

describe('canSellHouse', () => {
  it('allows selling house from property with houses', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 2),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 2),
    ]

    const result = canSellHouse(player, properties[0], properties)
    expect(result.valid).toBe(true)
  })

  it('prevents selling from property with no houses', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 0),
    ]

    const result = canSellHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('No houses')
  })

  it('enforces even selling rule', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 2),
    ]

    // Mediterranean has 1 house, Baltic has 2
    // Should not allow selling from Mediterranean (already lower)
    const result = canSellHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('evenly')
  })

  it('prevents selling from unowned property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_2, 2),
    ]

    const result = canSellHouse(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain("don't own")
  })
})

// ============================================================
// MORTGAGE TESTS
// ============================================================

describe('canMortgage', () => {
  it('allows mortgaging unimproved property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    const result = canMortgage(player, properties[0], properties)
    expect(result.valid).toBe(true)
  })

  it('prevents mortgaging already mortgaged property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, true),
    ]

    const result = canMortgage(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('already mortgaged')
  })

  it('prevents mortgaging when group has houses', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 0),
    ]

    // Trying to mortgage Baltic when Mediterranean has houses
    const result = canMortgage(player, properties[1], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('sell all houses')
  })

  it('prevents mortgaging unowned property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_2),
    ]

    const result = canMortgage(player, properties[0], properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain("don't own")
  })
})

// ============================================================
// UNMORTGAGE TESTS
// ============================================================

describe('canUnmortgage', () => {
  it('allows unmortgaging with sufficient cash', () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, true),
    ]

    const result = canUnmortgage(player, properties[0])
    expect(result.valid).toBe(true)
  })

  it('prevents unmortgaging with insufficient cash', () => {
    // Mediterranean mortgage value is $30, unmortgage cost is $33 (10% interest)
    const player = createPlayer(PLAYER_1, 20)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, true),
    ]

    const result = canUnmortgage(player, properties[0])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not enough cash')
  })

  it("prevents unmortgaging property that's not mortgaged", () => {
    const player = createPlayer(PLAYER_1, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 0, false),
    ]

    const result = canUnmortgage(player, properties[0])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('not mortgaged')
  })
})

// ============================================================
// JAIL TESTS
// ============================================================

describe('canPayJailFine', () => {
  it('allows paying fine when in jail with sufficient cash', () => {
    const player = createPlayer(PLAYER_1, 100, {
      inJail: true,
      jailTurnsRemaining: 2,
    })

    const result = canPayJailFine(player)
    expect(result.valid).toBe(true)
  })

  it('prevents paying fine when not in jail', () => {
    const player = createPlayer(PLAYER_1, 100, {
      inJail: false,
    })

    const result = canPayJailFine(player)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not in jail')
  })

  it('prevents paying fine with insufficient cash', () => {
    const player = createPlayer(PLAYER_1, 10, {
      inJail: true,
    })

    const result = canPayJailFine(player)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not enough cash')
  })
})

describe('canUseJailCard', () => {
  it('allows using jail card when in jail with card', () => {
    const player = createPlayer(PLAYER_1, 100, {
      inJail: true,
      getOutOfJailCards: 1,
    })

    const result = canUseJailCard(player)
    expect(result.valid).toBe(true)
  })

  it('prevents using jail card when not in jail', () => {
    const player = createPlayer(PLAYER_1, 100, {
      inJail: false,
      getOutOfJailCards: 1,
    })

    const result = canUseJailCard(player)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Not in jail')
  })

  it('prevents using jail card when no cards available', () => {
    const player = createPlayer(PLAYER_1, 100, {
      inJail: true,
      getOutOfJailCards: 0,
    })

    const result = canUseJailCard(player)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('No Get Out of Jail Free cards')
  })
})

// ============================================================
// TRADE VALIDATION TESTS
// ============================================================

describe('canProposeTrade', () => {
  it('validates basic trade offer', () => {
    const proposer = createPlayer(PLAYER_1, 500)
    const recipient = createPlayer(PLAYER_2, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_2),
    ]

    const offer: TradeOffer = {
      offerMoney: 100,
      offerProperties: [properties[0]._id],
      offerGetOutOfJailCards: 0,
      requestMoney: 50,
      requestProperties: [properties[1]._id],
      requestGetOutOfJailCards: 0,
    }

    const result = canProposeTrade(proposer, recipient, offer, properties)
    expect(result.valid).toBe(true)
  })

  it('rejects trade when proposer lacks cash', () => {
    const proposer = createPlayer(PLAYER_1, 50)
    const recipient = createPlayer(PLAYER_2, 500)
    const properties: Array<PropertyState> = []

    const offer: TradeOffer = {
      offerMoney: 100,
      offerProperties: [],
      offerGetOutOfJailCards: 0,
      requestMoney: 0,
      requestProperties: [],
      requestGetOutOfJailCards: 0,
    }

    const result = canProposeTrade(proposer, recipient, offer, properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain("Proposer doesn't have enough cash")
  })

  it("rejects trade when proposer doesn't own offered property", () => {
    const proposer = createPlayer(PLAYER_1, 500)
    const recipient = createPlayer(PLAYER_2, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_2), // Wrong owner
    ]

    const offer: TradeOffer = {
      offerMoney: 0,
      offerProperties: [properties[0]._id],
      offerGetOutOfJailCards: 0,
      requestMoney: 0,
      requestProperties: [],
      requestGetOutOfJailCards: 0,
    }

    const result = canProposeTrade(proposer, recipient, offer, properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain("doesn't own")
  })

  it('rejects trade of property with houses', () => {
    const proposer = createPlayer(PLAYER_1, 500)
    const recipient = createPlayer(PLAYER_2, 500)
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1, 2), // Has houses
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1, 2),
    ]

    const offer: TradeOffer = {
      offerMoney: 0,
      offerProperties: [properties[0]._id],
      offerGetOutOfJailCards: 0,
      requestMoney: 0,
      requestProperties: [],
      requestGetOutOfJailCards: 0,
    }

    const result = canProposeTrade(proposer, recipient, offer, properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('houses')
  })

  it('rejects trade when proposer lacks jail cards', () => {
    const proposer = createPlayer(PLAYER_1, 500, { getOutOfJailCards: 0 })
    const recipient = createPlayer(PLAYER_2, 500)
    const properties: Array<PropertyState> = []

    const offer: TradeOffer = {
      offerMoney: 0,
      offerProperties: [],
      offerGetOutOfJailCards: 1, // Offering a card they don't have
      requestMoney: 0,
      requestProperties: [],
      requestGetOutOfJailCards: 0,
    }

    const result = canProposeTrade(proposer, recipient, offer, properties)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Jail')
  })
})

// ============================================================
// GET VALID ACTIONS TESTS
// ============================================================

describe('getValidActions', () => {
  it('returns jail options when in jail during pre_roll', () => {
    const player = createPlayer(PLAYER_1, 500, {
      inJail: true,
      jailTurnsRemaining: 2,
      getOutOfJailCards: 1,
    })
    const game = createGameState('pre_roll')
    const properties: Array<PropertyState> = []

    const actions = getValidActions(player, game, properties)

    expect(actions.some((a) => a.type === 'pay_jail_fine')).toBe(true)
    expect(actions.some((a) => a.type === 'use_jail_card')).toBe(true)
    expect(actions.some((a) => a.type === 'roll_for_doubles')).toBe(true)
    expect(actions.some((a) => a.type === 'roll_dice')).toBe(false)
  })

  it('returns roll_dice action when not in jail during pre_roll', () => {
    const player = createPlayer(PLAYER_1, 500)
    const game = createGameState('pre_roll')
    const properties: Array<PropertyState> = []

    const actions = getValidActions(player, game, properties)

    expect(actions.some((a) => a.type === 'roll_dice')).toBe(true)
    expect(actions.some((a) => a.type === 'propose_trade')).toBe(true)
  })

  it('returns buy option when landing on unowned property', () => {
    const player = createPlayer(PLAYER_1, 500)
    const game = createGameState('post_roll')
    const property = createProperty(1, 'Mediterranean Avenue', 'brown')
    const properties = [property]

    const actions = getValidActions(player, game, properties, property)

    expect(actions.some((a) => a.type === 'buy_property')).toBe(true)
    expect(actions.some((a) => a.type === 'auction_property')).toBe(true)
    expect(actions.some((a) => a.type === 'end_turn')).toBe(true)
  })

  it('returns build actions when player has buildable monopoly', () => {
    const player = createPlayer(PLAYER_1, 500)
    const game = createGameState('post_roll')
    const properties = [
      createProperty(1, 'Mediterranean Avenue', 'brown', PLAYER_1),
      createProperty(3, 'Baltic Avenue', 'brown', PLAYER_1),
    ]

    const actions = getValidActions(player, game, properties)

    expect(actions.some((a) => a.type === 'build_house')).toBe(true)
  })

  it('returns no actions during game_over phase', () => {
    const player = createPlayer(PLAYER_1, 500)
    const game = createGameState('game_over')
    const properties: Array<PropertyState> = []

    const actions = getValidActions(player, game, properties)

    expect(actions).toHaveLength(0)
  })
})

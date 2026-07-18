import { describe, expect, it } from 'vitest'
import {
  reconstructPlayersAtTurn,
} from './replayState'
import type { ReplayPlayer, ReplayTurn } from './replayState'

const players: Array<ReplayPlayer> = [
  {
    _id: 'p1',
    position: 39,
    modelDisplayName: 'Alpha',
    tokenColor: '#f00',
    inJail: true,
  },
  {
    _id: 'p2',
    position: 20,
    modelDisplayName: 'Beta',
    tokenColor: '#0f0',
    inJail: false,
  },
]

const turns: Array<ReplayTurn> = [
  {
    playerId: 'p1',
    turnNumber: 1,
    positionBefore: 0,
    positionAfter: 5,
    events: ['Rolled 5', 'Moved to Reading Railroad'],
  },
  {
    playerId: 'p2',
    turnNumber: 2,
    positionBefore: 0,
    positionAfter: 7,
    events: ['Rolled 7'],
  },
  {
    playerId: 'p1',
    turnNumber: 3,
    positionBefore: 5,
    positionAfter: 10,
    events: ['Moved to Go To Jail', 'GO TO JAIL!'],
  },
  {
    playerId: 'p2',
    turnNumber: 4,
    positionBefore: 7,
    positionAfter: 10,
    events: ['Moved to Jail / Just Visiting'],
  },
  {
    playerId: 'p1',
    turnNumber: 5,
    positionBefore: 10,
    positionAfter: 16,
    events: ['Paid $50 to get out of jail', 'Rolled 6', 'Moved to St. James Place'],
  },
]

describe('reconstructPlayersAtTurn', () => {
  it('starts every player at GO before they have moved', () => {
    const board = reconstructPlayersAtTurn(players, turns, 0)
    expect(board).toEqual([
      expect.objectContaining({
        _id: 'p1',
        position: 0,
        inJail: false,
      }),
      expect.objectContaining({
        _id: 'p2',
        position: 0,
        inJail: false,
      }),
    ])
  })

  it('uses each player latest retained turn at or before the selected turn', () => {
    const at2 = reconstructPlayersAtTurn(players, turns, 2)
    expect(at2.find((p) => p._id === 'p1')).toMatchObject({
      position: 5,
      inJail: false,
    })
    expect(at2.find((p) => p._id === 'p2')).toMatchObject({
      position: 7,
      inJail: false,
    })
  })

  it('derives jail from retained events and never uses final jail state', () => {
    const inJail = reconstructPlayersAtTurn(players, turns, 3)
    expect(inJail.find((p) => p._id === 'p1')).toMatchObject({
      position: 10,
      inJail: true,
    })
    // Final player record says inJail:true for p1, but at turn 5 they left jail
    const freed = reconstructPlayersAtTurn(players, turns, 5)
    expect(freed.find((p) => p._id === 'p1')).toMatchObject({
      position: 16,
      inJail: false,
    })
  })

  it('treats Jail / Just Visiting as not in jail', () => {
    const at4 = reconstructPlayersAtTurn(players, turns, 4)
    expect(at4.find((p) => p._id === 'p2')).toMatchObject({
      position: 10,
      inJail: false,
    })
  })

  it('ignores Get Out of Jail Free card draws when deriving jail', () => {
    const withCardDraw: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 10,
        events: ['Moved to Go To Jail', 'GO TO JAIL!'],
      },
      {
        playerId: 'p1',
        turnNumber: 2,
        positionBefore: 10,
        positionAfter: 10,
        events: [
          'Drew Chance: "Get Out of Jail Free. This card may be kept until needed or sold."',
        ],
      },
    ]
    const board = reconstructPlayersAtTurn(players, withCardDraw, 2)
    expect(board.find((p) => p._id === 'p1')).toMatchObject({
      position: 10,
      inJail: true,
    })
  })

  it('prefers landedOn/events over corrupt positionAfter (Income Tax production fixture)', () => {
    // game kh702t2cv1zy3w3knh3g5c08qh8181td turn 30
    const corrupt: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 30,
        positionBefore: 37,
        positionAfter: 19,
        landedOn: 'Income Tax',
        events: [
          'Rolled 7 (5,2)',
          'Passed GO - collected $200',
          'Moved to Income Tax',
          'Paid $200 Income Tax',
        ],
      },
    ]
    const board = reconstructPlayersAtTurn(players, corrupt, 30)
    expect(board.find((p) => p._id === 'p1')?.position).toBe(4)
  })

  it('prefers landedOn/events over corrupt positionAfter (Boardwalk + North Carolina fixtures)', () => {
    // same production game turns 100 and 135
    const corrupt: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 100,
        positionBefore: 32,
        positionAfter: 8,
        landedOn: 'Boardwalk',
        events: [
          'Rolled 7 (5,2)',
          'Moved to Boardwalk',
          'Paid $47 rent to GPT-4o Mini',
        ],
      },
      {
        playerId: 'p1',
        turnNumber: 135,
        positionBefore: 12,
        positionAfter: 8,
        landedOn: 'North Carolina Avenue',
        events: [
          'Rolled 10 (5,5)',
          'Moved to Chance',
          'Drew Chance: "Pay poor tax of $15."',
          'Rolled doubles - rolling again!',
          'Rolled 10 (4,6)',
          'Moved to North Carolina Avenue',
          'Paid $874 rent to GPT-4o Mini',
        ],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, corrupt, 100).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(39)
    expect(
      reconstructPlayersAtTurn(players, corrupt, 135).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(32)
  })

  it('keeps prior position for action-only turns even when positionAfter is corrupt', () => {
    const actionOnlyTurns: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 39,
        landedOn: 'Boardwalk',
        events: ['Rolled 7 (3,4)', 'Moved to Boardwalk'],
      },
      {
        playerId: 'p1',
        turnNumber: 2,
        positionBefore: 8,
        positionAfter: 8,
        events: ['Built 1 house(s) on Pacific Avenue for $200'],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, actionOnlyTurns, 2).find(
        (p) => p._id === 'p1',
      )?.position,
    ).toBe(39)
  })

  it('applies card moves from events: advance, nearest railroad/utility, go back three, jail', () => {
    const cardTurns: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 7,
        landedOn: 'Chance',
        events: [
          'Rolled 7 (3,4)',
          'Moved to Chance',
          'Drew Chance: "Advance to Boardwalk."',
        ],
      },
      {
        playerId: 'p1',
        turnNumber: 2,
        positionBefore: 39,
        positionAfter: 7,
        landedOn: 'Chance',
        events: [
          'Rolled 8 (4,4)',
          'Moved to Chance',
          'Drew Chance: "Advance to the nearest Railroad. If unowned, you may buy it. If owned, pay owner twice the rental."',
        ],
      },
      {
        playerId: 'p1',
        turnNumber: 3,
        positionBefore: 5,
        positionAfter: 12,
        landedOn: 'Chance',
        events: [
          'Rolled 2 (1,1)',
          'Moved to Chance',
          'Drew Chance: "Advance to the nearest Utility. If unowned, you may buy it. If owned, throw dice and pay owner 10× the amount thrown."',
        ],
      },
      {
        playerId: 'p1',
        turnNumber: 4,
        positionBefore: 12,
        positionAfter: 22,
        landedOn: 'Chance',
        events: [
          'Rolled 10 (5,5)',
          'Moved to Chance',
          'Drew Chance: "Go Back 3 Spaces."',
        ],
      },
      {
        playerId: 'p1',
        turnNumber: 5,
        positionBefore: 19,
        positionAfter: 19,
        landedOn: 'Chance',
        events: [
          'Moved to Chance',
          'Drew Chance: "Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200."',
          'Sent to Jail!',
        ],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, cardTurns, 1).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(39)
    // After Boardwalk (39) → Chance (7) → nearest railroad → Pennsylvania (15)
    expect(
      reconstructPlayersAtTurn(players, cardTurns, 2).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(15)
    // From 15 → Chance (22) → nearest utility → Water Works (28)
    expect(
      reconstructPlayersAtTurn(players, cardTurns, 3).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(28)
    // From 28 → Chance (36) → go back 3 → 33
    expect(
      reconstructPlayersAtTurn(players, cardTurns, 4).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(33)
    // jail
    expect(
      reconstructPlayersAtTurn(players, cardTurns, 5).find((p) => p._id === 'p1'),
    ).toMatchObject({ position: 10, inJail: true })
  })

  it('falls back to positionAfter only when no retained movement signal exists', () => {
    const fallback: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 7,
        events: ['Rolled 7'],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, fallback, 1).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(7)
  })

  it('uses pending Rolled N distance for repeated Community Chest wraparound (31+11→2)', () => {
    // Production: next-name resolver wrongly picks CC at 33 instead of wrap to 2.
    const wrapTurns: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 31,
        landedOn: 'Pacific Avenue',
        events: ['Rolled 11 (5,6)', 'Moved to Pacific Avenue'],
      },
      {
        playerId: 'p1',
        turnNumber: 2,
        positionBefore: 31,
        positionAfter: 2,
        landedOn: 'Community Chest',
        events: ['Rolled 11 (5,6)', 'Moved to Community Chest'],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, wrapTurns, 2).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(2)
  })

  it('applies each pending Rolled N to the next Moved-to for doubles across Chance wrap', () => {
    // Short Line (35) + roll 12 → Chance 7 (wrap). Next-name wrongly picks Chance 36.
    // Go Back 3 then a second roll+Moved-to Chance only lands on 7 when the first
    // Chance used roll distance (4+3); the next-name path ends at Chance 36.
    const multi: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 35,
        landedOn: 'Short Line',
        events: ['Rolled 12 (6,6)', 'Moved to Short Line'],
      },
      {
        playerId: 'p1',
        turnNumber: 2,
        positionBefore: 35,
        positionAfter: 7,
        landedOn: 'Chance',
        events: [
          'Rolled 12 (6,6)',
          'Moved to Chance',
          'Drew Chance: "Go Back 3 Spaces."',
          'Rolled doubles - rolling again!',
          'Rolled 3 (1,2)',
          'Moved to Chance',
        ],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, multi, 2).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(7)
  })

  it('moves on Take a trip to Reading Railroad Chance card text', () => {
    const trip: Array<ReplayTurn> = [
      {
        playerId: 'p1',
        turnNumber: 1,
        positionBefore: 0,
        positionAfter: 7,
        landedOn: 'Chance',
        events: [
          'Rolled 7 (3,4)',
          'Moved to Chance',
          'Drew Chance: "Take a trip to Reading Railroad. If you pass GO, collect $200."',
        ],
      },
    ]
    expect(
      reconstructPlayersAtTurn(players, trip, 1).find((p) => p._id === 'p1')
        ?.position,
    ).toBe(5)
  })
})

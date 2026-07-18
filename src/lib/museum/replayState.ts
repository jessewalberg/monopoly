import { BOARD } from '../game/constants'
import { findNearestSpace } from '../game/board'

export type ReplayPlayer = {
  _id: string
  position: number
  modelDisplayName: string
  tokenColor: string
  inJail: boolean
  textColor?: string
}

export type ReplayTurn = {
  playerId: string
  turnNumber: number
  positionBefore?: number
  positionAfter?: number
  landedOn?: string
  events: Array<string>
}

export type BoardPlayerAtTurn = {
  _id: string
  position: number
  modelDisplayName: string
  tokenColor: string
  textColor: string
  inJail: boolean
}

const BOARD_SIZE = 40

/** Canonical space name → one or more board positions (Chance/CC repeat). */
const POSITIONS_BY_NAME: Map<string, Array<number>> = (() => {
  const map = new Map<string, Array<number>>()
  for (const space of BOARD) {
    const list = map.get(space.name)
    if (list) list.push(space.pos)
    else map.set(space.name, [space.pos])
  }
  return map
})()

/**
 * Resolve a retained space name to a board position.
 * When a pending recorded roll is available and the implied modulo position's
 * board name matches, prefer that position (fixes Chance/CC wraparound).
 * Otherwise keep next-forward repeated-name / unique-space behavior.
 */
function resolveSpaceName(
  name: string,
  fromPosition: number,
  pendingRoll: number | null = null,
): number | null {
  const positions = POSITIONS_BY_NAME.get(name)
  if (!positions || positions.length === 0) return null

  if (pendingRoll !== null && positions.length > 1) {
    const implied =
      (((fromPosition + pendingRoll) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
    const space = BOARD[implied]
    if (space.name === name) return implied
  }

  if (positions.length === 1) return positions[0] ?? null
  for (const pos of positions) {
    if (pos > fromPosition) return pos
  }
  return positions[0] ?? null
}

function eventEntersJail(event: string): boolean {
  const lower = event.toLowerCase()
  if (lower.includes('just visiting')) return false
  if (lower.startsWith('drew ')) return false
  return (
    lower.includes('go to jail!') ||
    lower.includes('sent to jail') ||
    /rolled 3rd doubles.*go to jail/.test(lower)
  )
}

function eventExitsJail(event: string): boolean {
  const lower = event.toLowerCase()
  if (lower.startsWith('drew ')) return false
  return (
    lower.includes('paid $50 to get out of jail') ||
    lower.includes('jail fine - now free') ||
    lower.includes('used get out of jail') ||
    /rolled doubles.*out of jail/.test(lower)
  )
}

const MOVED_TO_RE = /^Moved to (.+)$/
const CARD_DRAW_RE = /^Drew (?:Chance|Community Chest): "(.+)"\.?$/
/** Recorded dice totals only — not "Rolled doubles" / "Rolled 3rd doubles". */
const ROLLED_RE = /^Rolled (\d+)(?:\s*\(\d+,\s*\d+\))?$/i

type EventCursor = {
  position: number
  pendingRoll: number | null
  movedBySignal: boolean
}

/**
 * Apply one retained event to the replay cursor.
 * Tracks pending Rolled N for the next Moved-to; clears it when consumed.
 */
function applyEvent(event: string, cursor: EventCursor): void {
  const rolled = ROLLED_RE.exec(event)
  if (rolled) {
    cursor.pendingRoll = Number(rolled[1])
    return
  }

  const moved = MOVED_TO_RE.exec(event)
  if (moved) {
    const spaceName = moved[1]
    const next = resolveSpaceName(
      spaceName,
      cursor.position,
      cursor.pendingRoll,
    )
    cursor.pendingRoll = null
    if (next !== null) {
      cursor.position = next
      cursor.movedBySignal = true
    }
    return
  }

  if (eventEntersJail(event)) {
    cursor.position = 10
    cursor.movedBySignal = true
    return
  }

  const card = CARD_DRAW_RE.exec(event)
  if (!card) return
  const text = card[1]

  if (/^Go Back 3 Spaces\.?$/i.test(text)) {
    cursor.position =
      (((cursor.position - 3) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
    cursor.movedBySignal = true
    return
  }

  if (/go to jail/i.test(text)) {
    cursor.position = 10
    cursor.movedBySignal = true
    return
  }

  if (/advance to the nearest railroad/i.test(text)) {
    cursor.position = findNearestSpace(cursor.position, 'railroad')
    cursor.movedBySignal = true
    return
  }
  if (/advance to the nearest utility/i.test(text)) {
    cursor.position = findNearestSpace(cursor.position, 'utility')
    cursor.movedBySignal = true
    return
  }

  const advance =
    /^(?:Advance|Take a trip) to (.+?)(?:\. If you pass GO.*|\. Collect \$.*|\.?$)/i.exec(
      text,
    )
  if (advance) {
    const captured = advance[1]
    let destName = captured.trim()
    if (/^GO$/i.test(destName)) destName = 'GO'
    const next = resolveSpaceName(destName, cursor.position, null)
    if (next !== null) {
      cursor.position = next
      cursor.movedBySignal = true
    }
  }
}

function turnHasAuthoritativeMovement(turn: ReplayTurn): boolean {
  if (typeof turn.landedOn === 'string' && turn.landedOn.length > 0) {
    return true
  }
  for (const event of turn.events) {
    if (MOVED_TO_RE.test(event)) return true
    if (eventEntersJail(event)) return true
    const card = CARD_DRAW_RE.exec(event)
    if (!card) continue
    const text = card[1]
    if (
      /^Go Back 3 Spaces/i.test(text) ||
      /go to jail/i.test(text) ||
      /advance to /i.test(text) ||
      /take a trip to /i.test(text)
    ) {
      return true
    }
  }
  return false
}

/**
 * Resolve ending board position for one retained turn.
 * Prefer event/landedOn movement semantics; use position fields only when
 * no authoritative retained movement signal exists.
 */
function resolveTurnPosition(turn: ReplayTurn, priorPosition: number): number {
  const cursor: EventCursor = {
    position: priorPosition,
    pendingRoll: null,
    movedBySignal: false,
  }

  for (const event of turn.events) {
    applyEvent(event, cursor)
  }

  // landedOn is retained authoritative movement when events recorded none
  // (do not override card advances that leave Chance/CC while landedOn stays put).
  if (
    !cursor.movedBySignal &&
    typeof turn.landedOn === 'string' &&
    turn.landedOn.length > 0
  ) {
    const fromLanded = resolveSpaceName(
      turn.landedOn,
      priorPosition,
      cursor.pendingRoll,
    )
    if (fromLanded !== null) {
      cursor.position = fromLanded
      cursor.movedBySignal = true
    }
  }

  if (cursor.movedBySignal) return cursor.position

  // Action-only: keep prior position (do not trust corrupt positionAfter).
  const hasRoll = turn.events.some((e) => ROLLED_RE.test(e))
  if (!hasRoll && !turnHasAuthoritativeMovement(turn)) {
    return priorPosition
  }

  // Guarded fallback when a roll happened but no retained movement name exists.
  if (typeof turn.positionAfter === 'number') return turn.positionAfter
  if (typeof turn.positionBefore === 'number') return turn.positionBefore
  return priorPosition
}

/**
 * Reconstruct every player's board position and jail flag for a historical turn.
 * Position prefers retained landedOn/events over known-corrupt positionAfter.
 * Jail is derived only from retained turn events — never from the final
 * player.inJail snapshot.
 */
export function reconstructPlayersAtTurn(
  players: Array<ReplayPlayer>,
  turns: Array<ReplayTurn>,
  selectedTurn: number,
): Array<BoardPlayerAtTurn> {
  const turnsByPlayer = new Map<string, Array<ReplayTurn>>()
  for (const turn of turns) {
    if (turn.turnNumber > selectedTurn) continue
    const list = turnsByPlayer.get(turn.playerId)
    if (list) list.push(turn)
    else turnsByPlayer.set(turn.playerId, [turn])
  }

  return players.map((player) => {
    let position = 0
    let inJail = false
    const playerTurns = [...(turnsByPlayer.get(player._id) ?? [])].sort(
      (a, b) => a.turnNumber - b.turnNumber,
    )

    for (const turn of playerTurns) {
      position = resolveTurnPosition(turn, position)
      for (const event of turn.events) {
        if (eventEntersJail(event)) inJail = true
        if (eventExitsJail(event)) inJail = false
      }
    }

    return {
      _id: player._id,
      position,
      modelDisplayName: player.modelDisplayName,
      tokenColor: player.tokenColor,
      textColor: player.textColor ?? '#FFFFFF',
      inJail,
    }
  })
}

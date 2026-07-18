import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { reconstructPlayersAtTurn } from '../../src/lib/museum/replayState'
import type { MuseumPlayer, MuseumTurn } from '../../src/lib/museum/types'
import { generateMuseumFromSnapshot } from './generateMuseum'

/**
 * Authoritative production Convex export used for the static museum sunset.
 * Opt-in only via MUSEUM_SNAPSHOT_PATH — never embed private absolute paths.
 */
const PRODUCTION_SNAPSHOT = process.env.MUSEUM_SNAPSHOT_PATH

type MuseumGamePayload = {
  game: { _id: string; currentTurnNumber?: number }
  players: Array<MuseumPlayer>
  turns: Array<MuseumTurn>
}

/**
 * Compare reconstructed board positions at each game's max turn against the
 * retained final player.position. Reports only aggregate mismatch counts —
 * never dumps private game/player payloads.
 */
function countFinalPositionMismatches(
  gamesDir: string,
): { compared: number; mismatches: number } {
  let compared = 0
  let mismatches = 0

  for (const fileName of readdirSync(gamesDir)) {
    if (!fileName.endsWith('.json')) continue
    const payload = JSON.parse(
      readFileSync(join(gamesDir, fileName), 'utf8'),
    ) as MuseumGamePayload

    const maxTurn = Math.max(
      0,
      Number(payload.game.currentTurnNumber ?? 0),
      ...payload.turns.map((t) => t.turnNumber),
    )

    const reconstructed = reconstructPlayersAtTurn(
      payload.players.map((p) => ({
        _id: p._id,
        position: p.position,
        modelDisplayName: p.modelDisplayName,
        tokenColor: p.tokenColor,
        textColor: p.textColor,
        inJail: p.inJail,
      })),
      payload.turns.map((t) => ({
        playerId: t.playerId,
        turnNumber: t.turnNumber,
        positionBefore: t.positionBefore,
        positionAfter: t.positionAfter,
        landedOn: t.landedOn,
        events: t.events,
      })),
      maxTurn,
    )

    for (const player of payload.players) {
      compared += 1
      const board = reconstructed.find((p) => p._id === player._id)
      if (!board || board.position !== player.position) {
        mismatches += 1
      }
    }
  }

  return { compared, mismatches }
}

describe('production snapshot museum conversion', () => {
  it.skipIf(!PRODUCTION_SNAPSHOT)(
    'archives exactly 224 completed games and excludes abandoned plus omitted payloads',
    async () => {
      const outputDir = mkdtempSync(join(tmpdir(), 'museum-prod-'))

      const result = await generateMuseumFromSnapshot({
        snapshotPath: PRODUCTION_SNAPSHOT!,
        outputDir,
      })

      expect(result.completedGameCount).toBe(224)
      expect(result.abandonedExcludedCount).toBe(664)
      expect(result.gameIds).toHaveLength(224)

      const index = JSON.parse(
        readFileSync(join(outputDir, 'index.json'), 'utf8'),
      ) as { games: Array<{ id: string; status: string }> }
      expect(index.games).toHaveLength(224)
      expect(index.games.every((g) => g.status === 'completed')).toBe(true)

      const gameFiles = readdirSync(join(outputDir, 'games'))
      expect(gameFiles).toHaveLength(224)

      const sample = JSON.parse(
        readFileSync(join(outputDir, 'games', gameFiles[0]), 'utf8'),
      ) as Record<string, unknown>
      expect(sample).toHaveProperty('game')
      expect(sample).toHaveProperty('players')
      expect(sample).toHaveProperty('properties')
      expect(sample).toHaveProperty('turns')
      expect(sample).toHaveProperty('propertyTransfers')
      expect(sample).toHaveProperty('propertyStateEvents')
      expect(sample).not.toHaveProperty('decisions')
      expect(sample).not.toHaveProperty('trades')
      expect(sample).not.toHaveProperty('rentPayments')

      const analytics = JSON.parse(
        readFileSync(join(outputDir, 'analytics.json'), 'utf8'),
      ) as {
        global: { completedGames: number; totalDecisions: number }
        leaderboard: unknown[]
        strategyProfiles: unknown[]
        winRateTrends: { totalGames: number }
      }
      expect(analytics.global.completedGames).toBe(224)
      expect(analytics.global.totalDecisions).toBe(116817)
      expect(analytics.leaderboard.length).toBeGreaterThan(0)
      expect(analytics.strategyProfiles.length).toBeGreaterThan(0)
      expect(analytics.winRateTrends.totalGames).toBe(224)
      expect(analytics).not.toHaveProperty('decisions')
      expect(analytics).not.toHaveProperty('trades')
      expect(analytics).not.toHaveProperty('rentPayments')
    },
    120_000,
  )

  it.skipIf(!PRODUCTION_SNAPSHOT)(
    'reconstructs final player positions with zero mismatches against retained snapshot',
    async () => {
      const outputDir = mkdtempSync(join(tmpdir(), 'museum-replay-integrity-'))

      await generateMuseumFromSnapshot({
        snapshotPath: PRODUCTION_SNAPSHOT!,
        outputDir,
      })

      const { compared, mismatches } = countFinalPositionMismatches(
        join(outputDir, 'games'),
      )

      expect(compared).toBeGreaterThan(0)
      expect(mismatches).toBe(0)
    },
    120_000,
  )
})

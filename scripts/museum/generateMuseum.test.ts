import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateMuseumFromSnapshot } from './generateMuseum'

const FIXTURE_SNAPSHOT = join(
  import.meta.dirname,
  'fixtures',
  'tiny-snapshot.zip',
)

/** Generation-only tables required for analytics; never shipped in museum payloads. */
const GENERATION_ONLY_TABLES = [
  'decisions',
  'trades',
  'rentPayments',
] as const

type GenerationOnlyTable = (typeof GENERATION_ONLY_TABLES)[number]

const FORBIDDEN_PAYLOAD_KEYS = GENERATION_ONLY_TABLES

/**
 * Build a synthetic snapshot zip from tiny-snapshot with a pure in-memory-style
 * mutation of the extracted tree. Fixtures stay synthetic (no production data).
 */
function buildMutatedSnapshot(mutate: (extractDir: string) => void): string {
  const work = mkdtempSync(join(tmpdir(), 'museum-fx-'))
  const extractDir = join(work, 'extract')
  mkdirSync(extractDir)
  const unzip = spawnSync(
    'unzip',
    ['-q', '-o', FIXTURE_SNAPSHOT, '-d', extractDir],
    { encoding: 'utf8' },
  )
  if (unzip.status !== 0) {
    throw new Error(unzip.stderr || unzip.stdout || 'unzip failed')
  }
  mutate(extractDir)
  const outZip = join(work, 'snapshot.zip')
  const zip = spawnSync('zip', ['-qr', outZip, '.'], {
    cwd: extractDir,
    encoding: 'utf8',
  })
  if (zip.status !== 0) {
    throw new Error(zip.stderr || zip.stdout || 'zip failed')
  }
  return outZip
}

function snapshotMissingTable(table: GenerationOnlyTable): string {
  return buildMutatedSnapshot((extractDir) => {
    rmSync(join(extractDir, table), { recursive: true, force: true })
  })
}

function snapshotWithFirstGameId(
  table: GenerationOnlyTable,
  gameId: unknown,
): string {
  return buildMutatedSnapshot((extractDir) => {
    const path = join(extractDir, table, 'documents.jsonl')
    const rawLines = readFileSync(path, 'utf8').split('\n')
    const firstIdx = rawLines.findIndex((line) => line.trim().length > 0)
    const firstLine = firstIdx >= 0 ? rawLines[firstIdx] : undefined
    if (firstLine === undefined) {
      throw new Error(`synthetic fixture: ${table} has no documents`)
    }
    const doc = JSON.parse(firstLine) as Record<string, unknown>
    doc.gameId = gameId
    const rewritten = rawLines.map((line, index) =>
      index === firstIdx ? JSON.stringify(doc) : line,
    )
    writeFileSync(
      path,
      `${rewritten.filter((line, index) => index === firstIdx || line.trim()).join('\n')}\n`,
    )
  })
}

type Analytics = {
  generatedAt: string
  global: {
    completedGames: number
    totalDecisions: number
    totalTrades: number
    acceptedTrades: number
    totalRentPaid: number
  }
  leaderboard: Array<{
    modelId: string
    wins: number
    gamesPlayed: number
    avgFinalNetWorth: number
    totalRentCollected: number
    totalRentPaid: number
    tradesProposed: number
    tradesAccepted: number
  }>
  headToHead: {
    records: Array<{
      pairKey: string
      modelAId: string
      modelBId: string
      modelAWins: number
      modelBWins: number
      totalGames: number
    }>
  }
  propertyStats: Array<{
    propertyName: string
    timesPurchased: number
    timesAuctioned: number
  }>
  strategyProfiles: Array<{
    modelId: string
    buyRate: number
    tradeFrequency: number
    decisionsAnalyzed: number
  }>
  modelDetails: Record<
    string,
    {
      stats: { wins: number; avgFinalNetWorth: number }
      trends: { gamesAnalyzed: number }
    }
  >
}

describe('generateMuseumFromSnapshot', () => {
  it('keeps only completed games and omits decisions/trades/rent payloads', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-out-'))

    const result = await generateMuseumFromSnapshot({
      snapshotPath: FIXTURE_SNAPSHOT,
      outputDir,
    })

    expect(result.completedGameCount).toBe(2)
    expect(result.abandonedExcludedCount).toBe(1)
    expect(result.gameIds.sort()).toEqual([
      'game_completed_1',
      'game_completed_2',
    ])

    const index = JSON.parse(
      readFileSync(join(outputDir, 'index.json'), 'utf8'),
    ) as {
      games: Array<{ id: string; status: string }>
    }
    expect(index.games).toHaveLength(2)
    expect(index.games.every((g) => g.status === 'completed')).toBe(true)
    expect(index.games.map((g) => g.id).sort()).toEqual([
      'game_completed_1',
      'game_completed_2',
    ])

    const gameFiles = readdirSync(join(outputDir, 'games')).sort()
    expect(gameFiles).toEqual([
      'game_completed_1.json',
      'game_completed_2.json',
    ])

    for (const file of gameFiles) {
      const payload = JSON.parse(
        readFileSync(join(outputDir, 'games', file), 'utf8'),
      ) as Record<string, unknown>
      expect(payload.game).toBeDefined()
      expect(payload.players).toBeDefined()
      expect(payload.properties).toBeDefined()
      expect(payload.turns).toBeDefined()
      expect(payload.propertyTransfers).toBeDefined()
      expect(payload.propertyStateEvents).toBeDefined()
      for (const key of FORBIDDEN_PAYLOAD_KEYS) {
        expect(payload).not.toHaveProperty(key)
      }
      expect(existsSync(join(outputDir, 'games', file))).toBe(true)
    }

    const analytics = JSON.parse(
      readFileSync(join(outputDir, 'analytics.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(analytics.global).toBeDefined()
    expect(analytics.leaderboard).toBeDefined()
    expect(analytics.headToHead).toBeDefined()
    expect(analytics.propertyStats).toBeDefined()
    expect(analytics.strategyProfiles).toBeDefined()
    expect(analytics.winRateTrends).toBeDefined()
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      expect(analytics).not.toHaveProperty(key)
    }
  })

  it('asserts exact fixture analytics, purchases, net worth fallback, and decisions', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-exact-'))
    await generateMuseumFromSnapshot({
      snapshotPath: FIXTURE_SNAPSHOT,
      outputDir,
    })

    const analytics = JSON.parse(
      readFileSync(join(outputDir, 'analytics.json'), 'utf8'),
    ) as Analytics

    expect(analytics.generatedAt).toBe('1970-01-01T00:00:04.000Z')
    expect(analytics.global).toMatchObject({
      completedGames: 2,
      totalDecisions: 3,
      totalTrades: 2,
      acceptedTrades: 1,
      totalRentPaid: 27,
    })

    const byModel = Object.fromEntries(
      analytics.leaderboard.map((row) => [row.modelId, row]),
    )
    expect(byModel['openai/gpt-4o-mini']).toMatchObject({
      wins: 1,
      gamesPlayed: 2,
      avgFinalNetWorth: 1450,
      totalRentCollected: 2,
      totalRentPaid: 25,
      tradesProposed: 1,
      tradesAccepted: 0,
    })
    // player_c1_b has cash 250 and no finalNetWorth → cash fallback
    expect(byModel['x-ai/grok-3-mini']).toMatchObject({
      wins: 1,
      gamesPlayed: 2,
      avgFinalNetWorth: 1025,
      totalRentCollected: 25,
      totalRentPaid: 2,
      tradesProposed: 1,
      tradesAccepted: 1,
    })

    const med = analytics.propertyStats.find(
      (p) => p.propertyName === 'Mediterranean Avenue',
    )
    const baltic = analytics.propertyStats.find(
      (p) => p.propertyName === 'Baltic Avenue',
    )
    const railroad = analytics.propertyStats.find(
      (p) => p.propertyName === 'Reading Railroad',
    )
    // First bank acquisition only; trade/bankruptcy/re-purchase ignored
    expect(med).toMatchObject({ timesPurchased: 2, timesAuctioned: 0 })
    expect(baltic).toMatchObject({ timesPurchased: 0, timesAuctioned: 1 })
    expect(railroad).toMatchObject({ timesPurchased: 0, timesAuctioned: 1 })

    const h2h = analytics.headToHead.records.find(
      (r) => r.pairKey === 'openai/gpt-4o-mini|x-ai/grok-3-mini',
    )
    expect(h2h).toMatchObject({
      modelAWins: 1,
      modelBWins: 1,
      totalGames: 2,
    })

    const strategy = Object.fromEntries(
      analytics.strategyProfiles.map((row) => [row.modelId, row]),
    )
    expect(strategy['openai/gpt-4o-mini']).toMatchObject({
      buyRate: 1,
      tradeFrequency: 1,
      decisionsAnalyzed: 2,
    })
    expect(strategy['x-ai/grok-3-mini']).toMatchObject({
      buyRate: 0,
      decisionsAnalyzed: 1,
    })

    expect(analytics.modelDetails['openai/gpt-4o-mini']?.stats.wins).toBe(1)
    expect(
      analytics.modelDetails['x-ai/grok-3-mini']?.stats.avgFinalNetWorth,
    ).toBe(1025)
  })

  it('produces byte-identical outputs for the same snapshot twice', async () => {
    const outA = mkdtempSync(join(tmpdir(), 'museum-det-a-'))
    const outB = mkdtempSync(join(tmpdir(), 'museum-det-b-'))
    await generateMuseumFromSnapshot({
      snapshotPath: FIXTURE_SNAPSHOT,
      outputDir: outA,
    })
    await generateMuseumFromSnapshot({
      snapshotPath: FIXTURE_SNAPSHOT,
      outputDir: outB,
    })

    for (const file of ['index.json', 'analytics.json'] as const) {
      expect(readFileSync(join(outA, file), 'utf8')).toBe(
        readFileSync(join(outB, file), 'utf8'),
      )
    }
    const games = readdirSync(join(outA, 'games')).sort()
    expect(games).toEqual(readdirSync(join(outB, 'games')).sort())
    for (const file of games) {
      expect(readFileSync(join(outA, 'games', file), 'utf8')).toBe(
        readFileSync(join(outB, 'games', file), 'utf8'),
      )
    }
  })

  it('fails closed when a completed game is missing required players', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-bad-'))
    await expect(
      generateMuseumFromSnapshot({
        snapshotPath: join(
          import.meta.dirname,
          'fixtures',
          'broken-missing-players.zip',
        ),
        outputDir,
      }),
    ).rejects.toThrow(/referential integrity|missing players/i)
  })

  it('fails closed when retained related rows have a non-string gameId', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-bad-gid-'))
    await expect(
      generateMuseumFromSnapshot({
        snapshotPath: join(
          import.meta.dirname,
          'fixtures',
          'broken-nonstring-gameid.zip',
        ),
        outputDir,
      }),
    ).rejects.toThrow(/gameId|referential integrity|non-string/i)
  })

  it('fails closed when a completed game has fewer than two players', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-one-'))
    await expect(
      generateMuseumFromSnapshot({
        snapshotPath: join(
          import.meta.dirname,
          'fixtures',
          'broken-one-player.zip',
        ),
        outputDir,
      }),
    ).rejects.toThrow(/at least two players|referential integrity/i)
  })

  it('fails closed when generation-only decisions reference missing players', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-dec-'))
    await expect(
      generateMuseumFromSnapshot({
        snapshotPath: join(
          import.meta.dirname,
          'fixtures',
          'broken-orphan-decision.zip',
        ),
        outputDir,
      }),
    ).rejects.toThrow(/decision|missing player|referential integrity/i)
  })

  it('fails closed when generation-only trades reference missing players', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-trade-'))
    await expect(
      generateMuseumFromSnapshot({
        snapshotPath: join(
          import.meta.dirname,
          'fixtures',
          'broken-orphan-trade.zip',
        ),
        outputDir,
      }),
    ).rejects.toThrow(/trade|missing player|referential integrity/i)
  })

  it.each(GENERATION_ONLY_TABLES)(
    'fails closed when generation-only %s table is missing',
    async (table) => {
      const outputDir = mkdtempSync(join(tmpdir(), `museum-no-${table}-`))
      await expect(
        generateMuseumFromSnapshot({
          snapshotPath: snapshotMissingTable(table),
          outputDir,
        }),
      ).rejects.toThrow(
        new RegExp(`MuseumGenerationError|missing required table.*${table}`, 'i'),
      )
    },
  )

  it.each(GENERATION_ONLY_TABLES)(
    'fails closed when %s gameId is malformed (non-string)',
    async (table) => {
      const outputDir = mkdtempSync(join(tmpdir(), `museum-bad-${table}-gid-`))
      await expect(
        generateMuseumFromSnapshot({
          snapshotPath: snapshotWithFirstGameId(table, 12345),
          outputDir,
        }),
      ).rejects.toThrow(/MuseumGenerationError|gameId|referential integrity|non-string/i)
    },
  )

  it.each(GENERATION_ONLY_TABLES)(
    'fails closed when %s gameId references an unknown game',
    async (table) => {
      const outputDir = mkdtempSync(join(tmpdir(), `museum-unk-${table}-`))
      await expect(
        generateMuseumFromSnapshot({
          snapshotPath: snapshotWithFirstGameId(table, 'game_does_not_exist'),
          outputDir,
        }),
      ).rejects.toThrow(
        /MuseumGenerationError|gameId|unknown game|referential integrity/i,
      )
    },
  )

  it('accepts valid abandoned-game generation rows after gameId validates, excluding them from analytics', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'museum-ok-abd-'))
    const result = await generateMuseumFromSnapshot({
      snapshotPath: join(
        import.meta.dirname,
        'fixtures',
        'ok-abandoned-generation-rows.zip',
      ),
      outputDir,
    })
    expect(result.completedGameCount).toBe(2)
    expect(result.abandonedExcludedCount).toBe(1)

    const analytics = JSON.parse(
      readFileSync(join(outputDir, 'analytics.json'), 'utf8'),
    ) as Analytics
    // Same completed-only totals as tiny-snapshot (abandoned rows excluded)
    expect(analytics.global).toMatchObject({
      completedGames: 2,
      totalDecisions: 3,
      totalTrades: 2,
      acceptedTrades: 1,
      totalRentPaid: 27,
    })
  })
})

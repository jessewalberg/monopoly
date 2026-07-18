import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getAnalytics,
  getGameIndex,
  getGameReplay,
  listCompletedGames,
} from './data'

const MUSEUM_ROOT = join(process.cwd(), 'public', 'museum')

describe('static museum data API', () => {
  it('serves completed game index and analytics without Convex imports', async () => {
    expect(MUSEUM_ROOT).toContain('museum')

    const index = await getGameIndex()
    expect(index.completedGameCount).toBe(224)
    expect(index.games).toHaveLength(224)
    expect(new Set(index.games.map((g) => g.status))).toEqual(new Set(['completed']))

    const listed = await listCompletedGames({ limit: 5 })
    expect(listed).toHaveLength(5)
    expect(listed[0]?.id).toBeTruthy()

    const analytics = await getAnalytics()
    expect(analytics.global.completedGames).toBe(224)
    expect(analytics.leaderboard.length).toBeGreaterThan(0)
    expect(analytics.strategyProfiles.length).toBeGreaterThan(0)
    expect(analytics.winRateTrends.totalGames).toBe(224)
    expect(analytics).not.toHaveProperty('decisions')
    expect(analytics).not.toHaveProperty('trades')
    expect(analytics).not.toHaveProperty('rentPayments')

    const sampleId = index.games[0].id
    const replay = await getGameReplay(sampleId)
    expect(replay.game._id).toBe(sampleId)
    expect(replay.players.length).toBeGreaterThan(0)
    expect(replay.properties.length).toBeGreaterThan(0)
    expect(replay.turns.length).toBeGreaterThan(0)
    expect(replay).not.toHaveProperty('decisions')
    expect(replay).not.toHaveProperty('trades')
    expect(replay).not.toHaveProperty('rentPayments')
  })

  it('route modules do not reference Convex or OpenRouter runtimes', () => {
    const routeFiles = [
      'src/router.tsx',
      'src/routes/index.tsx',
      'src/routes/games/index.tsx',
      'src/routes/games/$gameId.tsx',
      'src/routes/analytics/index.tsx',
      'src/routes/analytics/leaderboard.tsx',
      'src/routes/analytics/head-to-head.tsx',
      'src/routes/analytics/model/$modelId.tsx',
      'src/routes/play/index.tsx',
      'src/routes/play/$gameId.tsx',
    ]

    const banned = [
      'convex.cloud',
      'convex.site',
      'openrouter.ai',
      '@convex-dev/react-query',
      'convex/react',
      'convex/_generated',
      'VITE_CONVEX_URL',
      'from \'convex/',
      'from "convex/',
    ]

    for (const file of routeFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      for (const token of banned) {
        expect(source, `${file} must not contain ${token}`).not.toContain(token)
      }
    }
  })

  it('built client output does not embed retired Convex/OpenRouter endpoints when present', () => {
    const distClient = join(process.cwd(), 'dist', 'client')
    if (!existsSync(distClient)) {
      // Defense-in-depth scan; full verification runs this after `pnpm build`.
      return
    }

    const banned = ['convex.cloud', 'convex.site', 'openrouter.ai']
    const walk = (dir: string): Array<string> => {
      const entries = readdirSync(dir)
      const files: Array<string> = []
      for (const entry of entries) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) files.push(...walk(full))
        else if (/\.(js|mjs|cjs|html|map)$/.test(entry)) files.push(full)
      }
      return files
    }

    for (const file of walk(distClient)) {
      const text = readFileSync(file, 'utf8')
      for (const token of banned) {
        expect(text, `${file} must not contain ${token}`).not.toContain(token)
      }
    }
  })
})

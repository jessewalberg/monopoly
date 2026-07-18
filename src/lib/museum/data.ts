import type {
  MuseumAnalytics,
  MuseumGameIndex,
  MuseumGameIndexEntry,
  MuseumGameReplay,
} from './types'

/**
 * Resolve a museum asset URL that works under Vite/Cloudflare SSR.
 * Relative fetch('/museum/...') throws TypeError: Invalid URL during SSR.
 */
async function resolveMuseumAssetUrl(relativePath: string): Promise<string> {
  if (import.meta.env.SSR) {
    try {
      const { getRequest } = await import('@tanstack/react-start/server')
      return new URL(`/${relativePath}`, getRequest().url).href
    } catch {
      // Vitest and other non-request SSR contexts: relative path is polyfilled.
      return `/${relativePath}`
    }
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return new URL(`/${relativePath}`, window.location.origin).href
  }
  // Node without SSR flag: relative path is polyfilled in vitest.setup.ts
  return `/${relativePath}`
}

async function readMuseumJson<T>(relativePath: string): Promise<T> {
  const url = await resolveMuseumAssetUrl(relativePath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to load museum asset /${relativePath} (${response.status})`,
    )
  }
  return (await response.json()) as T
}

let indexCache: MuseumGameIndex | null = null
let analyticsCache: MuseumAnalytics | null = null
const replayCache = new Map<string, MuseumGameReplay>()

export async function getGameIndex(): Promise<MuseumGameIndex> {
  if (!indexCache) {
    indexCache = await readMuseumJson<MuseumGameIndex>('museum/index.json')
  }
  return indexCache
}

export async function listCompletedGames(options?: {
  limit?: number
}): Promise<Array<MuseumGameIndexEntry>> {
  const index = await getGameIndex()
  if (options?.limit !== undefined) {
    return index.games.slice(0, options.limit)
  }
  return index.games
}

export async function getAnalytics(): Promise<MuseumAnalytics> {
  if (!analyticsCache) {
    analyticsCache = await readMuseumJson<MuseumAnalytics>(
      'museum/analytics.json',
    )
  }
  return analyticsCache
}

export async function getGameReplay(gameId: string): Promise<MuseumGameReplay> {
  const cached = replayCache.get(gameId)
  if (cached) return cached

  const replay = await readMuseumJson<MuseumGameReplay>(
    `museum/games/${gameId}.json`,
  )
  replayCache.set(gameId, replay)
  return replay
}

export async function getLeaderboard(options?: {
  sortBy?: 'wins' | 'winRate' | 'gamesPlayed' | 'avgNetWorth'
  limit?: number
}) {
  const analytics = await getAnalytics()
  const sortBy = options?.sortBy ?? 'wins'
  const sorted = [...analytics.leaderboard].sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        return b.winRate - a.winRate
      case 'gamesPlayed':
        return b.gamesPlayed - a.gamesPlayed
      case 'avgNetWorth':
        return b.avgFinalNetWorth - a.avgFinalNetWorth
      case 'wins':
      default:
        return b.wins - a.wins
    }
  })
  return options?.limit ? sorted.slice(0, options.limit) : sorted
}

export async function getStrategyProfiles(modelIds?: Array<string>) {
  const analytics = await getAnalytics()
  if (!modelIds || modelIds.length === 0) return analytics.strategyProfiles
  const wanted = new Set(modelIds)
  return analytics.strategyProfiles.filter((p) => wanted.has(p.modelId))
}

export async function getModelDetail(modelId: string) {
  const analytics = await getAnalytics()
  if (!Object.hasOwn(analytics.modelDetails, modelId)) {
    return null
  }
  return analytics.modelDetails[modelId]
}

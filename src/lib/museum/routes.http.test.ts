import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ChildProcess } from 'node:child_process'

const PORT = 4317
const BASE = `http://localhost:${PORT}`

async function waitForServer(url: string, timeoutMs = 90_000): Promise<void> {
  const start = Date.now()
  let lastError: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status >= 400) return
    } catch (err) {
      lastError = err
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Server did not become ready at ${url}: ${String(lastError)}`)
}

async function getHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`)
  expect(res.status, `${path} status`).toBe(200)
  return res.text()
}

function assertNoSsrFallback(html: string, path: string): void {
  expect(
    html,
    `${path} must not fall back to client render after SSR error`,
  ).not.toMatch(/Switched to client rendering because the server rendering errored/i)
  expect(html, `${path} must not hit Invalid URL museum fetch`).not.toMatch(
    /Invalid URL: \/museum\//i,
  )
  expect(html, `${path} must render route content into main`).not.toMatch(
    /<main class="flex-1"><!--\$!-->/,
  )
}

describe('museum public HTTP routes (SSR)', () => {
  let child: ChildProcess | undefined
  let index: { games: Array<{ id: string }> }
  let analytics: { leaderboard: Array<{ modelId: string }> }

  beforeAll(async () => {
    index = JSON.parse(
      readFileSync(join(process.cwd(), 'public/museum/index.json'), 'utf8'),
    ) as typeof index
    analytics = JSON.parse(
      readFileSync(join(process.cwd(), 'public/museum/analytics.json'), 'utf8'),
    ) as typeof analytics

    child = spawn(
      'pnpm',
      ['exec', 'vite', 'dev', '--port', String(PORT), '--strictPort'],
      {
        cwd: process.cwd(),
        env: { ...process.env, BROWSER: 'none' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    await waitForServer(`${BASE}/`)
  }, 120_000)

  afterAll(async () => {
    if (!child?.pid) return
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 500))
    try {
      process.kill(child.pid, 0)
      child.kill('SIGKILL')
    } catch {
      // already exited
    }
  })

  it('serves /, /games, /games/:id, analytics routes, and /play with SSR content', async () => {
    const gameId = index.games[0]?.id
    expect(gameId).toBeTruthy()
    const modelId = analytics.leaderboard[0]?.modelId
    expect(modelId).toBeTruthy()

    const home = await getHtml('/')
    assertNoSsrFallback(home, '/')
    expect(home).toMatch(/Museum Mode/)
    expect(home).toMatch(/224/)
    expect(home).toMatch(/Browse Game History/)

    const games = await getHtml('/games')
    assertNoSsrFallback(games, '/games')
    expect(games).toMatch(/Game History/)
    expect(games).toMatch(/224/)

    const replay = await getHtml(`/games/${gameId}`)
    assertNoSsrFallback(replay, `/games/${gameId}`)
    expect(replay).toMatch(/Replay/)
    expect(replay).toMatch(/Turn Selector/)

    const analyticsPage = await getHtml('/analytics')
    assertNoSsrFallback(analyticsPage, '/analytics')
    expect(analyticsPage).toMatch(/Analytics/)

    const leaderboard = await getHtml('/analytics/leaderboard')
    assertNoSsrFallback(leaderboard, '/analytics/leaderboard')
    expect(leaderboard).toMatch(/Leaderboard/)

    const h2h = await getHtml('/analytics/head-to-head')
    assertNoSsrFallback(h2h, '/analytics/head-to-head')
    expect(h2h).toMatch(/Head.to.Head|Head-to-Head|head-to-head/i)

    const modelPage = await getHtml(
      `/analytics/model/${encodeURIComponent(modelId)}`,
    )
    assertNoSsrFallback(modelPage, `/analytics/model/${modelId}`)
    expect(modelPage).toMatch(/Model|Wins|Games/i)

    const play = await getHtml('/play')
    assertNoSsrFallback(play, '/play')
    expect(play).toMatch(/Arena Play Retired|retired|read-only museum/i)
  }, 120_000)
})

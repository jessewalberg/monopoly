import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const originalFetch = globalThis.fetch.bind(globalThis)

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const museumIdx = url.indexOf('/museum/')
  if (museumIdx >= 0) {
    const relative = url.slice(museumIdx + 1) // museum/...
    const fullPath = join(process.cwd(), 'public', relative)
    try {
      const body = readFileSync(fullPath, 'utf8')
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    } catch {
      return new Response(`Missing museum asset: ${relative}`, { status: 404 })
    }
  }
  return originalFetch(input, init)
}) as typeof fetch

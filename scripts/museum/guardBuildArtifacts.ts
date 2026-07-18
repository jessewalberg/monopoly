import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export type ArtifactFinding = {
  file: string
  token: string
}

export type ArtifactGuardResult = {
  ok: boolean
  findings: Array<ArtifactFinding>
}

const FORBIDDEN_ENDPOINTS = [
  'convex.cloud',
  'convex.site',
  'openrouter.ai',
] as const

const RETIRED_ENV_NAMES = [
  'VITE_CONVEX_URL',
  'OPENROUTER_API_KEY',
  'CONVEX_DEPLOYMENT',
  'CONVEX_DEPLOY_KEY',
  'VITE_ADMIN_PASSPHRASE',
] as const

const FORBIDDEN_LITERALS = [...FORBIDDEN_ENDPOINTS, ...RETIRED_ENV_NAMES] as const

/** OpenRouter-style secret prefix; findings report only this token, never the full key. */
const SK_OR_PREFIX = 'sk-or-'

function walkFiles(dir: string): Array<string> {
  const files: Array<string> = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(full))
    else files.push(full)
  }
  return files
}

export function scanBuildArtifacts(rootDir: string): ArtifactGuardResult {
  if (!statSync(rootDir, { throwIfNoEntry: false })?.isDirectory()) {
    return { ok: true, findings: [] }
  }

  const findings: Array<ArtifactFinding> = []

  for (const absolute of walkFiles(rootDir)) {
    const file = relative(rootDir, absolute).split('\\').join('/')
    let text: string
    try {
      text = readFileSync(absolute, 'utf8')
    } catch {
      continue
    }

    for (const token of FORBIDDEN_LITERALS) {
      if (text.includes(token)) {
        findings.push({ file, token })
      }
    }

    if (text.includes(SK_OR_PREFIX)) {
      findings.push({ file, token: SK_OR_PREFIX })
    }
  }

  return { ok: findings.length === 0, findings }
}

/** Report paths and tokens only — never secret values or full line contents. */
export function formatArtifactFindings(
  findings: Array<ArtifactFinding>,
): string {
  return findings
    .map((f) => `${f.file}: forbidden token ${f.token}`)
    .join('\n')
}

export function assertCleanBuildArtifacts(rootDir: string): void {
  const result = scanBuildArtifacts(rootDir)
  if (!result.ok) {
    throw new Error(
      `Build artifact guard failed:\n${formatArtifactFindings(result.findings)}`,
    )
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(resolve(entry)).href
}

if (isMainModule()) {
  const root = resolve(process.argv[2] ?? join(process.cwd(), 'dist'))
  try {
    assertCleanBuildArtifacts(root)
    console.log(`Build artifact guard passed: ${root}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

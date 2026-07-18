import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanBuildArtifacts } from './guardBuildArtifacts'

function fixtureRoot(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `artifact-guard-${name}-`))
  mkdirSync(join(root, 'server'), { recursive: true })
  mkdirSync(join(root, 'client'), { recursive: true })
  return root
}

describe('scanBuildArtifacts', () => {
  it('fails when a hidden build file embeds a forbidden runtime endpoint', () => {
    const root = fixtureRoot('endpoint')
    writeFileSync(
      join(root, 'server', '.dev.vars'),
      'VITE_APP_URL="https://example.convex.cloud"\n',
    )

    const result = scanBuildArtifacts(root)

    expect(result.ok).toBe(false)
    expect(result.findings).toEqual([
      { file: 'server/.dev.vars', token: 'convex.cloud' },
    ])
  })

  it('fails when a hidden build file embeds a retired env name', () => {
    const root = fixtureRoot('retired-env')
    writeFileSync(
      join(root, 'server', '.dev.vars'),
      'OPENROUTER_API_KEY="synthetic-retired-value"\n',
    )

    const result = scanBuildArtifacts(root)

    expect(result.ok).toBe(false)
    expect(result.findings).toEqual([
      { file: 'server/.dev.vars', token: 'OPENROUTER_API_KEY' },
    ])
    expect(JSON.stringify(result.findings)).not.toContain(
      'synthetic-retired-value',
    )
  })

  it('fails when a build file embeds sk-or-style key material', () => {
    const root = fixtureRoot('sk-or')
    writeFileSync(
      join(root, 'client', 'chunk.js'),
      'const k = "sk-or-v1-abc123synthetic";\n',
    )

    const result = scanBuildArtifacts(root)

    expect(result.ok).toBe(false)
    expect(result.findings).toEqual([
      { file: 'client/chunk.js', token: 'sk-or-' },
    ])
    expect(JSON.stringify(result.findings)).not.toContain('abc123synthetic')
  })

  it('passes a clean artifact tree with no forbidden material', () => {
    const root = fixtureRoot('clean')
    writeFileSync(
      join(root, 'server', 'index.js'),
      'export default { museum: true }\n',
    )
    writeFileSync(join(root, 'client', 'app.js'), 'console.log("museum")\n')

    const result = scanBuildArtifacts(root)

    expect(result).toEqual({ ok: true, findings: [] })
  })
})

import { describe, expect, it } from 'vitest'
import { AVAILABLE_MODELS } from './models'

/**
 * Historical model catalog validation for the museum archive.
 * Live OpenRouter API checks are retired with the static sunset.
 */

describe('AVAILABLE_MODELS', () => {
  it('should have unique model IDs', () => {
    const ids = AVAILABLE_MODELS.map((m) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have valid provider prefixes', () => {
    const validPrefixes = ['openai/', 'anthropic/', 'google/', 'x-ai/']
    for (const model of AVAILABLE_MODELS) {
      const hasValidPrefix = validPrefixes.some((prefix) =>
        model.id.startsWith(prefix),
      )
      expect(hasValidPrefix, `Invalid prefix for model: ${model.id}`).toBe(true)
    }
  })

  it('should have consistent provider names', () => {
    const providerMap: Record<string, string> = {
      'openai/': 'OpenAI',
      'anthropic/': 'Anthropic',
      'google/': 'Google',
      'x-ai/': 'xAI',
    }

    for (const model of AVAILABLE_MODELS) {
      for (const [prefix, provider] of Object.entries(providerMap)) {
        if (model.id.startsWith(prefix)) {
          expect(
            model.provider,
            `Model ${model.id} has wrong provider: ${model.provider}`,
          ).toBe(provider)
        }
      }
    }
  })

  it('should have display names', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.name.length).toBeGreaterThan(0)
    }
  })
})

const KNOWN_VALID_IDS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1',
  'openai/o1',
  'openai/o1-mini',
  'openai/o3-mini',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro',
  'x-ai/grok-3',
  'x-ai/grok-3-mini',
  'x-ai/grok-4',
]

describe('historical OpenRouter model id catalog', () => {
  it('should only use known historical model IDs', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(
        KNOWN_VALID_IDS.includes(model.id),
        `Model ${model.id} is not in the known historical IDs list.`,
      ).toBe(true)
    }
  })
})

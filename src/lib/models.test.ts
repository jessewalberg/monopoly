import { describe, expect, it } from 'vitest'
import { AVAILABLE_MODELS } from './models'

/**
 * Model validation tests
 *
 * These tests validate that all model IDs in AVAILABLE_MODELS follow
 * the correct OpenRouter naming conventions and format.
 *
 * To validate models against the live OpenRouter API, run:
 *   OPENROUTER_API_KEY=your_key pnpm test -- --run models.test.ts
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

  it('should have required fields', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.provider).toBeTruthy()
      expect(['budget', 'standard', 'premium']).toContain(model.tier)
    }
  })

  it('should have valid cost information', () => {
    for (const model of AVAILABLE_MODELS) {
      if (model.costPerMillion) {
        expect(model.costPerMillion.input).toBeGreaterThanOrEqual(0)
        expect(model.costPerMillion.output).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('should not use deprecated date-suffixed model IDs', () => {
    // OpenRouter now uses shorter IDs without date suffixes for most models
    const datePattern = /-\d{8}$/
    for (const model of AVAILABLE_MODELS) {
      expect(
        datePattern.test(model.id),
        `Model ${model.id} uses deprecated date-suffixed format`,
      ).toBe(false)
    }
  })

  it('should use dots not hyphens for version numbers in Anthropic models', () => {
    // Anthropic models use dots: claude-3.5-sonnet, not claude-3-5-sonnet
    for (const model of AVAILABLE_MODELS) {
      if (model.id.startsWith('anthropic/')) {
        // Check for pattern like "3-5" which should be "3.5"
        const hasHyphenatedVersion = /claude-\d-\d/.test(model.id)
        expect(
          hasHyphenatedVersion,
          `Model ${model.id} should use dots for version numbers (e.g., claude-3.5-sonnet)`,
        ).toBe(false)
      }
    }
  })

  // Known valid OpenRouter model IDs as of January 2025
  const KNOWN_VALID_IDS = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-4.1',
    'openai/o3-mini',
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

  it('should only use known valid OpenRouter model IDs', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(
        KNOWN_VALID_IDS.includes(model.id),
        `Model ${model.id} is not in the known valid IDs list. ` +
          `If this is a new valid model, add it to KNOWN_VALID_IDS in models.test.ts`,
      ).toBe(true)
    }
  })
})

// Optional: Live API validation (only runs if API key is provided)
describe.skipIf(!process.env.OPENROUTER_API_KEY)(
  'OpenRouter API validation',
  () => {
    it('should validate all model IDs against OpenRouter API', async () => {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        console.log('Skipping API validation - no OPENROUTER_API_KEY set')
        return
      }

      // Fetch available models from OpenRouter
      let response: Response
      try {
        response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      } catch (error) {
        if (process.env.OPENROUTER_STRICT_TESTS === 'true') {
          throw error
        }
        console.log(
          'Skipping API validation - failed to reach OpenRouter:',
          error,
        )
        return
      }

      if (!response.ok) {
        if (process.env.OPENROUTER_STRICT_TESTS === 'true') {
          throw new Error(`Failed to fetch models: ${response.status}`)
        }
        console.log(
          `Skipping API validation - OpenRouter responded ${response.status}`,
        )
        return
      }

      const data = (await response.json()) as {
        data: Array<{ id: string }>
      }
      const availableIds = new Set(data.data.map((m) => m.id))

      const invalidModels: Array<string> = []
      for (const model of AVAILABLE_MODELS) {
        if (!availableIds.has(model.id)) {
          invalidModels.push(model.id)
        }
      }

      expect(
        invalidModels,
        `The following models are not available on OpenRouter: ${invalidModels.join(', ')}`,
      ).toHaveLength(0)
    })
  },
)

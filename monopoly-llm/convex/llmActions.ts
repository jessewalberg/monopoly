"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

// ============================================================
// TYPES
// ============================================================

interface DecisionResult {
  action: string;
  parameters: Record<string, unknown>;
  reasoning: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  rawResponse: string;
}

// ============================================================
// OPENROUTER ACTION
// ============================================================

/**
 * Call OpenRouter to get an LLM decision
 */
export const getDecision = action({
  args: {
    modelId: v.string(),
    systemPrompt: v.string(),
    userPrompt: v.string(),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DecisionResult> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://monopoly-llm.vercel.app",
        "X-Title": "LLM Monopoly Arena",
      },
    });

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Retry once on failure
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await Promise.race([
          client.chat.completions.create({
            model: args.modelId,
            messages: [
              { role: "system", content: args.systemPrompt },
              { role: "user", content: args.userPrompt },
            ],
            temperature: args.temperature ?? 0.7,
            max_tokens: 500,
          }),
          // Timeout after 30 seconds
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), 30000)
          ),
        ]);

        const latencyMs = Date.now() - startTime;
        const rawResponse = response.choices[0]?.message?.content || "";

        // Parse the JSON response
        const parsed = parseJsonResponse(rawResponse);

        return {
          action: parsed.action || "unknown",
          parameters: parsed.parameters || {},
          reasoning: parsed.reasoning || "No reasoning provided",
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          latencyMs,
          rawResponse,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt + 1} failed:`, error);

        // Don't retry on timeout
        if (lastError.message === "Request timeout") {
          break;
        }

        // Wait a bit before retry
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Return fallback on complete failure
    const latencyMs = Date.now() - startTime;
    return {
      action: "error",
      parameters: { error: lastError?.message || "Unknown error" },
      reasoning: `LLM call failed: ${lastError?.message}`,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs,
      rawResponse: "",
    };
  },
});

/**
 * Parse JSON from LLM response, handling various formats
 */
function parseJsonResponse(text: string): {
  action?: string;
  parameters?: Record<string, unknown>;
  reasoning?: string;
} {
  // Clean up the response
  let cleaned = text.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue to fallback
    }
  }

  // Try parsing the whole thing
  try {
    return JSON.parse(cleaned);
  } catch {
    // Return empty object on parse failure
    return {};
  }
}

// ============================================================
// HELPER ACTION FOR TESTING
// ============================================================

/**
 * Test the OpenRouter connection
 */
export const testConnection = action({
  args: {
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OPENROUTER_API_KEY not configured" };
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    try {
      const response = await client.chat.completions.create({
        model: args.modelId,
        messages: [
          { role: "user", content: "Say 'Hello' and nothing else." },
        ],
        max_tokens: 10,
      });

      return {
        success: true,
        response: response.choices[0]?.message?.content,
        model: args.modelId,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        model: args.modelId,
      };
    }
  },
});

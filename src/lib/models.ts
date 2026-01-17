// ============================================================
// AVAILABLE LLM MODELS (via OpenRouter)
// Only models from: OpenAI, Anthropic, Google, xAI
// Ordered by cost (cheapest first within each tier)
// ============================================================

export type ModelTier = "budget" | "standard" | "premium";

export interface LLMModel {
  id: string; // OpenRouter model ID
  name: string; // Display name
  provider: string; // Company name
  tier: ModelTier;
  description?: string;
  // Approximate cost per million tokens (input/output)
  costPerMillion?: { input: number; output: number };
}

export const AVAILABLE_MODELS: readonly LLMModel[] = [
  // ============================================================
  // BUDGET MODELS (cheapest options - recommended for testing)
  // ============================================================
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "budget",
    description: "Cheapest OpenAI option, great for games",
    costPerMillion: { input: 0.15, output: 0.6 },
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "budget",
    description: "Fast and affordable Google model",
    costPerMillion: { input: 0.1, output: 0.4 },
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
    tier: "budget",
    description: "Ultra-low latency and cost efficient",
    costPerMillion: { input: 0.1, output: 0.4 },
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    tier: "budget",
    description: "Fast and affordable Claude",
    costPerMillion: { input: 0.8, output: 4 },
  },
  {
    id: "x-ai/grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xAI",
    tier: "budget",
    description: "Lightweight thinking model from xAI",
    costPerMillion: { input: 0.3, output: 0.5 },
  },

  // ============================================================
  // STANDARD MODELS (good balance of cost and capability)
  // ============================================================
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "standard",
    description: "OpenAI's multimodal flagship",
    costPerMillion: { input: 2.5, output: 10 },
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "standard",
    description: "Google's workhorse model with built-in thinking",
    costPerMillion: { input: 0.3, output: 2.5 },
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "standard",
    description: "Excellent reasoning and strategy",
    costPerMillion: { input: 3, output: 15 },
  },
  {
    id: "x-ai/grok-3",
    name: "Grok 3",
    provider: "xAI",
    tier: "standard",
    description: "xAI's flagship model",
    costPerMillion: { input: 0.3, output: 0.5 },
  },

  // ============================================================
  // PREMIUM MODELS (highest capability, most expensive)
  // ============================================================
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "OpenAI",
    tier: "premium",
    description: "OpenAI's most capable model",
    costPerMillion: { input: 2, output: 8 },
  },
  {
    id: "openai/o3-mini",
    name: "o3 Mini",
    provider: "OpenAI",
    tier: "premium",
    description: "Advanced reasoning model",
    costPerMillion: { input: 1.1, output: 4.4 },
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    tier: "premium",
    description: "Google's most capable reasoning model",
    costPerMillion: { input: 1.25, output: 10 },
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    tier: "premium",
    description: "Latest Claude, excellent reasoning",
    costPerMillion: { input: 3, output: 15 },
  },
  {
    id: "x-ai/grok-4",
    name: "Grok 4",
    provider: "xAI",
    tier: "premium",
    description: "xAI's latest reasoning model",
    costPerMillion: { input: 0.2, output: 1.5 },
  },
] as const;

// ============================================================
// MODEL HELPERS
// ============================================================

export function getModelById(id: string): LLMModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(provider: string): LLMModel[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider);
}

export function getModelsByTier(tier: ModelTier): LLMModel[] {
  return AVAILABLE_MODELS.filter((m) => m.tier === tier);
}

export function getProviders(): string[] {
  return [...new Set(AVAILABLE_MODELS.map((m) => m.provider))];
}

// Get models sorted by cost (cheapest first)
export function getModelsSortedByCost(): LLMModel[] {
  return [...AVAILABLE_MODELS].sort((a, b) => {
    const costA = (a.costPerMillion?.input ?? 0) + (a.costPerMillion?.output ?? 0);
    const costB = (b.costPerMillion?.input ?? 0) + (b.costPerMillion?.output ?? 0);
    return costA - costB;
  });
}

// ============================================================
// PLAYER TOKEN COLORS
// ============================================================

export interface TokenColor {
  name: string;
  hex: string;
  textColor: string; // For contrast
}

export const TOKEN_COLORS: readonly TokenColor[] = [
  { name: "Red", hex: "#EF4444", textColor: "#FFFFFF" },
  { name: "Blue", hex: "#3B82F6", textColor: "#FFFFFF" },
  { name: "Green", hex: "#22C55E", textColor: "#FFFFFF" },
  { name: "Yellow", hex: "#EAB308", textColor: "#000000" },
  { name: "Purple", hex: "#A855F7", textColor: "#FFFFFF" },
  { name: "Orange", hex: "#F97316", textColor: "#FFFFFF" },
  { name: "Pink", hex: "#EC4899", textColor: "#FFFFFF" },
  { name: "Cyan", hex: "#06B6D4", textColor: "#000000" },
] as const;

export function getTokenColor(index: number): TokenColor {
  return TOKEN_COLORS[index % TOKEN_COLORS.length];
}

// ============================================================
// DEFAULT GAME SETTINGS
// ============================================================

export const DEFAULT_GAME_CONFIG = {
  startingMoney: 1500,
  speedMs: 2000, // 2 seconds between turns
  turnLimit: 200, // Optional max turns
} as const;

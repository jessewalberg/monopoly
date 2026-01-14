// ============================================================
// AVAILABLE LLM MODELS (via OpenRouter)
// ============================================================

export type ModelTier = "flagship" | "standard" | "fast" | "economy";

export interface LLMModel {
  id: string; // OpenRouter model ID
  name: string; // Display name
  provider: string; // Company name
  tier: ModelTier;
  description?: string;
}

export const AVAILABLE_MODELS: readonly LLMModel[] = [
  // Anthropic
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    tier: "flagship",
    description: "Latest Claude model, excellent reasoning",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "standard",
    description: "Fast and capable all-rounder",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    tier: "fast",
    description: "Quick responses, good for simple decisions",
  },

  // OpenAI
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "flagship",
    description: "OpenAI's flagship multimodal model",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "fast",
    description: "Efficient and cost-effective",
  },
  {
    id: "openai/o1-mini",
    name: "o1-mini",
    provider: "OpenAI",
    tier: "standard",
    description: "Reasoning-focused model",
  },

  // Google
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "fast",
    description: "Google's fastest model",
  },
  {
    id: "google/gemini-exp-1206",
    name: "Gemini Experimental",
    provider: "Google",
    tier: "flagship",
    description: "Latest experimental Gemini",
  },

  // Meta
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    tier: "standard",
    description: "Open-source powerhouse",
  },

  // Mistral
  {
    id: "mistralai/mistral-large-2411",
    name: "Mistral Large",
    provider: "Mistral",
    tier: "flagship",
    description: "Mistral's most capable model",
  },
  {
    id: "mistralai/mistral-small-2503",
    name: "Mistral Small",
    provider: "Mistral",
    tier: "fast",
    description: "Fast and efficient",
  },

  // DeepSeek
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    tier: "economy",
    description: "Cost-effective reasoning",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    tier: "standard",
    description: "Advanced reasoning model",
  },

  // xAI
  {
    id: "x-ai/grok-2-1212",
    name: "Grok 2",
    provider: "xAI",
    tier: "flagship",
    description: "xAI's flagship model",
  },

  // Qwen
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    tier: "standard",
    description: "Strong multilingual model",
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

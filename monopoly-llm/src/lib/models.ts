// ============================================================
// AVAILABLE LLM MODELS (via OpenRouter)
// ============================================================

export type ModelTier = "flagship" | "standard" | "fast" | "free";

export interface LLMModel {
  id: string; // OpenRouter model ID
  name: string; // Display name
  provider: string; // Company name
  tier: ModelTier;
  description?: string;
}

export const AVAILABLE_MODELS: readonly LLMModel[] = [
  // ============================================================
  // FREE MODELS (no API cost)
  // ============================================================
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    provider: "Meta",
    tier: "free",
    description: "Powerful open-source model, free tier",
  },
  {
    id: "meta-llama/llama-3.1-405b-instruct:free",
    name: "Llama 3.1 405B (Free)",
    provider: "Meta",
    tier: "free",
    description: "Largest Llama model, free tier",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (Free)",
    provider: "Google",
    tier: "free",
    description: "Google's fast model, free tier",
  },
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B (Free)",
    provider: "Google",
    tier: "free",
    description: "Google's open model, free tier",
  },
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1 (Free)",
    provider: "DeepSeek",
    tier: "free",
    description: "Advanced reasoning, free tier",
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B (Free)",
    provider: "Mistral",
    tier: "free",
    description: "Efficient open model, free tier",
  },
  {
    id: "qwen/qwen-2.5-vl-7b-instruct:free",
    name: "Qwen 2.5 7B (Free)",
    provider: "Qwen",
    tier: "free",
    description: "Alibaba's open model, free tier",
  },
  {
    id: "xiaomi/mimo-v2-flash:free",
    name: "MiMo V2 Flash (Free)",
    provider: "Xiaomi",
    tier: "free",
    description: "Fast MoE model, free tier",
  },
  {
    id: "moonshotai/kimi-k2:free",
    name: "Kimi K2 (Free)",
    provider: "Moonshot",
    tier: "free",
    description: "Strong reasoning, free tier",
  },

  // ============================================================
  // FLAGSHIP MODELS (highest capability)
  // ============================================================
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    tier: "flagship",
    description: "Latest Claude, excellent reasoning",
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    provider: "Anthropic",
    tier: "flagship",
    description: "Most capable Claude model",
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "OpenAI",
    tier: "flagship",
    description: "Latest GPT-4 series",
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "OpenAI",
    tier: "flagship",
    description: "Advanced reasoning model",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    tier: "flagship",
    description: "Google's most capable model",
  },
  {
    id: "x-ai/grok-3",
    name: "Grok 3",
    provider: "xAI",
    tier: "flagship",
    description: "xAI's flagship model",
  },
  {
    id: "mistralai/mistral-large-2411",
    name: "Mistral Large",
    provider: "Mistral",
    tier: "flagship",
    description: "Mistral's most capable model",
  },
  {
    id: "qwen/qwen3-max",
    name: "Qwen3 Max",
    provider: "Qwen",
    tier: "flagship",
    description: "Alibaba's flagship model",
  },

  // ============================================================
  // STANDARD MODELS (good balance)
  // ============================================================
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "standard",
    description: "Fast and capable all-rounder",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "standard",
    description: "Multimodal flagship model",
  },
  {
    id: "openai/o4-mini",
    name: "o4 Mini",
    provider: "OpenAI",
    tier: "standard",
    description: "Efficient reasoning model",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    tier: "standard",
    description: "Open-source powerhouse",
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "Meta",
    tier: "standard",
    description: "Latest Llama MoE model",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    tier: "standard",
    description: "Advanced reasoning model",
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    name: "Mistral Small 3.2",
    provider: "Mistral",
    tier: "standard",
    description: "Efficient mid-size model",
  },

  // ============================================================
  // FAST MODELS (speed optimized)
  // ============================================================
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    tier: "fast",
    description: "Quick responses, simple decisions",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "fast",
    description: "Efficient and cost-effective",
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "fast",
    description: "Google's fastest model",
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "fast",
    description: "Cost-effective and fast",
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

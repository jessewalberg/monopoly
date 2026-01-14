"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import OpenAI from "openai";
import {
  buildSystemPrompt,
  buildDecisionPrompt,
  type PlayerInfo,
  type PropertyInfo,
  type GameInfo,
} from "./lib/prompts";

// ============================================================
// TYPES
// ============================================================

const decisionTypeValidator = v.union(
  v.literal("buy_property"),
  v.literal("auction_bid"),
  v.literal("jail_strategy"),
  v.literal("pre_roll_actions"),
  v.literal("post_roll_actions"),
  v.literal("trade_response"),
  v.literal("bankruptcy_resolution")
);

type DecisionType =
  | "buy_property"
  | "auction_bid"
  | "jail_strategy"
  | "pre_roll_actions"
  | "post_roll_actions"
  | "trade_response"
  | "bankruptcy_resolution";

// ============================================================
// MAIN LLM DECISION ACTION
// ============================================================

/**
 * Get a decision from the LLM and process it
 * This action:
 * 1. Builds the prompt using game state
 * 2. Calls OpenRouter
 * 3. Parses the response
 * 4. Calls the processDecisionResult mutation to execute the decision
 *
 * Note: All mutations are in llmDecisionExecutors.ts because
 * "use node" files can only contain actions
 */
export const getLLMDecision = internalAction({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    turnId: v.id("turns"),
    decisionType: decisionTypeValidator,
    context: v.string(), // JSON string with decision-specific context
  },
  handler: async (ctx, args): Promise<void> => {
    const startTime = Date.now();

    // Fetch all needed data
    const [game, player, turn] = await Promise.all([
      ctx.runQuery(api.games.get, { gameId: args.gameId }),
      ctx.runQuery(api.players.get, { playerId: args.playerId }),
      ctx.runQuery(api.turns.get, { turnId: args.turnId }),
    ]);

    if (!game || !player || !turn) {
      console.error("Missing game data for LLM decision");
      // Fall back to default action
      await ctx.runMutation(internal.llmDecisionExecutors.processDecisionResult, {
        gameId: args.gameId,
        playerId: args.playerId,
        turnId: args.turnId,
        turnNumber: game?.currentTurnNumber ?? 1,
        decisionType: args.decisionType,
        action: getDefaultAction(args.decisionType),
        parameters: {},
        reasoning: "Failed to fetch game data",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
        rawResponse: "",
        context: args.context,
      });
      return;
    }

    // Get all players and properties
    const [allPlayers, allProperties] = await Promise.all([
      ctx.runQuery(api.players.getByGame, { gameId: args.gameId }),
      ctx.runQuery(api.properties.getByGame, { gameId: args.gameId }),
    ]);

    // Build prompts
    const currentPlayer: PlayerInfo = {
      _id: player._id,
      modelDisplayName: player.modelDisplayName,
      cash: player.cash,
      position: player.position,
      inJail: player.inJail,
      isBankrupt: player.isBankrupt,
      getOutOfJailCards: player.getOutOfJailCards,
    };

    const otherPlayers: PlayerInfo[] = allPlayers
      .filter((p) => p._id !== player._id)
      .map((p) => ({
        _id: p._id,
        modelDisplayName: p.modelDisplayName,
        cash: p.cash,
        position: p.position,
        inJail: p.inJail,
        isBankrupt: p.isBankrupt,
        getOutOfJailCards: p.getOutOfJailCards,
      }));

    const properties: PropertyInfo[] = allProperties.map((p) => ({
      _id: p._id,
      position: p.position,
      name: p.name,
      group: p.group,
      ownerId: p.ownerId,
      houses: p.houses,
      isMortgaged: p.isMortgaged,
    }));

    const gameInfo: GameInfo = {
      currentTurnNumber: game.currentTurnNumber,
      currentPhase: game.currentPhase,
    };

    const decisionContext = JSON.parse(args.context);
    const validActions = getValidActions(args.decisionType, decisionContext);

    const systemPrompt = buildSystemPrompt(player.modelDisplayName);
    const userPrompt = buildDecisionPrompt(
      args.decisionType,
      gameInfo,
      currentPlayer,
      otherPlayers,
      properties,
      validActions,
      decisionContext
    );

    // Call OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY not configured");
      await ctx.runMutation(internal.llmDecisionExecutors.processDecisionResult, {
        gameId: args.gameId,
        playerId: args.playerId,
        turnId: args.turnId,
        turnNumber: game.currentTurnNumber,
        decisionType: args.decisionType,
        action: getDefaultAction(args.decisionType),
        parameters: {},
        reasoning: "API key not configured - using default",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
        rawResponse: "",
        context: args.context,
      });
      return;
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://monopoly-llm.vercel.app",
        "X-Title": "LLM Monopoly Arena",
      },
    });

    let response;
    let rawResponse = "";
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      response = await Promise.race([
        client.chat.completions.create({
          model: player.modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 30000)
        ),
      ]);

      rawResponse = response.choices[0]?.message?.content || "";
      promptTokens = response.usage?.prompt_tokens || 0;
      completionTokens = response.usage?.completion_tokens || 0;
    } catch (error) {
      console.error("LLM call failed:", error);
      await ctx.runMutation(internal.llmDecisionExecutors.processDecisionResult, {
        gameId: args.gameId,
        playerId: args.playerId,
        turnId: args.turnId,
        turnNumber: game.currentTurnNumber,
        decisionType: args.decisionType,
        action: getDefaultAction(args.decisionType),
        parameters: {},
        reasoning: `LLM error: ${(error as Error).message}`,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - startTime,
        rawResponse: "",
        context: args.context,
      });
      return;
    }

    // Parse the response
    const parsed = parseJsonResponse(rawResponse);
    const latencyMs = Date.now() - startTime;

    // Validate and normalize the action
    const action = normalizeAction(
      parsed.action || getDefaultAction(args.decisionType),
      args.decisionType,
      validActions
    );

    await ctx.runMutation(internal.llmDecisionExecutors.processDecisionResult, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      turnNumber: game.currentTurnNumber,
      decisionType: args.decisionType,
      action,
      parameters: parsed.parameters || {},
      reasoning: parsed.reasoning || "No reasoning provided",
      promptTokens,
      completionTokens,
      latencyMs,
      rawResponse,
      context: args.context,
    });
  },
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function parseJsonResponse(text: string): {
  action?: string;
  parameters?: Record<string, unknown>;
  reasoning?: string;
} {
  let cleaned = text.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function getDefaultAction(decisionType: DecisionType): string {
  switch (decisionType) {
    case "buy_property":
      return "buy"; // Default to buying
    case "auction_bid":
      return "bid";
    case "jail_strategy":
      return "roll"; // Default to rolling
    case "pre_roll_actions":
    case "post_roll_actions":
      return "done"; // Default to finishing
    case "trade_response":
      return "reject"; // Default to rejecting
    default:
      return "done";
  }
}

function getValidActions(
  decisionType: DecisionType,
  context: Record<string, unknown>
): string[] {
  switch (decisionType) {
    case "buy_property":
      return ["buy", "auction"];
    case "auction_bid":
      return ["bid"];
    case "jail_strategy": {
      const actions = ["roll"];
      if (context.canPayFine) actions.push("pay");
      if (context.hasJailCard) actions.push("use_card");
      return actions;
    }
    case "pre_roll_actions":
      return ["build", "mortgage", "unmortgage", "trade", "done"];
    case "post_roll_actions":
      return ["build", "mortgage", "unmortgage", "done"];
    case "trade_response":
      return ["accept", "reject", "counter"];
    default:
      return ["done"];
  }
}

function normalizeAction(
  action: string,
  decisionType: DecisionType,
  validActions: string[]
): string {
  const normalized = action.toLowerCase().trim();

  // Check if action is valid
  if (validActions.includes(normalized)) {
    return normalized;
  }

  // Map common variations
  const mappings: Record<string, string> = {
    purchase: "buy",
    pass: "auction",
    decline: "auction",
    "roll dice": "roll",
    "pay fine": "pay",
    "use card": "use_card",
    end: "done",
    finish: "done",
    accept_trade: "accept",
    reject_trade: "reject",
  };

  if (mappings[normalized] && validActions.includes(mappings[normalized])) {
    return mappings[normalized];
  }

  // Return default if no match
  return getDefaultAction(decisionType);
}

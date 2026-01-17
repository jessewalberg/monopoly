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
import {
  parseDecisionResponse,
  getFallbackDecision,
  validateDecision,
  extractBidAmount,
} from "./lib/parseResponse";

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

    console.log(`[LLM] Game: ${args.gameId} | Decision: ${args.decisionType} | Player: ${args.playerId}`);

    const decisionContext = safeParseJson(args.context);
    const validActions = getValidActions(args.decisionType, decisionContext);

    // Fetch all needed data
    const [game, player, turn] = await Promise.all([
      ctx.runQuery(api.games.get, { gameId: args.gameId }),
      ctx.runQuery(api.players.get, { playerId: args.playerId }),
      ctx.runQuery(api.turns.get, { turnId: args.turnId }),
    ]);

    if (!game || !player || !turn) {
      // This is a critical error - game data should always exist
      const errorMsg = `Missing game data for LLM decision: game=${!!game}, player=${!!player}, turn=${!!turn}`;
      console.error(`[CRITICAL] ${errorMsg}`);
      throw new Error(errorMsg);
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
      // This is a configuration error - should be fixed before running games
      const errorMsg = "OPENROUTER_API_KEY not configured in Convex Dashboard environment variables";
      console.error(`[CRITICAL] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://monopoly-llm.vercel.app",
        "X-Title": "LLM Monopoly Arena",
      },
    });

    let rawResponse = "";
    let promptTokens = 0;
    let completionTokens = 0;

    // Retry logic: try up to 3 times with increasing timeouts
    const maxRetries = 3;
    const timeouts = [30000, 45000, 60000]; // 30s, 45s, 60s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await Promise.race([
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
            setTimeout(() => reject(new Error("Request timeout")), timeouts[attempt])
          ),
        ]);

        rawResponse = response.choices[0]?.message?.content || "";
        promptTokens = response.usage?.prompt_tokens || 0;
        completionTokens = response.usage?.completion_tokens || 0;
        break; // Success - exit retry loop
      } catch (error) {
        const errorMsg = `LLM API call failed for ${args.decisionType}: ${(error as Error).message}`;
        console.error(`[LLM_ERROR] Game: ${args.gameId} | Attempt ${attempt + 1}/${maxRetries}: ${errorMsg}`);
        console.error(`[LLM_ERROR] Game: ${args.gameId} | Model: ${player.modelId}, Player: ${player.modelDisplayName}`);

        if (attempt === maxRetries - 1) {
          // Final attempt failed - use fallback
          rawResponse = `[ERROR: ${(error as Error).message} after ${maxRetries} attempts]`;
        } else {
          // Wait before retrying (exponential backoff: 1s, 2s)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          console.log(`[LLM_RETRY] Game: ${args.gameId} | Retrying... attempt ${attempt + 2}/${maxRetries}`);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    let parsed = rawResponse.startsWith("[ERROR:") ? null : parseDecisionResponse(rawResponse, validActions);
    if (parsed && args.decisionType === "auction_bid") {
      const amount = extractBidAmount(parsed.parameters, player.cash);
      parsed = { ...parsed, parameters: { ...parsed.parameters, amount } };
    }

    // Use fallback only when parsing fails - pass rawResponse for debugging
    let decision = parsed ?? getFallbackDecision(args.decisionType, validActions, rawResponse);

    if (parsed) {
      const validation = validateDecision(parsed, args.decisionType);
      if (!validation.valid) {
        console.error(`[LLM_VALIDATION] Game: ${args.gameId} | Decision validation failed: ${validation.error}`);
        decision = getFallbackDecision(args.decisionType, validActions, rawResponse);
      }
    }
    if (args.decisionType === "auction_bid") {
      const amount = extractBidAmount(decision.parameters, player.cash);
      decision = { ...decision, parameters: { ...decision.parameters, amount } };
    }

    console.log(`[LLM] Game: ${args.gameId} | ${player.modelDisplayName} chose: ${decision.action} (${latencyMs}ms)`);

    await ctx.runMutation(internal.llmDecisionExecutors.processDecisionResult, {
      gameId: args.gameId,
      playerId: args.playerId,
      turnId: args.turnId,
      turnNumber: game.currentTurnNumber,
      decisionType: args.decisionType,
      action: decision.action,
      parameters: decision.parameters,
      reasoning: decision.reasoning,
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
    case "pre_roll_actions": {
      // Only include actions that are actually possible
      const actions: string[] = [];
      if (context.canBuild) actions.push("build");
      if (context.canMortgage) actions.push("mortgage");
      if (context.canUnmortgage) actions.push("unmortgage");
      actions.push("trade", "done");
      return actions;
    }
    case "post_roll_actions": {
      // Only include actions that are actually possible
      const actions: string[] = [];
      if (context.canBuild) actions.push("build");
      if (context.canMortgage) actions.push("mortgage");
      if (context.canUnmortgage) actions.push("unmortgage");
      actions.push("done");
      return actions;
    }
    case "trade_response":
      return ["accept", "reject", "counter"];
    default:
      return ["done"];
  }
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

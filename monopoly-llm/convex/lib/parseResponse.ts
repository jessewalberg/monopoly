import type { DecisionType } from "./types";

// ============================================================
// TYPES
// ============================================================

export interface ParsedDecision {
  action: string;
  parameters: Record<string, unknown>;
  reasoning: string;
}

// ============================================================
// RESPONSE PARSING
// ============================================================

/**
 * Parse a decision response from the LLM
 * @param rawText The raw text response from the LLM
 * @param validActions List of valid action names
 * @returns Parsed decision or null if parsing fails
 */
export function parseDecisionResponse(
  rawText: string,
  validActions: string[]
): ParsedDecision | null {
  // Clean up the response
  let cleaned = rawText.trim();

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
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (typeof parsed.action !== "string") {
      return null;
    }

    // Normalize action name (lowercase, trim)
    const action = parsed.action.toLowerCase().trim();

    // Check if action is valid
    const normalizedValidActions = validActions.map((a) => a.toLowerCase());
    if (!normalizedValidActions.includes(action)) {
      // Try to find a close match
      const closeMatch = findCloseMatch(action, validActions);
      if (closeMatch) {
        parsed.action = closeMatch;
      } else {
        return null;
      }
    } else {
      // Use the original casing from validActions
      const index = normalizedValidActions.indexOf(action);
      parsed.action = validActions[index];
    }

    return {
      action: parsed.action,
      parameters: parsed.parameters || {},
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch {
    return null;
  }
}

/**
 * Find a close match for an action name
 */
function findCloseMatch(action: string, validActions: string[]): string | null {
  // Common aliases and typos
  const aliases: Record<string, string[]> = {
    buy: ["purchase", "buy_property", "acquire"],
    auction: ["pass", "decline", "skip", "auction_property"],
    roll: ["roll_dice", "roll_for_doubles", "dice"],
    pay: ["pay_fine", "pay_jail", "pay_jail_fine"],
    use_card: ["use_jail_card", "card", "jail_card"],
    done: ["end", "finish", "end_turn", "pass", "skip"],
    build: ["build_house", "construct", "houses"],
    mortgage: ["mortgage_property"],
    unmortgage: ["unmortgage_property", "lift_mortgage"],
    accept: ["yes", "agree", "ok"],
    reject: ["no", "decline", "refuse"],
    counter: ["counter_offer", "counteroffer"],
    bid: ["place_bid", "make_bid"],
  };

  for (const [canonical, alts] of Object.entries(aliases)) {
    if (alts.includes(action) && validActions.includes(canonical)) {
      return canonical;
    }
  }

  // Try partial matches
  for (const valid of validActions) {
    if (action.includes(valid) || valid.includes(action)) {
      return valid;
    }
  }

  return null;
}

// ============================================================
// FALLBACK DECISIONS
// ============================================================

/**
 * Get a safe fallback decision when LLM response is invalid
 * This should only be used when parsing fails - throws error for debugging in dev
 */
export function getFallbackDecision(
  decisionType: DecisionType,
  validActions: string[],
  rawResponse?: string
): ParsedDecision {
  // Log the error for debugging - this helps identify why LLM responses fail
  console.error(`[LLM_FALLBACK] Decision type: ${decisionType}, Valid actions: ${validActions.join(", ")}`);
  if (rawResponse) {
    console.error(`[LLM_FALLBACK] Raw response that failed to parse: ${rawResponse.slice(0, 500)}`);
  }

  const fallbacks: Record<DecisionType, ParsedDecision> = {
    buy_property: {
      action: "auction",
      parameters: {},
      reasoning: "Fallback: passing to auction to conserve cash",
    },
    auction_bid: {
      action: "bid",
      parameters: { amount: 0 },
      reasoning: "Fallback: passing on auction",
    },
    jail_strategy: {
      action: validActions.includes("roll") ? "roll" : "pay",
      parameters: {},
      reasoning: "Fallback: trying to roll doubles",
    },
    pre_roll_actions: {
      action: "done",
      parameters: {},
      reasoning: "Fallback: proceeding to roll",
    },
    post_roll_actions: {
      action: "done",
      parameters: {},
      reasoning: "Fallback: ending turn",
    },
    trade_response: {
      action: "reject",
      parameters: {},
      reasoning: "Fallback: declining trade offer",
    },
    bankruptcy_resolution: {
      action: "liquidate",
      parameters: {},
      reasoning: "Fallback: liquidating assets",
    },
  };

  const fallback = fallbacks[decisionType];

  // Make sure the fallback action is actually valid
  if (fallback && validActions.includes(fallback.action)) {
    return fallback;
  }

  // Last resort: pick first valid action
  return {
    action: validActions[0] || "done",
    parameters: {},
    reasoning: "Fallback: using default action",
  };
}

// ============================================================
// PARAMETER EXTRACTION
// ============================================================

/**
 * Extract and validate bid amount from parameters
 */
export function extractBidAmount(
  parameters: Record<string, unknown>,
  maxCash: number
): number {
  const amount = parameters.amount;

  if (typeof amount === "number") {
    return Math.max(0, Math.min(Math.floor(amount), maxCash));
  }

  if (typeof amount === "string") {
    const parsed = parseInt(amount, 10);
    if (!isNaN(parsed)) {
      return Math.max(0, Math.min(parsed, maxCash));
    }
  }

  return 0;
}

/**
 * Extract property name from parameters
 */
export function extractPropertyName(
  parameters: Record<string, unknown>
): string | null {
  const name =
    parameters.propertyName || parameters.property || parameters.name;

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return null;
}

/**
 * Extract build count from parameters
 */
export function extractBuildCount(parameters: Record<string, unknown>): number {
  const count = parameters.count || parameters.houses || 1;

  if (typeof count === "number") {
    return Math.max(1, Math.min(Math.floor(count), 5));
  }

  if (typeof count === "string") {
    const parsed = parseInt(count, 10);
    if (!isNaN(parsed)) {
      return Math.max(1, Math.min(parsed, 5));
    }
  }

  return 1;
}

// ============================================================
// RESPONSE VALIDATION
// ============================================================

/**
 * Validate that a decision is complete and executable
 */
export function validateDecision(
  decision: ParsedDecision,
  decisionType: DecisionType
): { valid: boolean; error?: string } {
  // Check required parameters based on decision type and action
  switch (decisionType) {
    case "auction_bid":
      if (decision.action === "bid") {
        if (typeof decision.parameters.amount !== "number") {
          return { valid: false, error: "Bid amount required" };
        }
      }
      break;

    case "pre_roll_actions":
    case "post_roll_actions":
      if (decision.action === "build" || decision.action === "mortgage" || decision.action === "unmortgage") {
        if (!extractPropertyName(decision.parameters)) {
          return { valid: false, error: "Property name required" };
        }
      }
      break;
  }

  return { valid: true };
}

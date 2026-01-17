// ============================================================
// ERROR HANDLING UTILITIES
// ============================================================

/**
 * Custom error class for game-related errors
 */
export class GameError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    details?: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = "GameError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

/**
 * Error codes for the game
 */
export const ErrorCodes = {
  // Game errors
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_INVALID_STATUS: "GAME_INVALID_STATUS",
  GAME_NOT_ENOUGH_PLAYERS: "GAME_NOT_ENOUGH_PLAYERS",

  // Player errors
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  PLAYER_BANKRUPT: "PLAYER_BANKRUPT",
  PLAYER_INSUFFICIENT_FUNDS: "PLAYER_INSUFFICIENT_FUNDS",
  PLAYER_NO_JAIL_CARDS: "PLAYER_NO_JAIL_CARDS",

  // Property errors
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  PROPERTY_ALREADY_OWNED: "PROPERTY_ALREADY_OWNED",
  PROPERTY_NOT_OWNED: "PROPERTY_NOT_OWNED",
  PROPERTY_WRONG_OWNER: "PROPERTY_WRONG_OWNER",
  PROPERTY_MORTGAGED: "PROPERTY_MORTGAGED",
  PROPERTY_HAS_HOUSES: "PROPERTY_HAS_HOUSES",
  PROPERTY_NO_MONOPOLY: "PROPERTY_NO_MONOPOLY",
  PROPERTY_NOT_BUILDABLE: "PROPERTY_NOT_BUILDABLE",

  // Turn errors
  TURN_NOT_FOUND: "TURN_NOT_FOUND",

  // LLM errors
  LLM_API_ERROR: "LLM_API_ERROR",
  LLM_TIMEOUT: "LLM_TIMEOUT",
  LLM_PARSE_ERROR: "LLM_PARSE_ERROR",

  // Generic errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<string, string> = {
  [ErrorCodes.GAME_NOT_FOUND]: "Game not found. It may have been deleted.",
  [ErrorCodes.GAME_INVALID_STATUS]: "This action cannot be performed in the current game state.",
  [ErrorCodes.GAME_NOT_ENOUGH_PLAYERS]: "At least 2 players are required to start a game.",

  [ErrorCodes.PLAYER_NOT_FOUND]: "Player not found.",
  [ErrorCodes.PLAYER_BANKRUPT]: "This player is bankrupt and cannot take actions.",
  [ErrorCodes.PLAYER_INSUFFICIENT_FUNDS]: "Not enough cash to complete this action.",
  [ErrorCodes.PLAYER_NO_JAIL_CARDS]: "No Get Out of Jail Free cards available.",

  [ErrorCodes.PROPERTY_NOT_FOUND]: "Property not found.",
  [ErrorCodes.PROPERTY_ALREADY_OWNED]: "This property is already owned.",
  [ErrorCodes.PROPERTY_NOT_OWNED]: "This property has no owner.",
  [ErrorCodes.PROPERTY_WRONG_OWNER]: "You do not own this property.",
  [ErrorCodes.PROPERTY_MORTGAGED]: "This property is mortgaged.",
  [ErrorCodes.PROPERTY_HAS_HOUSES]: "Sell all houses before mortgaging this property.",
  [ErrorCodes.PROPERTY_NO_MONOPOLY]: "You need a complete color set to build houses.",
  [ErrorCodes.PROPERTY_NOT_BUILDABLE]: "Houses can only be built on color properties.",

  [ErrorCodes.TURN_NOT_FOUND]: "Turn record not found.",

  [ErrorCodes.LLM_API_ERROR]: "AI model temporarily unavailable. Using fallback behavior.",
  [ErrorCodes.LLM_TIMEOUT]: "AI model response timed out. Using fallback behavior.",
  [ErrorCodes.LLM_PARSE_ERROR]: "Could not understand AI model response. Using fallback behavior.",

  [ErrorCodes.VALIDATION_ERROR]: "Invalid input provided.",
  [ErrorCodes.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
};

/**
 * Create a GameError with a predefined code
 */
export function createError(
  code: keyof typeof ErrorCodes,
  details?: Record<string, unknown>
): GameError {
  const message = ErrorMessages[code] || "An unknown error occurred.";
  return new GameError(code, message, details);
}

/**
 * Wrap a function with error handling and logging
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Log the error with context
    console.error(`[${operation}] Error:`, error);

    // If it's already a GameError, rethrow
    if (error instanceof GameError) {
      throw error;
    }

    // If there's a fallback, use it
    if (fallback !== undefined) {
      console.warn(`[${operation}] Using fallback value`);
      return fallback;
    }

    // Wrap unknown errors
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new GameError(
      ErrorCodes.INTERNAL_ERROR,
      `${operation} failed: ${message}`,
      { originalError: message }
    );
  }
}

/**
 * Assert a condition and throw a GameError if false
 */
export function assertCondition(
  condition: boolean,
  code: keyof typeof ErrorCodes,
  details?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw createError(code, details);
  }
}

/**
 * Log an error without throwing
 */
export function logError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${operation}] Error:`, {
    message: errorMessage,
    stack: errorStack,
    context,
  });
}

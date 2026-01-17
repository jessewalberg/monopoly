import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ============================================================
// SCHEDULING HELPERS
// ============================================================

/**
 * Schedule the next turn step for a game
 */
export async function scheduleNextStep(
  ctx: MutationCtx,
  gameId: Id<"games">,
  delayMs: number
) {
  await ctx.scheduler.runAfter(delayMs, internal.gameEngine.processTurnStep, {
    gameId,
  });
}

/**
 * Schedule the next turn step immediately (0ms delay)
 */
export async function scheduleNextStepImmediate(
  ctx: MutationCtx,
  gameId: Id<"games">
) {
  await scheduleNextStep(ctx, gameId, 0);
}

/**
 * Get delay based on game speed setting
 */
export function getSpeedDelay(speedMs: number): number {
  // Clamp between 100ms and 10 seconds
  return Math.max(100, Math.min(speedMs, 10000));
}

// Speed presets
export const SPEED_PRESETS = {
  fast: 500,      // 0.5 seconds between steps
  normal: 2000,   // 2 seconds between steps
  slow: 5000,     // 5 seconds between steps
  instant: 100,   // As fast as possible
} as const;

export type SpeedPreset = keyof typeof SPEED_PRESETS;

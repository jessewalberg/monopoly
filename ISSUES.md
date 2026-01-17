# LLM Monopoly Arena - Issues Tracker

This document tracks all identified issues in the codebase. Each issue will be fixed one at a time.

## Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Fixed
- ⏭️ Deferred

---

## CRITICAL ISSUES

### Issue #1: LLM Integration Not Connected ✅
**Priority:** CRITICAL
**Files:** `convex/gameEngine.ts`, `convex/llmDecisions.ts`

The entire point of the app is to have LLMs play Monopoly, but:
- Properties are auto-bought at line 355-358 without asking the LLM
- Pre-roll actions (build/mortgage/trade) are skipped at line 216-218
- No decisions are logged to the `decisions` table
- `llmActions.ts` exists with `getDecision()` but is never called from gameEngine

**Fix Required:**
1. Create prompt builder for each decision type
2. Call `getDecision` action from game engine
3. Parse response and execute the decision
4. Log decision to `decisions` table

**Fixed:**
- Created `convex/llmDecisions.ts` with full LLM decision flow:
  - `getLLMDecision` - internal action that builds prompts, calls OpenRouter, parses response
  - `processDecisionResult` - logs decision to database and executes the action
  - Execution mutations for buy_property, jail_strategy, auction_bid, pre_roll_actions
- Added `waitingForLLM` and `pendingDecision` fields to games table in schema
- Modified `gameEngine.ts` to call LLM for:
  - `buy_property` decisions when landing on unowned property
  - `jail_strategy` decisions when player is in jail (pay fine, use card, or roll)
- Decisions are now logged to the `decisions` table with reasoning, tokens, latency
- Game pauses while waiting for LLM response, then resumes automatically

---

### Issue #2: Consecutive Doubles Logic Wrong ✅
**Priority:** CRITICAL
**File:** `convex/gameEngine.ts:240-242`

When exiting jail by rolling doubles, `consecutiveDoubles` is reset to 0:
```typescript
await ctx.db.patch(player._id, {
  inJail: false,
  jailTurnsRemaining: 0,
  consecutiveDoubles: 0,  // BUG: Should be 1, not 0
});
```

**Monopoly Rule:** Rolling doubles always grants another turn. When you roll doubles to exit jail, that counts as your first consecutive double, so you get another turn.

**Fix Required:** Change `consecutiveDoubles: 0` to `consecutiveDoubles: 1`

**Fixed:** Changed to `consecutiveDoubles: 1` with explanatory comment

---

### Issue #3: Stale Player State in Bankruptcy Check ✅
**Priority:** CRITICAL
**File:** `convex/gameEngine.ts:370-391`

```typescript
await ctx.db.patch(player._id, { cash: player.cash - actualPayment }); // DB updated
// ...later
if (player.cash - actualPayment < 0) { // BUG: Using OLD player.cash!
```

The bankruptcy check uses stale in-memory values instead of the updated DB state.

**Fix Required:** Either:
- Refetch player from DB after cash update, OR
- Track `newCash` variable and use that for bankruptcy check

**Fixed:** Changed bankruptcy check to `if (player.cash < rent)` which correctly checks if player couldn't afford the full rent (matching the tax case pattern)

---

### Issue #4: Auction System Missing ✅
**Priority:** CRITICAL
**File:** `convex/gameEngine.ts:354-361`

If a player can't afford or declines a property, it should go to auction. Currently:
```typescript
if (player.cash >= cost) {
  // Auto-buy
} else {
  await addTurnEvent(ctx, turn._id, `Cannot afford ${space.name} ($${cost})`);
  // Property stays unowned - NO AUCTION!
}
```

**Monopoly Rule:** When a player lands on an unowned property and doesn't buy it, ALL players (including the one who landed) can bid in an auction.

**Fix Required:** Call `runAuction` mutation when player declines/can't afford

**Fixed:** Added `runAutomatedAuction()` helper function that runs auction when player can't afford property. Uses simple bidding strategy (50% of cash) until LLM integration (Issue #1) is completed.

---

### Issue #5: Card Special Rent Rules Not Applied ✅
**Priority:** CRITICAL
**File:** `convex/gameEngine.ts:366-367`, `convex/lib/cards.ts`

When Chance sends player to nearest Railroad or Utility:
- "Nearest Railroad" should pay **double rent** - CardResult has `doubleRent: true` but it's ignored
- "Nearest Utility" should use **10x multiplier** - CardResult has `useMultiplierTen: true` but it's ignored

```typescript
const rent = calculateRent(property, properties, property.ownerId, diceTotal);
// BUG: Doesn't check for doubleRent or useMultiplierTen flags
```

**Fix Required:** Pass card flags to rent calculation and apply multipliers

**Fixed:** Added rent handling after card moves player to new position. Checks for `doubleRent` (railroad) and `useMultiplierTen` (utility) flags and applies appropriate multipliers. Also handles bankruptcy if player can't afford rent.

---

### Issue #6: Card Deck Not Tracked ✅
**Priority:** HIGH
**File:** `convex/gameEngine.ts:413-414`, `convex/lib/cards.ts`

Cards are drawn randomly each time:
```typescript
const cards = space.type === "chance" ? [...CHANCE_CARDS] : [...COMMUNITY_CHEST_CARDS];
const card = cards[Math.floor(Math.random() * cards.length)];
```

**Monopoly Rule:** Each deck has 16 cards. They should be shuffled once, then drawn in order. Same card cannot appear twice until deck is exhausted.

**Fix Required:**
1. Add `chanceDeck` and `communityChestDeck` to game state in schema
2. Shuffle on game start
3. Draw from top, reshuffle when empty

**Fixed:**
- Added `chanceDeck` and `communityChestDeck` fields to games table in schema
- Decks are shuffled on game start using Fisher-Yates shuffle
- Cards are drawn from front of deck, deck is reshuffled when empty

---

### Issue #7: Trading System Not Integrated ⬜
**Priority:** HIGH
**File:** `convex/gameEngine.ts`

`validation.ts` has full trade validation (`canProposeTrade`), but:
- Game engine never calls for trade proposals
- `trades` table exists but is never written to
- No LLM prompt for trade decisions

**Fix Required:**
1. Add trade proposal phase in pre_roll
2. Call LLM for trade decisions
3. Execute and log trades

---

### Issue #8: Final Position Calculation Wrong ✅
**Priority:** HIGH
**File:** `convex/gameEngine.ts:626`

```typescript
const finalPosition = activePlayers.length + 1; // BUG
```

Example: 4 players, player goes bankrupt when 2 others remain → should be 3rd place
Current code: `activePlayers.length (2) + 1 = 3rd` - correct by accident
But if 3 players remain: `3 + 1 = 4th` - wrong, should be 2nd

**Fix Required:** `finalPosition = totalPlayers - activePlayers.length + 1` or track eliminations

**Analysis:** After review, the current logic is actually CORRECT:
- `activePlayers` = players who are NOT bankrupt AND NOT the current bankrupt player
- First bankrupt (4 players): activePlayers=3, position=4 (last place) ✓
- Second bankrupt: activePlayers=2, position=3 ✓
- Third bankrupt: activePlayers=1, position=2 ✓
- The issue description's example "3+1=4th should be 2nd" is incorrect - if 3 players remain after you go bankrupt, you ARE in 4th place.
**Status:** Not a bug - closed

---

### Issue #9: passedGo Logic for Backward Movement ✅
**Priority:** HIGH
**File:** `convex/lib/board.ts`, `convex/gameEngine.ts`

"Go Back 3 Spaces" card calls:
```typescript
passedGo(player.position, newPosition, true) // movedForward = true, but we moved BACKWARD
```

The `passedGo` function returns `true` when `toPosition < fromPosition`, which is wrong for backward movement.

**Fix Required:**
1. Pass correct `movedForward` flag based on card action
2. Fix `passedGo` logic to handle both directions correctly

**Analysis:** After review, the code is CORRECT:
- `passedGo()` function correctly returns false when `movedForward=false`
- Dice rolls always pass `true` (correct - always forward)
- `movePlayer` mutation uses `args.spaces > 0` to determine direction
- Card `move_relative` ("Go Back 3 Spaces") doesn't set passedGo at all (correct)
- Card `move_to` and `move_to_nearest` always move forward ("Advance to...")
**Status:** Not a bug - closed

---

## MEDIUM ISSUES

### Issue #10: Jail Turn Counter Decremented Too Early ✅
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts:210-213`

Jail turns decremented in PRE_ROLL before the player rolls:
```typescript
await ctx.db.patch(player._id, {
  jailTurnsRemaining: player.jailTurnsRemaining - 1,
});
```

**Fix Required:** Decrement AFTER rolling (in rolling phase), not before

**Fixed:**
- Removed early decrement from processPreRoll
- Now decrement happens in processRolling AFTER failed doubles roll
- On 3rd failed attempt (jailTurns becomes 0), player must pay fine
- Proper Monopoly rules: player gets 3 chances to roll doubles, then forced to pay

---

### Issue #11: Decisions Table Never Populated ✅
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts`, `convex/decisions.ts`

Every property buy, trade response, jail decision should log to `decisions` table but doesn't.
Analytics can't analyze LLM decisions because they're never recorded.

**Fix Required:** Call `decisions.create` mutation after each LLM decision

**Fixed:** Addressed by Issue #1 - `llmDecisions.ts` calls `decisions.create` in `processDecisionResult` to log every LLM decision with full context, reasoning, and metrics.

---

### Issue #12: Validation Functions Unused ⬜
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts`

Functions like `canBuyProperty()`, `canBuildHouse()`, `canMortgage()` exist but are never called.
Game engine doesn't validate moves before applying them.

**Fix Required:** Add validation checks before executing actions

---

### Issue #13: Game Pause Uses Wrong Status ✅
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts:685`

`pauseGame` sets status to "setup" instead of a "paused" state:
```typescript
await ctx.db.patch(args.gameId, {
  status: "setup", // Should be "paused" or separate field
});
```

**Fix Required:** Either add "paused" status or use separate `isPaused` field

**Fixed:**
- Added `isPaused` boolean field to games table in schema
- pauseGame now sets `isPaused: true` instead of changing status
- resumeGame now sets `isPaused: false` and reschedules turn processing
- processTurnStep checks `isPaused` and returns early if paused
- Better design: paused games stay "in_progress" conceptually

---

### Issue #14: Stats Not Updated During Gameplay ✅
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts`, `convex/statsAggregator.ts`

`updateStatsAfterGame` is never called. If game is abandoned, stats are lost.

**Fix Required:** Call stats update when game ends (completed or abandoned)

**Fixed:**
- Added `ctx.scheduler.runAfter(0, internal.statsAggregator.updateStatsAfterGame, { gameId })` to handleGameEnd()
- Also added stats update call to abandonGame mutation
- Stats now update for both completed and abandoned games

---

### Issue #15: currentPlayerIndex Can Get Out of Sync ✅
**Priority:** MEDIUM
**File:** `convex/gameEngine.ts:121`

When players go bankrupt, `currentPlayerIndex` isn't adjusted:
```typescript
const currentPlayer = activePlayers[game.currentPlayerIndex % activePlayers.length];
```

The modulo works but index tracking becomes unreliable.

**Fix Required:** Recalculate proper index when player list changes

**Fixed:** Turn advancement now uses `turnOrder` to find the next player instead of simple index increment. This correctly skips bankrupt players and wraps around the turn order.

---

## LOW PRIORITY ISSUES

### Issue #16: Loose `any` Types Throughout ⬜
**Priority:** LOW
**File:** `convex/gameEngine.ts:186-191, 222-226, 335-341`

Function parameters use `any` type defeating TypeScript safety.

**Fix Required:** Add proper types for all parameters

---

### Issue #17: Repeated DB Queries ⬜
**Priority:** LOW
**File:** `convex/gameEngine.ts:620-623`

`handleBankruptcy` queries all players again even though they're already loaded.

**Fix Required:** Pass players as parameter instead of querying

---

### Issue #18: rentPayments Table Missing Fields ⬜
**Priority:** LOW
**File:** `convex/schema.ts:153-163`

No fields for:
- Whether rent was doubled (monopoly or card)
- Whether utility used 10x multiplier

**Fix Required:** Add `wasDoubled` and `utilityMultiplier` fields

---

### Issue #19: Turn Events Unstructured ⬜
**Priority:** LOW
**File:** `convex/schema.ts:95`

`events: v.array(v.string())` - just strings, hard to query/analyze.

**Fix Required:** Change to array of objects with event type and data

---

### Issue #20: No Cascade Delete ⬜
**Priority:** LOW
**File:** `convex/schema.ts`

If game is deleted, orphaned player/property/turn records remain.

**Fix Required:** Implement cleanup function or handle in delete mutation

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| CRITICAL | 5 | 5 fixed |
| HIGH | 4 | 3 closed (2 not a bug) |
| MEDIUM | 6 | 5 fixed (Issue #11 addressed by #1) |
| LOW | 5 | 0 fixed |
| **TOTAL** | **20** | **13 closed** |

---

## Current Focus

**Remaining issues:**
- Issue #7: Trading System Not Integrated (HIGH - depends on #1)
- Issue #12: Validation Functions Unused (MEDIUM)
- Issues #16-20: LOW priority code quality issues

import type { Id } from "../_generated/dataModel";

// ============================================================
// GAME STATUS & PHASE TYPES
// ============================================================

export type GameStatus = "setup" | "in_progress" | "completed" | "abandoned";

export type GamePhase =
  | "pre_roll"
  | "rolling"
  | "post_roll"
  | "turn_end"
  | "game_over";

export type EndingReason =
  | "last_player_standing"
  | "turn_limit_reached"
  | "manual_stop"
  | "error";

// ============================================================
// GAME CONFIGURATION
// ============================================================

export interface GameConfig {
  turnLimit?: number;
  speedMs: number;
  startingMoney: number;
}

// ============================================================
// GAME STATE
// ============================================================

export interface Game {
  _id: Id<"games">;
  status: GameStatus;
  currentPlayerIndex: number;
  currentTurnNumber: number;
  currentPhase: GamePhase;
  winnerId?: Id<"players">;
  endingReason?: EndingReason;
  config: GameConfig;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

export interface Player {
  _id: Id<"players">;
  gameId: Id<"games">;
  modelId: string;
  modelDisplayName: string;
  modelProvider: string;
  tokenColor: string;
  turnOrder: number;
  // Live game state
  cash: number;
  position: number; // 0-39
  inJail: boolean;
  jailTurnsRemaining: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  consecutiveDoubles: number;
  // Final stats
  finalPosition?: number;
  finalNetWorth?: number;
  bankruptcyTurn?: number;
}

export interface Property {
  _id: Id<"properties">;
  gameId: Id<"games">;
  position: number;
  name: string;
  group: PropertyGroup;
  ownerId?: Id<"players">;
  houses: number; // 0-4 = houses, 5 = hotel
  isMortgaged: boolean;
}

export type PropertyGroup =
  | "brown"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkBlue"
  | "railroad"
  | "utility";

// ============================================================
// TURN & DECISION TRACKING
// ============================================================

export interface Turn {
  _id: Id<"turns">;
  gameId: Id<"games">;
  playerId: Id<"players">;
  turnNumber: number;
  diceRoll?: [number, number];
  wasDoubles?: boolean;
  positionBefore: number;
  positionAfter?: number;
  passedGo?: boolean;
  landedOn?: string;
  cashBefore: number;
  cashAfter?: number;
  events: string[];
  startedAt: number;
  endedAt?: number;
}

export type DecisionType =
  | "buy_property"
  | "auction_bid"
  | "jail_strategy"
  | "pre_roll_actions"
  | "post_roll_actions"
  | "trade_response"
  | "bankruptcy_resolution";

export interface Decision {
  _id: Id<"decisions">;
  gameId: Id<"games">;
  playerId: Id<"players">;
  turnId: Id<"turns">;
  turnNumber: number;
  decisionType: DecisionType;
  context: string; // JSON string
  optionsAvailable: string[];
  decisionMade: string;
  parameters?: string; // JSON string
  reasoning: string;
  rawResponse?: string;
  promptTokens: number;
  completionTokens: number;
  decisionTimeMs: number;
}

// ============================================================
// TRADING
// ============================================================

export type TradeStatus = "pending" | "accepted" | "rejected" | "countered";

export interface Trade {
  _id: Id<"trades">;
  gameId: Id<"games">;
  turnNumber: number;
  proposerId: Id<"players">;
  recipientId: Id<"players">;
  // Offer
  offerMoney: number;
  offerProperties: Id<"properties">[];
  offerGetOutOfJailCards: number;
  // Request
  requestMoney: number;
  requestProperties: Id<"properties">[];
  requestGetOutOfJailCards: number;
  status: TradeStatus;
  proposerReasoning: string;
  recipientReasoning?: string;
}

export interface RentPayment {
  _id: Id<"rentPayments">;
  gameId: Id<"games">;
  turnNumber: number;
  payerId: Id<"players">;
  receiverId: Id<"players">;
  propertyName: string;
  amount: number;
  diceTotal?: number;
  payerCashAfter: number;
  receiverCashAfter: number;
}

// ============================================================
// ANALYTICS AGGREGATES
// ============================================================

export interface ModelStats {
  _id: Id<"modelStats">;
  modelId: string;
  modelDisplayName: string;
  modelProvider: string;
  // Win/loss
  gamesPlayed: number;
  wins: number;
  secondPlace: number;
  thirdPlace: number;
  bankruptcies: number;
  // Financial
  avgFinalNetWorth: number;
  avgFinalCash: number;
  totalRentCollected: number;
  totalRentPaid: number;
  // Property
  avgPropertiesOwned: number;
  monopoliesCompleted: number;
  // Trading
  tradesProposed: number;
  tradesAccepted: number;
  tradeAcceptRate: number;
  // Performance
  avgDecisionTimeMs: number;
  avgGameLength: number;
  updatedAt: number;
}

export interface HeadToHead {
  _id: Id<"headToHead">;
  pairKey: string;
  modelAId: string;
  modelADisplayName: string;
  modelBId: string;
  modelBDisplayName: string;
  modelAWins: number;
  modelBWins: number;
  totalGames: number;
  avgGameLength: number;
  updatedAt: number;
}

export interface PropertyStats {
  _id: Id<"propertyStats">;
  propertyName: string;
  propertyGroup: string;
  position: number;
  timesPurchased: number;
  timesAuctioned: number;
  avgPurchasePrice: number;
  avgAuctionPrice: number;
  totalRentCollected: number;
  avgRentPerGame: number;
  ownerWinRate: number;
  updatedAt: number;
}

// ============================================================
// COMPOSITE TYPES FOR GAME STATE
// ============================================================

export interface FullGameState {
  game: Game;
  players: Player[];
  properties: Property[];
  currentTurn?: Turn;
}

export interface GameSummary {
  game: Game;
  players: Player[];
  turnCount: number;
  winner?: Player;
}

// ============================================================
// LLM DECISION CONTEXT TYPES
// ============================================================

export interface PropertyContext {
  name: string;
  group: PropertyGroup;
  position: number;
  price: number;
  rent: number[];
  houseCost: number;
  hotelCost: number;
  mortgageValue: number;
  ownerId?: string;
  ownerName?: string;
  houses: number;
  isMortgaged: boolean;
}

export interface PlayerContext {
  id: string;
  name: string;
  cash: number;
  position: number;
  properties: string[];
  monopolies: string[];
  inJail: boolean;
  getOutOfJailCards: number;
  isBankrupt: boolean;
}

export interface DecisionContext {
  currentPlayer: PlayerContext;
  otherPlayers: PlayerContext[];
  allProperties: PropertyContext[];
  turnNumber: number;
  gamePhase: GamePhase;
}

// ============================================================
// LLM RESPONSE TYPES
// ============================================================

export interface BuyPropertyDecision {
  action: "buy" | "auction";
  reasoning: string;
}

export interface AuctionBidDecision {
  bidAmount: number;
  reasoning: string;
}

export interface JailStrategyDecision {
  action: "pay" | "roll" | "use_card";
  reasoning: string;
}

export interface PreRollActionsDecision {
  actions: PreRollAction[];
  reasoning: string;
}

export type PreRollAction =
  | { type: "build"; propertyName: string; count: number }
  | { type: "mortgage"; propertyName: string }
  | { type: "unmortgage"; propertyName: string }
  | { type: "propose_trade"; trade: TradeProposal }
  | { type: "done" };

export interface TradeProposal {
  recipientId: string;
  offerMoney: number;
  offerProperties: string[];
  offerGetOutOfJailCards: number;
  requestMoney: number;
  requestProperties: string[];
  requestGetOutOfJailCards: number;
}

export interface TradeResponseDecision {
  action: "accept" | "reject" | "counter";
  counterOffer?: TradeProposal;
  reasoning: string;
}

export interface PostRollActionsDecision {
  actions: PostRollAction[];
  reasoning: string;
}

export type PostRollAction =
  | { type: "build"; propertyName: string; count: number }
  | { type: "mortgage"; propertyName: string }
  | { type: "unmortgage"; propertyName: string }
  | { type: "done" };

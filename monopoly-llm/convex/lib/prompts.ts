import type { Id } from "../_generated/dataModel";
import { getSpace, getGroupPositions } from "./board";
import type { DecisionType, GamePhase } from "./types";

// ============================================================
// TYPES
// ============================================================

export interface PlayerInfo {
  _id: Id<"players">;
  modelDisplayName: string;
  cash: number;
  position: number;
  inJail: boolean;
  isBankrupt: boolean;
  getOutOfJailCards: number;
}

export interface PropertyInfo {
  _id: Id<"properties">;
  position: number;
  name: string;
  group: string;
  ownerId?: Id<"players">;
  houses: number;
  isMortgaged: boolean;
}

export interface GameInfo {
  currentTurnNumber: number;
  currentPhase: GamePhase;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * Build the system prompt for an LLM player
 */
export function buildSystemPrompt(playerName: string): string {
  return `You are playing Monopoly as "${playerName}".
Your goal is to WIN by bankrupting all opponents.

Make strategic decisions based on:
- Property monopoly potential (complete color sets let you build houses)
- Cash flow management (keep reserves for rent payments)
- Opponent positions and assets (target weak players)
- Risk vs reward tradeoffs (don't overextend early)

Key Monopoly Rules:
- Owning all properties in a color group (monopoly) doubles rent
- You can only build houses on monopolies, and must build evenly
- Mortgaged properties don't collect rent
- Railroads: $25/50/100/200 based on how many you own
- Utilities: 4x dice if you own one, 10x if you own both

ALWAYS respond with valid JSON in this exact format:
{
  "action": "<action_name>",
  "parameters": {},
  "reasoning": "<1-2 sentence explanation>"
}

Do not include any text outside the JSON object.`;
}

// ============================================================
// DECISION PROMPTS
// ============================================================

/**
 * Build the user prompt for a specific decision
 */
export function buildDecisionPrompt(
  decisionType: DecisionType,
  game: GameInfo,
  currentPlayer: PlayerInfo,
  otherPlayers: PlayerInfo[],
  properties: PropertyInfo[],
  validActions: string[],
  context: Record<string, unknown>
): string {
  const gameState = serializeGameState(currentPlayer, otherPlayers, properties);

  let prompt = `TURN ${game.currentTurnNumber}\n\n`;
  prompt += gameState;
  prompt += "\n\n";

  switch (decisionType) {
    case "buy_property":
      prompt += buildBuyPropertyPrompt(context, validActions);
      break;
    case "auction_bid":
      prompt += buildAuctionBidPrompt(context, currentPlayer, validActions);
      break;
    case "jail_strategy":
      prompt += buildJailStrategyPrompt(currentPlayer, validActions);
      break;
    case "pre_roll_actions":
      prompt += buildPreRollPrompt(currentPlayer, properties, validActions);
      break;
    case "post_roll_actions":
      prompt += buildPostRollPrompt(currentPlayer, properties, validActions);
      break;
    case "trade_response":
      prompt += buildTradeResponsePrompt(context, validActions);
      break;
    default:
      prompt += `Choose an action from: ${validActions.join(", ")}`;
  }

  return prompt;
}

// ============================================================
// GAME STATE SERIALIZATION
// ============================================================

/**
 * Serialize game state into a readable format for the LLM
 */
export function serializeGameState(
  currentPlayer: PlayerInfo,
  otherPlayers: PlayerInfo[],
  properties: PropertyInfo[]
): string {
  let state = "=== YOUR STATUS ===\n";
  state += `Cash: $${currentPlayer.cash}\n`;
  state += `Position: ${getSpace(currentPlayer.position).name} (space ${currentPlayer.position})\n`;

  if (currentPlayer.inJail) {
    state += "STATUS: IN JAIL\n";
  }
  if (currentPlayer.getOutOfJailCards > 0) {
    state += `Get Out of Jail Free cards: ${currentPlayer.getOutOfJailCards}\n`;
  }

  // Your properties
  const yourProperties = properties.filter(
    (p) => p.ownerId === currentPlayer._id
  );
  if (yourProperties.length > 0) {
    state += "\nYour Properties:\n";
    const byGroup = groupProperties(yourProperties);
    for (const [group, props] of Object.entries(byGroup)) {
      const groupPositions = getGroupPositions(group);
      const hasMonopoly = props.length === groupPositions.length;
      state += `  ${group}${hasMonopoly ? " (MONOPOLY)" : ""}: `;
      state += props
        .map((p) => {
          let desc = p.name;
          if (p.houses > 0) desc += ` [${p.houses}H]`;
          if (p.isMortgaged) desc += " (M)";
          return desc;
        })
        .join(", ");
      state += "\n";
    }
  }

  // Other players
  state += "\n=== OPPONENTS ===\n";
  for (const player of otherPlayers) {
    if (player.isBankrupt) {
      state += `${player.modelDisplayName}: BANKRUPT\n`;
      continue;
    }
    state += `${player.modelDisplayName}: $${player.cash}`;
    if (player.inJail) state += " [JAIL]";
    state += ` at ${getSpace(player.position).name}`;

    const theirProps = properties.filter((p) => p.ownerId === player._id);
    if (theirProps.length > 0) {
      const monopolies = findMonopolies(player._id, properties);
      if (monopolies.length > 0) {
        state += ` - MONOPOLIES: ${monopolies.join(", ")}`;
      } else {
        state += ` - ${theirProps.length} properties`;
      }
    }
    state += "\n";
  }

  // Unowned properties worth noting
  const unowned = properties.filter((p) => !p.ownerId);
  if (unowned.length > 0 && unowned.length <= 10) {
    state += "\n=== AVAILABLE PROPERTIES ===\n";
    state += unowned.map((p) => p.name).join(", ");
    state += "\n";
  }

  return state;
}

// ============================================================
// SPECIFIC DECISION PROMPTS
// ============================================================

function buildBuyPropertyPrompt(
  context: Record<string, unknown>,
  _validActions: string[]
): string {
  const propertyName = context.propertyName as string;
  const cost = context.cost as number;
  const group = context.group as string;

  let prompt = `=== DECISION: BUY PROPERTY ===\n`;
  prompt += `You landed on ${propertyName} (${group})\n`;
  prompt += `Cost: $${cost}\n\n`;
  prompt += `Options:\n`;
  prompt += `- "buy": Purchase this property for $${cost}\n`;
  prompt += `- "auction": Pass and let all players bid\n\n`;
  prompt += `Respond with: { "action": "buy" or "auction", "parameters": {}, "reasoning": "..." }`;

  return prompt;
}

function buildAuctionBidPrompt(
  context: Record<string, unknown>,
  player: PlayerInfo,
  _validActions: string[]
): string {
  const propertyName = context.propertyName as string;
  const currentBid = (context.currentBid as number) || 0;
  const minBid = (context.minBid as number) || 1;

  let prompt = `=== DECISION: AUCTION BID ===\n`;
  prompt += `Property: ${propertyName}\n`;
  prompt += `Current highest bid: $${currentBid}\n`;
  prompt += `Your cash: $${player.cash}\n`;
  prompt += `Minimum bid: $${minBid}\n\n`;
  prompt += `Options:\n`;
  prompt += `- Bid any amount from $${minBid} up to $${player.cash}\n`;
  prompt += `- Bid 0 to pass\n\n`;
  prompt += `Respond with: { "action": "bid", "parameters": { "amount": <number> }, "reasoning": "..." }`;

  return prompt;
}

function buildJailStrategyPrompt(
  _player: PlayerInfo,
  validActions: string[]
): string {
  let prompt = `=== DECISION: JAIL STRATEGY ===\n`;
  prompt += `You are in jail. Choose how to try to get out:\n\n`;
  prompt += `Options:\n`;

  if (validActions.includes("pay")) {
    prompt += `- "pay": Pay $50 fine to get out immediately\n`;
  }
  if (validActions.includes("roll")) {
    prompt += `- "roll": Roll dice - doubles gets you out free, otherwise stay\n`;
  }
  if (validActions.includes("use_card")) {
    prompt += `- "use_card": Use a Get Out of Jail Free card\n`;
  }

  prompt += `\nRespond with: { "action": "<choice>", "parameters": {}, "reasoning": "..." }`;

  return prompt;
}

function buildPreRollPrompt(
  _player: PlayerInfo,
  _properties: PropertyInfo[],
  validActions: string[]
): string {
  let prompt = `=== DECISION: PRE-ROLL ACTIONS ===\n`;
  prompt += `Before you roll, you may:\n\n`;

  if (validActions.includes("build")) {
    prompt += `- "build": Build houses on your monopolies\n`;
  }
  if (validActions.includes("mortgage")) {
    prompt += `- "mortgage": Mortgage a property for cash\n`;
  }
  if (validActions.includes("unmortgage")) {
    prompt += `- "unmortgage": Pay to unmortgage a property\n`;
  }
  if (validActions.includes("trade")) {
    prompt += `- "trade": Propose a trade with another player\n`;
  }
  prompt += `- "done": Finish pre-roll actions and roll the dice\n\n`;

  prompt += `Respond with: { "action": "<choice>", "parameters": { ... }, "reasoning": "..." }\n`;
  prompt += `For "build": parameters: { "propertyName": "...", "count": 1 }\n`;
  prompt += `For "mortgage"/"unmortgage": parameters: { "propertyName": "..." }\n`;
  prompt += `For "done": parameters: {}`;

  return prompt;
}

function buildPostRollPrompt(
  _player: PlayerInfo,
  _properties: PropertyInfo[],
  validActions: string[]
): string {
  let prompt = `=== DECISION: POST-ROLL ACTIONS ===\n`;
  prompt += `After your move, you may:\n\n`;

  if (validActions.includes("build")) {
    prompt += `- "build": Build houses on your monopolies\n`;
  }
  if (validActions.includes("mortgage")) {
    prompt += `- "mortgage": Mortgage a property for cash\n`;
  }
  if (validActions.includes("unmortgage")) {
    prompt += `- "unmortgage": Pay to unmortgage a property\n`;
  }
  prompt += `- "done": End your turn\n\n`;

  prompt += `Respond with: { "action": "<choice>", "parameters": { ... }, "reasoning": "..." }`;

  return prompt;
}

function buildTradeResponsePrompt(
  context: Record<string, unknown>,
  _validActions: string[]
): string {
  const proposerName = context.proposerName as string;
  const offer = context.offer as Record<string, unknown>;

  let prompt = `=== DECISION: TRADE RESPONSE ===\n`;
  prompt += `${proposerName} proposes a trade:\n\n`;

  prompt += `They offer you:\n`;
  if ((offer.money as number) > 0) prompt += `  - $${offer.money}\n`;
  if ((offer.properties as string[])?.length > 0) {
    prompt += `  - Properties: ${(offer.properties as string[]).join(", ")}\n`;
  }
  if ((offer.jailCards as number) > 0) {
    prompt += `  - ${offer.jailCards} Get Out of Jail card(s)\n`;
  }

  prompt += `\nThey want from you:\n`;
  const request = context.request as Record<string, unknown>;
  if ((request.money as number) > 0) prompt += `  - $${request.money}\n`;
  if ((request.properties as string[])?.length > 0) {
    prompt += `  - Properties: ${(request.properties as string[]).join(", ")}\n`;
  }
  if ((request.jailCards as number) > 0) {
    prompt += `  - ${request.jailCards} Get Out of Jail card(s)\n`;
  }

  prompt += `\nOptions:\n`;
  prompt += `- "accept": Accept this trade\n`;
  prompt += `- "reject": Decline this trade\n`;
  prompt += `- "counter": Make a counter-offer\n\n`;

  prompt += `Respond with: { "action": "<choice>", "parameters": {}, "reasoning": "..." }`;

  return prompt;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function groupProperties(
  properties: PropertyInfo[]
): Record<string, PropertyInfo[]> {
  const grouped: Record<string, PropertyInfo[]> = {};
  for (const prop of properties) {
    if (!grouped[prop.group]) {
      grouped[prop.group] = [];
    }
    grouped[prop.group].push(prop);
  }
  return grouped;
}

function findMonopolies(
  playerId: Id<"players">,
  properties: PropertyInfo[]
): string[] {
  const monopolies: string[] = [];
  const groups = [
    "brown",
    "light_blue",
    "pink",
    "orange",
    "red",
    "yellow",
    "green",
    "dark_blue",
  ];

  for (const group of groups) {
    const groupPositions = getGroupPositions(group);
    const owned = properties.filter(
      (p) => p.ownerId === playerId && groupPositions.includes(p.position)
    );
    if (owned.length === groupPositions.length) {
      monopolies.push(group);
    }
  }

  return monopolies;
}

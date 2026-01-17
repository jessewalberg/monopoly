import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";

// ============================================================
// TYPES
// ============================================================

export type DecisionType =
  | "buy_property"
  | "auction_bid"
  | "jail_strategy"
  | "pre_roll_actions"
  | "post_roll_actions"
  | "trade_response"
  | "bankruptcy_resolution";

export interface LLMThinkingProps {
  isThinking: boolean;
  modelName?: string;
  modelIcon?: string;
  decisionType?: DecisionType;
  action?: string;
  reasoning?: string;
  latencyMs?: number;
}

// ============================================================
// DECISION TYPE LABELS
// ============================================================

const decisionTypeLabels: Record<DecisionType, string> = {
  buy_property: "Buy Property?",
  auction_bid: "Auction Bid",
  jail_strategy: "Jail Strategy",
  pre_roll_actions: "Pre-Roll Actions",
  post_roll_actions: "Post-Roll Actions",
  trade_response: "Trade Response",
  bankruptcy_resolution: "Bankruptcy Resolution",
};

// ============================================================
// SPINNER COMPONENT
// ============================================================

function ThinkingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
      </div>
      <span className="text-blue-400 text-sm animate-pulse">Thinking...</span>
    </div>
  );
}

// ============================================================
// LLM THINKING COMPONENT
// ============================================================

export function LLMThinking({
  isThinking,
  modelName,
  modelIcon,
  decisionType,
  action,
  reasoning,
  latencyMs,
}: LLMThinkingProps) {
  if (isThinking) {
    return (
      <Card className="border border-blue-500/30">
        <CardBody className="py-3">
          <div className="flex items-center gap-3">
            {modelIcon && <span className="text-2xl">{modelIcon}</span>}
            <div className="flex-1">
              {modelName && (
                <p className="text-sm font-medium text-white mb-1">
                  {modelName}
                </p>
              )}
              {decisionType && (
                <Badge variant="info" size="sm" className="mb-2">
                  {decisionTypeLabels[decisionType]}
                </Badge>
              )}
              <ThinkingSpinner />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!action && !reasoning) {
    return null;
  }

  return (
    <Card className="border border-green-500/30">
      <CardBody className="py-3">
        <div className="flex items-start gap-3">
          {modelIcon && <span className="text-2xl">{modelIcon}</span>}
          <div className="flex-1 space-y-2">
            {modelName && (
              <p className="text-sm font-medium text-white">{modelName}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {decisionType && (
                <Badge variant="neutral" size="sm">
                  {decisionTypeLabels[decisionType]}
                </Badge>
              )}
              {action && (
                <Badge variant="success" size="md">
                  {formatAction(action)}
                </Badge>
              )}
              {latencyMs !== undefined && (
                <span className="text-xs text-slate-500">
                  {latencyMs}ms
                </span>
              )}
            </div>

            {reasoning && (
              <div className="mt-2 p-2 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Reasoning:</p>
                <p className="text-sm text-slate-300 italic">
                  "{reasoning}"
                </p>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================
// COMPACT VERSION FOR INLINE USE
// ============================================================

export function LLMDecisionInline({
  modelName,
  action,
  reasoning,
}: {
  modelName: string;
  action: string;
  reasoning?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-700/50 rounded-lg">
      <span className="text-xs text-slate-400">{modelName}:</span>
      <Badge variant="success" size="sm">
        {formatAction(action)}
      </Badge>
      {reasoning && (
        <span
          className="text-xs text-slate-500 max-w-32 truncate"
          title={reasoning}
        >
          - {reasoning}
        </span>
      )}
    </div>
  );
}

// ============================================================
// MODEL ICON HELPER
// ============================================================

export function getModelIcon(modelId: string): string {
  const provider = modelId.split("/")[0].toLowerCase();

  switch (provider) {
    case "anthropic":
      return "🤖";
    case "openai":
      return "🧠";
    case "google":
      return "🔮";
    case "meta-llama":
      return "🦙";
    case "mistralai":
      return "🌬️";
    case "deepseek":
      return "🔍";
    case "x-ai":
      return "✨";
    case "qwen":
      return "🐉";
    default:
      return "🤖";
  }
}

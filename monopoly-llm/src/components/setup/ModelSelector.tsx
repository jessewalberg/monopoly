import { Select, type SelectOptionGroup } from "../ui/Select";
import { Badge } from "../ui/Badge";
import {
  AVAILABLE_MODELS,
  getProviders,
  type LLMModel,
  type ModelTier,
} from "../../lib/models";

// ============================================================
// TYPES
// ============================================================

export interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  label?: string;
  excludeModels?: string[]; // IDs of models to exclude (already selected)
}

// ============================================================
// TIER BADGE STYLES
// ============================================================

const tierBadgeVariant: Record<ModelTier, "success" | "info" | "warning" | "neutral"> = {
  flagship: "success",
  standard: "info",
  fast: "warning",
  economy: "neutral",
};

// ============================================================
// MODEL SELECTOR COMPONENT
// ============================================================

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  label = "Select Model",
  excludeModels = [],
}: ModelSelectorProps) {
  // Group models by provider
  const providers = getProviders();
  const optionGroups: SelectOptionGroup[] = providers.map((provider) => ({
    label: provider,
    options: AVAILABLE_MODELS.filter(
      (m) => m.provider === provider && !excludeModels.includes(m.id)
    ).map((m) => ({
      value: m.id,
      label: `${m.name} (${m.tier})`,
    })),
  }));

  // Filter out empty groups
  const nonEmptyGroups = optionGroups.filter((g) => g.options.length > 0);

  return (
    <Select
      label={label}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Choose a model..."
      optionGroups={nonEmptyGroups}
    />
  );
}

// ============================================================
// MODEL INFO CARD
// ============================================================

export function ModelInfoCard({ model }: { model: LLMModel }) {
  return (
    <div className="p-3 bg-slate-700 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">{model.name}</h4>
        <Badge variant={tierBadgeVariant[model.tier]} size="sm">
          {model.tier}
        </Badge>
      </div>
      <p className="text-xs text-slate-400">{model.provider}</p>
      {model.description && (
        <p className="text-sm text-slate-300">{model.description}</p>
      )}
    </div>
  );
}

// ============================================================
// MODEL SELECTOR WITH PREVIEW
// ============================================================

export function ModelSelectorWithPreview({
  value,
  onChange,
  disabled = false,
  label = "Select Model",
  excludeModels = [],
}: ModelSelectorProps) {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === value);

  return (
    <div className="space-y-2">
      <ModelSelector
        value={value}
        onChange={onChange}
        disabled={disabled}
        label={label}
        excludeModels={excludeModels}
      />
      {selectedModel && <ModelInfoCard model={selectedModel} />}
    </div>
  );
}

// ============================================================
// MODEL GRID SELECTOR
// Alternative visual selector with cards
// ============================================================

export function ModelGridSelector({
  value,
  onChange,
  excludeModels = [],
}: {
  value?: string;
  onChange: (modelId: string) => void;
  excludeModels?: string[];
}) {
  const availableModels = AVAILABLE_MODELS.filter(
    (m) => !excludeModels.includes(m.id)
  );

  // Group by tier
  const byTier: Record<ModelTier, LLMModel[]> = {
    flagship: [],
    standard: [],
    fast: [],
    economy: [],
  };

  for (const model of availableModels) {
    byTier[model.tier].push(model);
  }

  return (
    <div className="space-y-4">
      {(["flagship", "standard", "fast", "economy"] as ModelTier[]).map(
        (tier) =>
          byTier[tier].length > 0 && (
            <div key={tier}>
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-2">
                {tier} Models
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {byTier[tier].map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onChange(model.id)}
                    className={`
                      p-3 rounded-lg text-left transition-all
                      ${
                        value === model.id
                          ? "bg-green-600/20 border-2 border-green-500"
                          : "bg-slate-700 border-2 border-transparent hover:border-slate-500"
                      }
                    `}
                  >
                    <p className="text-sm font-medium text-white">
                      {model.name}
                    </p>
                    <p className="text-xs text-slate-400">{model.provider}</p>
                  </button>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

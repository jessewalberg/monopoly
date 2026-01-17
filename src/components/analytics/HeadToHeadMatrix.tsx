import { useState } from "react";

// ============================================================
// TYPES
// ============================================================

export interface HeadToHeadRecord {
  wins: number;
  losses: number;
  totalGames: number;
}

export interface HeadToHeadMatrixData {
  matrix: Record<string, Record<string, HeadToHeadRecord>>;
  modelDisplayNames: Record<string, string>;
  models: string[];
}

export interface HeadToHeadMatrixProps {
  data: HeadToHeadMatrixData;
  maxModels?: number;
}

// ============================================================
// HEAD-TO-HEAD MATRIX COMPONENT
// ============================================================

export function HeadToHeadMatrix({
  data,
  maxModels = 8,
}: HeadToHeadMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    rowModel: string;
    colModel: string;
    record: HeadToHeadRecord;
  } | null>(null);

  const { matrix, modelDisplayNames, models } = data;

  // Limit to maxModels
  const displayModels = models.slice(0, maxModels);

  if (displayModels.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-2">⚔️</div>
        <p>No head-to-head data yet</p>
        <p className="text-sm mt-1">Play games with multiple models to see matchups!</p>
      </div>
    );
  }

  // Get short name for display
  const getShortName = (modelId: string): string => {
    const displayName = modelDisplayNames[modelId] || modelId;
    // Return first 8 chars or split by / and take last part
    if (displayName.length <= 8) return displayName;
    const parts = displayName.split("/");
    const name = parts[parts.length - 1];
    return name.length <= 8 ? name : name.slice(0, 7) + "…";
  };

  return (
    <div className="relative">
      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl z-10 whitespace-nowrap">
          <div className="text-white font-medium text-sm">
            {modelDisplayNames[hoveredCell.rowModel]} vs{" "}
            {modelDisplayNames[hoveredCell.colModel]}
          </div>
          <div className="text-slate-400 text-xs mt-1">
            {hoveredCell.record.wins}W - {hoveredCell.record.losses}L
            <span className="text-slate-500 ml-2">
              ({hoveredCell.record.totalGames} games)
            </span>
          </div>
        </div>
      )}

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-slate-500 bg-slate-800/50 border border-slate-700 w-20">
                vs
              </th>
              {displayModels.map((modelId) => (
                <th
                  key={modelId}
                  className="p-2 text-xs text-white bg-slate-800/50 border border-slate-700 w-20"
                  title={modelDisplayNames[modelId]}
                >
                  {getShortName(modelId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayModels.map((rowModel) => (
              <tr key={rowModel}>
                <td
                  className="p-2 text-xs text-white bg-slate-800/50 border border-slate-700 font-medium"
                  title={modelDisplayNames[rowModel]}
                >
                  {getShortName(rowModel)}
                </td>
                {displayModels.map((colModel) => {
                  if (rowModel === colModel) {
                    return (
                      <td
                        key={colModel}
                        className="p-2 text-center text-xs bg-slate-800 border border-slate-700 text-slate-600"
                      >
                        —
                      </td>
                    );
                  }

                  const record = matrix[rowModel]?.[colModel] || {
                    wins: 0,
                    losses: 0,
                    totalGames: 0,
                  };

                  return (
                    <MatrixCell
                      key={colModel}
                      record={record}
                      rowModel={rowModel}
                      colModel={colModel}
                      onHover={(isHovered) =>
                        setHoveredCell(
                          isHovered ? { rowModel, colModel, record } : null
                        )
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500/60 rounded" />
          <span>More Wins</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-600 rounded" />
          <span>Even</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500/60 rounded" />
          <span>More Losses</span>
        </div>
      </div>

      {models.length > maxModels && (
        <p className="text-center text-xs text-slate-500 mt-2">
          Showing {maxModels} of {models.length} models
        </p>
      )}
    </div>
  );
}

// ============================================================
// MATRIX CELL
// ============================================================

interface MatrixCellProps {
  record: HeadToHeadRecord;
  rowModel: string;
  colModel: string;
  onHover: (isHovered: boolean) => void;
}

function MatrixCell({ record, onHover }: MatrixCellProps) {
  const { wins, losses, totalGames } = record;

  if (totalGames === 0) {
    return (
      <td
        className="p-2 text-center text-xs bg-slate-700/30 border border-slate-700 text-slate-500"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        0-0
      </td>
    );
  }

  // Calculate win ratio for color intensity
  const winRatio = wins / totalGames;
  const lossRatio = losses / totalGames;

  let bgColor: string;
  let textColor: string;

  if (winRatio > lossRatio) {
    // More wins - green
    const intensity = Math.min(0.8, (winRatio - 0.5) * 2);
    bgColor = `rgba(34, 197, 94, ${0.2 + intensity * 0.4})`;
    textColor = winRatio > 0.6 ? "text-green-300" : "text-green-400";
  } else if (lossRatio > winRatio) {
    // More losses - red
    const intensity = Math.min(0.8, (lossRatio - 0.5) * 2);
    bgColor = `rgba(239, 68, 68, ${0.2 + intensity * 0.4})`;
    textColor = lossRatio > 0.6 ? "text-red-300" : "text-red-400";
  } else {
    // Even
    bgColor = "rgba(100, 116, 139, 0.3)";
    textColor = "text-slate-300";
  }

  return (
    <td
      className={`p-2 text-center text-xs border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity ${textColor}`}
      style={{ backgroundColor: bgColor }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {wins}-{losses}
    </td>
  );
}

// ============================================================
// HEAD-TO-HEAD COMPARISON (Two models)
// ============================================================

export interface HeadToHeadComparisonProps {
  modelA: {
    id: string;
    displayName: string;
    color?: string;
  };
  modelB: {
    id: string;
    displayName: string;
    color?: string;
  };
  record: {
    modelAWins: number;
    modelBWins: number;
    totalGames: number;
  };
}

export function HeadToHeadComparison({
  modelA,
  modelB,
  record,
}: HeadToHeadComparisonProps) {
  const { modelAWins, modelBWins, totalGames } = record;

  if (totalGames === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">⚔️</div>
        <p className="text-slate-400">These models haven't faced each other yet!</p>
      </div>
    );
  }

  const modelAPercent = (modelAWins / totalGames) * 100;
  const modelBPercent = (modelBWins / totalGames) * 100;

  return (
    <div className="space-y-6">
      {/* VS Display */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center flex-1">
          <div
            className="text-xl font-bold"
            style={{ color: modelA.color || "#22c55e" }}
          >
            {modelA.displayName}
          </div>
          <div className="text-4xl font-bold text-white mt-2">{modelAWins}</div>
          <div className="text-sm text-slate-400">wins</div>
        </div>

        <div className="text-3xl text-slate-500 font-bold">VS</div>

        <div className="text-center flex-1">
          <div
            className="text-xl font-bold"
            style={{ color: modelB.color || "#3b82f6" }}
          >
            {modelB.displayName}
          </div>
          <div className="text-4xl font-bold text-white mt-2">{modelBWins}</div>
          <div className="text-sm text-slate-400">wins</div>
        </div>
      </div>

      {/* Win Bar */}
      <div className="relative h-8 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 transition-all"
          style={{
            width: `${modelAPercent}%`,
            backgroundColor: modelA.color || "#22c55e",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 transition-all"
          style={{
            width: `${modelBPercent}%`,
            backgroundColor: modelB.color || "#3b82f6",
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{totalGames}</div>
          <div className="text-sm text-slate-400">Games Played</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div
            className="text-2xl font-bold"
            style={{ color: modelA.color || "#22c55e" }}
          >
            {modelAPercent.toFixed(0)}%
          </div>
          <div className="text-sm text-slate-400">{modelA.displayName}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div
            className="text-2xl font-bold"
            style={{ color: modelB.color || "#3b82f6" }}
          >
            {modelBPercent.toFixed(0)}%
          </div>
          <div className="text-sm text-slate-400">{modelB.displayName}</div>
        </div>
      </div>
    </div>
  );
}

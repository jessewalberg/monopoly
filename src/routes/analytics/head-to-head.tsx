import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { AVAILABLE_MODELS } from "../../lib/models";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/analytics/head-to-head")({
  component: HeadToHeadPage,
});

// ============================================================
// HEAD TO HEAD PAGE
// ============================================================

function HeadToHeadPage() {
  const [selectedModel1, setSelectedModel1] = useState<string>("");
  const [selectedModel2, setSelectedModel2] = useState<string>("");

  // Get all games for stats
  const { data: allGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 1000 })
  );

  const completedGames = allGames.filter((g) => g.status === "completed");

  // Calculate head-to-head stats (placeholder for now)
  const h2hStats = selectedModel1 && selectedModel2
    ? calculateH2HStats(selectedModel1, selectedModel2)
    : null;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/analytics"
          className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
        >
          ← Back to Analytics
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Head-to-Head</h1>
        <p className="text-slate-400">Compare performance between AI models</p>
      </div>

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">Model 1</h3>
          </CardHeader>
          <CardBody>
            <select
              value={selectedModel1}
              onChange={(e) => setSelectedModel1(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3"
            >
              <option value="">Select a model...</option>
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id} disabled={model.id === selectedModel2}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">Model 2</h3>
          </CardHeader>
          <CardBody>
            <select
              value={selectedModel2}
              onChange={(e) => setSelectedModel2(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3"
            >
              <option value="">Select a model...</option>
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id} disabled={model.id === selectedModel1}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </CardBody>
        </Card>
      </div>

      {/* Comparison Results */}
      {selectedModel1 && selectedModel2 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Comparison Results</h2>
          </CardHeader>
          <CardBody>
            {h2hStats && h2hStats.totalGames > 0 ? (
              <div className="space-y-6">
                {/* VS Display */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">
                      {getModelName(selectedModel1)}
                    </div>
                    <div className="text-3xl font-bold text-green-400 mt-2">
                      {h2hStats.model1Wins}
                    </div>
                    <div className="text-sm text-slate-400">wins</div>
                  </div>

                  <div className="text-4xl text-slate-500">VS</div>

                  <div className="text-center">
                    <div className="text-xl font-bold text-white">
                      {getModelName(selectedModel2)}
                    </div>
                    <div className="text-3xl font-bold text-blue-400 mt-2">
                      {h2hStats.model2Wins}
                    </div>
                    <div className="text-sm text-slate-400">wins</div>
                  </div>
                </div>

                {/* Win Bar */}
                <div className="relative h-8 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500"
                    style={{
                      width: `${(h2hStats.model1Wins / h2hStats.totalGames) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-blue-500"
                    style={{
                      width: `${(h2hStats.model2Wins / h2hStats.totalGames) * 100}%`,
                    }}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-white">
                      {h2hStats.totalGames}
                    </div>
                    <div className="text-sm text-slate-400">Games Played</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-400">
                      {((h2hStats.model1Wins / h2hStats.totalGames) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-slate-400">
                      {getModelName(selectedModel1)} Win Rate
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-400">
                      {((h2hStats.model2Wins / h2hStats.totalGames) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-slate-400">
                      {getModelName(selectedModel2)} Win Rate
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-4">⚔️</div>
                <p>These models haven't faced each other yet!</p>
                <p className="text-sm mt-2">
                  Start a game with both models to see head-to-head stats
                </p>
                <Link
                  to="/play"
                  className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Start a Game
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-4">⚔️</div>
              <p>Select two models above to compare their performance</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Quick Matrix Preview */}
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-lg font-bold text-white">All Matchups</h2>
        </CardHeader>
        <CardBody>
          {completedGames.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>Complete some games to see the matchup matrix</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <p className="text-slate-400 text-sm mb-4">
                Matrix showing win records between models. Green = more wins, Red = fewer wins.
              </p>
              <div className="grid grid-cols-5 gap-1 max-w-2xl">
                {/* Header row */}
                <div className="bg-slate-700 p-2 text-xs text-slate-400">-</div>
                {AVAILABLE_MODELS.slice(0, 4).map((model) => (
                  <div
                    key={model.id}
                    className="bg-slate-700 p-2 text-xs text-white truncate"
                    title={model.name}
                  >
                    {model.name.slice(0, 8)}
                  </div>
                ))}
                {/* Data rows */}
                {AVAILABLE_MODELS.slice(0, 4).map((rowModel) => (
                  <>
                    <div
                      key={`row-${rowModel.id}`}
                      className="bg-slate-700 p-2 text-xs text-white truncate"
                      title={rowModel.name}
                    >
                      {rowModel.name.slice(0, 8)}
                    </div>
                    {AVAILABLE_MODELS.slice(0, 4).map((colModel) => (
                      <div
                        key={`${rowModel.id}-${colModel.id}`}
                        className={`p-2 text-xs text-center ${
                          rowModel.id === colModel.id
                            ? "bg-slate-800 text-slate-500"
                            : "bg-slate-700/50 text-white"
                        }`}
                      >
                        {rowModel.id === colModel.id ? "-" : "0-0"}
                      </div>
                    ))}
                  </>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Showing top 4 models. Play games to populate this matrix.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

interface H2HStats {
  totalGames: number;
  model1Wins: number;
  model2Wins: number;
}

function calculateH2HStats(_model1: string, _model2: string): H2HStats {
  // Placeholder - in production, this would query the database for games
  // where both models played and calculate actual win/loss records
  return {
    totalGames: 0,
    model1Wins: 0,
    model2Wins: 0,
  };
}

function getModelName(modelId: string): string {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  return model?.name || modelId.split("/").pop() || "Unknown";
}

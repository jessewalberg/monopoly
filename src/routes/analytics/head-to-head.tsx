import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import {
  HeadToHeadComparison,
  HeadToHeadMatrix,
} from "../../components/analytics";
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

  const { data: headToHeadMatrix } = useSuspenseQuery(
    convexQuery(api.analytics.getHeadToHeadMatrix, {})
  );
  const { data: leaderboard } = useSuspenseQuery(
    convexQuery(api.analytics.getLeaderboard, { sortBy: "wins" })
  );

  const modelOptions = useMemo(() => {
    if (leaderboard.length > 0) {
      return leaderboard.map((model) => ({
        id: model.modelId,
        name: model.modelDisplayName,
        provider: model.modelProvider,
      }));
    }
    return AVAILABLE_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }));
  }, [leaderboard]);

  const h2hRecord = useMemo(() => {
    if (!selectedModel1 || !selectedModel2) return null;
    if (selectedModel1 === selectedModel2) return null;
    const record =
      headToHeadMatrix.matrix[selectedModel1]?.[selectedModel2] || null;
    return record
      ? {
          modelAWins: record.wins,
          modelBWins: record.losses,
          totalGames: record.totalGames,
        }
      : { modelAWins: 0, modelBWins: 0, totalGames: 0 };
  }, [headToHeadMatrix, selectedModel1, selectedModel2]);

  const displayName = (modelId: string) =>
    headToHeadMatrix.modelDisplayNames[modelId] ||
    modelOptions.find((model) => model.id === modelId)?.name ||
    modelId.split("/").pop() ||
    "Unknown";

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
              {modelOptions.map((model) => (
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
              {modelOptions.map((model) => (
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
            {h2hRecord && h2hRecord.totalGames > 0 ? (
              <HeadToHeadComparison
                modelA={{
                  id: selectedModel1,
                  displayName: displayName(selectedModel1),
                }}
                modelB={{
                  id: selectedModel2,
                  displayName: displayName(selectedModel2),
                }}
                record={h2hRecord}
              />
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
          <HeadToHeadMatrix data={headToHeadMatrix} maxModels={8} />
        </CardBody>
      </Card>
    </div>
  );
}

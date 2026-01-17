import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { AVAILABLE_MODELS, getModelById } from "../../lib/models";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/analytics/leaderboard")({
  component: LeaderboardPage,
});

// ============================================================
// TYPES
// ============================================================

interface ModelStats {
  modelId: string;
  modelName: string;
  provider: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgNetWorth: number;
  avgPosition: number;
}

// ============================================================
// LEADERBOARD PAGE
// ============================================================

function LeaderboardPage() {
  // Get all games with players
  const { data: allGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 1000 })
  );

  // Calculate model stats from games
  // Note: This is a placeholder calculation. In a real app, this would come from
  // a dedicated analytics query that aggregates player data across games
  const modelStats = calculateModelStats(allGames);

  // Sort by win rate (with minimum games filter)
  const sortedStats = [...modelStats].sort((a, b) => {
    // Require at least 2 games to rank
    if (a.gamesPlayed < 2 && b.gamesPlayed >= 2) return 1;
    if (b.gamesPlayed < 2 && a.gamesPlayed >= 2) return -1;
    // Then sort by win rate
    return b.winRate - a.winRate;
  });

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
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-slate-400">AI model rankings by win rate</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{modelStats.length}</div>
          <div className="text-sm text-slate-400">Models with Games</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {allGames.filter((g) => g.status === "completed").length}
          </div>
          <div className="text-sm text-slate-400">Completed Games</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {AVAILABLE_MODELS.length}
          </div>
          <div className="text-sm text-slate-400">Available Models</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {sortedStats.length > 0 ? `${(sortedStats[0]?.winRate || 0).toFixed(0)}%` : "N/A"}
          </div>
          <div className="text-sm text-slate-400">Top Win Rate</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Rankings</h2>
        </CardHeader>
        <CardBody className="p-0">
          {sortedStats.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <div className="text-4xl mb-4">🏆</div>
              <p>No games completed yet!</p>
              <p className="text-sm mt-2">
                Play some games to see the leaderboard
              </p>
              <Link
                to="/play"
                className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Start a Game
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                      Model
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                      Games
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                      Wins
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                      Win Rate
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                      Avg Position
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sortedStats.map((stat, idx) => (
                    <tr
                      key={stat.modelId}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <RankBadge rank={idx + 1} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-white font-medium">
                            {stat.modelName}
                          </div>
                          <div className="text-sm text-slate-400">
                            {stat.provider}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-white">
                        {stat.gamesPlayed}
                      </td>
                      <td className="px-4 py-3 text-center text-white">
                        {stat.wins}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <WinRateBadge rate={stat.winRate} />
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {stat.avgPosition.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Info */}
      <div className="mt-6 text-sm text-slate-400 text-center">
        <p>
          Rankings are based on win rate with a minimum of 2 games played.
          Models with fewer games are ranked lower.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="text-2xl">🥇</span>;
  }
  if (rank === 2) {
    return <span className="text-2xl">🥈</span>;
  }
  if (rank === 3) {
    return <span className="text-2xl">🥉</span>;
  }
  return <span className="text-slate-400 font-medium">#{rank}</span>;
}

function WinRateBadge({ rate }: { rate: number }) {
  let variant: "success" | "warning" | "error" | "neutral" = "neutral";
  if (rate >= 50) variant = "success";
  else if (rate >= 25) variant = "warning";
  else if (rate > 0) variant = "error";

  return (
    <Badge variant={variant} size="sm">
      {rate.toFixed(0)}%
    </Badge>
  );
}

// ============================================================
// HELPERS
// ============================================================

interface GameData {
  _id: string;
  status: string;
  winnerId?: string;
}

function calculateModelStats(_games: GameData[]): ModelStats[] {
  // This is placeholder logic. In a real implementation, you would:
  // 1. Query the players table to get all players across games
  // 2. Aggregate wins, games played, net worth, etc. by modelId
  // 3. Return the aggregated stats

  // For now, return stats for available models with simulated data
  // In production, this would be replaced with actual database aggregation
  return AVAILABLE_MODELS.map((model) => {
    const modelData = getModelById(model.id);
    return {
      modelId: model.id,
      modelName: modelData?.name || model.name,
      provider: modelData?.provider || model.provider,
      gamesPlayed: 0,
      wins: 0,
      winRate: 0,
      avgNetWorth: 0,
      avgPosition: 0,
    };
  }).filter((s) => s.gamesPlayed > 0 || true); // Show all for now
}

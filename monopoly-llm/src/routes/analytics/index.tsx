import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { AVAILABLE_MODELS } from "../../lib/models";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/analytics/")({
  component: AnalyticsDashboardPage,
});

// ============================================================
// ANALYTICS DASHBOARD PAGE
// ============================================================

function AnalyticsDashboardPage() {
  // Get all games for basic stats
  const { data: allGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 1000 })
  );

  // Calculate stats
  const completedGames = allGames.filter((g) => g.status === "completed");
  const totalTurns = completedGames.reduce((sum, g) => sum + g.currentTurnNumber, 0);
  const avgTurns = completedGames.length > 0 ? Math.round(totalTurns / completedGames.length) : 0;
  const avgDuration = calculateAvgDuration(completedGames);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
        <p className="text-slate-400">AI model performance and game statistics</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Games"
          value={allGames.length.toString()}
          icon="🎮"
        />
        <StatCard
          label="Completed"
          value={completedGames.length.toString()}
          icon="✓"
        />
        <StatCard
          label="Avg Turns"
          value={avgTurns.toString()}
          icon="🎲"
        />
        <StatCard
          label="Avg Duration"
          value={avgDuration}
          icon="⏱️"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Explore Analytics</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <QuickLink
                to="/analytics/leaderboard"
                title="Leaderboard"
                description="View win rates and rankings for all AI models"
                icon="🏆"
              />
              <QuickLink
                to="/analytics/head-to-head"
                title="Head-to-Head"
                description="Compare performance between specific models"
                icon="⚔️"
              />
            </div>
          </CardBody>
        </Card>

        {/* Model Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Available Models</h2>
              <Badge variant="info" size="sm">
                {AVAILABLE_MODELS.length} models
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_MODELS.slice(0, 8).map((model) => (
                <div
                  key={model.id}
                  className="flex items-center gap-2 p-2 bg-slate-700/50 rounded"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{model.name}</div>
                    <div className="text-xs text-slate-400">{model.provider}</div>
                  </div>
                </div>
              ))}
            </div>
            {AVAILABLE_MODELS.length > 8 && (
              <p className="text-sm text-slate-400 mt-3 text-center">
                +{AVAILABLE_MODELS.length - 8} more models
              </p>
            )}
          </CardBody>
        </Card>

        {/* Recent Games Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recent Games</h2>
              <Link
                to="/games"
                className="text-sm text-green-400 hover:text-green-300"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {completedGames.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                No completed games yet. Start playing to see analytics!
              </p>
            ) : (
              <div className="space-y-2">
                {completedGames.slice(0, 5).map((game) => (
                  <Link
                    key={game._id}
                    to="/games/$gameId"
                    params={{ gameId: game._id }}
                    className="flex items-center justify-between p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-sm text-white">
                      Game #{game._id.slice(-6)}
                    </span>
                    <span className="text-sm text-slate-400">
                      {game.currentTurnNumber} turns
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Placeholder for Charts */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Win Distribution</h2>
          </CardHeader>
          <CardBody>
            <div className="h-48 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p>Charts will appear here after more games are played</p>
                <p className="text-sm mt-2">
                  Play at least 5 games to see win distribution
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Info Banner */}
      {completedGames.length < 5 && (
        <div className="mt-8 bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 text-center">
          <p className="text-blue-200">
            Play more games to unlock detailed analytics! You've completed{" "}
            <span className="font-bold">{completedGames.length}/5</span> games needed
            for full statistics.
          </p>
          <Link
            to="/play"
            className="inline-block mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Start a Game
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  title,
  description,
  icon,
}: {
  to: "/analytics/leaderboard" | "/analytics/head-to-head";
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <div className="text-white font-medium">{title}</div>
        <div className="text-sm text-slate-400">{description}</div>
      </div>
      <span className="ml-auto text-slate-400">→</span>
    </Link>
  );
}

// ============================================================
// HELPERS
// ============================================================

interface GameData {
  startedAt?: number;
  endedAt?: number;
}

function calculateAvgDuration(games: GameData[]): string {
  const gamesWithDuration = games.filter((g) => g.startedAt && g.endedAt);
  if (gamesWithDuration.length === 0) return "N/A";

  const totalMs = gamesWithDuration.reduce(
    (sum, g) => sum + ((g.endedAt || 0) - (g.startedAt || 0)),
    0
  );
  const avgMs = totalMs / gamesWithDuration.length;

  const minutes = Math.floor(avgMs / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import {
  CompactLeaderboard,
  PropertyHeatmap,
  StrategyRadar,
  TopPropertiesList,
  WinRateChart,
  WinRateTrendChart,
  type StrategyProfile,
} from "../../components/analytics";

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
  const { data: globalStats } = useSuspenseQuery(
    convexQuery(api.analytics.getGlobalStats, {})
  );
  const { data: leaderboard } = useSuspenseQuery(
    convexQuery(api.analytics.getLeaderboard, { sortBy: "wins" })
  );
  const { data: propertyStats } = useSuspenseQuery(
    convexQuery(api.analytics.getPropertyStats, {})
  );
  const { data: winRateTrends } = useSuspenseQuery(
    convexQuery(api.analytics.getWinRateTrends, { limit: 50 })
  );
  const { data: recentGames } = useSuspenseQuery(
    convexQuery(api.analytics.getRecentGames, { limit: 5 })
  );

  const topModelIds = useMemo(
    () => leaderboard.slice(0, 4).map((model) => model.modelId),
    [leaderboard]
  );

  const { data: strategyProfiles } = useSuspenseQuery(
    convexQuery(api.analytics.getStrategyProfiles, { modelIds: topModelIds })
  );

  const avgDuration = formatDurationMs(globalStats.avgDurationMs);
  const avgTurns = globalStats.avgGameLength;

  const winRateChartData = leaderboard.map((entry) => ({
    modelId: entry.modelId,
    modelDisplayName: entry.modelDisplayName,
    wins: entry.wins,
    gamesPlayed: entry.gamesPlayed,
    winRate: entry.winRate,
  }));

  const topTrader = getTopModel(leaderboard, "tradesProposed");
  const topCloser = getTopModel(
    leaderboard.filter((entry) => entry.tradesProposed > 0),
    "tradeAcceptRate"
  );
  const rentCollector = getTopModel(leaderboard, "totalRentCollected");
  const fastestThinker = getTopModel(leaderboard, "avgDecisionTimeMs", "asc");
  const propertyHoarder = getTopModel(leaderboard, "avgPropertiesOwned");

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
          value={globalStats.totalGames.toString()}
          icon="🎮"
        />
        <StatCard
          label="Completed"
          value={globalStats.completedGames.toString()}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Win Distribution</h2>
              <Badge variant="info" size="sm">
                {leaderboard.length} models
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <WinRateChart data={winRateChartData} metric="winRate" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Leaderboard</h2>
              <Link
                to="/analytics/leaderboard"
                className="text-sm text-green-400 hover:text-green-300"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            <CompactLeaderboard data={leaderboard} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Insights</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <InsightCard
                title="Top Trader"
                value={topTrader?.modelDisplayName || "N/A"}
                subValue={
                  topTrader ? `${topTrader.tradesProposed} proposals` : "No trade data"
                }
              />
              <InsightCard
                title="Best Deal Closer"
                value={topCloser?.modelDisplayName || "N/A"}
                subValue={
                  topCloser
                    ? `${Math.round(topCloser.tradeAcceptRate * 100)}% accepted`
                    : "No accepted trades"
                }
              />
              <InsightCard
                title="Rent Collector"
                value={rentCollector?.modelDisplayName || "N/A"}
                subValue={
                  rentCollector
                    ? `$${Math.round(rentCollector.totalRentCollected).toLocaleString()}`
                    : "No rent data"
                }
              />
              <InsightCard
                title="Fastest Thinker"
                value={fastestThinker?.modelDisplayName || "N/A"}
                subValue={
                  fastestThinker
                    ? `${Math.round(fastestThinker.avgDecisionTimeMs)} ms avg`
                    : "No timing data"
                }
              />
              <InsightCard
                title="Property Hoarder"
                value={propertyHoarder?.modelDisplayName || "N/A"}
                subValue={
                  propertyHoarder
                    ? `${propertyHoarder.avgPropertiesOwned.toFixed(1)} props`
                    : "No property data"
                }
              />
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Property Performance</h2>
              <Link
                to="/analytics/leaderboard"
                className="text-sm text-green-400 hover:text-green-300"
              >
                See models
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            <PropertyHeatmap data={propertyStats} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Property Rankings</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            <TopPropertiesList data={propertyStats} metric="ownerWinRate" />
            <TopPropertiesList data={propertyStats} metric="avgRentPerGame" />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Strategy Profiles</h2>
              <Badge variant="info" size="sm">
                Top models
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <StrategyRadar profiles={normalizeProfiles(strategyProfiles)} height={320} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recent Games</h2>
              <Link
                to="/games"
                className="text-sm text-green-400 hover:text-green-300"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentGames.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                No completed games yet. Start playing to see analytics!
              </p>
            ) : (
              <div className="space-y-2">
                {recentGames.map((game) => (
                  <Link
                    key={game._id}
                    to="/games/$gameId"
                    params={{ gameId: game._id }}
                    className="flex items-center justify-between p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-white">
                        Game #{game._id.slice(-6)}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        Winner: {game.winner?.modelDisplayName || "Unknown"}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {game.currentTurnNumber} turns
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Win Trends</h2>
          </CardHeader>
          <CardBody>
            <WinRateTrendChart data={winRateTrends.trends} height={320} />
          </CardBody>
        </Card>
      </div>

      {/* Explore Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Explore Analytics</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <QuickLink
                to="/analytics/leaderboard"
                title="Leaderboard"
                description="Win rates, trades, and overall rankings"
                icon="🏆"
              />
              <QuickLink
                to="/analytics/head-to-head"
                title="Head-to-Head"
                description="Matchup matrix and direct comparisons"
                icon="⚔️"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Global Summary</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
              <StatPair label="Models Played" value={globalStats.totalModelsPlayed} />
              <StatPair label="Total Decisions" value={globalStats.totalDecisions} />
              <StatPair label="Total Trades" value={globalStats.totalTrades} />
              <StatPair label="Accepted Trades" value={globalStats.acceptedTrades} />
              <StatPair
                label="Total Rent Paid"
                value={`$${globalStats.totalRentPaid.toLocaleString()}`}
              />
              <StatPair label="Games In Progress" value={globalStats.inProgressGames} />
            </div>
          </CardBody>
        </Card>
      </div>
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

function formatDurationMs(durationMs: number): string {
  if (!durationMs || durationMs <= 0) return "N/A";
  const minutes = Math.floor(durationMs / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getTopModel<T extends Record<string, number | string>>(
  data: T[],
  key: keyof T,
  order: "desc" | "asc" = "desc"
): T | undefined {
  if (data.length === 0) return undefined;
  return [...data].sort((a, b) => {
    const aValue = Number(a[key] || 0);
    const bValue = Number(b[key] || 0);
    return order === "desc" ? bValue - aValue : aValue - bValue;
  })[0];
}

function normalizeProfiles(profiles: StrategyProfile[]): StrategyProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    modelDisplayName: profile.modelDisplayName || profile.modelId,
  }));
}

function InsightCard({
  title,
  value,
  subValue,
}: {
  title: string;
  value: string;
  subValue: string;
}) {
  return (
    <div className="bg-slate-700/40 rounded-lg p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{title}</div>
      <div className="text-lg font-semibold text-white mt-1">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{subValue}</div>
    </div>
  );
}

function StatPair({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  );
}

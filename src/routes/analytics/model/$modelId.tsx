import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import {
  StrategyProfileCard,
  StrategySummaryBadges,
} from "../../../components/analytics";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/analytics/model/$modelId")({
  component: ModelAnalyticsPage,
});

// ============================================================
// MODEL ANALYTICS PAGE
// ============================================================

function ModelAnalyticsPage() {
  const { modelId } = Route.useParams();

  const { data: modelDetail } = useSuspenseQuery(
    convexQuery(api.analytics.getModelDetail, { modelId })
  );

  const { data: strategyProfile } = useSuspenseQuery(
    convexQuery(api.analytics.getStrategyProfile, { modelId })
  );

  if (!modelDetail) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <Link
          to="/analytics/leaderboard"
          className="text-sm text-slate-400 hover:text-slate-300 mb-4 inline-block"
        >
          ← Back to Leaderboard
        </Link>
        <Card>
          <CardBody>
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">🤖</div>
              <p>Model not found.</p>
              <p className="text-sm mt-2">Play some games or check the model ID.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { stats, recentGames, trends } = modelDetail;
  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/analytics/leaderboard"
          className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
        >
          ← Back to Leaderboard
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">
          {stats.modelDisplayName}
        </h1>
        <p className="text-slate-400">
          {stats.modelProvider} · {stats.modelId}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Games Played" value={stats.gamesPlayed} icon="🎮" />
        <StatCard label="Wins" value={stats.wins} icon="🏆" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon="📈" />
        <StatCard
          label="Avg Net Worth"
          value={formatCurrency(stats.avgFinalNetWorth)}
          icon="💰"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Strategy Profile</h2>
              <span className="text-sm text-slate-400">
                {strategyProfile?.decisionsAnalyzed || 0} decisions analyzed
              </span>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {strategyProfile ? (
              <>
                <StrategySummaryBadges
                  profile={{
                    modelId,
                    modelDisplayName: stats.modelDisplayName,
                    buyRate: strategyProfile.buyRate,
                    tradeFrequency: strategyProfile.tradeFrequency,
                    buildSpeed: strategyProfile.buildSpeed,
                    riskTolerance: strategyProfile.riskTolerance,
                    jailStrategy: strategyProfile.jailStrategy,
                  }}
                />
                <StrategyProfileCard
                  profile={{
                    modelId,
                    modelDisplayName: stats.modelDisplayName,
                    buyRate: strategyProfile.buyRate,
                    tradeFrequency: strategyProfile.tradeFrequency,
                    buildSpeed: strategyProfile.buildSpeed,
                    riskTolerance: strategyProfile.riskTolerance,
                    jailStrategy: strategyProfile.jailStrategy,
                  }}
                />
              </>
            ) : (
              <div className="text-slate-400 text-center py-8">
                No strategy data yet.
              </div>
            )}
          </CardBody>
        </Card>

        {/* Key stats */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Performance</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <StatPair
              label="Avg Decision Time"
              value={`${Math.round(stats.avgDecisionTimeMs)} ms`}
            />
            <StatPair
              label="Avg Game Length"
              value={`${Math.round(stats.avgGameLength)} turns`}
            />
            <StatPair
              label="Trades Proposed"
              value={stats.tradesProposed}
            />
            <StatPair
              label="Trades Accepted"
              value={stats.tradesAccepted}
            />
            <StatPair
              label="Trade Accept Rate"
              value={`${Math.round(stats.tradeAcceptRate * 100)}%`}
            />
            <StatPair
              label="Avg Properties Owned"
              value={stats.avgPropertiesOwned.toFixed(1)}
            />
            <StatPair
              label="Total Rent Collected"
              value={formatCurrency(stats.totalRentCollected)}
            />
            <StatPair
              label="Total Rent Paid"
              value={formatCurrency(stats.totalRentPaid)}
            />
          </CardBody>
        </Card>

        {/* Recent games */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recent Games</h2>
              <span className="text-sm text-slate-400">
                Recent win rate: {Math.round(trends.recentWinRate * 100)}%
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {recentGames.length === 0 ? (
              <div className="text-center text-slate-400 py-6">
                No completed games yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentGames.map((game) => (
                  <Link
                    key={game.gameId}
                    to="/games/$gameId"
                    params={{ gameId: game.gameId }}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <div className="text-sm text-white">
                        Game #{game.gameId.slice(-6)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {game.turnNumber} turns ·{" "}
                        {game.won ? "Win" : "Loss"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {game.finalNetWorth
                        ? formatCurrency(game.finalNetWorth)
                        : "Net worth N/A"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
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

function StatPair({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-white font-medium">{value}</div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

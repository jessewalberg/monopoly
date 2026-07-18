import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  getAnalytics,
  getLeaderboard,
  getStrategyProfiles,
} from '../../lib/museum/data'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import {
  CompactLeaderboard,
  PropertyHeatmap,
  StrategyRadar,
  TopPropertiesList,
  WinRateChart,
  WinRateTrendChart,
} from '../../components/analytics'
import type { StrategyProfile } from '../../components/analytics'
import type { MuseumLeaderboardEntry } from '../../lib/museum/types'

export const Route = createFileRoute('/analytics/')({
  component: AnalyticsDashboardPage,
})

function AnalyticsDashboardPage() {
  const { data: analytics } = useSuspenseQuery({
    queryKey: ['museum', 'analytics'],
    queryFn: getAnalytics,
  })
  const { data: leaderboard } = useSuspenseQuery({
    queryKey: ['museum', 'leaderboard', 'wins'],
    queryFn: () => getLeaderboard({ sortBy: 'wins' }),
  })

  const topModelIds = leaderboard.slice(0, 4).map((model) => model.modelId)
  const { data: strategyProfiles } = useSuspenseQuery({
    queryKey: ['museum', 'strategyProfiles', topModelIds.join(',')],
    queryFn: () => getStrategyProfiles(topModelIds),
  })

  const globalStats = analytics.global
  const propertyStats = analytics.propertyStats
  const winRateTrends = analytics.winRateTrends
  const recentGames = analytics.recentGames.slice(0, 5)
  const avgDuration = formatDurationMs(globalStats.avgDurationMs)
  const avgTurns = globalStats.avgGameLength

  const winRateChartData = leaderboard.map((entry) => ({
    modelId: entry.modelId,
    modelDisplayName: entry.modelDisplayName,
    wins: entry.wins,
    gamesPlayed: entry.gamesPlayed,
    winRate: entry.winRate,
  }))

  const topTrader = getTopModel(leaderboard, 'tradesProposed')
  const topCloser = getTopModel(
    leaderboard.filter((entry) => entry.tradesProposed > 0),
    'tradeAcceptRate',
  )
  const rentCollector = getTopModel(leaderboard, 'totalRentCollected')
  const fastestThinker = getTopModel(leaderboard, 'avgDecisionTimeMs', 'asc')
  const propertyHoarder = getTopModel(leaderboard, 'avgPropertiesOwned')

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-slate-400">
          Historical AI model performance from the completed-game museum archive
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Games" value={globalStats.totalGames.toString()} />
        <StatCard
          label="Completed"
          value={globalStats.completedGames.toString()}
        />
        <StatCard label="Avg Turns" value={avgTurns.toString()} />
        <StatCard label="Avg Duration" value={avgDuration} />
      </div>

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
                value={topTrader?.modelDisplayName || 'N/A'}
                subValue={
                  topTrader
                    ? `${topTrader.tradesProposed} proposals`
                    : 'No trade data'
                }
              />
              <InsightCard
                title="Best Deal Closer"
                value={topCloser?.modelDisplayName || 'N/A'}
                subValue={
                  topCloser
                    ? `${Math.round(topCloser.tradeAcceptRate * 100)}% accepted`
                    : 'No accepted trades'
                }
              />
              <InsightCard
                title="Rent Collector"
                value={rentCollector?.modelDisplayName || 'N/A'}
                subValue={
                  rentCollector
                    ? `$${Math.round(rentCollector.totalRentCollected).toLocaleString()}`
                    : 'No rent data'
                }
              />
              <InsightCard
                title="Fastest Thinker"
                value={fastestThinker?.modelDisplayName || 'N/A'}
                subValue={
                  fastestThinker
                    ? `${Math.round(fastestThinker.avgDecisionTimeMs)} ms avg`
                    : 'No timing data'
                }
              />
              <InsightCard
                title="Property Hoarder"
                value={propertyHoarder?.modelDisplayName || 'N/A'}
                subValue={
                  propertyHoarder
                    ? `${propertyHoarder.avgPropertiesOwned.toFixed(1)} props`
                    : 'No property data'
                }
              />
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Property Performance</h2>
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
            <h2 className="text-lg font-bold text-white">Strategy Profiles</h2>
          </CardHeader>
          <CardBody>
            <StrategyRadar
              profiles={normalizeProfiles(strategyProfiles)}
              height={320}
            />
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
                      Winner: {game.winner?.modelDisplayName || 'Unknown'}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {game.currentTurnNumber} turns
                  </span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Win Trends</h2>
          </CardHeader>
          <CardBody>
            <WinRateTrendChart
              data={winRateTrends.trends}
              height={320}
            />
          </CardBody>
        </Card>
      </div>

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
              />
              <QuickLink
                to="/analytics/head-to-head"
                title="Head-to-Head"
                description="Matchup matrix and direct comparisons"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Museum Summary</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
              <StatPair
                label="Models Played"
                value={globalStats.totalModelsPlayed}
              />
              <StatPair label="Total Trades" value={globalStats.totalTrades} />
              <StatPair
                label="Accepted Trades"
                value={globalStats.acceptedTrades}
              />
              <StatPair
                label="Total Rent Paid"
                value={`$${globalStats.totalRentPaid.toLocaleString()}`}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function InsightCard({
  title,
  value,
  subValue,
}: {
  title: string
  value: string
  subValue: string
}) {
  return (
    <div className="bg-slate-700/40 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="text-white font-medium truncate">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{subValue}</div>
    </div>
  )
}

function QuickLink({
  to,
  title,
  description,
}: {
  to: '/analytics/leaderboard' | '/analytics/head-to-head'
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="block p-3 rounded-lg bg-slate-700/40 hover:bg-slate-700 transition-colors"
    >
      <div className="text-white font-medium">{title}</div>
      <div className="text-sm text-slate-400">{description}</div>
    </Link>
  )
}

function StatPair({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  )
}

function getTopModel(
  entries: Array<MuseumLeaderboardEntry>,
  key: keyof MuseumLeaderboardEntry,
  direction: 'asc' | 'desc' = 'desc',
) {
  if (entries.length === 0) return null
  return [...entries].sort((a, b) => {
    const av = Number(a[key])
    const bv = Number(b[key])
    return direction === 'asc' ? av - bv : bv - av
  })[0]
}

function formatDurationMs(ms: number) {
  if (!ms) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return `${hours}h ${rem}m`
}

function normalizeProfiles(
  profiles: Array<{
    modelId: string
    modelDisplayName: string
    buyRate: number
    tradeFrequency: number
    buildSpeed: number
    riskTolerance: number
    jailStrategy: string
  }>,
): Array<StrategyProfile> {
  return profiles.map((p) => ({
    modelId: p.modelId,
    modelDisplayName: p.modelDisplayName,
    buyRate: p.buyRate,
    tradeFrequency: p.tradeFrequency,
    buildSpeed: p.buildSpeed,
    riskTolerance: p.riskTolerance,
    jailStrategy: p.jailStrategy,
  }))
}

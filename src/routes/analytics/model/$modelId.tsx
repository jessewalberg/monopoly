import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  getModelDetail,
  getStrategyProfiles,
} from '../../../lib/museum/data'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import {
  StrategyProfileCard,
  StrategySummaryBadges,
} from '../../../components/analytics'

export const Route = createFileRoute('/analytics/model/$modelId')({
  component: ModelAnalyticsPage,
})

function ModelAnalyticsPage() {
  const { modelId } = Route.useParams()

  const { data: modelDetail } = useSuspenseQuery({
    queryKey: ['museum', 'modelDetail', modelId],
    queryFn: () => getModelDetail(modelId),
  })

  const { data: strategyProfiles } = useSuspenseQuery({
    queryKey: ['museum', 'strategyProfiles', modelId],
    queryFn: () => getStrategyProfiles([modelId]),
  })
  const strategyProfile =
    strategyProfiles.length > 0 ? strategyProfiles[0] : null

  if (modelDetail === null) {
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
              <p>Model not found in the museum archive.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  const { stats, recentGames, trends } = modelDetail
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.wins}</div>
          <div className="text-sm text-slate-400">Wins</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{winRate}%</div>
          <div className="text-sm text-slate-400">Win Rate</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {stats.gamesPlayed}
          </div>
          <div className="text-sm text-slate-400">Games</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {Math.round(trends.recentWinRate * 100)}%
          </div>
          <div className="text-sm text-slate-400">Recent Win Rate</div>
        </div>
      </div>

      {strategyProfile !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <StrategyProfileCard profile={strategyProfile} />
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-white">Traits</h2>
            </CardHeader>
            <CardBody>
              <StrategySummaryBadges profile={strategyProfile} />
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Recent Games</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {recentGames.map((game) => (
              <Link
                key={game.gameId}
                to="/games/$gameId"
                params={{ gameId: game.gameId }}
                className="flex items-center justify-between p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
              >
                <div>
                  <div className="text-sm text-white">
                    Game #{game.gameId.slice(-6)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {game.won ? 'Won' : 'Did not win'} · turn {game.turnNumber}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {game.finalNetWorth !== undefined
                    ? `$${game.finalNetWorth}`
                    : ''}
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

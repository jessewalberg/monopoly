import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getAnalytics, getLeaderboard } from '../../lib/museum/data'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { LeaderboardTable } from '../../components/analytics'

export const Route = createFileRoute('/analytics/leaderboard')({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<
    'wins' | 'winRate' | 'gamesPlayed' | 'avgNetWorth'
  >('wins')

  const { data: leaderboard } = useSuspenseQuery({
    queryKey: ['museum', 'leaderboard', sortBy],
    queryFn: () => getLeaderboard({ sortBy }),
  })
  const { data: analytics } = useSuspenseQuery({
    queryKey: ['museum', 'analytics'],
    queryFn: getAnalytics,
  })
  const globalStats = analytics.global

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <Link
          to="/analytics"
          className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
        >
          ← Back to Analytics
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-slate-400">AI model rankings from completed games</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {leaderboard.length}
          </div>
          <div className="text-sm text-slate-400">Models with Games</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {globalStats.completedGames}
          </div>
          <div className="text-sm text-slate-400">Completed Games</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {globalStats.totalTrades}
          </div>
          <div className="text-sm text-slate-400">Total Trades</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {leaderboard.length > 0
              ? `${Math.round(leaderboard[0]?.winRate * 100)}%`
              : 'N/A'}
          </div>
          <div className="text-sm text-slate-400">Top Win Rate</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Rankings</h2>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | 'wins'
                    | 'winRate'
                    | 'gamesPlayed'
                    | 'avgNetWorth',
                )
              }
              className="bg-slate-700 text-white text-sm rounded px-3 py-2"
            >
              <option value="wins">Wins</option>
              <option value="winRate">Win Rate</option>
              <option value="gamesPlayed">Games Played</option>
              <option value="avgNetWorth">Avg Net Worth</option>
            </select>
          </div>
        </CardHeader>
        <CardBody>
          <LeaderboardTable data={leaderboard} sortBy={sortBy} />
        </CardBody>
      </Card>
    </div>
  )
}

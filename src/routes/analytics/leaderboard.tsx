import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { LeaderboardTable } from '../../components/analytics'
import type { FunctionArgs } from 'convex/server'

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute('/analytics/leaderboard')({
  component: LeaderboardPage,
})

// ============================================================
// LEADERBOARD PAGE
// ============================================================

function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<
    'wins' | 'winRate' | 'gamesPlayed' | 'avgNetWorth'
  >('wins')

  const leaderboardArgs = {
    sortBy,
  } satisfies FunctionArgs<typeof api.analytics.getLeaderboard>
  const { data: leaderboard } = useSuspenseQuery(
    convexQuery(api.analytics.getLeaderboard, leaderboardArgs),
  )

  const { data: globalStats } = useSuspenseQuery(
    convexQuery(api.analytics.getGlobalStats, {}),
  )

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

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Rankings</h2>
            <Badge variant="info" size="sm">
              Sorted by {sortBy}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {leaderboard.length === 0 ? (
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
            <LeaderboardTable
              data={leaderboard}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          )}
        </CardBody>
      </Card>

      {/* Info */}
      <div className="mt-6 text-sm text-slate-400 text-center">
        <p>
          Sort by wins, win rate, games played, or average net worth to explore
          different rankings.
        </p>
      </div>
    </div>
  )
}

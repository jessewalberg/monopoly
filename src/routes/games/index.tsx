import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute('/games/')({
  component: GamesHistoryPage,
})

// ============================================================
// GAMES HISTORY PAGE
// ============================================================

function GamesHistoryPage() {
  const [filter, setFilter] = useState<
    'all' | 'completed' | 'in_progress' | 'abandoned'
  >('all')

  const { data: allGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 100 }),
  )

  // Filter games
  const filteredGames =
    filter === 'all' ? allGames : allGames.filter((g) => g.status === filter)

  // Stats
  const completedCount = allGames.filter((g) => g.status === 'completed').length
  const inProgressCount = allGames.filter(
    (g) => g.status === 'in_progress',
  ).length

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Game History</h1>
        <p className="text-slate-400">Browse and replay past games</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Games" value={allGames.length} />
        <StatCard label="Completed" value={completedCount} />
        <StatCard label="In Progress" value={inProgressCount} />
        <StatCard label="Avg Turns" value={getAvgTurns(allGames)} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <FilterButton
          label="All"
          count={allGames.length}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterButton
          label="Completed"
          count={completedCount}
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
        />
        <FilterButton
          label="In Progress"
          count={inProgressCount}
          active={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
        />
      </div>

      {/* Games List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">
            Games ({filteredGames.length})
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {filteredGames.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No games found</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filteredGames.map((game) => (
                <GameRow key={game._id} game={game} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Empty state CTA */}
      {allGames.length === 0 && (
        <div className="text-center mt-8">
          <p className="text-slate-400 mb-4">No games played yet!</p>
          <Link to="/play">
            <Button variant="primary">Start Your First Game</Button>
          </Link>
        </div>
      )}
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-green-600 text-white'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {label} ({count})
    </button>
  )
}

interface GameData {
  _id: string
  status: string
  currentTurnNumber: number
  createdAt: number
  startedAt?: number
  endedAt?: number
  winnerId?: string
  endingReason?: string
}

function GameRow({ game }: { game: GameData }) {
  const statusVariant: Record<
    string,
    'success' | 'info' | 'warning' | 'error' | 'neutral'
  > = {
    completed: 'success',
    in_progress: 'info',
    setup: 'warning',
    abandoned: 'error',
  }

  const createdDate = new Date(game.createdAt)
  const duration =
    game.endedAt && game.startedAt
      ? formatDuration(game.endedAt - game.startedAt)
      : null

  const content = (
    <>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
          <span className="text-lg">🎲</span>
        </div>
        <div>
          <div className="text-white font-medium">
            Game #{game._id.slice(-6)}
          </div>
          <div className="text-sm text-slate-400">
            {createdDate.toLocaleDateString()} at{' '}
            {createdDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="text-white">{game.currentTurnNumber} turns</div>
          {duration && <div className="text-sm text-slate-400">{duration}</div>}
        </div>
        <Badge variant={statusVariant[game.status]} size="sm">
          {game.status.replace('_', ' ')}
        </Badge>
        <span className="text-slate-400">→</span>
      </div>
    </>
  )

  if (game.status === 'in_progress') {
    return (
      <Link
        to="/play/$gameId"
        params={{ gameId: game._id }}
        className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
      >
        {content}
      </Link>
    )
  }

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game._id }}
      className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
    >
      {content}
    </Link>
  )
}

// ============================================================
// HELPERS
// ============================================================

function getAvgTurns(games: Array<GameData>): string {
  const completed = games.filter((g) => g.status === 'completed')
  if (completed.length === 0) return '0'
  const avg =
    completed.reduce((sum, g) => sum + g.currentTurnNumber, 0) /
    completed.length
  return Math.round(avg).toString()
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

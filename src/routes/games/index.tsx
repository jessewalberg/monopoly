import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getGameIndex } from '../../lib/museum/data'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { MuseumGameIndexEntry } from '../../lib/museum/types'

export const Route = createFileRoute('/games/')({
  component: GamesHistoryPage,
})

function GamesHistoryPage() {
  const { data: index } = useSuspenseQuery({
    queryKey: ['museum', 'games', 'index'],
    queryFn: getGameIndex,
  })
  const allGames = index.games
  const avgTurns =
    allGames.length === 0
      ? 0
      : Math.round(
          allGames.reduce((sum, g) => sum + Number(g.currentTurnNumber || 0), 0) /
            allGames.length,
        )

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Game History</h1>
        <p className="text-slate-400">
          Browse and replay {index.completedGameCount} completed museum games
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Completed" value={index.completedGameCount} />
        <StatCard
          label="Excluded Abandoned"
          value={index.abandonedExcludedCount}
        />
        <StatCard label="Avg Turns" value={avgTurns} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">
            Completed Games ({allGames.length})
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {allGames.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No games found</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {allGames.map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function GameRow({ game }: { game: MuseumGameIndexEntry }) {
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-800/60 transition-colors"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="success">Completed</Badge>
          <span className="text-white font-medium">
            Winner: {game.winner?.modelDisplayName ?? 'Unknown'}
          </span>
        </div>
        <div className="text-slate-400 text-sm">
          {game.players.map((p) => p.modelDisplayName).join(' · ')}
        </div>
      </div>
      <div className="text-slate-400 text-sm sm:text-right">
        <div>{game.currentTurnNumber} turns</div>
        <div>{game.endingReason?.replaceAll('_', ' ') ?? 'finished'}</div>
      </div>
    </Link>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
      <div className="text-slate-400 text-sm mb-1">{label}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
    </div>
  )
}

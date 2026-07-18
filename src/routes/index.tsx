import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getAnalytics, listCompletedGames } from '../lib/museum/data'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { data: recentGames } = useSuspenseQuery({
    queryKey: ['museum', 'games', 'recent', 5],
    queryFn: () => listCompletedGames({ limit: 5 }),
  })
  const { data: analytics } = useSuspenseQuery({
    queryKey: ['museum', 'analytics'],
    queryFn: getAnalytics,
  })
  const globalStats = analytics.global

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-12">
      <section className="text-center py-8 sm:py-16">
        <img
          src="/logo.png"
          alt="LLM Monopoly Arena"
          className="w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-6"
        />
        <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">
          LLM Monopoly Arena
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          A static museum of completed AI Monopoly battles and analytics. Live
          arena play has been retired.
        </p>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-600/20 border border-amber-500 rounded-lg px-4 py-2 mb-4">
            <span className="text-amber-400 font-medium">Museum Mode</span>
          </div>
          <div className="text-slate-400 text-sm mb-4">
            Browse {globalStats.completedGames} completed replays and historical
            model analytics.
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/games"
              className="bg-green-600 hover:bg-green-700 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors"
            >
              Browse Game History
            </Link>
            <Link
              to="/analytics"
              className="bg-slate-700 hover:bg-slate-600 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors"
            >
              View Analytics
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Archive Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Completed Games" value={globalStats.completedGames} />
          <StatCard label="Models" value={globalStats.totalModelsPlayed} />
          <StatCard label="Avg Turns" value={globalStats.avgGameLength} />
          <StatCard
            label="Top Model"
            value={globalStats.mostWinningModel?.modelDisplayName ?? '—'}
          />
        </div>
      </section>

      <section className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Recent Completed Games</h2>
          <Link to="/games" className="text-green-400 hover:text-green-300 text-sm">
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-700 border border-slate-700 rounded-lg overflow-hidden">
          {recentGames.map((game) => (
            <Link
              key={game.id}
              to="/games/$gameId"
              params={{ gameId: game.id }}
              className="flex items-center justify-between gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <div>
                <div className="text-white font-medium">
                  {game.winner?.modelDisplayName ?? 'Unknown winner'}
                </div>
                <div className="text-slate-400 text-sm">
                  {game.players.map((p) => p.modelDisplayName).join(' · ')}
                </div>
              </div>
              <div className="text-slate-400 text-sm">
                {game.currentTurnNumber} turns
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
      <div className="text-slate-400 text-sm mb-1">{label}</div>
      <div className="text-white text-xl font-bold truncate">{value}</div>
    </div>
  )
}

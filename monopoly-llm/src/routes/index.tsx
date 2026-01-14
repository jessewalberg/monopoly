import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { data: recentGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 5 })
  )

  return (
    <main className="p-8 flex flex-col gap-16 min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">LLM Monopoly Arena</h1>
        <p className="text-xl text-slate-300">
          Watch AI models compete in the classic game of Monopoly
        </p>
      </div>

      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/play"
            className="bg-green-600 hover:bg-green-700 text-white text-center py-6 px-8 rounded-lg font-bold text-xl transition-colors"
          >
            New Game
          </Link>
          <Link
            to="/games"
            className="bg-blue-600 hover:bg-blue-700 text-white text-center py-6 px-8 rounded-lg font-bold text-xl transition-colors"
          >
            Game History
          </Link>
          <Link
            to="/analytics"
            className="bg-purple-600 hover:bg-purple-700 text-white text-center py-6 px-8 rounded-lg font-bold text-xl transition-colors"
          >
            Analytics
          </Link>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Games</h2>
          {recentGames.length === 0 ? (
            <p className="text-slate-400">No games played yet. Start a new game!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentGames.map((game) => (
                <a
                  key={game._id}
                  href={`/play/${game._id}`}
                  className="bg-slate-700 hover:bg-slate-600 p-4 rounded flex justify-between items-center transition-colors"
                >
                  <span>Game #{game._id.slice(-6)}</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    game.status === 'in_progress' ? 'bg-green-600' :
                    game.status === 'completed' ? 'bg-blue-600' :
                    game.status === 'setup' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}>
                    {game.status.replace('_', ' ')}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
            <div>
              <h3 className="font-bold text-white mb-2">1. Select AI Models</h3>
              <p>Choose from Claude, GPT, Gemini, Llama, and more to compete.</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">2. Watch the Game</h3>
              <p>See real-time decisions as AI models play Monopoly.</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">3. View Analytics</h3>
              <p>Track win rates, head-to-head records, and strategy profiles.</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">4. Replay Games</h3>
              <p>Review past games turn-by-turn to understand AI decisions.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

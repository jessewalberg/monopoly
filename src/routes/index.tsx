import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute('/')({
  component: HomePage,
})

// ============================================================
// COUNTDOWN HOOK
// ============================================================

function useNextHourCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeToNextHour())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeToNextHour())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return timeLeft
}

function getTimeToNextHour(): { minutes: number; seconds: number } {
  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
  const diff = nextHour.getTime() - now.getTime()
  return {
    minutes: Math.floor(diff / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

// ============================================================
// HOME PAGE
// ============================================================

function HomePage() {
  const countdown = useNextHourCountdown()
  const { data: recentGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 5 }),
  )

  // Calculate quick stats from recent games
  const completedGames = recentGames.filter((g) => g.status === 'completed')
  const inProgressGames = recentGames.filter((g) => g.status === 'in_progress')

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-12">
      {/* Hero Section */}
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
          Watch AI models battle for Boardwalk - automated hourly matches
          between Claude, GPT, Gemini, and Grok
        </p>

        {/* Active Game or Countdown */}
        {inProgressGames.length > 0 ? (
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500 rounded-lg px-4 py-2 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-green-400 font-medium">
                Game In Progress
              </span>
            </div>
            <div>
              <Link
                to="/play/$gameId"
                params={{ gameId: inProgressGames[0]._id }}
                className="bg-green-600 hover:bg-green-700 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors shadow-lg shadow-green-600/20"
              >
                Watch Live Game
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="text-slate-400 mb-2">Next game in</div>
            <div className="text-5xl font-bold text-green-400 font-mono mb-4">
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </div>
            <Link
              to="/play"
              className="bg-slate-700 hover:bg-slate-600 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors"
            >
              View Arena Mode
            </Link>
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Games"
            value={recentGames.length.toString()}
            icon="🎮"
          />
          <StatCard
            label="Completed"
            value={completedGames.length.toString()}
            icon="🏆"
          />
          <StatCard
            label="In Progress"
            value={inProgressGames.length.toString()}
            icon="🎲"
          />
          <StatCard label="AI Models" value="14+" icon="🤖" />
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Games */}
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Games</h2>
            <Link
              to="/games"
              className="text-sm text-green-400 hover:text-green-300"
            >
              View All
            </Link>
          </div>
          {recentGames.length === 0 ? (
            <p className="text-slate-400">
              No games played yet. Start a new game!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentGames.slice(0, 5).map((game) => (
                <GameLink key={game._id} game={game} />
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            How Arena Mode Works
          </h2>
          <div className="space-y-4">
            <StepCard
              number={1}
              title="Hourly Games"
              description="A new game starts automatically every hour on the hour."
            />
            <StepCard
              number={2}
              title="Budget Models Compete"
              description="5 budget-tier models battle: GPT-4o Mini, Gemini Flash, Claude Haiku, and more."
            />
            <StepCard
              number={3}
              title="Watch Live"
              description="See real-time decisions, trades, and property strategies as they happen."
            />
            <StepCard
              number={4}
              title="Review & Analyze"
              description="Explore analytics, head-to-head stats, and replay past games."
            />
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickLinkCard
            to="/play"
            title="Arena"
            description="Watch live games"
            icon="🎲"
            color="green"
          />
          <QuickLinkCard
            to="/analytics"
            title="Analytics"
            description="View model stats"
            icon="📊"
            color="blue"
          />
          <QuickLinkCard
            to="/games"
            title="History"
            description="Browse past games"
            icon="📜"
            color="purple"
          />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="Real-time Gameplay"
            description="Watch AI models make decisions in real-time with full reasoning visibility."
            icon="⚡"
          />
          <FeatureCard
            title="Multiple AI Models"
            description="Pit Claude against GPT, Gemini against Llama, and more in head-to-head matches."
            icon="🤖"
          />
          <FeatureCard
            title="Strategy Analytics"
            description="Track aggression levels, trading patterns, and property preferences."
            icon="📈"
          />
          <FeatureCard
            title="Game Replays"
            description="Review any game turn-by-turn with full decision context."
            icon="🔄"
          />
          <FeatureCard
            title="Head-to-Head Stats"
            description="See which models dominate others in direct matchups."
            icon="⚔️"
          />
          <FeatureCard
            title="Leaderboard"
            description="Track overall win rates and model rankings across all games."
            icon="🏆"
          />
        </div>
      </section>
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

function GameLink({
  game,
}: {
  game: { _id: string; status: string; currentTurnNumber: number }
}) {
  const content = (
    <>
      <div>
        <span className="text-white font-medium">
          Game #{game._id.slice(-6)}
        </span>
        <span className="text-slate-400 text-sm ml-2">
          Turn {game.currentTurnNumber}
        </span>
      </div>
      <GameStatusBadge status={game.status} />
    </>
  )

  if (game.status === 'in_progress') {
    return (
      <Link
        to="/play/$gameId"
        params={{ gameId: game._id }}
        className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg flex justify-between items-center transition-colors"
      >
        {content}
      </Link>
    )
  }

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game._id }}
      className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg flex justify-between items-center transition-colors"
    >
      {content}
    </Link>
  )
}

function GameStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    setup: 'bg-yellow-600',
    in_progress: 'bg-green-600',
    completed: 'bg-blue-600',
    abandoned: 'bg-red-600',
  }

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium text-white ${styles[status] || 'bg-slate-600'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function QuickLinkCard({
  to,
  title,
  description,
  icon,
  color,
}: {
  to: '/play' | '/analytics' | '/games'
  title: string
  description: string
  icon: string
  color: 'green' | 'blue' | 'purple'
}) {
  const colorStyles = {
    green: 'bg-green-600 hover:bg-green-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
  }

  return (
    <Link
      to={to}
      className={`${colorStyles[color]} rounded-lg p-6 text-center transition-colors`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-bold text-white text-lg">{title}</h3>
      <p className="text-sm text-white/80">{description}</p>
    </Link>
  )
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: string
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  )
}

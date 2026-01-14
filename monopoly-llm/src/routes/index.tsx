import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/")({
  component: HomePage,
});

// ============================================================
// HOME PAGE
// ============================================================

function HomePage() {
  const { data: recentGames } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 5 })
  );

  // Calculate quick stats from recent games
  const completedGames = recentGames.filter((g) => g.status === "completed");
  const inProgressGames = recentGames.filter((g) => g.status === "in_progress");

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-12">
      {/* Hero Section */}
      <section className="text-center py-8 sm:py-16">
        <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">
          LLM Monopoly Arena
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          Watch AI models battle for Boardwalk - Claude, GPT, Gemini, and more
          compete in real-time Monopoly matches
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/play"
            className="bg-green-600 hover:bg-green-700 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors shadow-lg shadow-green-600/20"
          >
            Start New Game
          </Link>
          {inProgressGames.length > 0 && (
            <Link
              to="/play/$gameId"
              params={{ gameId: inProgressGames[0]._id }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-center py-4 px-8 rounded-lg font-bold text-xl transition-colors"
            >
              Watch Live Game
            </Link>
          )}
        </div>
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
          <StatCard
            label="AI Models"
            value="14+"
            icon="🤖"
          />
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
            <p className="text-slate-400">No games played yet. Start a new game!</p>
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
          <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            <StepCard
              number={1}
              title="Select AI Models"
              description="Choose from Claude, GPT, Gemini, Llama, Mistral, and more to compete."
            />
            <StepCard
              number={2}
              title="Configure Game"
              description="Set game speed, turn limits, and starting money."
            />
            <StepCard
              number={3}
              title="Watch & Analyze"
              description="See real-time decisions, trades, and property strategies."
            />
            <StepCard
              number={4}
              title="Review Results"
              description="Explore analytics, head-to-head stats, and replay key moments."
            />
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickLinkCard
            to="/play"
            title="New Game"
            description="Start a fresh match"
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
        <h2 className="text-2xl font-bold text-white text-center mb-8">Features</h2>
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
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function GameLink({ game }: { game: { _id: string; status: string; currentTurnNumber: number } }) {
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
  );

  if (game.status === "in_progress") {
    return (
      <Link
        to="/play/$gameId"
        params={{ gameId: game._id }}
        className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg flex justify-between items-center transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game._id }}
      className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg flex justify-between items-center transition-colors"
    >
      {content}
    </Link>
  );
}

function GameStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    setup: "bg-yellow-600",
    in_progress: "bg-green-600",
    completed: "bg-blue-600",
    abandoned: "bg-red-600",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium text-white ${styles[status] || "bg-slate-600"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
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
  );
}

function QuickLinkCard({
  to,
  title,
  description,
  icon,
  color,
}: {
  to: "/play" | "/analytics" | "/games";
  title: string;
  description: string;
  icon: string;
  color: "green" | "blue" | "purple";
}) {
  const colorStyles = {
    green: "bg-green-600 hover:bg-green-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
  };

  return (
    <Link
      to={to}
      className={`${colorStyles[color]} rounded-lg p-6 text-center transition-colors`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-bold text-white text-lg">{title}</h3>
      <p className="text-sm text-white/80">{description}</p>
    </Link>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

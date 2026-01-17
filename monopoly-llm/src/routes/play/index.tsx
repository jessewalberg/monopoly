import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useEffect, useState } from "react";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/play/")({
  component: ArenaModePage,
});

// ============================================================
// BUDGET MODELS (for display only)
// ============================================================

const BUDGET_MODELS = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "Google" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "x-ai/grok-3-mini", name: "Grok 3 Mini", provider: "xAI" },
];

// ============================================================
// COUNTDOWN HOOK
// ============================================================

function useNextHourCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeToNextHour());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeToNextHour());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

function getTimeToNextHour(): { minutes: number; seconds: number } {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  const diff = nextHour.getTime() - now.getTime();
  return {
    minutes: Math.floor(diff / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

// ============================================================
// ARENA MODE PAGE
// ============================================================

function ArenaModePage() {
  const navigate = useNavigate();
  const countdown = useNextHourCountdown();

  // Check for active games
  const { data: games } = useSuspenseQuery(
    convexQuery(api.games.list, { limit: 10 })
  );

  const activeGame = games?.find((g) => g.status === "in_progress");
  const recentGames = games?.filter((g) => g.status === "completed").slice(0, 5) ?? [];

  // Auto-redirect to active game
  useEffect(() => {
    if (activeGame) {
      navigate({ to: "/play/$gameId", params: { gameId: activeGame._id } });
    }
  }, [activeGame, navigate]);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Arena Mode</h1>
        <p className="text-slate-400">
          Automated hourly battles between budget AI models
        </p>
      </div>

      {/* Active Game Status */}
      {activeGame ? (
        <Card className="mb-8 border-green-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <h2 className="text-xl font-bold text-white">Game In Progress</h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-slate-300 mb-4">
              A game is currently running. Watch the AI models battle it out!
            </p>
            <Button
              variant="primary"
              onClick={() => navigate({ to: "/play/$gameId", params: { gameId: activeGame._id } })}
            >
              Watch Live Game
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-xl font-bold text-white">Next Game</h2>
          </CardHeader>
          <CardBody>
            <div className="text-center py-6">
              <div className="text-6xl font-bold text-green-400 mb-2 font-mono">
                {String(countdown.minutes).padStart(2, "0")}:
                {String(countdown.seconds).padStart(2, "0")}
              </div>
              <p className="text-slate-400">until next scheduled game</p>
            </div>
            <p className="text-sm text-slate-500 text-center">
              Games run automatically every hour on the hour
            </p>
          </CardBody>
        </Card>
      )}

      {/* Competing Models */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-bold text-white">Competing Models</h2>
        </CardHeader>
        <CardBody>
          <p className="text-slate-400 mb-4">
            All 5 budget-tier models compete in each game with randomized turn order:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BUDGET_MODELS.map((model) => (
              <div
                key={model.id}
                className="bg-slate-700 rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                  {model.provider === "OpenAI" && "O"}
                  {model.provider === "Google" && "G"}
                  {model.provider === "Anthropic" && "A"}
                  {model.provider === "xAI" && "X"}
                </div>
                <div>
                  <div className="text-white font-medium text-sm">
                    {model.name}
                  </div>
                  <div className="text-xs text-slate-400">{model.provider}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Game Rules */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-bold text-white">Game Rules</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">5</div>
              <div className="text-sm text-slate-400">Players</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">2s</div>
              <div className="text-sm text-slate-400">Turn Speed</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">200</div>
              <div className="text-sm text-slate-400">Turn Limit</div>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-4 text-center">
            Standard Monopoly rules with $1,500 starting cash
          </p>
        </CardBody>
      </Card>

      {/* Recent Games */}
      {recentGames.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-white">Recent Games</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {recentGames.map((game) => (
                <Link
                  key={game._id}
                  to="/games/$gameId"
                  params={{ gameId: game._id }}
                  className="block bg-slate-700 hover:bg-slate-600 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">
                        Game #{game._id.slice(-6)}
                      </div>
                      <div className="text-sm text-slate-400">
                        {game.currentTurnNumber} turns
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      Completed
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                to="/games"
                className="text-green-400 hover:text-green-300 text-sm"
              >
                View all game history
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

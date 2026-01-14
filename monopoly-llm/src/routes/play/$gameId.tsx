import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Board } from "../../components/game/Board";
import { PlayerPanel } from "../../components/game/PlayerPanel";
import { ActionLog, parseTurnEvents } from "../../components/game/ActionLog";
import { DiceDisplay } from "../../components/game/DiceDisplay";
import { GameControlsCompact } from "../../components/game/GameControls";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/play/$gameId")({
  component: LiveGamePage,
});

// ============================================================
// LIVE GAME PAGE
// ============================================================

function LiveGamePage() {
  const { gameId } = Route.useParams();
  const typedGameId = gameId as Id<"games">;

  // Get full game state (auto-updates via Convex)
  const { data: gameState } = useSuspenseQuery(
    convexQuery(api.games.getFullState, { gameId: typedGameId })
  );

  // Get recent turns for log
  const { data: recentTurns } = useSuspenseQuery(
    convexQuery(api.turns.getByGame, { gameId: typedGameId, limit: 20 })
  );

  // Game control mutations
  const pauseGame = useMutation({
    mutationFn: useConvexMutation(api.gameEngine.pauseGame),
  });
  const resumeGame = useMutation({
    mutationFn: useConvexMutation(api.gameEngine.resumeGame),
  });
  const abandonGame = useMutation({
    mutationFn: useConvexMutation(api.gameEngine.abandonGame),
  });

  if (!gameState) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
        <Link
          to="/play"
          className="text-green-400 hover:text-green-300"
        >
          Start a new game
        </Link>
      </div>
    );
  }

  const { game, players, properties, currentTurn } = gameState;

  // Handle different game states
  if (game.status === "setup") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Game Ready</h1>
        <p className="text-slate-400 mb-4">This game is ready to start.</p>
        <Button
          variant="primary"
          onClick={() => resumeGame.mutate({ gameId: typedGameId })}
          loading={resumeGame.isPending}
        >
          Start Game
        </Button>
      </div>
    );
  }

  if (game.status === "completed") {
    const winner = players.find((p) => p._id === game.winnerId);
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Complete!</h1>
          {winner ? (
            <div className="mb-6">
              <div
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-white"
                style={{ backgroundColor: winner.tokenColor }}
              >
                <span className="text-xl font-bold">{winner.modelDisplayName}</span>
                <span>wins!</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 mb-6">No winner determined</p>
          )}
          <div className="flex gap-4 justify-center">
            <a
              href={`/games/${gameId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              View Replay
            </a>
            <Link
              to="/play"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              New Game
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "abandoned") {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Game Abandoned</h1>
        <p className="text-slate-400 mb-4">This game was ended early.</p>
        <Link
          to="/play"
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Start New Game
        </Link>
      </div>
    );
  }

  // Game is in progress
  const activePlayers = players.filter((p) => !p.isBankrupt);
  const currentPlayer = activePlayers[game.currentPlayerIndex % activePlayers.length];

  // Transform players for Board component
  const boardPlayers = players.map((p) => ({
    _id: p._id,
    position: p.position,
    modelDisplayName: p.modelDisplayName,
    tokenColor: p.tokenColor,
    textColor: "#FFFFFF",
    inJail: p.inJail,
  }));

  // Transform properties for Board component
  const boardProperties = properties.map((prop) => ({
    position: prop.position,
    ownerId: prop.ownerId,
    houses: prop.houses,
    isMortgaged: prop.isMortgaged,
  }));

  // Transform turns for ActionLog using the helper
  const logEvents = recentTurns.flatMap((turn) => {
    const player = players.find((p) => p._id === turn.playerId);
    return parseTurnEvents(
      turn.events,
      player?.modelDisplayName,
      player?.tokenColor,
      turn.startedAt
    );
  }).slice(0, 50);

  const isPaused = game.isPaused === true;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 p-4">
      {/* Main game area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Top bar with controls */}
        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-4">
            <Badge variant="info" size="md">
              Turn {game.currentTurnNumber}
            </Badge>
            {isPaused ? (
              <Badge variant="warning" size="md">
                PAUSED
              </Badge>
            ) : (
              <Badge
                variant={game.currentPhase === "rolling" ? "success" : "neutral"}
                size="md"
              >
                {game.currentPhase.replace("_", " ")}
              </Badge>
            )}
            {currentPlayer && (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: currentPlayer.tokenColor }}
                />
                <span className="text-white text-sm">
                  {currentPlayer.modelDisplayName}'s turn
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <GameControlsCompact
              isPlaying={game.status === "in_progress" && !isPaused}
              isPaused={isPaused}
              onPause={() => pauseGame.mutate({ gameId: typedGameId })}
              onPlay={() => resumeGame.mutate({ gameId: typedGameId })}
            />
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to abandon this game?")) {
                  abandonGame.mutate({ gameId: typedGameId });
                }
              }}
            >
              Stop
            </Button>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <Board
            players={boardPlayers}
            properties={boardProperties}
            currentPlayerId={currentPlayer?._id}
            turnNumber={game.currentTurnNumber}
            phase={game.currentPhase}
          >
            {/* Center content: dice and current player */}
            <div className="flex flex-col items-center gap-4">
              {/* Pause overlay */}
              {isPaused ? (
                <div className="flex flex-col items-center gap-4 py-4 bg-white/80 rounded-lg px-6">
                  <div className="text-4xl">⏸️</div>
                  <p className="text-lg font-semibold text-yellow-600">Game Paused</p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => resumeGame.mutate({ gameId: typedGameId })}
                    loading={resumeGame.isPending}
                  >
                    Resume Game
                  </Button>
                </div>
              ) : (
                <>
                  {currentTurn?.diceRoll && (
                    <DiceDisplay
                      dice={currentTurn.diceRoll as [number, number]}
                      isRolling={game.currentPhase === "rolling"}
                    />
                  )}
                  {currentPlayer && (
                    <div className="text-center bg-white/60 rounded-lg px-4 py-2">
                      <p className="text-sm text-slate-600">Current Player</p>
                      <p
                        className="font-bold text-lg"
                        style={{ color: currentPlayer.tokenColor }}
                      >
                        {currentPlayer.modelDisplayName}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Board>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 overflow-hidden">
        {/* Players */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <h3 className="text-sm font-medium text-slate-400 px-1">Players</h3>
          {players.map((player) => {
            const playerProperties = properties.filter(
              (p) => p.ownerId === player._id
            );
            return (
              <PlayerPanel
                key={player._id}
                player={{
                  _id: player._id,
                  modelId: player.modelId,
                  modelDisplayName: player.modelDisplayName,
                  tokenColor: player.tokenColor,
                  textColor: "#FFFFFF",
                  cash: player.cash,
                  position: player.position,
                  inJail: player.inJail,
                  isBankrupt: player.isBankrupt,
                  getOutOfJailCards: player.getOutOfJailCards,
                }}
                properties={playerProperties.map((p) => ({
                  _id: p._id,
                  name: p.name,
                  group: p.group,
                  houses: p.houses,
                  isMortgaged: p.isMortgaged,
                }))}
                isCurrentTurn={currentPlayer?._id === player._id}
                compact
              />
            );
          })}
        </div>

        {/* Action Log */}
        <div className="h-64 lg:h-80">
          <ActionLog
            events={logEvents}
            maxHeight="100%"
          />
        </div>
      </div>
    </div>
  );
}

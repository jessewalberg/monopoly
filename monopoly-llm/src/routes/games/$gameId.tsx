import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Board } from "../../components/game/Board";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/games/$gameId")({
  component: GameReplayPage,
});

// ============================================================
// GAME REPLAY PAGE
// ============================================================

function GameReplayPage() {
  const { gameId } = Route.useParams();
  const typedGameId = gameId as Id<"games">;

  // Selected turn for replay
  const [selectedTurn, setSelectedTurn] = useState<number>(1);

  // Get game state
  const { data: gameState } = useSuspenseQuery(
    convexQuery(api.games.getFullState, { gameId: typedGameId })
  );

  // Get all turns
  const { data: allTurns } = useSuspenseQuery(
    convexQuery(api.turns.getByGame, { gameId: typedGameId })
  );

  if (!gameState) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
        <Link
          to="/games"
          className="text-green-400 hover:text-green-300"
        >
          Back to History
        </Link>
      </div>
    );
  }

  const { game, players, properties } = gameState;
  const winner = players.find((p) => p._id === game.winnerId);

  // Sort turns by turn number
  const sortedTurns = [...allTurns].sort((a, b) => a.turnNumber - b.turnNumber);
  const maxTurn = sortedTurns.length > 0 ? sortedTurns[sortedTurns.length - 1].turnNumber : 1;
  const currentTurnData = sortedTurns.find((t) => t.turnNumber === selectedTurn);

  // Transform for board at selected turn
  // Note: For a full replay, we'd need to reconstruct board state at each turn
  // For now, we show the final state but highlight the selected turn info
  const boardPlayers = players.map((p) => ({
    _id: p._id,
    position: currentTurnData?.playerId === p._id
      ? (currentTurnData.positionAfter ?? currentTurnData.positionBefore)
      : p.position,
    modelDisplayName: p.modelDisplayName,
    tokenColor: p.tokenColor,
    textColor: "#FFFFFF",
    inJail: p.inJail,
  }));

  const boardProperties = properties.map((prop) => ({
    position: prop.position,
    ownerId: prop.ownerId,
    houses: prop.houses,
    isMortgaged: prop.isMortgaged,
  }));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/games"
            className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
          >
            ← Back to History
          </Link>
          <h1 className="text-2xl font-bold text-white">
            Game #{gameId.slice(-6)} Replay
          </h1>
        </div>
        <Badge
          variant={game.status === "completed" ? "success" : "neutral"}
          size="md"
        >
          {game.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Winner Banner */}
      {winner && (
        <div
          className="rounded-lg p-4 mb-6 flex items-center gap-4"
          style={{ backgroundColor: `${winner.tokenColor}20`, borderColor: winner.tokenColor, borderWidth: 1 }}
        >
          <span className="text-3xl">🏆</span>
          <div>
            <div className="text-white font-bold text-lg">
              {winner.modelDisplayName} Won!
            </div>
            <div className="text-sm text-slate-300">
              {game.endingReason?.replace("_", " ")} after {game.currentTurnNumber} turns
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Board */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Game Board</h2>
                <span className="text-sm text-slate-400">
                  Showing turn {selectedTurn} of {maxTurn}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex justify-center">
                <Board
                  players={boardPlayers}
                  properties={boardProperties}
                  turnNumber={selectedTurn}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Turn Selector */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold text-white">Turn Selector</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <input
                  type="range"
                  min={1}
                  max={maxTurn}
                  value={selectedTurn}
                  onChange={(e) => setSelectedTurn(Number(e.target.value))}
                  className="w-full accent-green-500"
                />
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Turn 1</span>
                  <span className="text-white font-medium">Turn {selectedTurn}</span>
                  <span>Turn {maxTurn}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedTurn(Math.max(1, selectedTurn - 1))}
                    disabled={selectedTurn <= 1}
                  >
                    ←
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedTurn(Math.min(maxTurn, selectedTurn + 1))}
                    disabled={selectedTurn >= maxTurn}
                  >
                    →
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Turn Details */}
          {currentTurnData && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-white">Turn {selectedTurn}</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {/* Player */}
                  <div>
                    <span className="text-sm text-slate-400">Player</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: players.find(
                            (p) => p._id === currentTurnData.playerId
                          )?.tokenColor,
                        }}
                      />
                      <span className="text-white">
                        {players.find((p) => p._id === currentTurnData.playerId)?.modelDisplayName}
                      </span>
                    </div>
                  </div>

                  {/* Dice Roll */}
                  {currentTurnData.diceRoll && (
                    <div>
                      <span className="text-sm text-slate-400">Dice Roll</span>
                      <div className="text-white mt-1">
                        {currentTurnData.diceRoll[0]} + {currentTurnData.diceRoll[1]} = {currentTurnData.diceRoll[0] + currentTurnData.diceRoll[1]}
                        {currentTurnData.wasDoubles && (
                          <Badge variant="warning" size="sm" className="ml-2">Doubles!</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Movement */}
                  {currentTurnData.landedOn && (
                    <div>
                      <span className="text-sm text-slate-400">Landed On</span>
                      <div className="text-white mt-1">{currentTurnData.landedOn}</div>
                    </div>
                  )}

                  {/* Cash Change */}
                  <div>
                    <span className="text-sm text-slate-400">Cash</span>
                    <div className="text-white mt-1">
                      ${currentTurnData.cashBefore}
                      {currentTurnData.cashAfter !== undefined && currentTurnData.cashAfter !== currentTurnData.cashBefore && (
                        <span
                          className={
                            currentTurnData.cashAfter > currentTurnData.cashBefore
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {" → "}${currentTurnData.cashAfter}
                          {" ("}
                          {currentTurnData.cashAfter > currentTurnData.cashBefore ? "+" : ""}
                          {currentTurnData.cashAfter - currentTurnData.cashBefore}
                          {")"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Events */}
                  {currentTurnData.events.length > 0 && (
                    <div>
                      <span className="text-sm text-slate-400">Events</span>
                      <ul className="mt-1 space-y-1">
                        {currentTurnData.events.map((event, idx) => (
                          <li key={idx} className="text-sm text-slate-300">
                            • {event}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Final Standings */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold text-white">Final Standings</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {[...players]
                  .sort((a, b) => {
                    if (a._id === game.winnerId) return -1;
                    if (b._id === game.winnerId) return 1;
                    if (a.isBankrupt && !b.isBankrupt) return 1;
                    if (!a.isBankrupt && b.isBankrupt) return -1;
                    return (b.finalNetWorth || b.cash) - (a.finalNetWorth || a.cash);
                  })
                  .map((player, idx) => (
                    <div
                      key={player._id}
                      className="flex items-center justify-between p-2 rounded bg-slate-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-6">#{idx + 1}</span>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: player.tokenColor }}
                        />
                        <span className="text-white text-sm">
                          {player.modelDisplayName}
                        </span>
                      </div>
                      <div className="text-right">
                        {player.isBankrupt ? (
                          <Badge variant="error" size="sm">Bankrupt</Badge>
                        ) : (
                          <span className="text-green-400 text-sm">
                            ${player.finalNetWorth || player.cash}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import {
  PlayersListConfigurator,
  generateInitialPlayers,
  type PlayerConfig,
} from "../../components/setup/PlayerConfigurator";
import { GameSettings, type GameSettingsConfig } from "../../components/setup/GameSettings";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, CardFooter } from "../../components/ui/Card";
import { getModelById, TOKEN_COLORS, DEFAULT_GAME_CONFIG } from "../../lib/models";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createFileRoute("/play/")({
  component: GameSetupPage,
});

// ============================================================
// TYPES
// ============================================================

type SetupStep = "players" | "settings" | "review";

// ============================================================
// GAME SETUP PAGE
// ============================================================

function GameSetupPage() {
  const navigate = useNavigate();

  // Setup state
  const [step, setStep] = useState<SetupStep>("players");
  const [players, setPlayers] = useState<PlayerConfig[]>(() =>
    generateInitialPlayers(2)
  );
  const [settings, setSettings] = useState<GameSettingsConfig>({
    speedMs: DEFAULT_GAME_CONFIG.speedMs,
    turnLimit: DEFAULT_GAME_CONFIG.turnLimit,
    startingMoney: DEFAULT_GAME_CONFIG.startingMoney,
  });

  // Mutations
  const createGame = useMutation({
    mutationFn: useConvexMutation(api.games.create),
  });
  const createPlayer = useMutation({
    mutationFn: useConvexMutation(api.players.create),
  });
  const startGame = useMutation({
    mutationFn: useConvexMutation(api.gameEngine.startGame),
  });

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const isPlayersValid = players.length >= 2 && players.every((p) => p.modelId);

  // Handle game start
  const handleStartGame = async () => {
    setIsStarting(true);
    setError(null);

    try {
      // 1. Create the game
      const gameId = await createGame.mutateAsync({
        config: {
          speedMs: settings.speedMs,
          turnLimit: settings.turnLimit || undefined,
          startingMoney: settings.startingMoney,
        },
      });

      // 2. Create each player
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const model = getModelById(player.modelId);
        const color = TOKEN_COLORS[player.tokenColorIndex];

        await createPlayer.mutateAsync({
          gameId,
          modelId: player.modelId,
          modelDisplayName: player.displayName || model?.name || "Player",
          modelProvider: model?.provider || "Unknown",
          tokenColor: color.hex,
          turnOrder: i,
        });
      }

      // 3. Start the game
      await startGame.mutateAsync({ gameId });

      // 4. Navigate to the game
      navigate({ to: `/play/${gameId}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
      setIsStarting(false);
    }
  };

  // Step navigation
  const canProceed = () => {
    switch (step) {
      case "players":
        return isPlayersValid;
      case "settings":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === "players") setStep("settings");
    else if (step === "settings") setStep("review");
  };

  const handleBack = () => {
    if (step === "settings") setStep("players");
    else if (step === "review") setStep("settings");
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">New Game Setup</h1>
        <p className="text-slate-400">Configure your AI Monopoly match</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <StepIndicator
          step={1}
          label="Players"
          isActive={step === "players"}
          isComplete={step !== "players"}
        />
        <StepConnector isComplete={step !== "players"} />
        <StepIndicator
          step={2}
          label="Settings"
          isActive={step === "settings"}
          isComplete={step === "review"}
        />
        <StepConnector isComplete={step === "review"} />
        <StepIndicator
          step={3}
          label="Review"
          isActive={step === "review"}
          isComplete={false}
        />
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-white">
            {step === "players" && "Select AI Players"}
            {step === "settings" && "Game Settings"}
            {step === "review" && "Review & Start"}
          </h2>
        </CardHeader>

        <CardBody>
          {step === "players" && (
            <div className="space-y-4">
              <p className="text-slate-400 mb-4">
                Add 2-8 AI players to compete. Each player needs a unique model and color.
              </p>
              <PlayersListConfigurator
                players={players}
                onChange={setPlayers}
                minPlayers={2}
                maxPlayers={8}
              />
            </div>
          )}

          {step === "settings" && (
            <div className="space-y-4">
              <p className="text-slate-400 mb-4">
                Configure how the game will be played.
              </p>
              <GameSettings
                config={settings}
                onChange={setSettings}
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-6">
              {/* Players Summary */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Players</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {players.map((player, idx) => {
                    const model = getModelById(player.modelId);
                    const color = TOKEN_COLORS[player.tokenColorIndex];
                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 bg-slate-700 rounded-lg p-3"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                          style={{
                            backgroundColor: color.hex,
                            color: color.textColor,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {player.displayName || model?.name || "Unknown"}
                          </div>
                          <div className="text-sm text-slate-400">
                            {model?.provider || "Unknown"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settings Summary */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Settings</h3>
                <div className="bg-slate-700 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {settings.speedMs >= 1000
                        ? `${settings.speedMs / 1000}s`
                        : `${settings.speedMs}ms`}
                    </div>
                    <div className="text-sm text-slate-400">Turn Speed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {settings.turnLimit || "∞"}
                    </div>
                    <div className="text-sm text-slate-400">Turn Limit</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      ${settings.startingMoney}
                    </div>
                    <div className="text-sm text-slate-400">Starting Cash</div>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg p-4">
                  {error}
                </div>
              )}
            </div>
          )}
        </CardBody>

        <CardFooter>
          <div className="flex justify-between w-full">
            <Button
              variant="secondary"
              onClick={handleBack}
              disabled={step === "players"}
            >
              Back
            </Button>

            {step === "review" ? (
              <Button
                variant="primary"
                onClick={handleStartGame}
                loading={isStarting}
                disabled={isStarting}
              >
                {isStarting ? "Starting..." : "Start Game"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StepIndicator({
  step,
  label,
  isActive,
  isComplete,
}: {
  step: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          isActive
            ? "bg-green-600 text-white"
            : isComplete
              ? "bg-green-600/50 text-white"
              : "bg-slate-700 text-slate-400"
        }`}
      >
        {isComplete ? "✓" : step}
      </div>
      <span
        className={`text-sm mt-1 ${
          isActive ? "text-white" : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div
      className={`w-16 sm:w-24 h-1 mx-2 rounded ${
        isComplete ? "bg-green-600/50" : "bg-slate-700"
      }`}
    />
  );
}

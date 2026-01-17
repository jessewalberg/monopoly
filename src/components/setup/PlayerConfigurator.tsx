import { useState } from "react";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { ModelSelector } from "./ModelSelector";
import { TokenColorPreview } from "../game/PlayerToken";
import { TOKEN_COLORS, getModelById } from "../../lib/models";

// ============================================================
// TYPES
// ============================================================

export interface PlayerConfig {
  id: string; // Temporary ID for the form
  modelId: string;
  displayName: string;
  tokenColorIndex: number;
}

export interface PlayerConfiguratorProps {
  player: PlayerConfig;
  onChange: (player: PlayerConfig) => void;
  onRemove?: () => void;
  usedColorIndices: number[];
  usedModelIds: string[];
  canRemove?: boolean;
  playerNumber: number;
}

// ============================================================
// PLAYER CONFIGURATOR COMPONENT
// ============================================================

export function PlayerConfigurator({
  player,
  onChange,
  onRemove,
  usedColorIndices,
  usedModelIds,
  canRemove = true,
  playerNumber,
}: PlayerConfiguratorProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  const selectedColor = TOKEN_COLORS[player.tokenColorIndex];

  // Handle model change - auto-generate display name
  const handleModelChange = (modelId: string) => {
    const model = getModelById(modelId);
    const displayName = model ? model.name : modelId.split("/").pop() || "Player";

    onChange({
      ...player,
      modelId,
      displayName,
    });
  };

  // Handle color change
  const handleColorChange = (colorIndex: number) => {
    onChange({
      ...player,
      tokenColorIndex: colorIndex,
    });
  };

  // Handle name change
  const handleNameChange = (name: string) => {
    onChange({
      ...player,
      displayName: name,
    });
  };

  return (
    <Card className="relative">
      <CardBody className="space-y-4">
        {/* Player number and remove button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                backgroundColor: selectedColor.hex,
                color: selectedColor.textColor,
              }}
            >
              {playerNumber}
            </div>
            <span className="text-sm font-medium text-white">
              Player {playerNumber}
            </span>
          </div>
          {canRemove && onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>

        {/* Model selector */}
        <ModelSelector
          value={player.modelId}
          onChange={handleModelChange}
          label="AI Model"
          excludeModels={usedModelIds.filter((id) => id !== player.modelId)}
        />

        {/* Display name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Display Name
          </label>
          {isEditingName ? (
            <input
              type="text"
              value={player.displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
              className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg text-left hover:bg-slate-600 transition-colors"
            >
              {player.displayName || "Click to edit"}
            </button>
          )}
        </div>

        {/* Color picker */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Token Color
          </label>
          <div className="flex flex-wrap gap-2">
            {TOKEN_COLORS.map((color, idx) => {
              const isUsed =
                usedColorIndices.includes(idx) && idx !== player.tokenColorIndex;
              return (
                <button
                  key={color.name}
                  onClick={() => !isUsed && handleColorChange(idx)}
                  disabled={isUsed}
                  className={isUsed ? "opacity-30 cursor-not-allowed" : ""}
                  title={isUsed ? `Used by another player` : color.name}
                >
                  <TokenColorPreview
                    color={color.hex}
                    textColor={color.textColor}
                    selected={idx === player.tokenColorIndex}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================
// PLAYERS LIST CONFIGURATOR
// ============================================================

export function PlayersListConfigurator({
  players,
  onChange,
  minPlayers = 2,
  maxPlayers = 8,
}: {
  players: PlayerConfig[];
  onChange: (players: PlayerConfig[]) => void;
  minPlayers?: number;
  maxPlayers?: number;
}) {
  // Get used colors and models
  const usedColorIndices = players.map((p) => p.tokenColorIndex);
  const usedModelIds = players.map((p) => p.modelId);

  // Add player
  const handleAddPlayer = () => {
    if (players.length >= maxPlayers) return;

    // Find next available color
    const nextColorIndex = TOKEN_COLORS.findIndex(
      (_, idx) => !usedColorIndices.includes(idx)
    );

    const newPlayer: PlayerConfig = {
      id: `player-${Date.now()}`,
      modelId: "",
      displayName: "",
      tokenColorIndex: nextColorIndex >= 0 ? nextColorIndex : 0,
    };

    onChange([...players, newPlayer]);
  };

  // Remove player
  const handleRemovePlayer = (index: number) => {
    if (players.length <= minPlayers) return;
    onChange(players.filter((_, i) => i !== index));
  };

  // Update player
  const handleUpdatePlayer = (index: number, updated: PlayerConfig) => {
    const newPlayers = [...players];
    newPlayers[index] = updated;
    onChange(newPlayers);
  };

  return (
    <div className="space-y-4">
      {players.map((player, index) => (
        <PlayerConfigurator
          key={player.id}
          player={player}
          onChange={(p) => handleUpdatePlayer(index, p)}
          onRemove={() => handleRemovePlayer(index)}
          usedColorIndices={usedColorIndices.filter((_, i) => i !== index)}
          usedModelIds={usedModelIds.filter((_, i) => i !== index)}
          canRemove={players.length > minPlayers}
          playerNumber={index + 1}
        />
      ))}

      {players.length < maxPlayers && (
        <Button
          variant="secondary"
          onClick={handleAddPlayer}
          className="w-full"
        >
          + Add Player
        </Button>
      )}
    </div>
  );
}

// ============================================================
// HELPER: Generate initial players
// ============================================================

export function generateInitialPlayers(count: number = 2): PlayerConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    modelId: "",
    displayName: "",
    tokenColorIndex: i,
  }));
}

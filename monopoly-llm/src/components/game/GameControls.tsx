import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardBody } from "../ui/Card";

// ============================================================
// TYPES
// ============================================================

export interface GameControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  speedMs: number;
  currentTurnNumber: number;
  currentPlayerName?: string;
  currentPlayerColor?: string;
  currentPhase?: string;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speedMs: number) => void;
  onAbandon?: () => void;
}

// ============================================================
// SPEED PRESETS
// ============================================================

const SPEED_OPTIONS = [
  { label: "0.5x", value: 4000, description: "Slow" },
  { label: "1x", value: 2000, description: "Normal" },
  { label: "2x", value: 1000, description: "Fast" },
  { label: "4x", value: 500, description: "Very Fast" },
];

// ============================================================
// ICONS
// ============================================================

function PlayIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

// ============================================================
// GAME CONTROLS COMPONENT
// ============================================================

export function GameControls({
  isPlaying,
  isPaused,
  speedMs,
  currentTurnNumber,
  currentPlayerName,
  currentPlayerColor,
  currentPhase,
  onPlay,
  onPause,
  onSpeedChange,
  onAbandon,
}: GameControlsProps) {
  const currentSpeedOption = SPEED_OPTIONS.find((opt) => opt.value === speedMs);

  return (
    <Card>
      <CardBody className="py-3">
        <div className="flex flex-col gap-3">
          {/* Turn and player info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Turn</span>
              <span className="text-xl font-bold text-white">
                {currentTurnNumber}
              </span>
            </div>
            {currentPhase && (
              <Badge
                variant={
                  currentPhase === "rolling"
                    ? "info"
                    : currentPhase === "game_over"
                      ? "error"
                      : "neutral"
                }
                size="sm"
              >
                {currentPhase.replace("_", " ")}
              </Badge>
            )}
          </div>

          {/* Current player */}
          {currentPlayerName && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: currentPlayerColor || "#666" }}
              />
              <span className="text-sm text-white">{currentPlayerName}</span>
              <span className="text-xs text-slate-500">is playing</span>
            </div>
          )}

          {/* Play/Pause controls */}
          <div className="flex items-center gap-2">
            {isPlaying && !isPaused ? (
              <Button
                variant="secondary"
                size="md"
                onClick={onPause}
                leftIcon={<PauseIcon />}
              >
                Pause
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={onPlay}
                leftIcon={<PlayIcon />}
              >
                {isPaused ? "Resume" : "Start"}
              </Button>
            )}

            {onAbandon && isPlaying && (
              <Button
                variant="danger"
                size="md"
                onClick={onAbandon}
                leftIcon={<StopIcon />}
              >
                Stop
              </Button>
            )}
          </div>

          {/* Speed control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Speed</span>
              <span className="text-xs text-slate-400">
                {currentSpeedOption?.description || `${speedMs}ms`}
              </span>
            </div>
            <div className="flex gap-1">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSpeedChange(option.value)}
                  className={`
                    flex-1 py-1.5 text-xs font-medium rounded transition-colors
                    ${
                      speedMs === option.value
                        ? "bg-green-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================
// COMPACT CONTROLS FOR INLINE USE
// ============================================================

export function GameControlsCompact({
  isPlaying,
  isPaused,
  onPlay,
  onPause,
}: {
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {isPlaying && !isPaused ? (
        <button
          onClick={onPause}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          title="Pause"
        >
          <PauseIcon />
        </button>
      ) : (
        <button
          onClick={onPlay}
          className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          title={isPaused ? "Resume" : "Play"}
        >
          <PlayIcon />
        </button>
      )}
    </div>
  );
}

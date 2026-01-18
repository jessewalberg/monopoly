import { Card, CardBody, CardHeader } from '../ui/Card'
import { DEFAULT_GAME_CONFIG } from '../../lib/models'

// ============================================================
// TYPES
// ============================================================

export interface GameSettingsConfig {
  speedMs: number
  turnLimit?: number
  startingMoney: number
}

export interface GameSettingsProps {
  config: GameSettingsConfig
  onChange: (config: GameSettingsConfig) => void
  showAdvanced?: boolean
}

// ============================================================
// SPEED OPTIONS
// ============================================================

const SPEED_OPTIONS = [
  { label: 'Slow (4s)', value: 4000 },
  { label: 'Normal (2s)', value: 2000 },
  { label: 'Fast (1s)', value: 1000 },
  { label: 'Very Fast (0.5s)', value: 500 },
]

// ============================================================
// TURN LIMIT OPTIONS
// ============================================================

const TURN_LIMIT_OPTIONS = [
  { label: 'No Limit', value: undefined },
  { label: '50 turns', value: 50 },
  { label: '100 turns', value: 100 },
  { label: '200 turns', value: 200 },
  { label: '500 turns', value: 500 },
]

// ============================================================
// STARTING MONEY OPTIONS
// ============================================================

const STARTING_MONEY_OPTIONS = [
  { label: '$1,000', value: 1000 },
  { label: '$1,500 (Standard)', value: 1500 },
  { label: '$2,000', value: 2000 },
  { label: '$3,000', value: 3000 },
]

// ============================================================
// GAME SETTINGS COMPONENT
// ============================================================

export function GameSettings({
  config,
  onChange,
  showAdvanced = false,
}: GameSettingsProps) {
  const handleSpeedChange = (speedMs: number) => {
    onChange({ ...config, speedMs })
  }

  const handleTurnLimitChange = (turnLimit: number | undefined) => {
    onChange({ ...config, turnLimit })
  }

  const handleStartingMoneyChange = (startingMoney: number) => {
    onChange({ ...config, startingMoney })
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-white">Game Settings</h3>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Speed setting */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Game Speed
          </label>
          <p className="text-xs text-slate-500">Time between each turn step</p>
          <div className="grid grid-cols-2 gap-2">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSpeedChange(option.value)}
                className={`
                  py-2 px-3 rounded-lg text-sm font-medium transition-all
                  ${
                    config.speedMs === option.value
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Turn limit */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Turn Limit
          </label>
          <p className="text-xs text-slate-500">
            Maximum turns before game ends (winner by net worth)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TURN_LIMIT_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() => handleTurnLimitChange(option.value)}
                className={`
                  py-2 px-3 rounded-lg text-sm font-medium transition-all
                  ${
                    config.turnLimit === option.value
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced settings */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Advanced Settings
            </h4>

            {/* Starting money */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Starting Money
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STARTING_MONEY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStartingMoneyChange(option.value)}
                    className={`
                      py-2 px-3 rounded-lg text-sm font-medium transition-all
                      ${
                        config.startingMoney === option.value
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export function getDefaultGameSettings(): GameSettingsConfig {
  return {
    speedMs: DEFAULT_GAME_CONFIG.speedMs,
    turnLimit: DEFAULT_GAME_CONFIG.turnLimit,
    startingMoney: DEFAULT_GAME_CONFIG.startingMoney,
  }
}

// ============================================================
// COMPACT SETTINGS PREVIEW
// ============================================================

export function GameSettingsPreview({
  config,
}: {
  config: GameSettingsConfig
}) {
  const speedOption = SPEED_OPTIONS.find((o) => o.value === config.speedMs)
  const turnLimitOption = TURN_LIMIT_OPTIONS.find(
    (o) => o.value === config.turnLimit,
  )

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">
        Speed: {speedOption?.label || `${config.speedMs}ms`}
      </span>
      <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">
        Turns: {turnLimitOption?.label || 'No Limit'}
      </span>
      <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">
        Starting: ${config.startingMoney.toLocaleString()}
      </span>
    </div>
  )
}

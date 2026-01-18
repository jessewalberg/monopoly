import { Card, CardBody, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { PlayerToken } from './PlayerToken'
import { GROUP_COLORS } from './Board'
import type { Id } from '../../../convex/_generated/dataModel'
import type { PropertyGroup } from '../../../convex/lib/constants'

// ============================================================
// TYPES
// ============================================================

export interface PlayerProperty {
  _id: Id<'properties'>
  name: string
  group: string
  houses: number
  isMortgaged: boolean
}

export interface PlayerPanelProps {
  player: {
    _id: Id<'players'>
    modelId: string
    modelDisplayName: string
    tokenColor: string
    textColor: string
    cash: number
    position: number
    inJail: boolean
    isBankrupt: boolean
    getOutOfJailCards: number
    jailTurnsRemaining?: number
  }
  properties: Array<PlayerProperty>
  isCurrentTurn: boolean
  compact?: boolean
}

// ============================================================
// PLAYER PANEL COMPONENT
// ============================================================

export function PlayerPanel({
  player,
  properties,
  isCurrentTurn,
  compact = false,
}: PlayerPanelProps) {
  // Group properties by color group
  const propertiesByGroup = groupPropertiesByGroup(properties)

  if (player.isBankrupt) {
    return (
      <Card className={`relative ${compact ? '' : 'w-64'}`}>
        <CardHeader className="py-2">
          <div className="flex items-center gap-2">
            <PlayerToken player={player} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-400 truncate">
                {player.modelDisplayName}
              </p>
            </div>
          </div>
        </CardHeader>
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
          <span className="text-2xl font-bold text-red-500">BANKRUPT</span>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className={`
        ${compact ? '' : 'w-64'}
        ${isCurrentTurn ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' : ''}
        transition-all duration-200
      `}
    >
      <CardHeader className="py-2">
        <div className="flex items-center gap-2">
          <PlayerToken
            player={player}
            size="sm"
            isCurrentPlayer={isCurrentTurn}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {player.modelDisplayName}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {player.modelId.split('/').pop()}
            </p>
          </div>
          {isCurrentTurn && (
            <Badge variant="success" size="sm">
              Playing
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardBody className="py-2 space-y-3">
        {/* Cash */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Cash</span>
          <span className="text-lg font-bold text-green-400">
            ${player.cash.toLocaleString()}
          </span>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1">
          {player.inJail && (
            <Badge variant="warning" size="sm">
              In Jail{' '}
              {player.jailTurnsRemaining !== undefined &&
                `(${player.jailTurnsRemaining})`}
            </Badge>
          )}
          {player.getOutOfJailCards > 0 && (
            <Badge variant="info" size="sm">
              GOOJ x{player.getOutOfJailCards}
            </Badge>
          )}
        </div>

        {/* Properties */}
        {!compact && properties.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Properties ({properties.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(propertiesByGroup).map(([group, groupProps]) => (
                <PropertyGroupIndicator
                  key={group}
                  group={group as PropertyGroup | 'railroad' | 'utility'}
                  properties={groupProps ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {/* Compact property count */}
        {compact && properties.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Properties</span>
            <span className="text-sm font-medium text-white">
              {properties.length}
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function PropertyGroupIndicator({
  group,
  properties,
}: {
  group: PropertyGroup | 'railroad' | 'utility'
  properties: Array<PlayerProperty>
}) {
  const color = GROUP_COLORS[group] || '#666666'
  const totalHouses = properties.reduce((sum, p) => sum + p.houses, 0)
  const hasMortgaged = properties.some((p) => p.isMortgaged)

  return (
    <div
      className={`
        flex items-center gap-0.5 px-1.5 py-0.5 rounded
        ${hasMortgaged ? 'opacity-50' : ''}
      `}
      style={{
        backgroundColor: `${color}30`,
        borderColor: color,
        borderWidth: 1,
      }}
      title={properties.map((p) => p.name).join(', ')}
    >
      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-white font-medium">
        {properties.length}
      </span>
      {totalHouses > 0 && (
        <span className="text-[10px] text-green-400">+{totalHouses}</span>
      )}
    </div>
  )
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function groupPropertiesByGroup(
  properties: Array<PlayerProperty>,
): Record<string, Array<PlayerProperty> | undefined> {
  const grouped: Record<string, Array<PlayerProperty> | undefined> = {}

  for (const prop of properties) {
    const group = (grouped[prop.group] ??= [])
    group.push(prop)
  }

  return grouped
}

// ============================================================
// PLAYER PANELS LIST
// ============================================================

export function PlayerPanelsList({
  players,
  properties,
  currentPlayerId,
}: {
  players: Array<PlayerPanelProps['player']>
  properties: Array<PlayerProperty & { ownerId?: Id<'players'> }>
  currentPlayerId?: Id<'players'>
}) {
  return (
    <div className="flex flex-col gap-3">
      {players.map((player) => {
        const playerProps = properties.filter((p) => p.ownerId === player._id)
        return (
          <PlayerPanel
            key={player._id}
            player={player}
            properties={playerProps}
            isCurrentTurn={player._id === currentPlayerId}
          />
        )
      })}
    </div>
  )
}

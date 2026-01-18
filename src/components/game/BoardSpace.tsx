import { PlayerToken } from './PlayerToken'
import {
  
  GROUP_COLORS
  
  
} from './Board'
import type {BoardSide, PlayerOnBoard, PropertyOnBoard} from './Board';
import type { BoardSpace, PropertyGroup } from '../../../convex/lib/constants'
import type { Id } from '../../../convex/_generated/dataModel'

// ============================================================
// TYPES
// ============================================================

export interface BoardSpaceProps {
  space: BoardSpace
  propertyState?: PropertyOnBoard & { ownerColor?: string }
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
  side: BoardSide
}

// ============================================================
// LAYOUT HELPERS
// ============================================================

function getColorBandPosition(side: BoardSide): string {
  switch (side) {
    case 'top':
      return 'bottom-0 left-0 right-0 h-[30%]'
    case 'left':
      return 'right-0 top-0 bottom-0 w-[30%]'
    case 'right':
      return 'left-0 top-0 bottom-0 w-[30%]'
    case 'bottom':
    default:
      return 'top-0 left-0 right-0 h-[30%]'
  }
}

function getOwnerIndicatorPosition(side: BoardSide): string {
  switch (side) {
    case 'top':
      return 'top-0.5 left-0.5'
    case 'left':
      return 'bottom-0.5 left-0.5'
    case 'right':
      return 'bottom-0.5 right-0.5'
    case 'bottom':
    default:
      return 'bottom-0.5 left-0.5'
  }
}

function getTextRotationClass(side: BoardSide): string {
  switch (side) {
    case 'top':
      return 'rotate-180'
    case 'left':
      return 'rotate-90'
    case 'right':
      return '-rotate-90'
    case 'bottom':
    default:
      return ''
  }
}

function getContentPaddingClass(side: BoardSide, isVertical: boolean): string {
  if (isVertical) {
    return side === 'left' ? 'pr-[35%]' : 'pl-[35%]'
  }

  return side === 'top' ? 'pb-[35%]' : 'pt-[35%]'
}

function getContentOffsetClass(side: BoardSide): string {
  return side === 'left' ? 'translate-y-0.5' : ''
}

// ============================================================
// HOUSE INDICATOR
// ============================================================

function HouseIndicator({ count, side }: { count: number; side: BoardSide }) {
  if (count === 0) return null

  const isVertical = side === 'left' || side === 'right'
  const positionClass = isVertical ? 'flex-col gap-0.5' : 'flex-row gap-0.5'

  if (count === 5) {
    return (
      <div className={`flex ${positionClass} items-center justify-center`}>
        <div
          className="w-3 h-3 bg-red-600 rounded-sm border border-red-800"
          title="Hotel"
        />
      </div>
    )
  }

  return (
    <div className={`flex ${positionClass} items-center justify-center`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 bg-green-600 rounded-sm border border-green-800"
          title={`${count} house(s)`}
        />
      ))}
    </div>
  )
}

// ============================================================
// PROPERTY SPACE COMPONENT
// ============================================================

function PropertySpaceContent({
  space,
  side,
  isOwned,
  ownerColor,
  isMortgaged,
  houses,
}: {
  space: BoardSpace & { type: 'property'; group: PropertyGroup; cost: number }
  side: BoardSide
  isOwned: boolean
  ownerColor?: string
  isMortgaged: boolean
  houses: number
}) {
  const groupColor = GROUP_COLORS[space.group]
  const colorBandPos = getColorBandPosition(side)
  const isVertical = side === 'left' || side === 'right'
  // Shorten property names
  const shortName = space.name
    .replace(' Avenue', ' Ave')
    .replace(' Place', ' Pl')
    .replace(' Gardens', ' Gdns')
    .replace('Mediterranean', 'Med.')
    .replace('Connecticut', 'Conn.')
    .replace('Pennsylvania', 'Penn.')
    .replace('North Carolina', 'N.C.')
    .replace('St. Charles', 'St.Chas')
    .replace('St. James', 'St.Jas')

  const rotationClass = getTextRotationClass(side)

  const contentPaddingClass = getContentPaddingClass(side, isVertical)

  const contentOffsetClass = getContentOffsetClass(side)

  return (
    <div
      className={`w-full h-full bg-[#D5E8D4] relative overflow-hidden ${isMortgaged ? 'opacity-50' : ''}`}
    >
      {/* Color band on outer edge */}
      <div
        className={`absolute ${colorBandPos} z-0`}
        style={{ backgroundColor: groupColor }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <HouseIndicator count={houses} side={side} />
        </div>
      </div>

      {/* Property content */}
      <div
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${contentPaddingClass} ${contentOffsetClass}`}
      >
        <div
          className={`flex flex-col items-center justify-center gap-0 origin-center ${rotationClass}`}
        >
          <span className="text-[6px] sm:text-[7px] font-bold text-black leading-tight text-center drop-shadow-sm whitespace-nowrap">
            {shortName}
          </span>
          <span
            className={`text-[6px] sm:text-[7px] font-bold leading-tight ${
              isOwned ? 'text-emerald-800' : 'text-green-700'
            }`}
          >
            ${space.cost}
          </span>
        </div>
      </div>

      {/* Owner indicator */}
      {isOwned && ownerColor && (
        <div
          className={`absolute ${getOwnerIndicatorPosition(side)} w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10`}
          style={{ backgroundColor: ownerColor }}
        />
      )}
    </div>
  )
}

// ============================================================
// RAILROAD SPACE COMPONENT
// ============================================================

function RailroadSpaceContent({
  space,
  side,
  isOwned,
  ownerColor,
  isMortgaged,
}: {
  space: BoardSpace & { type: 'railroad'; cost: number }
  side: BoardSide
  isOwned: boolean
  ownerColor?: string
  isMortgaged: boolean
}) {
  const shortName = space.name
    .replace(' Railroad', '')
    .replace('Pennsylvania', 'Penn.')

  const rotationClass = getTextRotationClass(side)

  return (
    <div
      className={`w-full h-full bg-[#D5E8D4] relative overflow-hidden ${isMortgaged ? 'opacity-50' : ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className={`flex flex-col items-center justify-center gap-0 origin-center ${rotationClass}`}
        >
          <svg
            className="w-3 h-3 sm:w-4 sm:h-4 text-black flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L9 7h2v3H8v2h3v3H8v2h3v3h2v-3h3v-2h-3v-3h3v-2h-3V7h2l-3-5zM4 21v2h16v-2H4z" />
          </svg>
          <span className="text-[5px] sm:text-[6px] font-bold text-black text-center leading-tight drop-shadow-sm whitespace-nowrap">
            {shortName}
          </span>
          <span
            className={`text-[5px] sm:text-[6px] font-bold leading-tight ${
              isOwned ? 'text-emerald-800' : 'text-green-700'
            }`}
          >
            ${space.cost}
          </span>
        </div>
      </div>
      {isOwned && ownerColor && (
        <div
          className={`absolute ${getOwnerIndicatorPosition(side)} w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10`}
          style={{ backgroundColor: ownerColor }}
        />
      )}
    </div>
  )
}

// ============================================================
// UTILITY SPACE COMPONENT
// ============================================================

function UtilitySpaceContent({
  space,
  side,
  isOwned,
  ownerColor,
  isMortgaged,
}: {
  space: BoardSpace & { type: 'utility'; cost: number }
  side: BoardSide
  isOwned: boolean
  ownerColor?: string
  isMortgaged: boolean
}) {
  const isElectric = space.name.includes('Electric')

  const rotationClass = getTextRotationClass(side)

  return (
    <div
      className={`w-full h-full bg-[#D5E8D4] relative overflow-hidden ${isMortgaged ? 'opacity-50' : ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className={`flex flex-col items-center justify-center gap-0 origin-center ${rotationClass}`}
        >
          {isElectric ? (
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          ) : (
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z" />
            </svg>
          )}
          <span className="text-[5px] sm:text-[6px] font-bold text-black text-center leading-tight drop-shadow-sm">
            {isElectric ? 'ELEC' : 'WATER'}
          </span>
          <span
            className={`text-[5px] sm:text-[6px] font-bold leading-tight ${
              isOwned ? 'text-emerald-800' : 'text-green-700'
            }`}
          >
            ${space.cost}
          </span>
        </div>
      </div>
      {isOwned && ownerColor && (
        <div
          className={`absolute ${getOwnerIndicatorPosition(side)} w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10`}
          style={{ backgroundColor: ownerColor }}
        />
      )}
    </div>
  )
}

// ============================================================
// CORNER SPACES
// ============================================================

function GoSpace({
  players,
  currentPlayerId,
}: {
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  return (
    <div className="w-full h-full bg-[#D5E8D4] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Arrow pointing diagonally toward bottom-left (clockwise direction around the board) */}
      <div className="absolute top-0.5 left-0.5 transform rotate-[225deg]">
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 text-red-600"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </div>
      <span className="text-[6px] sm:text-[7px] text-red-600 font-bold">
        COLLECT
      </span>
      <span className="text-[6px] sm:text-[7px] text-red-600 font-bold">
        $200
      </span>
      <span className="text-base sm:text-lg font-black text-red-600 -rotate-45 mt-0.5">
        GO
      </span>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
      />
    </div>
  )
}

function JailSpace({
  players,
  currentPlayerId,
}: {
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  const visiting = players.filter((p) => !p.inJail)
  const inJail = players.filter((p) => p.inJail)

  return (
    <div className="w-full h-full bg-[#D5E8D4] flex flex-col items-center justify-between p-0.5 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[30%] flex items-center justify-center overflow-hidden">
        <span
          className="text-[4px] sm:text-[5px] font-bold text-black drop-shadow-sm"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
        >
          VISIT
        </span>
      </div>

      <div className="absolute right-0 top-0 w-[70%] h-[70%] bg-orange-400 border border-black flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex justify-around items-stretch">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-px h-full bg-black" />
          ))}
        </div>
        <span className="text-[5px] sm:text-[6px] font-bold text-black z-10 bg-orange-400 px-0.5">
          JAIL
        </span>

        {inJail.length > 0 && (
          <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
            {inJail.map((player) => (
              <PlayerToken
                key={player._id}
                player={player}
                isCurrentPlayer={player._id === currentPlayerId}
                size="xs"
              />
            ))}
          </div>
        )}
      </div>

      {visiting.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
          {visiting.map((player) => (
            <PlayerToken
              key={player._id}
              player={player}
              isCurrentPlayer={player._id === currentPlayerId}
              size="xs"
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FreeParkingSpace({
  players,
  currentPlayerId,
}: {
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  return (
    <div className="w-full h-full bg-[#D5E8D4] flex flex-col items-center justify-center relative overflow-hidden">
      <span className="text-[6px] sm:text-[7px] font-bold text-black drop-shadow-sm">
        FREE
      </span>
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6 text-red-600"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z" />
      </svg>
      <span className="text-[5px] sm:text-[6px] font-bold text-black drop-shadow-sm">
        PARKING
      </span>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
      />
    </div>
  )
}

function GoToJailSpace({
  players,
  currentPlayerId,
}: {
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  return (
    <div className="w-full h-full bg-[#D5E8D4] flex flex-col items-center justify-center relative overflow-hidden">
      <span className="text-[5px] sm:text-[6px] font-bold text-black drop-shadow-sm">
        GO TO
      </span>
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6 text-black"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
      </svg>
      <span className="text-[6px] sm:text-[7px] font-bold text-black drop-shadow-sm">
        JAIL
      </span>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
      />
    </div>
  )
}

// ============================================================
// CARD SPACES (Chance & Community Chest)
// ============================================================

function ChanceSpace({
  side,
  players,
  currentPlayerId,
}: {
  side: BoardSide
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  const rotationClass = getTextRotationClass(side)

  const contentOffsetClass = getContentOffsetClass(side)

  return (
    <div className="w-full h-full bg-[#D5E8D4] flex items-center justify-center relative overflow-hidden">
      <div
        className={`flex items-center gap-0.5 origin-center ${rotationClass} ${contentOffsetClass}`}
      >
        <span className="text-[5px] sm:text-[6px] font-bold text-orange-600 drop-shadow-sm">
          CHANCE
        </span>
        <span className="text-sm sm:text-base font-bold text-orange-500">
          ?
        </span>
      </div>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
        side={side}
      />
    </div>
  )
}

function CommunityChestSpace({
  side,
  players,
  currentPlayerId,
}: {
  side: BoardSide
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  const rotationClass = getTextRotationClass(side)

  const contentOffsetClass = getContentOffsetClass(side)

  return (
    <div className="w-full h-full bg-[#D5E8D4] flex items-center justify-center relative overflow-hidden">
      <div
        className={`flex items-center gap-0.5 origin-center ${rotationClass} ${contentOffsetClass}`}
      >
        <svg
          className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM10 4h4v2h-4V4zm6 11h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z" />
        </svg>
        <span className="text-[4px] sm:text-[5px] font-bold text-blue-600 drop-shadow-sm">
          CHEST
        </span>
      </div>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
        side={side}
      />
    </div>
  )
}

// ============================================================
// TAX SPACE
// ============================================================

function TaxSpace({
  space,
  side,
  players,
  currentPlayerId,
}: {
  space: BoardSpace & { type: 'tax'; amount: number }
  side: BoardSide
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
}) {
  const isIncome = space.name.includes('Income')
  const rotationClass = getTextRotationClass(side)

  const contentOffsetClass = getContentOffsetClass(side)

  return (
    <div className="w-full h-full bg-[#D5E8D4] flex items-center justify-center relative overflow-hidden">
      <div
        className={`flex flex-col items-center gap-0 origin-center ${rotationClass} ${contentOffsetClass}`}
      >
        <svg
          className="w-3 h-3 text-black flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84z" />
        </svg>
        <span className="text-[5px] sm:text-[6px] font-bold text-black drop-shadow-sm">
          {isIncome ? 'TAX' : 'LUX'}
        </span>
        <span className="text-[5px] sm:text-[6px] font-bold text-black drop-shadow-sm">
          ${space.amount}
        </span>
      </div>
      <PlayerTokensOverlay
        players={players}
        currentPlayerId={currentPlayerId}
        side={side}
      />
    </div>
  )
}

// ============================================================
// MAIN BOARD SPACE COMPONENT
// ============================================================

export function BoardSpaceComponent({
  space,
  propertyState,
  players,
  currentPlayerId,
  side,
}: BoardSpaceProps) {
  const isOwned = propertyState?.ownerId !== undefined
  const ownerColor = propertyState?.ownerColor
  const isMortgaged = propertyState?.isMortgaged || false
  const houses = propertyState?.houses || 0

  switch (space.type) {
    case 'property':
      return (
        <div className="w-full h-full relative">
          <PropertySpaceContent
            space={space}
            side={side}
            isOwned={isOwned}
            ownerColor={ownerColor}
            isMortgaged={isMortgaged}
            houses={houses}
          />
          <PlayerTokensOverlay
            players={players}
            currentPlayerId={currentPlayerId}
            side={side}
          />
        </div>
      )

    case 'railroad':
      return (
        <div className="w-full h-full relative">
          <RailroadSpaceContent
            space={space}
            side={side}
            isOwned={isOwned}
            ownerColor={ownerColor}
            isMortgaged={isMortgaged}
          />
          <PlayerTokensOverlay
            players={players}
            currentPlayerId={currentPlayerId}
            side={side}
          />
        </div>
      )

    case 'utility':
      return (
        <div className="w-full h-full relative">
          <UtilitySpaceContent
            space={space}
            side={side}
            isOwned={isOwned}
            ownerColor={ownerColor}
            isMortgaged={isMortgaged}
          />
          <PlayerTokensOverlay
            players={players}
            currentPlayerId={currentPlayerId}
            side={side}
          />
        </div>
      )

    case 'go':
      return <GoSpace players={players} currentPlayerId={currentPlayerId} />

    case 'jail':
      return <JailSpace players={players} currentPlayerId={currentPlayerId} />

    case 'free_parking':
      return (
        <FreeParkingSpace players={players} currentPlayerId={currentPlayerId} />
      )

    case 'go_to_jail':
      return (
        <GoToJailSpace players={players} currentPlayerId={currentPlayerId} />
      )

    case 'chance':
      return (
        <ChanceSpace
          side={side}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      )

    case 'community_chest':
      return (
        <CommunityChestSpace
          side={side}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      )

    case 'tax':
      return (
        <TaxSpace
          space={space}
          side={side}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      )
  }

  const _exhaustiveCheck: never = space
  return _exhaustiveCheck
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function getTokenPosition(side: BoardSide): string {
  switch (side) {
    case 'top':
      return 'top-0.5 right-0.5'
    case 'left':
      return 'bottom-0.5 left-0.5'
    case 'right':
      return 'bottom-0.5 right-0.5'
    case 'bottom':
      return 'bottom-0.5 right-0.5'
    case 'corner':
    default:
      return 'bottom-0.5 right-0.5'
  }
}

function PlayerTokensOverlay({
  players,
  currentPlayerId,
  side = 'corner',
}: {
  players: Array<PlayerOnBoard>
  currentPlayerId?: Id<'players'>
  side?: BoardSide
}) {
  if (players.length === 0) return null

  const positionClass = getTokenPosition(side)

  return (
    <div
      className={`absolute ${positionClass} flex flex-wrap gap-0.5 justify-end max-w-full z-10`}
    >
      {players.map((player) => (
        <PlayerToken
          key={player._id}
          player={player}
          isCurrentPlayer={player._id === currentPlayerId}
          size="xs"
        />
      ))}
    </div>
  )
}

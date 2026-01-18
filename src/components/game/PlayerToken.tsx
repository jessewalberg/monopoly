import type { Id } from '../../../convex/_generated/dataModel'

// ============================================================
// TYPES
// ============================================================

export interface PlayerTokenProps {
  player: {
    _id: Id<'players'>
    modelDisplayName: string
    tokenColor: string
    textColor: string
  }
  isCurrentPlayer?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  offset?: number // For stacking multiple tokens
  showName?: boolean
}

// ============================================================
// SIZE STYLES
// ============================================================

const sizeStyles = {
  xs: {
    container: 'w-3 h-3',
    text: 'text-[4px]',
    ring: 'ring-1',
  },
  sm: {
    container: 'w-5 h-5',
    text: 'text-[6px]',
    ring: 'ring-1',
  },
  md: {
    container: 'w-8 h-8',
    text: 'text-xs',
    ring: 'ring-2',
  },
  lg: {
    container: 'w-10 h-10',
    text: 'text-sm',
    ring: 'ring-2',
  },
}

// ============================================================
// PLAYER TOKEN COMPONENT
// ============================================================

export function PlayerToken({
  player,
  isCurrentPlayer = false,
  size = 'md',
  offset = 0,
  showName = false,
}: PlayerTokenProps) {
  const styles = sizeStyles[size]

  // Get initials from model name
  const initials = getInitials(player.modelDisplayName)

  // Stack offset for multiple tokens on same space
  const offsetStyles =
    offset > 0
      ? {
          transform: `translate(${offset * -3}px, ${offset * -3}px)`,
          zIndex: offset,
        }
      : {}

  return (
    <div className="flex flex-col items-center gap-0.5" style={offsetStyles}>
      <div
        className={`
          ${styles.container}
          rounded-full
          flex items-center justify-center
          font-bold
          shadow-md
          ${isCurrentPlayer ? `${styles.ring} ring-yellow-400 ring-offset-1 ring-offset-slate-900` : ''}
          transition-all duration-200
        `}
        style={{
          backgroundColor: player.tokenColor,
          color: player.textColor,
        }}
        title={player.modelDisplayName}
      >
        <span className={styles.text}>{initials}</span>
      </div>
      {showName && (
        <span className="text-[8px] text-slate-300 whitespace-nowrap max-w-12 truncate">
          {player.modelDisplayName}
        </span>
      )}
    </div>
  )
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getInitials(name: string): string {
  // Handle common model names
  const words = name.split(/[\s-]+/)

  if (words.length === 1) {
    // Single word: take first 2 characters
    return words[0].slice(0, 2).toUpperCase()
  }

  // Multiple words: take first letter of first 2 words
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ============================================================
// TOKEN COLOR PREVIEW
// ============================================================

export function TokenColorPreview({
  color,
  textColor,
  selected = false,
}: {
  color: string
  textColor: string
  selected?: boolean
}) {
  return (
    <div
      className={`
        w-6 h-6 rounded-full
        flex items-center justify-center
        cursor-pointer
        transition-transform
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110'}
      `}
      style={{ backgroundColor: color, color: textColor }}
    >
      {selected && (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  )
}

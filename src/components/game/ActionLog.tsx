import { useEffect, useRef } from 'react'
import { Card, CardBody, CardHeader } from '../ui/Card'

// ============================================================
// TYPES
// ============================================================

export type ActionEventType =
  | 'roll'
  | 'move'
  | 'purchase'
  | 'rent'
  | 'card'
  | 'jail'
  | 'build'
  | 'mortgage'
  | 'trade'
  | 'bankrupt'
  | 'system'
  | 'decision'

export interface ActionEvent {
  id: string
  timestamp: number
  type: ActionEventType
  message: string
  playerName?: string
  playerColor?: string
  details?: string
}

export interface ActionLogProps {
  events: Array<ActionEvent>
  maxHeight?: string
  autoScroll?: boolean
  showTimestamps?: boolean
}

// ============================================================
// EVENT TYPE STYLES
// ============================================================

const eventTypeConfig: Record<
  ActionEventType,
  { icon: string; bgColor: string; textColor: string }
> = {
  roll: { icon: '🎲', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
  move: { icon: '👟', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
  purchase: {
    icon: '🏠',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400',
  },
  rent: {
    icon: '💰',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  card: {
    icon: '🃏',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  jail: {
    icon: '🔒',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  build: { icon: '🏗️', bgColor: 'bg-teal-500/20', textColor: 'text-teal-400' },
  mortgage: { icon: '📄', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
  trade: {
    icon: '🤝',
    bgColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-400',
  },
  bankrupt: { icon: '💀', bgColor: 'bg-red-600/20', textColor: 'text-red-500' },
  system: {
    icon: '⚙️',
    bgColor: 'bg-slate-600/20',
    textColor: 'text-slate-500',
  },
  decision: {
    icon: '🤔',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
  },
}

// ============================================================
// ACTION LOG COMPONENT
// ============================================================

export function ActionLog({
  events,
  maxHeight = '400px',
  autoScroll = true,
  showTimestamps = false,
}: ActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, autoScroll])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Action Log</h3>
          <span className="text-xs text-slate-500">{events.length} events</span>
        </div>
      </CardHeader>
      <CardBody className="p-0 flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="overflow-y-auto h-full p-2 space-y-1.5"
          style={{ maxHeight }}
        >
          {events.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No events yet
            </p>
          ) : (
            events.map((event) => (
              <ActionEventRow
                key={event.id}
                event={event}
                showTimestamp={showTimestamps}
              />
            ))
          )}
        </div>
      </CardBody>
    </Card>
  )
}

// ============================================================
// ACTION EVENT ROW
// ============================================================

function ActionEventRow({
  event,
  showTimestamp,
}: {
  event: ActionEvent
  showTimestamp: boolean
}) {
  const config = eventTypeConfig[event.type]

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <div
      className={`
        flex items-start gap-2 px-2 py-1.5 rounded
        ${config.bgColor}
      `}
    >
      <span className="text-sm flex-shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Player name on its own line if present */}
        {event.playerName && (
          <span
            className="inline-block text-xs font-medium px-1.5 rounded mb-0.5"
            style={{
              backgroundColor: event.playerColor || '#666',
              color: '#fff',
            }}
          >
            {event.playerName}
          </span>
        )}
        {/* Message text - wraps properly */}
        <p className={`text-sm ${config.textColor} break-words leading-snug`}>
          {event.message}
        </p>
        {event.details && (
          <p className="text-xs text-slate-500 mt-0.5 break-words">
            {event.details}
          </p>
        )}
      </div>
      {showTimestamp && (
        <span className="text-[10px] text-slate-600 flex-shrink-0">
          {formatTime(event.timestamp)}
        </span>
      )}
    </div>
  )
}

// ============================================================
// HELPER FUNCTION TO CREATE EVENTS
// ============================================================

export function createActionEvent(
  type: ActionEventType,
  message: string,
  options?: {
    playerName?: string
    playerColor?: string
    details?: string
  },
): ActionEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    message,
    ...options,
  }
}

// ============================================================
// TURN EVENTS TO ACTION EVENTS
// Converts turn event strings to ActionEvent objects
// ============================================================

export function parseTurnEvents(
  events: Array<string>,
  playerName?: string,
  playerColor?: string,
  baseTimestamp?: number,
): Array<ActionEvent> {
  return events.map((eventStr, index) => {
    const type = inferEventType(eventStr)
    const timestamp = (baseTimestamp || Date.now()) + index * 100

    return {
      id: `${timestamp}-${index}`,
      timestamp,
      type,
      message: eventStr,
      playerName,
      playerColor,
    }
  })
}

function inferEventType(message: string): ActionEventType {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('rolled') || lowerMessage.includes('dice'))
    return 'roll'
  if (lowerMessage.includes('moved') || lowerMessage.includes('landed'))
    return 'move'
  if (lowerMessage.includes('bought') || lowerMessage.includes('purchased'))
    return 'purchase'
  if (lowerMessage.includes('rent') || lowerMessage.includes('paid'))
    return 'rent'
  if (
    lowerMessage.includes('chance') ||
    lowerMessage.includes('community chest') ||
    lowerMessage.includes('drew')
  )
    return 'card'
  if (lowerMessage.includes('jail')) return 'jail'
  if (lowerMessage.includes('built') || lowerMessage.includes('house'))
    return 'build'
  if (lowerMessage.includes('mortgage')) return 'mortgage'
  if (lowerMessage.includes('trade')) return 'trade'
  if (lowerMessage.includes('bankrupt')) return 'bankrupt'
  if (lowerMessage.includes('game') || lowerMessage.includes('turn'))
    return 'system'

  return 'system'
}

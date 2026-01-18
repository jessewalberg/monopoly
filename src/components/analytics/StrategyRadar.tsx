import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

// ============================================================
// TYPES
// ============================================================

export interface StrategyProfile {
  modelId: string
  modelDisplayName: string
  buyRate: number // 0-1: How often they buy when possible
  tradeFrequency: number // 0-1: How often they propose trades
  buildSpeed: number // 0-1: How quickly they build houses
  riskTolerance: number // 0-1: Willingness to spend down cash
  jailStrategy: string // "pay", "roll", "use_card", "unknown"
}

export interface StrategyRadarProps {
  profiles: Array<StrategyProfile>
  height?: number
}

// ============================================================
// STRATEGY COLORS
// ============================================================

const PROFILE_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
]

// ============================================================
// STRATEGY RADAR CHART
// ============================================================

export function StrategyRadar({ profiles, height = 400 }: StrategyRadarProps) {
  if (profiles.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p>No strategy data available</p>
          <p className="text-sm mt-1">Play some games to see AI strategies!</p>
        </div>
      </div>
    )
  }

  // Transform data for radar chart
  // Each axis is a strategy dimension
  const axes = [
    { key: 'buyRate', label: 'Property Buying' },
    { key: 'tradeFrequency', label: 'Trading' },
    { key: 'buildSpeed', label: 'Building' },
    { key: 'riskTolerance', label: 'Risk Taking' },
  ]

  // Create data points for each axis
  const chartData = axes.map((axis) => {
    const point: Record<string, string | number> = {
      axis: axis.label,
    }

    for (const profile of profiles) {
      // Normalize to 0-100 for display
      const value = (profile[axis.key as keyof StrategyProfile] as number) * 100
      point[profile.modelId] = Math.round(value)
    }

    return point
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart
        data={chartData}
        margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
      >
        <PolarGrid stroke="#475569" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#6b7280', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#f1f5f9' }}
          formatter={(value, name) => {
            const profile = profiles.find((p) => p.modelId === String(name))
            return [`${value}%`, profile?.modelDisplayName || String(name)]
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value) => {
            const profile = profiles.find((p) => p.modelId === value)
            return profile?.modelDisplayName || value
          }}
        />
        {profiles.map((profile, index) => (
          <Radar
            key={profile.modelId}
            name={profile.modelId}
            dataKey={profile.modelId}
            stroke={PROFILE_COLORS[index % PROFILE_COLORS.length]}
            fill={PROFILE_COLORS[index % PROFILE_COLORS.length]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ============================================================
// STRATEGY PROFILE CARD (Single model)
// ============================================================

export interface StrategyProfileCardProps {
  profile: StrategyProfile
  color?: string
}

export function StrategyProfileCard({
  profile,
  color = '#22c55e',
}: StrategyProfileCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-lg font-bold text-white">
          {profile.modelDisplayName}
        </h3>
      </div>

      <div className="space-y-3">
        <StrategyBar
          label="Property Buying"
          value={profile.buyRate}
          color={color}
          description={getDescriptionForValue(profile.buyRate, 'buyRate')}
        />
        <StrategyBar
          label="Trading"
          value={profile.tradeFrequency}
          color={color}
          description={getDescriptionForValue(
            profile.tradeFrequency,
            'trading',
          )}
        />
        <StrategyBar
          label="Building Speed"
          value={profile.buildSpeed}
          color={color}
          description={getDescriptionForValue(profile.buildSpeed, 'building')}
        />
        <StrategyBar
          label="Risk Tolerance"
          value={profile.riskTolerance}
          color={color}
          description={getDescriptionForValue(profile.riskTolerance, 'risk')}
        />

        <div className="pt-2 border-t border-slate-700">
          <div className="text-xs text-slate-400">Jail Strategy</div>
          <div className="text-sm text-white font-medium capitalize">
            {formatJailStrategy(profile.jailStrategy)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

interface StrategyBarProps {
  label: string
  value: number
  color: string
  description: string
}

function StrategyBar({ label, value, color, description }: StrategyBarProps) {
  const percent = Math.round(value * 100)

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-medium text-white">{percent}%</span>
      </div>
      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </div>
  )
}

// ============================================================
// STRATEGY COMPARISON TABLE
// ============================================================

export interface StrategyComparisonTableProps {
  profiles: Array<StrategyProfile>
}

export function StrategyComparisonTable({
  profiles,
}: StrategyComparisonTableProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>No profiles to compare</p>
      </div>
    )
  }

  const metrics = [
    { key: 'buyRate', label: 'Property Buying' },
    { key: 'tradeFrequency', label: 'Trade Frequency' },
    { key: 'buildSpeed', label: 'Build Speed' },
    { key: 'riskTolerance', label: 'Risk Tolerance' },
    { key: 'jailStrategy', label: 'Jail Strategy' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
            <th className="pb-3 px-2">Metric</th>
            {profiles.map((profile, index) => (
              <th key={profile.modelId} className="pb-3 px-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        PROFILE_COLORS[index % PROFILE_COLORS.length],
                    }}
                  />
                  <span className="text-white">{profile.modelDisplayName}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr
              key={metric.key}
              className="border-b border-slate-700/50 hover:bg-slate-700/20"
            >
              <td className="py-3 px-2 text-slate-300">{metric.label}</td>
              {profiles.map((profile) => {
                const value = profile[metric.key as keyof StrategyProfile]

                if (metric.key === 'jailStrategy') {
                  return (
                    <td key={profile.modelId} className="py-3 px-2">
                      <span className="text-white capitalize">
                        {formatJailStrategy(value as string)}
                      </span>
                    </td>
                  )
                }

                const numValue = value as number
                const percent = Math.round(numValue * 100)

                return (
                  <td key={profile.modelId} className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor:
                              PROFILE_COLORS[
                                profiles.indexOf(profile) %
                                  PROFILE_COLORS.length
                              ],
                          }}
                        />
                      </div>
                      <span className="text-white text-sm">{percent}%</span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// STRATEGY SUMMARY BADGES
// ============================================================

export interface StrategySummaryBadgesProps {
  profile: StrategyProfile
}

export function StrategySummaryBadges({ profile }: StrategySummaryBadgesProps) {
  const badges: Array<{ label: string; color: string }> = []

  // Determine personality traits based on values
  if (profile.buyRate > 0.7) {
    badges.push({ label: 'Property Hungry', color: '#22c55e' })
  } else if (profile.buyRate < 0.3) {
    badges.push({ label: 'Selective Buyer', color: '#f59e0b' })
  }

  if (profile.tradeFrequency > 0.5) {
    badges.push({ label: 'Active Trader', color: '#3b82f6' })
  }

  if (profile.buildSpeed > 0.6) {
    badges.push({ label: 'Fast Builder', color: '#8b5cf6' })
  }

  if (profile.riskTolerance > 0.7) {
    badges.push({ label: 'High Roller', color: '#ef4444' })
  } else if (profile.riskTolerance < 0.3) {
    badges.push({ label: 'Conservative', color: '#6b7280' })
  }

  if (profile.jailStrategy === 'pay') {
    badges.push({ label: 'Jail Payer', color: '#ec4899' })
  } else if (profile.jailStrategy === 'roll') {
    badges.push({ label: 'Gambler', color: '#f97316' })
  }

  if (badges.length === 0) {
    badges.push({ label: 'Balanced', color: '#6b7280' })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge, index) => (
        <span
          key={index}
          className="px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: badge.color }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  )
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDescriptionForValue(value: number, type: string): string {
  if (type === 'buyRate') {
    if (value > 0.7) return 'Buys most properties when possible'
    if (value > 0.4) return 'Moderate property acquisition'
    return 'Very selective about purchases'
  }

  if (type === 'trading') {
    if (value > 0.5) return 'Frequently proposes trades'
    if (value > 0.2) return 'Occasionally trades'
    return 'Rarely initiates trades'
  }

  if (type === 'building') {
    if (value > 0.6) return 'Builds houses quickly'
    if (value > 0.3) return 'Builds at moderate pace'
    return 'Prefers to hold cash'
  }

  if (type === 'risk') {
    if (value > 0.7) return 'Willing to risk low cash reserves'
    if (value > 0.4) return 'Balanced approach to spending'
    return 'Maintains safe cash cushion'
  }

  return ''
}

function formatJailStrategy(strategy: string): string {
  switch (strategy) {
    case 'pay':
      return 'Pays to get out'
    case 'roll':
      return 'Rolls for doubles'
    case 'use_card':
      return 'Uses Get Out cards'
    default:
      return 'Unknown'
  }
}

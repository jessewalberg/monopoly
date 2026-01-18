import { useState } from 'react'

// ============================================================
// TYPES
// ============================================================

export interface PropertyStatData {
  propertyName: string
  propertyGroup: string
  position: number
  timesPurchased: number
  timesAuctioned: number
  avgPurchasePrice: number
  avgAuctionPrice: number
  totalRentCollected: number
  avgRentPerGame: number
  ownerWinRate: number
}

export interface PropertyHeatmapProps {
  data: Array<PropertyStatData>
  metric?: 'ownerWinRate' | 'timesPurchased' | 'avgRentPerGame'
  showBoard?: boolean
}

// ============================================================
// PROPERTY GROUP COLORS
// ============================================================

const GROUP_COLORS: Record<string, string> = {
  brown: '#8B4513',
  light_blue: '#87CEEB',
  pink: '#FF69B4',
  orange: '#FFA500',
  red: '#FF0000',
  yellow: '#FFFF00',
  green: '#228B22',
  dark_blue: '#0000CD',
  railroad: '#4B4B4B',
  utility: '#808080',
}

// ============================================================
// PROPERTY HEATMAP COMPONENT
// ============================================================

export function PropertyHeatmap({
  data,
  metric = 'ownerWinRate',
  showBoard = false,
}: PropertyHeatmapProps) {
  const [selectedProperty, setSelectedProperty] =
    useState<PropertyStatData | null>(null)
  const [currentMetric, setCurrentMetric] = useState(metric)

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-2">🏠</div>
        <p>No property data available</p>
        <p className="text-sm mt-1">
          Play some games to see property statistics!
        </p>
      </div>
    )
  }

  // Get value for current metric
  const getValue = (prop: PropertyStatData): number => {
    switch (currentMetric) {
      case 'timesPurchased':
        return prop.timesPurchased
      case 'avgRentPerGame':
        return prop.avgRentPerGame
      case 'ownerWinRate':
      default:
        return prop.ownerWinRate
    }
  }

  // Get max value for normalization
  const maxValue = Math.max(...data.map(getValue))

  // Get intensity color
  const getIntensityColor = (value: number): string => {
    const intensity = maxValue > 0 ? value / maxValue : 0
    // Green gradient from dark to light
    const r = Math.round(34 + (1 - intensity) * 100)
    const g = Math.round(197 - (1 - intensity) * 100)
    const b = Math.round(94 - (1 - intensity) * 50)
    return `rgb(${r}, ${g}, ${b})`
  }

  // Group properties by color group
  const groupedProperties = data.reduce<
    Record<string, Array<PropertyStatData> | undefined>
  >((acc, prop) => {
    const group = (acc[prop.propertyGroup] ??= [])
    group.push(prop)
    return acc
  }, {})

  // Sort groups in traditional Monopoly order
  const groupOrder = [
    'brown',
    'light_blue',
    'pink',
    'orange',
    'red',
    'yellow',
    'green',
    'dark_blue',
    'railroad',
    'utility',
  ]

  const sortedGroups = groupOrder.filter((g) => groupedProperties[g]?.length)

  if (showBoard) {
    return (
      <PropertyBoardView
        data={data}
        metric={currentMetric}
        onPropertySelect={setSelectedProperty}
        selectedProperty={selectedProperty}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Metric Selector */}
      <div className="flex gap-2">
        <MetricButton
          label="Buyer Win Rate"
          active={currentMetric === 'ownerWinRate'}
          onClick={() => setCurrentMetric('ownerWinRate')}
        />
        <MetricButton
          label="Purchases"
          active={currentMetric === 'timesPurchased'}
          onClick={() => setCurrentMetric('timesPurchased')}
        />
        <MetricButton
          label="Avg Rent"
          active={currentMetric === 'avgRentPerGame'}
          onClick={() => setCurrentMetric('avgRentPerGame')}
        />
      </div>

      {/* Property Grid by Group */}
      <div className="space-y-4">
        {sortedGroups.map((group) => (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: GROUP_COLORS[group] || '#666' }}
              />
              <span className="text-sm font-medium text-slate-300 capitalize">
                {group.replace('_', ' ')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {(groupedProperties[group] ?? [])
                .sort((a, b) => a.position - b.position)
                .map((prop) => (
                  <PropertyCard
                    key={prop.propertyName}
                    property={prop}
                    value={getValue(prop)}
                    maxValue={maxValue}
                    metric={currentMetric}
                    isSelected={
                      selectedProperty?.propertyName === prop.propertyName
                    }
                    onClick={() => setSelectedProperty(prop)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Property Detail */}
      {selectedProperty && (
        <PropertyDetail
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 pt-4">
        <span className="text-xs text-slate-500">Low</span>
        <div className="flex h-3 w-32 rounded overflow-hidden">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <div
              key={intensity}
              className="flex-1"
              style={{
                backgroundColor: getIntensityColor(intensity * maxValue),
              }}
            />
          ))}
        </div>
        <span className="text-xs text-slate-500">High</span>
      </div>
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function MetricButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm transition-colors ${
        active
          ? 'bg-green-600 text-white'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  )
}

interface PropertyCardProps {
  property: PropertyStatData
  value: number
  maxValue: number
  metric: string
  isSelected: boolean
  onClick: () => void
}

function PropertyCard({
  property,
  value,
  maxValue,
  metric,
  isSelected,
  onClick,
}: PropertyCardProps) {
  const intensity = maxValue > 0 ? value / maxValue : 0

  // Calculate background color based on intensity
  const bgOpacity = 0.2 + intensity * 0.6
  const groupColor = GROUP_COLORS[property.propertyGroup] || '#666'

  // Format display value
  const displayValue =
    metric === 'ownerWinRate'
      ? `${Math.round(value * 100)}%`
      : metric === 'avgRentPerGame'
        ? `$${Math.round(value)}`
        : value.toString()

  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-lg text-left transition-all hover:scale-105 ${
        isSelected ? 'ring-2 ring-white' : ''
      }`}
      style={{
        backgroundColor: `rgba(${hexToRgb(groupColor)}, ${bgOpacity})`,
        borderLeft: `4px solid ${groupColor}`,
      }}
    >
      <div className="text-xs text-white font-medium truncate">
        {property.propertyName}
      </div>
      <div className="text-lg font-bold text-white">{displayValue}</div>
    </button>
  )
}

interface PropertyDetailProps {
  property: PropertyStatData
  onClose: () => void
}

function PropertyDetail({ property, onClose }: PropertyDetailProps) {
  const groupColor = GROUP_COLORS[property.propertyGroup] || '#666'

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: groupColor }}
          />
          <h3 className="text-lg font-bold text-white">
            {property.propertyName}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatItem
          label="Buyer Win Rate"
          value={`${Math.round(property.ownerWinRate * 100)}%`}
        />
        <StatItem
          label="Times Purchased"
          value={property.timesPurchased.toString()}
        />
        <StatItem
          label="Times Auctioned"
          value={property.timesAuctioned.toString()}
        />
        <StatItem
          label="Avg Purchase Price"
          value={`$${Math.round(property.avgPurchasePrice)}`}
        />
        <StatItem
          label="Avg Auction Price"
          value={`$${Math.round(property.avgAuctionPrice)}`}
        />
        <StatItem
          label="Total Rent Collected"
          value={`$${property.totalRentCollected.toLocaleString()}`}
        />
        <StatItem
          label="Avg Rent/Game"
          value={`$${Math.round(property.avgRentPerGame)}`}
        />
        <StatItem label="Board Position" value={property.position.toString()} />
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  )
}

// ============================================================
// BOARD VIEW (simplified visual representation)
// ============================================================

interface PropertyBoardViewProps {
  data: Array<PropertyStatData>
  metric: string
  onPropertySelect: (prop: PropertyStatData | null) => void
  selectedProperty: PropertyStatData | null
}

function PropertyBoardView({
  data,
  metric,
  onPropertySelect,
  selectedProperty,
}: PropertyBoardViewProps) {
  // Create a map for easy lookup
  const propertyMap = new Map(data.map((p) => [p.position, p]))

  // Get max value for current metric
  const getValue = (prop: PropertyStatData): number => {
    switch (metric) {
      case 'timesPurchased':
        return prop.timesPurchased
      case 'avgRentPerGame':
        return prop.avgRentPerGame
      case 'ownerWinRate':
      default:
        return prop.ownerWinRate
    }
  }

  const maxValue = Math.max(...data.map(getValue))

  // Board positions (0-39)
  const positions = Array.from({ length: 40 }, (_, i) => i)

  // Property positions only (exclude special spaces)
  const propertyPositions = [
    1,
    3,
    6,
    8,
    9,
    11,
    13,
    14,
    16,
    18,
    19,
    21,
    23,
    24,
    26,
    27,
    29,
    31,
    32,
    34,
    37,
    39,
    5,
    15,
    25,
    35, // Railroads
    12,
    28, // Utilities
  ]

  return (
    <div className="grid grid-cols-11 gap-1 p-4 bg-slate-900 rounded-lg">
      {positions.map((pos) => {
        const property = propertyMap.get(pos)
        const isPropertySpace = propertyPositions.includes(pos)

        if (!isPropertySpace || !property) {
          return (
            <div
              key={pos}
              className="aspect-square bg-slate-800/50 rounded text-xs flex items-center justify-center text-slate-600"
            >
              {pos}
            </div>
          )
        }

        const value = getValue(property)
        const intensity = maxValue > 0 ? value / maxValue : 0
        const groupColor = GROUP_COLORS[property.propertyGroup] || '#666'

        return (
          <button
            key={pos}
            onClick={() => onPropertySelect(property)}
            className={`aspect-square rounded text-xs flex items-center justify-center transition-all hover:scale-110 ${
              selectedProperty?.position === pos ? 'ring-2 ring-white' : ''
            }`}
            style={{
              backgroundColor: `rgba(${hexToRgb(groupColor)}, ${0.3 + intensity * 0.5})`,
            }}
            title={property.propertyName}
          >
            {metric === 'ownerWinRate'
              ? `${Math.round(value * 100)}%`
              : Math.round(value)}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '100, 100, 100'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

// ============================================================
// TOP PROPERTIES LIST (Alternative simpler view)
// ============================================================

export interface TopPropertiesListProps {
  data: Array<PropertyStatData>
  limit?: number
  metric?: 'ownerWinRate' | 'timesPurchased' | 'avgRentPerGame'
}

export function TopPropertiesList({
  data,
  limit = 10,
  metric = 'ownerWinRate',
}: TopPropertiesListProps) {
  const getValue = (prop: PropertyStatData): number => {
    switch (metric) {
      case 'timesPurchased':
        return prop.timesPurchased
      case 'avgRentPerGame':
        return prop.avgRentPerGame
      case 'ownerWinRate':
      default:
        return prop.ownerWinRate
    }
  }

  const sortedData = [...data]
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, limit)

  const getLabel = () => {
    switch (metric) {
      case 'timesPurchased':
        return 'Purchases'
      case 'avgRentPerGame':
        return 'Avg Rent'
      default:
        return 'Buyer Win Rate'
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-400">
        Top Properties by {getLabel()}
      </h4>
      {sortedData.map((prop, index) => {
        const value = getValue(prop)
        const groupColor = GROUP_COLORS[prop.propertyGroup] || '#666'

        return (
          <div
            key={prop.propertyName}
            className="flex items-center gap-3 p-2 bg-slate-700/30 rounded"
          >
            <span className="text-slate-500 w-5 text-sm">{index + 1}</span>
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: groupColor }}
            />
            <span className="flex-1 text-sm text-white truncate">
              {prop.propertyName}
            </span>
            <span className="text-sm font-medium text-green-400">
              {metric === 'ownerWinRate'
                ? `${Math.round(value * 100)}%`
                : metric === 'avgRentPerGame'
                  ? `$${Math.round(value)}`
                  : value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

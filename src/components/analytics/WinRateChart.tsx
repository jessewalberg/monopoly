import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ============================================================
// TYPES
// ============================================================

export interface WinRateDataPoint {
  modelId: string;
  modelDisplayName: string;
  wins: number;
  gamesPlayed: number;
  winRate: number;
  color?: string;
}

export interface WinRateTrendPoint {
  gameNumber: number;
  cumulativeWins: number;
  modelName: string;
}

// ============================================================
// WIN RATE BAR CHART
// ============================================================

export interface WinRateChartProps {
  data: WinRateDataPoint[];
  metric?: "winRate" | "wins";
  height?: number;
}

// Default colors for models
const MODEL_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export function WinRateChart({
  data,
  metric = "winRate",
  height = 300,
}: WinRateChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400" style={{ height }}>
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No data to display</p>
        </div>
      </div>
    );
  }

  // Sort by metric
  const sortedData = [...data].sort((a, b) => {
    if (metric === "wins") return b.wins - a.wins;
    return b.winRate - a.winRate;
  });

  // Assign colors
  const chartData = sortedData.map((d, i) => ({
    ...d,
    color: d.color || MODEL_COLORS[i % MODEL_COLORS.length],
    displayValue: metric === "wins" ? d.wins : Math.round(d.winRate * 100),
  }));

  // Shorten model names for display
  const getShortName = (name: string): string => {
    if (name.length <= 12) return name;
    const parts = name.split(/[-\/]/);
    return parts[parts.length - 1].slice(0, 10);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="modelDisplayName"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          tickFormatter={getShortName}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          label={{
            value: metric === "wins" ? "Wins" : "Win Rate %",
            angle: -90,
            position: "insideLeft",
            fill: "#9ca3af",
            fontSize: 12,
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #475569",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
          formatter={(value) => [
            metric === "wins" ? `${value} wins` : `${value}%`,
            "Win Rate",
          ]}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// WIN RATE TREND CHART (Line)
// ============================================================

export interface WinRateTrendChartProps {
  data: Record<string, WinRateTrendPoint[]>;
  height?: number;
}

export function WinRateTrendChart({ data, height = 300 }: WinRateTrendChartProps) {
  const modelIds = Object.keys(data);

  if (modelIds.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400" style={{ height }}>
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <p>No trend data available</p>
        </div>
      </div>
    );
  }

  // Transform data for Recharts
  // Find max game number
  let maxGameNumber = 0;
  for (const points of Object.values(data)) {
    for (const point of points) {
      if (point.gameNumber > maxGameNumber) {
        maxGameNumber = point.gameNumber;
      }
    }
  }

  // Create chart data with all games
  const chartData: Array<Record<string, number | string>> = [];
  for (let i = 1; i <= maxGameNumber; i++) {
    const point: Record<string, number | string> = { gameNumber: i };
    for (const modelId of modelIds) {
      const modelPoints = data[modelId];
      const lastPoint = modelPoints
        .filter((p) => p.gameNumber <= i)
        .sort((a, b) => b.gameNumber - a.gameNumber)[0];
      point[modelId] = lastPoint?.cumulativeWins || 0;
    }
    chartData.push(point);
  }

  // Get model names from data
  const modelNames: Record<string, string> = {};
  for (const [modelId, points] of Object.entries(data)) {
    if (points.length > 0) {
      modelNames[modelId] = points[0].modelName;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="gameNumber"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          label={{
            value: "Game #",
            position: "bottom",
            fill: "#9ca3af",
            fontSize: 12,
          }}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          label={{
            value: "Cumulative Wins",
            angle: -90,
            position: "insideLeft",
            fill: "#9ca3af",
            fontSize: 12,
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #475569",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#f1f5f9" }}
          formatter={(value, name) => [
            `${value} wins`,
            modelNames[String(name)] || String(name),
          ]}
          labelFormatter={(label) => `Game ${label}`}
        />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          formatter={(value) => modelNames[value] || value}
        />
        {modelIds.map((modelId, index) => (
          <Line
            key={modelId}
            type="monotone"
            dataKey={modelId}
            stroke={MODEL_COLORS[index % MODEL_COLORS.length]}
            strokeWidth={2}
            dot={false}
            name={modelId}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// SIMPLE STAT CARDS
// ============================================================

export interface WinStatCardsProps {
  stats: {
    totalGames: number;
    totalWins: number;
    avgWinRate: number;
    topModel?: string;
  };
}

export function WinStatCards({ stats }: WinStatCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Games"
        value={stats.totalGames.toString()}
        icon="🎮"
      />
      <StatCard label="Total Wins" value={stats.totalWins.toString()} icon="🏆" />
      <StatCard
        label="Avg Win Rate"
        value={`${Math.round(stats.avgWinRate * 100)}%`}
        icon="📊"
      />
      {stats.topModel && (
        <StatCard label="Top Model" value={stats.topModel} icon="👑" />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-lg font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";

// ============================================================
// TYPES
// ============================================================

export interface LeaderboardEntry {
  _id: string;
  modelId: string;
  modelDisplayName: string;
  modelProvider: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgFinalNetWorth: number;
  avgDecisionTimeMs: number;
}

export interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  sortBy?: "wins" | "winRate" | "gamesPlayed" | "avgNetWorth";
  onSortChange?: (sortBy: "wins" | "winRate" | "gamesPlayed" | "avgNetWorth") => void;
  showRank?: boolean;
  compact?: boolean;
}

// ============================================================
// LEADERBOARD TABLE COMPONENT
// ============================================================

export function LeaderboardTable({
  data,
  sortBy = "wins",
  onSortChange,
  showRank = true,
  compact = false,
}: LeaderboardTableProps) {
  const [localSortBy, setLocalSortBy] = useState(sortBy);

  const handleSort = (newSortBy: typeof sortBy) => {
    setLocalSortBy(newSortBy);
    onSortChange?.(newSortBy);
  };

  // Sort data locally if no external handler
  const sortedData = onSortChange
    ? data
    : [...data].sort((a, b) => {
        switch (localSortBy) {
          case "winRate":
            return b.winRate - a.winRate;
          case "gamesPlayed":
            return b.gamesPlayed - a.gamesPlayed;
          case "avgNetWorth":
            return b.avgFinalNetWorth - a.avgFinalNetWorth;
          case "wins":
          default:
            return b.wins - a.wins;
        }
      });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="text-4xl mb-2">🏆</div>
        <p>No leaderboard data yet</p>
        <p className="text-sm mt-1">Play some games to see rankings!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
            {showRank && <th className="pb-3 pr-2 w-12">#</th>}
            <th className="pb-3 px-2">Model</th>
            <th
              className={`pb-3 px-2 cursor-pointer hover:text-white ${
                localSortBy === "gamesPlayed" ? "text-white" : ""
              }`}
              onClick={() => handleSort("gamesPlayed")}
            >
              Games {localSortBy === "gamesPlayed" && "▼"}
            </th>
            <th
              className={`pb-3 px-2 cursor-pointer hover:text-white ${
                localSortBy === "wins" ? "text-white" : ""
              }`}
              onClick={() => handleSort("wins")}
            >
              Wins {localSortBy === "wins" && "▼"}
            </th>
            <th
              className={`pb-3 px-2 cursor-pointer hover:text-white ${
                localSortBy === "winRate" ? "text-white" : ""
              }`}
              onClick={() => handleSort("winRate")}
            >
              Win % {localSortBy === "winRate" && "▼"}
            </th>
            {!compact && (
              <th
                className={`pb-3 px-2 cursor-pointer hover:text-white ${
                  localSortBy === "avgNetWorth" ? "text-white" : ""
                }`}
                onClick={() => handleSort("avgNetWorth")}
              >
                Avg Worth {localSortBy === "avgNetWorth" && "▼"}
              </th>
            )}
            {!compact && <th className="pb-3 px-2">Win Rate</th>}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((entry, index) => (
            <LeaderboardRow
              key={entry._id}
              entry={entry}
              rank={index + 1}
              showRank={showRank}
              compact={compact}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// LEADERBOARD ROW
// ============================================================

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  showRank: boolean;
  compact: boolean;
}

function LeaderboardRow({ entry, rank, showRank, compact }: LeaderboardRowProps) {
  const winRatePercent = Math.round(entry.winRate * 100);

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
      {showRank && (
        <td className="py-3 pr-2">
          <RankBadge rank={rank} />
        </td>
      )}
      <td className="py-3 px-2">
        <div className="flex flex-col">
          <Link
            to="/analytics/model/$modelId"
            params={{ modelId: entry.modelId }}
            className="text-white font-medium hover:text-green-300 transition-colors"
          >
            {entry.modelDisplayName}
          </Link>
          <span className="text-xs text-slate-500">{entry.modelProvider}</span>
        </div>
      </td>
      <td className="py-3 px-2 text-slate-300">{entry.gamesPlayed}</td>
      <td className="py-3 px-2 text-green-400 font-medium">{entry.wins}</td>
      <td className="py-3 px-2">
        <span
          className={`font-medium ${
            winRatePercent >= 50
              ? "text-green-400"
              : winRatePercent >= 25
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {winRatePercent}%
        </span>
      </td>
      {!compact && (
        <td className="py-3 px-2 text-slate-300">
          ${Math.round(entry.avgFinalNetWorth).toLocaleString()}
        </td>
      )}
      {!compact && (
        <td className="py-3 px-2 w-32">
          <WinRateBar winRate={entry.winRate} />
        </td>
      )}
    </tr>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 font-bold text-sm">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-400/20 text-slate-300 font-bold text-sm">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-600 font-bold text-sm">
        🥉
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-700/50 text-slate-400 font-medium text-sm">
      {rank}
    </span>
  );
}

function WinRateBar({ winRate }: { winRate: number }) {
  const percent = Math.round(winRate * 100);

  return (
    <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all ${
          percent >= 50
            ? "bg-green-500"
            : percent >= 25
            ? "bg-yellow-500"
            : "bg-red-500"
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ============================================================
// COMPACT LEADERBOARD (for sidebar/summary use)
// ============================================================

export interface CompactLeaderboardProps {
  data: LeaderboardEntry[];
  limit?: number;
}

export function CompactLeaderboard({ data, limit = 5 }: CompactLeaderboardProps) {
  const topEntries = data.slice(0, limit);

  return (
    <div className="space-y-2">
      {topEntries.map((entry, index) => (
        <div
          key={entry._id}
          className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={index + 1} />
            <div>
              <Link
                to="/analytics/model/$modelId"
                params={{ modelId: entry.modelId }}
                className="text-sm text-white font-medium hover:text-green-300 transition-colors"
              >
                {entry.modelDisplayName}
              </Link>
              <div className="text-xs text-slate-500">
                {entry.wins} wins / {entry.gamesPlayed} games
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-green-400">
              {Math.round(entry.winRate * 100)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

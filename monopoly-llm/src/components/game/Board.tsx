import { BOARD, type PropertyGroup } from "../../../convex/lib/constants";
import { BoardSpaceComponent } from "./BoardSpace";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================
// TYPES
// ============================================================

export interface PlayerOnBoard {
  _id: Id<"players">;
  position: number;
  modelDisplayName: string;
  tokenColor: string;
  textColor: string;
  inJail: boolean;
}

export interface PropertyOnBoard {
  position: number;
  ownerId?: Id<"players">;
  houses: number;
  isMortgaged: boolean;
}

export interface BoardProps {
  players: PlayerOnBoard[];
  properties: PropertyOnBoard[];
  currentPlayerId?: Id<"players">;
  turnNumber?: number;
  phase?: string;
  children?: React.ReactNode; // For center content
}

// ============================================================
// GRID POSITION MAPPING
// The board is an 11x11 grid:
// - Row 1: positions 20-30 (top, right to left)
// - Col 1: positions 11-19 (left, top to bottom)
// - Row 11: positions 0-10 (bottom, left to right)
// - Col 11: positions 31-39 (right, bottom to top)
// ============================================================

function getGridPosition(pos: number): { row: number; col: number } {
  if (pos >= 0 && pos <= 10) {
    // Bottom row: left to right
    return { row: 11, col: 11 - pos };
  } else if (pos >= 11 && pos <= 19) {
    // Left side: top to bottom
    return { row: pos - 9, col: 1 };
  } else if (pos >= 20 && pos <= 30) {
    // Top row: left to right (from corner)
    return { row: 1, col: pos - 19 };
  } else {
    // Right side: bottom to top
    return { row: 41 - pos, col: 11 };
  }
}

// ============================================================
// COLOR MAPPING
// ============================================================

export const GROUP_COLORS: Record<PropertyGroup | "railroad" | "utility", string> = {
  brown: "#8B4513",
  light_blue: "#87CEEB",
  pink: "#FF69B4",
  orange: "#FFA500",
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#228B22",
  dark_blue: "#0000CD",
  railroad: "#333333",
  utility: "#666666",
};

// ============================================================
// BOARD COMPONENT
// ============================================================

export function Board({
  players,
  properties,
  currentPlayerId,
  turnNumber,
  phase,
  children,
}: BoardProps) {
  // Get property state by position
  const propertyMap = new Map(properties.map((p) => [p.position, p]));

  // Get players by position
  const playersByPosition = new Map<number, PlayerOnBoard[]>();
  for (const player of players) {
    const pos = player.position;
    if (!playersByPosition.has(pos)) {
      playersByPosition.set(pos, []);
    }
    playersByPosition.get(pos)!.push(player);
  }

  return (
    <div className="relative w-full max-w-4xl aspect-square bg-slate-900 rounded-lg p-1">
      {/* CSS Grid for board spaces */}
      <div
        className="grid gap-0.5 h-full"
        style={{
          gridTemplateColumns: "repeat(11, 1fr)",
          gridTemplateRows: "repeat(11, 1fr)",
        }}
      >
        {/* Render all 40 board spaces */}
        {BOARD.map((space) => {
          const { row, col } = getGridPosition(space.pos);
          const propertyState = propertyMap.get(space.pos);
          const playersOnSpace = playersByPosition.get(space.pos) || [];

          return (
            <div
              key={space.pos}
              style={{
                gridRow: row,
                gridColumn: col,
              }}
              className="relative"
            >
              <BoardSpaceComponent
                space={space}
                propertyState={propertyState}
                players={playersOnSpace}
                currentPlayerId={currentPlayerId}
              />
            </div>
          );
        })}

        {/* Center area for game info */}
        <div
          style={{
            gridRow: "2 / 11",
            gridColumn: "2 / 11",
          }}
          className="bg-slate-800 rounded-lg p-4 flex flex-col items-center justify-center"
        >
          {children || (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">MONOPOLY</h2>
              <p className="text-slate-400 text-sm">LLM Arena</p>
              {turnNumber !== undefined && (
                <p className="text-slate-300 mt-4">Turn {turnNumber}</p>
              )}
              {phase && (
                <p className="text-green-400 text-sm mt-1">
                  {phase.replace("_", " ")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

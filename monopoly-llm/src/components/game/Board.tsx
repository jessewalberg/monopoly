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
  ownerColor?: string;
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
// - Row 1: positions 20-30 (top, left to right)
// - Col 1: positions 11-19 (left, top to bottom)
// - Row 11: positions 0-10 (bottom, right to left)
// - Col 11: positions 31-39 (right, bottom to top)
// ============================================================

export type BoardSide = "bottom" | "left" | "top" | "right" | "corner";

function getGridPosition(pos: number): { row: number; col: number; side: BoardSide } {
  if (pos === 0) {
    // GO - bottom right corner
    return { row: 11, col: 11, side: "corner" };
  } else if (pos === 10) {
    // Jail - bottom left corner
    return { row: 11, col: 1, side: "corner" };
  } else if (pos === 20) {
    // Free Parking - top left corner
    return { row: 1, col: 1, side: "corner" };
  } else if (pos === 30) {
    // Go To Jail - top right corner
    return { row: 1, col: 11, side: "corner" };
  } else if (pos >= 1 && pos <= 9) {
    // Bottom row: right to left (GO is at right)
    return { row: 11, col: 11 - pos, side: "bottom" };
  } else if (pos >= 11 && pos <= 19) {
    // Left side: top to bottom
    return { row: pos - 9, col: 1, side: "left" };
  } else if (pos >= 21 && pos <= 29) {
    // Top row: left to right
    return { row: 1, col: pos - 19, side: "top" };
  } else {
    // Right side: bottom to top (31-39)
    return { row: 41 - pos, col: 11, side: "right" };
  }
}

// ============================================================
// COLOR MAPPING - Classic Monopoly colors
// ============================================================

export const GROUP_COLORS: Record<PropertyGroup | "railroad" | "utility", string> = {
  brown: "#955436",      // Dark brown
  light_blue: "#AAE0FA", // Light cyan/sky blue
  pink: "#D93A96",       // Magenta/pink
  orange: "#F7941D",     // Orange
  red: "#ED1B24",        // Red
  yellow: "#FEF200",     // Bright yellow
  green: "#1FB25A",      // Green
  dark_blue: "#0072BB",  // Dark blue
  railroad: "#000000",   // Black
  utility: "#000000",    // Black
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
  // Get property state by position with owner colors
  const propertyMap = new Map(
    properties.map((p) => {
      const ownerColor = p.ownerId
        ? players.find((pl) => pl._id === p.ownerId)?.tokenColor
        : undefined;
      return [p.position, { ...p, ownerColor }];
    })
  );

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
    <div className="relative w-full max-w-3xl aspect-square rounded-lg overflow-hidden border-2 border-slate-700" style={{ backgroundColor: "#C8E6C9" }}>
      {/* CSS Grid for board spaces */}
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: "1.5fr repeat(9, 1fr) 1.5fr",
          gridTemplateRows: "1.5fr repeat(9, 1fr) 1.5fr",
        }}
      >
        {/* Render all 40 board spaces */}
        {BOARD.map((space) => {
          const { row, col, side } = getGridPosition(space.pos);
          const propertyState = propertyMap.get(space.pos);
          const playersOnSpace = playersByPosition.get(space.pos) || [];

          return (
            <div
              key={space.pos}
              style={{
                gridRow: row,
                gridColumn: col,
              }}
              className="relative border border-slate-800/30"
            >
              <BoardSpaceComponent
                space={space}
                propertyState={propertyState}
                players={playersOnSpace}
                currentPlayerId={currentPlayerId}
                side={side}
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
          className="flex flex-col items-center justify-center p-4"
        >
          {children || (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-red-600 mb-2 tracking-wider" style={{ fontFamily: "serif" }}>
                MONOPOLY
              </h2>
              <p className="text-slate-600 text-sm">LLM Arena</p>
              {turnNumber !== undefined && (
                <p className="text-slate-700 mt-4">Turn {turnNumber}</p>
              )}
              {phase && (
                <p className="text-green-700 text-sm mt-1">
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

import type { BoardSpace, PropertyGroup } from "../../../convex/lib/constants";
import { PlayerToken } from "./PlayerToken";
import { GROUP_COLORS, type PlayerOnBoard, type PropertyOnBoard } from "./Board";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================
// TYPES
// ============================================================

export interface BoardSpaceProps {
  space: BoardSpace;
  propertyState?: PropertyOnBoard;
  players: PlayerOnBoard[];
  currentPlayerId?: Id<"players">;
}

// ============================================================
// ICONS
// ============================================================

function GoIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 12l-5-5v3H5v4h7v3l5-5z" />
    </svg>
  );
}

function JailIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zM10 6h2v12h-2zM14 6h2v12h-2zM18 6h2v12h-2zM4 4h18v2H4zM4 18h18v2H4z" />
    </svg>
  );
}

function RailroadIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l-2 4h4l-2-4zM6 8v2h12V8H6zM6 12v6h2v-4h2v4h4v-4h2v4h2v-6H6zM5 20v2h14v-2H5z" />
    </svg>
  );
}

function UtilityIcon({ type }: { type: "electric" | "water" }) {
  if (type === "electric") {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.12.23-2.19.65-3.16.38.25.79.47 1.22.64-.08.5-.12 1-.12 1.52 0 3.41 2.72 6.23 6.25 6.23 1.19 0 2.31-.34 3.26-.93.29.47.55.96.74 1.48C14.31 19.6 13.18 20 12 20z" />
    </svg>
  );
}

function ChanceIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
    </svg>
  );
}

function CommunityChestIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM10 4h4v2h-4V4zm6 11h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z" />
    </svg>
  );
}

function TaxIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
    </svg>
  );
}

function FreeParkingIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z" />
    </svg>
  );
}

function GoToJailIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-10h2v8h-2z" />
    </svg>
  );
}

// ============================================================
// HOUSE INDICATOR
// ============================================================

function HouseIndicator({ count }: { count: number }) {
  if (count === 0) return null;

  if (count === 5) {
    // Hotel
    return (
      <div className="flex gap-0.5">
        <div className="w-2 h-2 bg-red-500 rounded-sm" title="Hotel" />
      </div>
    );
  }

  // Houses
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-1.5 h-1.5 bg-green-500 rounded-sm" title={`${count} house(s)`} />
      ))}
    </div>
  );
}

// ============================================================
// BOARD SPACE COMPONENT
// ============================================================

export function BoardSpaceComponent({
  space,
  propertyState,
  players,
  currentPlayerId,
}: BoardSpaceProps) {
  const isOwned = propertyState?.ownerId !== undefined;
  const isMortgaged = propertyState?.isMortgaged || false;
  const houses = propertyState?.houses || 0;

  // Base container styles
  const baseStyles = "w-full h-full flex flex-col items-center justify-center text-center p-0.5 text-white rounded-sm overflow-hidden relative";

  // Render based on space type
  switch (space.type) {
    case "property": {
      const groupColor = GROUP_COLORS[space.group as PropertyGroup];
      return (
        <div
          className={`${baseStyles} bg-slate-700 ${isMortgaged ? "opacity-50" : ""}`}
          title={`${space.name} - $${space.cost}`}
        >
          {/* Color band */}
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{ backgroundColor: groupColor }}
          />

          {/* Houses */}
          <div className="absolute top-2.5 right-0.5">
            <HouseIndicator count={houses} />
          </div>

          {/* Name (truncated) */}
          <span className="text-[6px] leading-tight mt-2 line-clamp-2 px-0.5">
            {space.name.replace(" Avenue", " Ave").replace(" Place", " Pl")}
          </span>

          {/* Price or owner indicator */}
          {isOwned ? (
            <div className="absolute bottom-0.5 left-0.5 w-2 h-2 rounded-full border border-white/50"
                 style={{ backgroundColor: playerColorForOwner(space.pos, players, propertyState?.ownerId) }} />
          ) : (
            <span className="text-[5px] text-slate-400">${space.cost}</span>
          )}

          {/* Players */}
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "railroad": {
      return (
        <div
          className={`${baseStyles} bg-slate-700 ${isMortgaged ? "opacity-50" : ""}`}
          title={`${space.name} - $${space.cost}`}
        >
          <RailroadIcon />
          <span className="text-[6px] leading-tight line-clamp-2 px-0.5">
            {space.name.replace(" Railroad", "")}
          </span>
          {isOwned ? (
            <div className="absolute bottom-0.5 left-0.5 w-2 h-2 rounded-full border border-white/50"
                 style={{ backgroundColor: playerColorForOwner(space.pos, players, propertyState?.ownerId) }} />
          ) : (
            <span className="text-[5px] text-slate-400">${space.cost}</span>
          )}
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "utility": {
      const isElectric = space.name.includes("Electric");
      return (
        <div
          className={`${baseStyles} bg-slate-700 ${isMortgaged ? "opacity-50" : ""}`}
          title={`${space.name} - $${space.cost}`}
        >
          <UtilityIcon type={isElectric ? "electric" : "water"} />
          <span className="text-[6px] leading-tight line-clamp-2 px-0.5">
            {space.name.replace(" Company", "")}
          </span>
          {isOwned ? (
            <div className="absolute bottom-0.5 left-0.5 w-2 h-2 rounded-full border border-white/50"
                 style={{ backgroundColor: playerColorForOwner(space.pos, players, propertyState?.ownerId) }} />
          ) : (
            <span className="text-[5px] text-slate-400">${space.cost}</span>
          )}
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "go": {
      return (
        <div className={`${baseStyles} bg-red-700`} title="Collect $200">
          <GoIcon />
          <span className="text-[8px] font-bold">GO</span>
          <span className="text-[5px]">$200</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "jail": {
      return (
        <div className={`${baseStyles} bg-orange-800`} title="Jail / Just Visiting">
          <JailIcon />
          <span className="text-[6px]">JAIL</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} inJail />
        </div>
      );
    }

    case "free_parking": {
      return (
        <div className={`${baseStyles} bg-green-800`} title="Free Parking">
          <FreeParkingIcon />
          <span className="text-[6px]">FREE</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "go_to_jail": {
      return (
        <div className={`${baseStyles} bg-red-900`} title="Go To Jail">
          <GoToJailIcon />
          <span className="text-[5px]">GO TO</span>
          <span className="text-[6px]">JAIL</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "chance": {
      return (
        <div className={`${baseStyles} bg-blue-600`} title="Chance">
          <ChanceIcon />
          <span className="text-[6px]">?</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "community_chest": {
      return (
        <div className={`${baseStyles} bg-purple-600`} title="Community Chest">
          <CommunityChestIcon />
          <span className="text-[5px]">CHEST</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

    case "tax": {
      return (
        <div className={`${baseStyles} bg-slate-600`} title={`${space.name} - $${space.amount}`}>
          <TaxIcon />
          <span className="text-[5px] leading-tight">{space.name.replace(" Tax", "")}</span>
          <span className="text-[5px] text-red-300">${space.amount}</span>
          <PlayerTokensOverlay players={players} currentPlayerId={currentPlayerId} />
        </div>
      );
    }

  }

  // This should never happen as all space types are handled above
  // Adding as exhaustive check
  const _exhaustiveCheck: never = space;
  return _exhaustiveCheck;
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function PlayerTokensOverlay({
  players,
  currentPlayerId,
  inJail = false
}: {
  players: PlayerOnBoard[];
  currentPlayerId?: Id<"players">;
  inJail?: boolean;
}) {
  if (players.length === 0) return null;

  // Filter by jail status if on jail space
  const displayPlayers = inJail
    ? players.filter(p => p.inJail || p.position === 10)
    : players.filter(p => !p.inJail || p.position !== 10);

  if (displayPlayers.length === 0) return null;

  return (
    <div className="absolute bottom-0.5 right-0.5 flex flex-wrap gap-0.5 justify-end max-w-full">
      {displayPlayers.map((player, index) => (
        <PlayerToken
          key={player._id}
          player={player}
          isCurrentPlayer={player._id === currentPlayerId}
          size="xs"
          offset={index}
        />
      ))}
    </div>
  );
}

function playerColorForOwner(
  _position: number,
  _players: PlayerOnBoard[],
  _ownerId?: Id<"players">
): string {
  // This would need the actual owner's color - simplified for now
  return "#888888";
}

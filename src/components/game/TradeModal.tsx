import { Modal } from "../ui/Modal";
import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { GROUP_COLORS } from "./Board";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PropertyGroup } from "../../../convex/lib/constants";

// ============================================================
// TYPES
// ============================================================

export interface TradeProperty {
  _id: Id<"properties">;
  name: string;
  group: string;
  houses: number;
  isMortgaged: boolean;
}

export interface TradeOffer {
  money: number;
  properties: TradeProperty[];
  jailCards: number;
}

export interface TradeParty {
  playerId: Id<"players">;
  playerName: string;
  playerColor: string;
  cash: number;
  properties: TradeProperty[];
  jailCards: number;
}

export interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposer: TradeParty;
  responder: TradeParty;
  offering: TradeOffer;
  requesting: TradeOffer;
  proposerReasoning?: string;
  responderReasoning?: string;
  status?: "pending" | "accepted" | "rejected" | "countered";
}

// ============================================================
// TRADE MODAL COMPONENT
// ============================================================

export function TradeModal({
  isOpen,
  onClose,
  proposer,
  responder,
  offering,
  requesting,
  proposerReasoning,
  responderReasoning,
  status = "pending",
}: TradeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trade Proposal" size="lg">
      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex justify-center">
          <Badge
            variant={
              status === "accepted"
                ? "success"
                : status === "rejected"
                  ? "error"
                  : status === "countered"
                    ? "warning"
                    : "info"
            }
            size="md"
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Two columns: offering / requesting */}
        <div className="grid grid-cols-2 gap-4">
          {/* Proposer's offer */}
          <TradeColumn
            title={`${proposer.playerName} Offers`}
            playerColor={proposer.playerColor}
            offer={offering}
            reasoning={proposerReasoning}
          />

          {/* What they want */}
          <TradeColumn
            title={`${proposer.playerName} Wants`}
            playerColor={responder.playerColor}
            offer={requesting}
            reasoning={responderReasoning}
            isRequest
          />
        </div>

        {/* Action buttons (if pending) */}
        {status === "pending" && (
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
            <Button variant="danger" onClick={onClose}>
              Reject
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Counter
            </Button>
            <Button variant="primary" onClick={onClose}>
              Accept
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// TRADE COLUMN
// ============================================================

function TradeColumn({
  title,
  playerColor,
  offer,
  reasoning,
  isRequest = false,
}: {
  title: string;
  playerColor: string;
  offer: TradeOffer;
  reasoning?: string;
  isRequest?: boolean;
}) {
  const isEmpty =
    offer.money === 0 &&
    offer.properties.length === 0 &&
    offer.jailCards === 0;

  return (
    <Card className={isRequest ? "border border-red-500/30" : "border border-green-500/30"}>
      <CardBody className="py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: playerColor }}
          />
          <h4 className="text-sm font-medium text-white">{title}</h4>
        </div>

        {isEmpty ? (
          <p className="text-sm text-slate-500 italic">Nothing</p>
        ) : (
          <div className="space-y-2">
            {/* Money */}
            {offer.money > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">💵</span>
                <span className="text-lg font-bold text-green-400">
                  ${offer.money.toLocaleString()}
                </span>
              </div>
            )}

            {/* Properties */}
            {offer.properties.length > 0 && (
              <div className="space-y-1">
                {offer.properties.map((prop) => (
                  <TradePropertyCard key={prop._id} property={prop} />
                ))}
              </div>
            )}

            {/* Jail cards */}
            {offer.jailCards > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎫</span>
                <span className="text-sm text-white">
                  Get Out of Jail Free x{offer.jailCards}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        {reasoning && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-400">Reasoning:</p>
            <p className="text-sm text-slate-300 italic">"{reasoning}"</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ============================================================
// TRADE PROPERTY CARD
// ============================================================

function TradePropertyCard({ property }: { property: TradeProperty }) {
  const color = GROUP_COLORS[property.group as PropertyGroup] || "#666666";

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded
        bg-slate-700/50 border-l-4
        ${property.isMortgaged ? "opacity-50" : ""}
      `}
      style={{ borderLeftColor: color }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{property.name}</p>
        {property.houses > 0 && (
          <p className="text-xs text-green-400">
            {property.houses === 5 ? "Hotel" : `${property.houses} house(s)`}
          </p>
        )}
      </div>
      {property.isMortgaged && (
        <Badge variant="error" size="sm">
          Mortgaged
        </Badge>
      )}
    </div>
  );
}

// ============================================================
// TRADE SUMMARY INLINE
// ============================================================

export function TradeSummaryInline({
  proposerName,
  responderName,
  status,
}: {
  proposerName: string;
  responderName: string;
  offering?: TradeOffer;
  requesting?: TradeOffer;
  status: "pending" | "accepted" | "rejected" | "countered";
}) {
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-700/50 rounded-lg text-sm">
      <span className="text-slate-400">{proposerName}</span>
      <span className="text-white">→</span>
      <span className="text-slate-400">{responderName}</span>
      <Badge
        variant={
          status === "accepted"
            ? "success"
            : status === "rejected"
              ? "error"
              : "info"
        }
        size="sm"
      >
        {status}
      </Badge>
    </div>
  );
}

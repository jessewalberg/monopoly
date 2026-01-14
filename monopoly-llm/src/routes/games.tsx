// TODO: Game history and replays
// - List of completed games
// - Game details view
// - Replay functionality

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/games")({
  component: GamesPage,
});

function GamesPage() {
  return (
    <div>
      <h1>Games</h1>
      {/* TODO: Game history and replay UI */}
    </div>
  );
}

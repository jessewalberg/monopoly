// TODO: Game setup and live game page
// - Model selector for each player
// - Game configuration options
// - Start game button
// - Live game view during play

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({
  component: PlayPage,
});

function PlayPage() {
  return (
    <div>
      <h1>Play</h1>
      {/* TODO: Game setup and live game UI */}
    </div>
  );
}

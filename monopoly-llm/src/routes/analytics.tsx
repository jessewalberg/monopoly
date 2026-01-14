// TODO: Analytics dashboard
// - Win rate charts
// - Head-to-head comparisons
// - Strategy profiles
// - Property statistics

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div>
      <h1>Analytics</h1>
      {/* TODO: Analytics dashboard UI */}
    </div>
  );
}

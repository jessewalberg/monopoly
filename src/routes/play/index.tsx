import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

export const Route = createFileRoute('/play/')({
  component: RetiredPlayPage,
})

const BUDGET_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
  },
  { id: 'x-ai/grok-3-mini', name: 'Grok 3 Mini', provider: 'xAI' },
]

function RetiredPlayPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Arena Play Retired</h1>
        <p className="text-slate-400">
          Live AI Monopoly games are no longer started from this site. This page
          is a read-only museum status notice.
        </p>
      </div>

      <Card className="mb-8 border-amber-500/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Museum</Badge>
            <h2 className="text-lg font-bold text-white">No live controls</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 text-slate-300">
          <p>
            The runtime Convex backend and OpenRouter decision loop have been
            removed from this deployment. Completed historical games remain
            available for replay and analytics.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/games"
              className="bg-green-600 hover:bg-green-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Browse completed games
            </Link>
            <Link
              to="/analytics"
              className="bg-slate-700 hover:bg-slate-600 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Open analytics museum
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Historical roster</h2>
        </CardHeader>
        <CardBody>
          <div className="grid gap-2">
            {BUDGET_MODELS.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between rounded bg-slate-800/60 px-3 py-2"
              >
                <span className="text-white">{model.name}</span>
                <span className="text-slate-400 text-sm">{model.provider}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

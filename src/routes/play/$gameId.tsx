import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

export const Route = createFileRoute('/play/$gameId')({
  component: RetiredLiveGamePage,
})

function RetiredLiveGamePage() {
  const { gameId } = Route.useParams()

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Card className="border-amber-500/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Retired</Badge>
            <h1 className="text-xl font-bold text-white">
              Live play surface removed
            </h1>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 text-slate-300">
          <p>
            Live controls for game <code className="text-slate-200">{gameId}</code>{' '}
            are no longer available. If this game completed, open the museum
            replay instead.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/games/$gameId"
              params={{ gameId }}
              className="bg-green-600 hover:bg-green-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Open museum replay
            </Link>
            <Link
              to="/play"
              className="bg-slate-700 hover:bg-slate-600 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Arena status
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

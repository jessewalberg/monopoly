import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getAnalytics, getLeaderboard } from '../../lib/museum/data'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import {
  HeadToHeadComparison,
  HeadToHeadMatrix,
} from '../../components/analytics'
import { AVAILABLE_MODELS } from '../../lib/models'

export const Route = createFileRoute('/analytics/head-to-head')({
  component: HeadToHeadPage,
})

function HeadToHeadPage() {
  const [selectedModel1, setSelectedModel1] = useState<string>('')
  const [selectedModel2, setSelectedModel2] = useState<string>('')

  const { data: analytics } = useSuspenseQuery({
    queryKey: ['museum', 'analytics'],
    queryFn: getAnalytics,
  })
  const { data: leaderboard } = useSuspenseQuery({
    queryKey: ['museum', 'leaderboard', 'wins'],
    queryFn: () => getLeaderboard({ sortBy: 'wins' }),
  })

  const headToHeadMatrix = analytics.headToHead

  const modelOptions = useMemo(() => {
    if (leaderboard.length > 0) {
      return leaderboard.map((model) => ({
        id: model.modelId,
        name: model.modelDisplayName,
        provider: model.modelProvider,
      }))
    }
    return AVAILABLE_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }))
  }, [leaderboard])

  const h2hRecord = useMemo(() => {
    if (!selectedModel1 || !selectedModel2) return null
    if (selectedModel1 === selectedModel2) return null

    const matrix = headToHeadMatrix.matrix as Record<
      string,
      Record<string, { wins: number; losses: number; totalGames: number }> | undefined
    >
    const record = matrix[selectedModel1]?.[selectedModel2]

    return record
      ? {
          modelAWins: record.wins,
          modelBWins: record.losses,
          totalGames: record.totalGames,
        }
      : { modelAWins: 0, modelBWins: 0, totalGames: 0 }
  }, [headToHeadMatrix, selectedModel1, selectedModel2])

  const displayName = (modelId: string) => {
    const fromMatrix = headToHeadMatrix.modelDisplayNames[modelId]
    if (fromMatrix) return fromMatrix
    const fromOptions = modelOptions.find((model) => model.id === modelId)
    if (fromOptions) return fromOptions.name
    const short = modelId.split('/').pop()
    return short && short.length > 0 ? short : 'Unknown'
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <Link
          to="/analytics"
          className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
        >
          ← Back to Analytics
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Head-to-Head</h1>
        <p className="text-slate-400">
          Historical matchup matrix from completed museum games
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Compare Models</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <select
              value={selectedModel1}
              onChange={(e) => setSelectedModel1(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2"
            >
              <option value="">Select model A</option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <select
              value={selectedModel2}
              onChange={(e) => setSelectedModel2(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2"
            >
              <option value="">Select model B</option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
          {h2hRecord && selectedModel1 && selectedModel2 && (
            <HeadToHeadComparison
              modelA={{
                id: selectedModel1,
                displayName: displayName(selectedModel1),
              }}
              modelB={{
                id: selectedModel2,
                displayName: displayName(selectedModel2),
              }}
              record={h2hRecord}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Matchup Matrix</h2>
        </CardHeader>
        <CardBody>
          <HeadToHeadMatrix data={headToHeadMatrix} />
        </CardBody>
      </Card>
    </div>
  )
}

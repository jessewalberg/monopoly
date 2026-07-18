import { spawnSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export type GenerateMuseumOptions = {
  snapshotPath: string
  outputDir: string
}

export type MuseumGenerationResult = {
  completedGameCount: number
  abandonedExcludedCount: number
  gameIds: string[]
  outputFiles: string[]
}

type Doc = Record<string, unknown> & { _id: string }

const REQUIRED_GAME_TABLES = [
  'games',
  'players',
  'properties',
  'turns',
  'propertyTransfers',
  'propertyStateEvents',
] as const

/** Required for analytics generation; never copied into deployed per-game payloads. */
const REQUIRED_GENERATION_ONLY_TABLES = [
  'decisions',
  'trades',
  'rentPayments',
] as const

const OMITTED_FROM_ARCHIVE = REQUIRED_GENERATION_ONLY_TABLES

export class MuseumGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MuseumGenerationError'
  }
}

function extractSnapshot(snapshotPath: string): string {
  const extractDir = mkdtempSync(join(tmpdir(), 'museum-snap-'))
  const result = spawnSync(
    'unzip',
    ['-q', '-o', snapshotPath, '-d', extractDir],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    rmSync(extractDir, { recursive: true, force: true })
    throw new MuseumGenerationError(
      `Failed to extract snapshot: ${result.stderr || result.stdout || 'unknown unzip error'}`,
    )
  }
  return extractDir
}

async function* iterateJsonl(path: string): AsyncGenerator<Doc> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parsed = JSON.parse(trimmed) as Doc
    if (typeof parsed._id !== 'string') {
      throw new MuseumGenerationError(
        'Snapshot document missing string _id (referential integrity)',
      )
    }
    yield parsed
  }
}

async function readTableFiltered(
  extractDir: string,
  name: string,
  required: boolean,
  keep?: (doc: Doc) => boolean,
): Promise<Doc[]> {
  const path = join(extractDir, name, 'documents.jsonl')
  if (!existsSync(path)) {
    if (required) {
      throw new MuseumGenerationError(
        `Snapshot missing required table: ${name}/documents.jsonl`,
      )
    }
    return []
  }
  const docs: Doc[] = []
  for await (const doc of iterateJsonl(path)) {
    if (!keep || keep(doc)) docs.push(doc)
  }
  return docs
}

function groupByGameId(docs: Doc[]): Map<string, Doc[]> {
  const map = new Map<string, Doc[]>()
  for (const doc of docs) {
    const gameId = doc.gameId
    if (typeof gameId !== 'string') {
      throw new MuseumGenerationError(
        `Referential integrity failure: document ${doc._id} has non-string gameId`,
      )
    }
    const list = map.get(gameId)
    if (list) list.push(doc)
    else map.set(gameId, [doc])
  }
  return map
}

function deriveGeneratedAt(completedGames: Doc[]): string {
  let maxTs = 0
  for (const game of completedGames) {
    for (const key of ['endedAt', 'createdAt', '_creationTime'] as const) {
      const value = game[key]
      if (typeof value === 'number' && value > maxTs) maxTs = value
    }
  }
  return new Date(maxTs).toISOString()
}

function isBankAcquisition(transfer: Doc): boolean {
  const reason = transfer.reason
  return (
    (transfer.fromOwnerId === null || transfer.fromOwnerId === undefined) &&
    typeof transfer.toOwnerId === 'string' &&
    (reason === 'purchase' || reason === 'auction')
  )
}

function assertReferentialIntegrity(
  game: Doc,
  related: {
    players: Doc[]
    properties: Doc[]
    turns: Doc[]
    propertyTransfers: Doc[]
    propertyStateEvents: Doc[]
  },
): void {
  const gameId = game._id
  if (related.players.length < 2) {
    throw new MuseumGenerationError(
      `Referential integrity failure: completed game ${gameId} must have at least two players`,
    )
  }
  if (related.properties.length < 1) {
    throw new MuseumGenerationError(
      `Referential integrity failure: completed game ${gameId} must have at least one property`,
    )
  }
  if (related.turns.length < 1) {
    throw new MuseumGenerationError(
      `Referential integrity failure: completed game ${gameId} must have at least one turn`,
    )
  }

  const playerIds = new Set(related.players.map((p) => p._id))
  const propertyIds = new Set(related.properties.map((p) => p._id))

  const winnerId = game.winnerId
  if (typeof winnerId === 'string' && !playerIds.has(winnerId)) {
    throw new MuseumGenerationError(
      `Referential integrity failure: completed game ${gameId} winnerId ${winnerId} not in players`,
    )
  }

  for (const turn of related.turns) {
    if (typeof turn.playerId !== 'string' || !playerIds.has(turn.playerId)) {
      throw new MuseumGenerationError(
        `Referential integrity failure: turn ${turn._id} references missing player in game ${gameId}`,
      )
    }
  }

  for (const prop of related.properties) {
    const ownerId = prop.ownerId
    if (typeof ownerId === 'string' && !playerIds.has(ownerId)) {
      throw new MuseumGenerationError(
        `Referential integrity failure: property ${prop._id} references missing owner in game ${gameId}`,
      )
    }
  }

  for (const transfer of related.propertyTransfers) {
    if (
      typeof transfer.propertyId !== 'string' ||
      !propertyIds.has(transfer.propertyId)
    ) {
      throw new MuseumGenerationError(
        `Referential integrity failure: propertyTransfer ${transfer._id} references missing property in game ${gameId}`,
      )
    }
    for (const key of ['fromOwnerId', 'toOwnerId'] as const) {
      const id = transfer[key]
      if (typeof id === 'string' && !playerIds.has(id)) {
        throw new MuseumGenerationError(
          `Referential integrity failure: propertyTransfer ${transfer._id} references missing ${key} in game ${gameId}`,
        )
      }
    }
  }

  for (const event of related.propertyStateEvents) {
    if (
      typeof event.propertyId !== 'string' ||
      !propertyIds.has(event.propertyId)
    ) {
      throw new MuseumGenerationError(
        `Referential integrity failure: propertyStateEvent ${event._id} references missing property in game ${gameId}`,
      )
    }
  }
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function round2(n: number): number {
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100))
}

type StrategyAcc = {
  modelId: string
  modelDisplayName: string
  buyTotal: number
  buyYes: number
  actionTotal: number
  tradeYes: number
  buildYes: number
  jailPay: number
  jailRoll: number
  jailCard: number
  decisionsAnalyzed: number
  decisionTimes: number[]
}

type TradeAcc = {
  tradesProposed: number
  tradesAccepted: number
}

type RentAcc = {
  collected: number
  paid: number
  byProperty: Map<string, number>
}

function requireGenerationOnlyGameId(
  doc: Doc,
  kind: string,
  allGameIds: Set<string>,
): string {
  const gameId = doc.gameId
  if (typeof gameId !== 'string') {
    throw new MuseumGenerationError(
      `Referential integrity failure: ${kind} ${doc._id} has non-string gameId`,
    )
  }
  if (!allGameIds.has(gameId)) {
    throw new MuseumGenerationError(
      `Referential integrity failure: ${kind} ${doc._id} references unknown game ${gameId}`,
    )
  }
  return gameId
}

async function accumulateGenerationOnlyMetrics(
  extractDir: string,
  completedIds: Set<string>,
  allGameIds: Set<string>,
  playersById: Map<string, Doc>,
): Promise<{
  strategyByModel: Map<string, StrategyAcc>
  tradesByModel: Map<string, TradeAcc>
  rentByModel: Map<string, RentAcc>
  propertyRent: Map<string, number>
  totalDecisions: number
  totalTrades: number
  acceptedTrades: number
  totalRentPaid: number
}> {
  const strategyByModel = new Map<string, StrategyAcc>()
  const tradesByModel = new Map<string, TradeAcc>()
  const rentByModel = new Map<string, RentAcc>()
  const propertyRent = new Map<string, number>()
  let totalDecisions = 0
  let totalTrades = 0
  let acceptedTrades = 0
  let totalRentPaid = 0

  for (const table of REQUIRED_GENERATION_ONLY_TABLES) {
    const path = join(extractDir, table, 'documents.jsonl')
    if (!existsSync(path)) {
      throw new MuseumGenerationError(
        `Snapshot missing required table: ${table}/documents.jsonl`,
      )
    }
  }

  const requirePlayerInGame = (
    playerId: unknown,
    gameId: string,
    kind: string,
    docId: string,
  ): Doc => {
    if (typeof playerId !== 'string') {
      throw new MuseumGenerationError(
        `Referential integrity failure: ${kind} ${docId} references missing player`,
      )
    }
    const player = playersById.get(playerId)
    if (!player) {
      throw new MuseumGenerationError(
        `Referential integrity failure: ${kind} ${docId} references missing player ${playerId}`,
      )
    }
    if (player.gameId !== gameId) {
      throw new MuseumGenerationError(
        `Referential integrity failure: ${kind} ${docId} player ${playerId} belongs to another game`,
      )
    }
    return player
  }

  const ensureStrategy = (player: Doc): StrategyAcc => {
    const modelId = String(player.modelId)
    let acc = strategyByModel.get(modelId)
    if (!acc) {
      acc = {
        modelId,
        modelDisplayName: String(player.modelDisplayName),
        buyTotal: 0,
        buyYes: 0,
        actionTotal: 0,
        tradeYes: 0,
        buildYes: 0,
        jailPay: 0,
        jailRoll: 0,
        jailCard: 0,
        decisionsAnalyzed: 0,
        decisionTimes: [],
      }
      strategyByModel.set(modelId, acc)
    }
    return acc
  }

  const decisionsPath = join(extractDir, 'decisions', 'documents.jsonl')
  for await (const decision of iterateJsonl(decisionsPath)) {
    const gameId = requireGenerationOnlyGameId(
      decision,
      'decision',
      allGameIds,
    )
    if (!completedIds.has(gameId)) continue
    const player = requirePlayerInGame(
      decision.playerId,
      gameId,
      'decision',
      decision._id,
    )
    const acc = ensureStrategy(player)
    acc.decisionsAnalyzed += 1
    totalDecisions += 1
    acc.decisionTimes.push(Number(decision.decisionTimeMs ?? 0))

    if (decision.decisionType === 'buy_property') {
      acc.buyTotal += 1
      if (decision.decisionMade === 'buy') acc.buyYes += 1
    } else if (
      decision.decisionType === 'pre_roll_actions' ||
      decision.decisionType === 'post_roll_actions'
    ) {
      acc.actionTotal += 1
      const made = String(decision.decisionMade)
      if (made.includes('trade')) acc.tradeYes += 1
      if (made.includes('build')) acc.buildYes += 1
    } else if (decision.decisionType === 'jail_strategy') {
      if (decision.decisionMade === 'pay') acc.jailPay += 1
      else if (decision.decisionMade === 'roll') acc.jailRoll += 1
      else if (decision.decisionMade === 'use_card') acc.jailCard += 1
    }
  }

  const tradesPath = join(extractDir, 'trades', 'documents.jsonl')
  for await (const trade of iterateJsonl(tradesPath)) {
    const gameId = requireGenerationOnlyGameId(trade, 'trade', allGameIds)
    if (!completedIds.has(gameId)) continue
    totalTrades += 1
    if (trade.status === 'accepted') acceptedTrades += 1
    const proposer = requirePlayerInGame(
      trade.proposerId,
      gameId,
      'trade',
      trade._id,
    )
    requirePlayerInGame(trade.recipientId, gameId, 'trade', trade._id)
    const modelId = String(proposer.modelId)
    const row = tradesByModel.get(modelId) ?? {
      tradesProposed: 0,
      tradesAccepted: 0,
    }
    row.tradesProposed += 1
    if (trade.status === 'accepted') row.tradesAccepted += 1
    tradesByModel.set(modelId, row)
  }

  const rentPath = join(extractDir, 'rentPayments', 'documents.jsonl')
  for await (const rent of iterateJsonl(rentPath)) {
    const gameId = requireGenerationOnlyGameId(rent, 'rentPayment', allGameIds)
    if (!completedIds.has(gameId)) continue
    const amount = Number(rent.amount ?? 0)
    totalRentPaid += amount
    const propertyName = String(rent.propertyName ?? '')
    propertyRent.set(
      propertyName,
      (propertyRent.get(propertyName) ?? 0) + amount,
    )

    const receiver = requirePlayerInGame(
      rent.receiverId,
      gameId,
      'rentPayment',
      rent._id,
    )
    const payer = requirePlayerInGame(
      rent.payerId,
      gameId,
      'rentPayment',
      rent._id,
    )
    {
      const modelId = String(receiver.modelId)
      const row = rentByModel.get(modelId) ?? {
        collected: 0,
        paid: 0,
        byProperty: new Map(),
      }
      row.collected += amount
      rentByModel.set(modelId, row)
    }
    {
      const modelId = String(payer.modelId)
      const row = rentByModel.get(modelId) ?? {
        collected: 0,
        paid: 0,
        byProperty: new Map(),
      }
      row.paid += amount
      rentByModel.set(modelId, row)
    }
  }

  return {
    strategyByModel,
    tradesByModel,
    rentByModel,
    propertyRent,
    totalDecisions,
    totalTrades,
    acceptedTrades,
    totalRentPaid,
  }
}

function buildAnalytics(
  completedGames: Doc[],
  playersByGame: Map<string, Doc[]>,
  propertiesByGame: Map<string, Doc[]>,
  transfersByGame: Map<string, Doc[]>,
  genMetrics: Awaited<ReturnType<typeof accumulateGenerationOnlyMetrics>>,
  allPlayers: Doc[],
): Record<string, unknown> {
  const playersById = new Map(allPlayers.map((p) => [p._id, p]))

  type ModelAgg = {
    modelId: string
    modelDisplayName: string
    modelProvider: string
    gamesPlayed: number
    wins: number
    secondPlace: number
    thirdPlace: number
    bankruptcies: number
    netWorths: number[]
    cashValues: number[]
    propertyCounts: number[]
    gameLengths: number[]
  }

  const modelAggs = new Map<string, ModelAgg>()
  const ensureModel = (player: Doc): ModelAgg => {
    const modelId = String(player.modelId)
    let agg = modelAggs.get(modelId)
    if (!agg) {
      agg = {
        modelId,
        modelDisplayName: String(player.modelDisplayName),
        modelProvider: String(player.modelProvider),
        gamesPlayed: 0,
        wins: 0,
        secondPlace: 0,
        thirdPlace: 0,
        bankruptcies: 0,
        netWorths: [],
        cashValues: [],
        propertyCounts: [],
        gameLengths: [],
      }
      modelAggs.set(modelId, agg)
    }
    return agg
  }

  const h2h = new Map<
    string,
    {
      pairKey: string
      modelAId: string
      modelADisplayName: string
      modelBId: string
      modelBDisplayName: string
      modelAWins: number
      modelBWins: number
      totalGames: number
      lengths: number[]
    }
  >()

  const propertyAggs = new Map<
    string,
    {
      propertyName: string
      propertyGroup: string
      position: number
      timesPurchased: number
      timesAuctioned: number
      purchasePrices: number[]
      auctionPrices: number[]
      ownerWins: number
      ownedGames: number
    }
  >()

  const ensurePropertyAgg = (prop: Doc) => {
    const name = String(prop.name)
    let pagg = propertyAggs.get(name)
    if (!pagg) {
      pagg = {
        propertyName: name,
        propertyGroup: String(prop.group),
        position: Number(prop.position),
        timesPurchased: 0,
        timesAuctioned: 0,
        purchasePrices: [],
        auctionPrices: [],
        ownerWins: 0,
        ownedGames: 0,
      }
      propertyAggs.set(name, pagg)
    }
    return pagg
  }

  let totalDuration = 0
  let durationGames = 0
  let totalTurns = 0

  const sortedGames = [...completedGames].sort(
    (a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0),
  )

  for (const game of sortedGames) {
    const players = [...(playersByGame.get(game._id) ?? [])].sort(
      (a, b) => Number(a.turnOrder) - Number(b.turnOrder),
    )
    const properties = propertiesByGame.get(game._id) ?? []
    const transfers = transfersByGame.get(game._id) ?? []
    const turnNumber = Number(game.currentTurnNumber ?? 0)
    totalTurns += turnNumber

    const startedAt = Number(game.startedAt ?? 0)
    const endedAt = Number(game.endedAt ?? 0)
    if (startedAt > 0 && endedAt > startedAt) {
      totalDuration += endedAt - startedAt
      durationGames += 1
    }

    for (const player of players) {
      const agg = ensureModel(player)
      agg.gamesPlayed += 1
      if (game.winnerId === player._id) agg.wins += 1
      if (player.finalPosition === 2) agg.secondPlace += 1
      if (player.finalPosition === 3) agg.thirdPlace += 1
      if (player.isBankrupt) agg.bankruptcies += 1
      const netWorth =
        typeof player.finalNetWorth === 'number'
          ? player.finalNetWorth
          : Number(player.cash ?? 0)
      agg.netWorths.push(netWorth)
      agg.cashValues.push(Number(player.cash ?? 0))
      agg.propertyCounts.push(
        properties.filter((p) => p.ownerId === player._id).length,
      )
      agg.gameLengths.push(turnNumber)
    }

    const modelsInGame = new Map<string, string>()
    for (const player of players) {
      modelsInGame.set(String(player.modelId), String(player.modelDisplayName))
    }
    const modelIds = [...modelsInGame.keys()].sort()
    const winner =
      typeof game.winnerId === 'string'
        ? playersById.get(game.winnerId)
        : undefined
    const winnerModelId = winner ? String(winner.modelId) : null
    for (let i = 0; i < modelIds.length; i++) {
      for (let j = i + 1; j < modelIds.length; j++) {
        const modelAId = modelIds[i]
        const modelBId = modelIds[j]
        const pairKey = `${modelAId}|${modelBId}`
        let row = h2h.get(pairKey)
        if (!row) {
          row = {
            pairKey,
            modelAId,
            modelADisplayName: modelsInGame.get(modelAId) ?? modelAId,
            modelBId,
            modelBDisplayName: modelsInGame.get(modelBId) ?? modelBId,
            modelAWins: 0,
            modelBWins: 0,
            totalGames: 0,
            lengths: [],
          }
          h2h.set(pairKey, row)
        }
        row.totalGames += 1
        row.lengths.push(turnNumber)
        if (winnerModelId === modelAId) row.modelAWins += 1
        if (winnerModelId === modelBId) row.modelBWins += 1
      }
    }

    const firstBankByProperty = new Set<string>()
    for (const transfer of transfers) {
      if (!isBankAcquisition(transfer)) continue
      const propertyId = String(transfer.propertyId)
      if (firstBankByProperty.has(propertyId)) continue
      firstBankByProperty.add(propertyId)

      const prop = properties.find((p) => p._id === transfer.propertyId)
      if (!prop) continue
      const pagg = ensurePropertyAgg(prop)
      const reason = transfer.reason
      const price =
        typeof transfer.price === 'number' ? transfer.price : undefined
      if (reason === 'auction') {
        pagg.timesAuctioned += 1
        if (price !== undefined) pagg.auctionPrices.push(price)
      } else if (reason === 'purchase') {
        pagg.timesPurchased += 1
        if (price !== undefined) pagg.purchasePrices.push(price)
      }
    }

    for (const prop of properties) {
      if (typeof prop.ownerId !== 'string') continue
      const pagg = ensurePropertyAgg(prop)
      pagg.ownedGames += 1
      if (game.winnerId === prop.ownerId) pagg.ownerWins += 1
    }
  }

  const leaderboard = [...modelAggs.values()]
    .map((agg) => {
      const trades = genMetrics.tradesByModel.get(agg.modelId) ?? {
        tradesProposed: 0,
        tradesAccepted: 0,
      }
      const rent = genMetrics.rentByModel.get(agg.modelId) ?? {
        collected: 0,
        paid: 0,
        byProperty: new Map(),
      }
      const strategy = genMetrics.strategyByModel.get(agg.modelId)
      const winRate = agg.gamesPlayed > 0 ? agg.wins / agg.gamesPlayed : 0
      return {
        modelId: agg.modelId,
        modelDisplayName: agg.modelDisplayName,
        modelProvider: agg.modelProvider,
        gamesPlayed: agg.gamesPlayed,
        wins: agg.wins,
        secondPlace: agg.secondPlace,
        thirdPlace: agg.thirdPlace,
        bankruptcies: agg.bankruptcies,
        avgFinalNetWorth: average(agg.netWorths),
        avgFinalCash: average(agg.cashValues),
        totalRentCollected: rent.collected,
        totalRentPaid: rent.paid,
        avgPropertiesOwned: average(agg.propertyCounts),
        monopoliesCompleted: 0,
        tradesProposed: trades.tradesProposed,
        tradesAccepted: trades.tradesAccepted,
        tradeAcceptRate:
          trades.tradesProposed > 0
            ? trades.tradesAccepted / trades.tradesProposed
            : 0,
        avgDecisionTimeMs: average(strategy?.decisionTimes ?? []),
        avgGameLength: average(agg.gameLengths),
        winRate,
      }
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)

  const mostWinning = leaderboard[0]
    ? {
        modelId: leaderboard[0].modelId,
        modelDisplayName: leaderboard[0].modelDisplayName,
        wins: leaderboard[0].wins,
      }
    : null

  const matrix: Record<
    string,
    Record<string, { wins: number; losses: number; totalGames: number }>
  > = {}
  const modelDisplayNames: Record<string, string> = {}
  for (const entry of leaderboard) {
    modelDisplayNames[entry.modelId] = entry.modelDisplayName
  }
  for (const row of h2h.values()) {
    const rowA = (matrix[row.modelAId] ??= {})
    const rowB = (matrix[row.modelBId] ??= {})
    rowA[row.modelBId] = {
      wins: row.modelAWins,
      losses: row.modelBWins,
      totalGames: row.totalGames,
    }
    rowB[row.modelAId] = {
      wins: row.modelBWins,
      losses: row.modelAWins,
      totalGames: row.totalGames,
    }
  }

  const propertyStats = [...propertyAggs.values()]
    .map((p) => ({
      propertyName: p.propertyName,
      propertyGroup: p.propertyGroup,
      position: p.position,
      timesPurchased: p.timesPurchased,
      timesAuctioned: p.timesAuctioned,
      avgPurchasePrice: average(p.purchasePrices),
      avgAuctionPrice: average(p.auctionPrices),
      totalRentCollected: genMetrics.propertyRent.get(p.propertyName) ?? 0,
      avgRentPerGame:
        completedGames.length > 0
          ? (genMetrics.propertyRent.get(p.propertyName) ?? 0) /
            completedGames.length
          : 0,
      ownerWinRate: p.ownedGames > 0 ? p.ownerWins / p.ownedGames : 0,
    }))
    .sort((a, b) => b.ownerWinRate - a.ownerWinRate)

  const strategyProfiles = [...genMetrics.strategyByModel.values()].map(
    (acc) => {
      const buyRate = acc.buyTotal > 0 ? acc.buyYes / acc.buyTotal : 0
      const tradeFrequency =
        acc.actionTotal > 0 ? acc.tradeYes / acc.actionTotal : 0
      const buildSpeed =
        acc.actionTotal > 0 ? acc.buildYes / acc.actionTotal : 0
      let jailStrategy = 'unknown'
      const jailTotal = acc.jailPay + acc.jailRoll + acc.jailCard
      if (jailTotal > 0) {
        if (acc.jailPay >= acc.jailRoll && acc.jailPay >= acc.jailCard) {
          jailStrategy = 'pay'
        } else if (acc.jailRoll >= acc.jailCard) {
          jailStrategy = 'roll'
        } else {
          jailStrategy = 'use_card'
        }
      }
      return {
        modelId: acc.modelId,
        modelDisplayName: acc.modelDisplayName,
        buyRate: round2(buyRate),
        tradeFrequency: round2(tradeFrequency),
        buildSpeed: round2(buildSpeed),
        riskTolerance: round2(buyRate),
        jailStrategy,
        decisionsAnalyzed: acc.decisionsAnalyzed,
      }
    },
  )

  const cumulativeWins: Record<
    string,
    Array<{ gameNumber: number; cumulativeWins: number; modelName: string }>
  > = {}
  let gameNumber = 1
  for (const game of sortedGames) {
    if (typeof game.winnerId === 'string') {
      const winner = playersById.get(game.winnerId)
      if (winner) {
        const modelId = String(winner.modelId)
        const winsForModel = (cumulativeWins[modelId] ??= [])
        const prevWins =
          winsForModel.length > 0
            ? winsForModel[winsForModel.length - 1].cumulativeWins
            : 0
        winsForModel.push({
          gameNumber,
          cumulativeWins: prevWins + 1,
          modelName: String(winner.modelDisplayName),
        })
      }
    }
    gameNumber += 1
  }

  const recentGames = [...sortedGames]
    .reverse()
    .slice(0, 20)
    .map((game) => {
      const players = playersByGame.get(game._id) ?? []
      const winner =
        typeof game.winnerId === 'string'
          ? players.find((p) => p._id === game.winnerId)
          : undefined
      return {
        _id: game._id,
        status: game.status,
        currentTurnNumber: game.currentTurnNumber,
        endingReason: game.endingReason,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        winner: winner
          ? {
              _id: winner._id,
              modelId: winner.modelId,
              modelDisplayName: winner.modelDisplayName,
              modelProvider: winner.modelProvider,
              finalNetWorth: winner.finalNetWorth,
            }
          : null,
        playerCount: players.length,
        players: players
          .slice()
          .sort((a, b) => Number(a.turnOrder) - Number(b.turnOrder))
          .map((p) => ({
            modelDisplayName: p.modelDisplayName,
            finalPosition: p.finalPosition,
            isBankrupt: p.isBankrupt,
          })),
      }
    })

  const modelDetails: Record<string, unknown> = {}
  for (const entry of leaderboard) {
    const modelGames = recentGames
      .map((g) => {
        const players = playersByGame.get(g._id) ?? []
        const player = players.find((p) => p.modelId === entry.modelId)
        if (!player) return null
        return {
          gameId: g._id,
          status: g.status,
          turnNumber: g.currentTurnNumber,
          won: g.winner?._id === player._id,
          finalPosition: player.finalPosition,
          finalNetWorth: player.finalNetWorth,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 10)
    const winTrend =
      modelGames.length > 0
        ? modelGames.filter((g) => g.won).length / modelGames.length
        : 0
    modelDetails[entry.modelId] = {
      stats: entry,
      recentGames: modelGames,
      trends: {
        recentWinRate: winTrend,
        gamesAnalyzed: modelGames.length,
      },
    }
  }

  return {
    generatedAt: deriveGeneratedAt(completedGames),
    source: {
      completedGames: completedGames.length,
      omittedTables: [...OMITTED_FROM_ARCHIVE],
    },
    global: {
      totalGames: completedGames.length,
      completedGames: completedGames.length,
      inProgressGames: 0,
      abandonedGames: 0,
      totalDecisions: genMetrics.totalDecisions,
      totalTrades: genMetrics.totalTrades,
      acceptedTrades: genMetrics.acceptedTrades,
      totalRentPaid: genMetrics.totalRentPaid,
      avgGameLength: Math.round(
        completedGames.length > 0 ? totalTurns / completedGames.length : 0,
      ),
      avgDurationMs: Math.round(
        durationGames > 0 ? totalDuration / durationGames : 0,
      ),
      totalModelsPlayed: leaderboard.length,
      mostWinningModel: mostWinning,
    },
    leaderboard,
    headToHead: {
      matrix,
      modelDisplayNames,
      models: Object.keys(matrix),
      records: [...h2h.values()].map(
        ({ lengths: _lengths, ...row }) => ({
          ...row,
          avgGameLength: average(_lengths),
        }),
      ),
    },
    propertyStats,
    strategyProfiles,
    winRateTrends: {
      trends: cumulativeWins,
      totalGames: sortedGames.length,
    },
    recentGames,
    modelDetails,
  }
}

function buildGameIndexEntry(
  game: Doc,
  players: Doc[],
): Record<string, unknown> {
  const winner = players.find((p) => p._id === game.winnerId)
  return {
    id: game._id,
    status: game.status,
    currentTurnNumber: game.currentTurnNumber,
    endingReason: game.endingReason,
    createdAt: game.createdAt,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    winner: winner
      ? {
          id: winner._id,
          modelId: winner.modelId,
          modelDisplayName: winner.modelDisplayName,
          modelProvider: winner.modelProvider,
          finalNetWorth: winner.finalNetWorth,
        }
      : null,
    players: players
      .slice()
      .sort((a, b) => Number(a.turnOrder) - Number(b.turnOrder))
      .map((p) => ({
        id: p._id,
        modelId: p.modelId,
        modelDisplayName: p.modelDisplayName,
        modelProvider: p.modelProvider,
        tokenColor: p.tokenColor,
        finalPosition: p.finalPosition,
        finalNetWorth: p.finalNetWorth,
        isBankrupt: p.isBankrupt,
      })),
  }
}

/**
 * Convert a Convex document export zip into static museum assets.
 * Public boundary: snapshot zip in → museum JSON tree out.
 */
export async function generateMuseumFromSnapshot(
  options: GenerateMuseumOptions,
): Promise<MuseumGenerationResult> {
  if (!existsSync(options.snapshotPath)) {
    throw new MuseumGenerationError(
      `Snapshot not found: ${options.snapshotPath}`,
    )
  }

  const extractDir = extractSnapshot(options.snapshotPath)
  try {
    for (const table of REQUIRED_GAME_TABLES) {
      const path = join(extractDir, table, 'documents.jsonl')
      if (!existsSync(path)) {
        throw new MuseumGenerationError(
          `Snapshot missing required table: ${table}/documents.jsonl`,
        )
      }
    }

    const allGames = await readTableFiltered(extractDir, 'games', true)
    const abandonedExcludedCount = allGames.filter(
      (g) => g.status === 'abandoned',
    ).length
    const completedGames = allGames
      .filter((g) => g.status === 'completed')
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
    const completedIds = new Set(completedGames.map((g) => g._id))
    const allGameIds = new Set(allGames.map((g) => g._id))
    const keepCompletedRelated = (tableName: string) => (doc: Doc) => {
      if (typeof doc.gameId !== 'string') {
        throw new MuseumGenerationError(
          `Referential integrity failure: ${tableName} document ${doc._id} has non-string gameId`,
        )
      }
      return completedIds.has(doc.gameId)
    }

    const players = await readTableFiltered(
      extractDir,
      'players',
      true,
      keepCompletedRelated('players'),
    )
    const properties = await readTableFiltered(
      extractDir,
      'properties',
      true,
      keepCompletedRelated('properties'),
    )
    const turns = await readTableFiltered(
      extractDir,
      'turns',
      true,
      keepCompletedRelated('turns'),
    )
    const propertyTransfers = await readTableFiltered(
      extractDir,
      'propertyTransfers',
      true,
      keepCompletedRelated('propertyTransfers'),
    )
    const propertyStateEvents = await readTableFiltered(
      extractDir,
      'propertyStateEvents',
      true,
      keepCompletedRelated('propertyStateEvents'),
    )

    const playersByGame = groupByGameId(players)
    const propertiesByGame = groupByGameId(properties)
    const turnsByGame = groupByGameId(turns)
    const transfersByGame = groupByGameId(propertyTransfers)
    const stateEventsByGame = groupByGameId(propertyStateEvents)
    const playersById = new Map(players.map((p) => [p._id, p]))

    for (const game of completedGames) {
      assertReferentialIntegrity(game, {
        players: playersByGame.get(game._id) ?? [],
        properties: propertiesByGame.get(game._id) ?? [],
        turns: turnsByGame.get(game._id) ?? [],
        propertyTransfers: transfersByGame.get(game._id) ?? [],
        propertyStateEvents: stateEventsByGame.get(game._id) ?? [],
      })
    }

    const genMetrics = await accumulateGenerationOnlyMetrics(
      extractDir,
      completedIds,
      allGameIds,
      playersById,
    )

    mkdirSync(options.outputDir, { recursive: true })
    const gamesDir = join(options.outputDir, 'games')
    if (existsSync(gamesDir)) {
      rmSync(gamesDir, { recursive: true, force: true })
    }
    mkdirSync(gamesDir, { recursive: true })

    const outputFiles: string[] = []
    const gameIds: string[] = []

    const indexGames = completedGames.map((game) => {
      const gamePlayers = playersByGame.get(game._id) ?? []
      const payload = {
        game,
        players: gamePlayers
          .slice()
          .sort((a, b) => Number(a.turnOrder) - Number(b.turnOrder)),
        properties: propertiesByGame.get(game._id) ?? [],
        turns: (turnsByGame.get(game._id) ?? [])
          .slice()
          .sort((a, b) => Number(a.turnNumber) - Number(b.turnNumber)),
        propertyTransfers: (transfersByGame.get(game._id) ?? [])
          .slice()
          .sort(
            (a, b) =>
              Number(a.turnNumber) - Number(b.turnNumber) ||
              Number(a.createdAt) - Number(b.createdAt),
          ),
        propertyStateEvents: (stateEventsByGame.get(game._id) ?? [])
          .slice()
          .sort(
            (a, b) =>
              Number(a.turnNumber) - Number(b.turnNumber) ||
              Number(a.createdAt) - Number(b.createdAt),
          ),
      }

      for (const key of OMITTED_FROM_ARCHIVE) {
        if (key in payload) {
          throw new MuseumGenerationError(
            `Internal error: archive payload must not include ${key}`,
          )
        }
      }

      const fileName = `${game._id}.json`
      writeFileSync(join(gamesDir, fileName), JSON.stringify(payload))
      outputFiles.push(join('games', fileName))
      gameIds.push(game._id)
      return buildGameIndexEntry(game, gamePlayers)
    })

    const generatedAt = deriveGeneratedAt(completedGames)
    const index = {
      generatedAt,
      completedGameCount: completedGames.length,
      abandonedExcludedCount,
      games: indexGames,
    }
    writeFileSync(join(options.outputDir, 'index.json'), JSON.stringify(index))
    outputFiles.push('index.json')

    const analytics = buildAnalytics(
      completedGames,
      playersByGame,
      propertiesByGame,
      transfersByGame,
      genMetrics,
      players,
    )
    for (const key of OMITTED_FROM_ARCHIVE) {
      if (key in analytics) {
        throw new MuseumGenerationError(
          `Internal error: analytics must not include ${key}`,
        )
      }
    }
    writeFileSync(
      join(options.outputDir, 'analytics.json'),
      JSON.stringify(analytics),
    )
    outputFiles.push('analytics.json')

    return {
      completedGameCount: completedGames.length,
      abandonedExcludedCount,
      gameIds,
      outputFiles,
    }
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

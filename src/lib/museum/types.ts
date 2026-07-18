export type MuseumGameIndexEntry = {
  id: string
  status: 'completed'
  currentTurnNumber: number
  endingReason?: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  winner: {
    id: string
    modelId: string
    modelDisplayName: string
    modelProvider: string
    finalNetWorth?: number
  } | null
  players: Array<{
    id: string
    modelId: string
    modelDisplayName: string
    modelProvider: string
    tokenColor: string
    finalPosition?: number
    finalNetWorth?: number
    isBankrupt: boolean
  }>
}

export type MuseumGameIndex = {
  generatedAt: string
  completedGameCount: number
  abandonedExcludedCount: number
  games: Array<MuseumGameIndexEntry>
}

export type MuseumLeaderboardEntry = {
  modelId: string
  modelDisplayName: string
  modelProvider: string
  gamesPlayed: number
  wins: number
  secondPlace: number
  thirdPlace: number
  bankruptcies: number
  avgFinalNetWorth: number
  avgFinalCash: number
  totalRentCollected: number
  totalRentPaid: number
  avgPropertiesOwned: number
  monopoliesCompleted: number
  tradesProposed: number
  tradesAccepted: number
  tradeAcceptRate: number
  avgDecisionTimeMs: number
  avgGameLength: number
  winRate: number
}

export type MuseumAnalytics = {
  generatedAt: string
  global: {
    totalGames: number
    completedGames: number
    inProgressGames: number
    abandonedGames: number
    totalDecisions: number
    totalTrades: number
    acceptedTrades: number
    totalRentPaid: number
    avgGameLength: number
    avgDurationMs: number
    totalModelsPlayed: number
    mostWinningModel: {
      modelId: string
      modelDisplayName: string
      wins: number
    } | null
  }
  leaderboard: Array<MuseumLeaderboardEntry>
  headToHead: {
    matrix: Record<
      string,
      Record<string, { wins: number; losses: number; totalGames: number }>
    >
    modelDisplayNames: Record<string, string>
    models: Array<string>
    records: Array<{
      pairKey: string
      modelAId: string
      modelADisplayName: string
      modelBId: string
      modelBDisplayName: string
      modelAWins: number
      modelBWins: number
      totalGames: number
      avgGameLength: number
    }>
  }
  propertyStats: Array<{
    propertyName: string
    propertyGroup: string
    position: number
    timesPurchased: number
    timesAuctioned: number
    avgPurchasePrice: number
    avgAuctionPrice: number
    totalRentCollected: number
    avgRentPerGame: number
    ownerWinRate: number
  }>
  strategyProfiles: Array<{
    modelId: string
    modelDisplayName: string
    buyRate: number
    tradeFrequency: number
    buildSpeed: number
    riskTolerance: number
    jailStrategy: string
    decisionsAnalyzed: number
  }>
  winRateTrends: {
    trends: Record<
      string,
      Array<{ gameNumber: number; cumulativeWins: number; modelName: string }>
    >
    totalGames: number
  }
  recentGames: Array<{
    _id: string
    status: string
    currentTurnNumber: number
    endingReason?: string
    createdAt: number
    startedAt?: number
    endedAt?: number
    winner: {
      _id: string
      modelId: string
      modelDisplayName: string
      modelProvider: string
      finalNetWorth?: number
    } | null
    playerCount: number
    players: Array<{
      modelDisplayName: string
      finalPosition?: number
      isBankrupt: boolean
    }>
  }>
  modelDetails: Record<
    string,
    {
      stats: MuseumLeaderboardEntry
      recentGames: Array<{
        gameId: string
        status: string
        turnNumber: number
        won: boolean
        finalPosition?: number
        finalNetWorth?: number
      }>
      trends: { recentWinRate: number; gamesAnalyzed: number }
    }
  >
}

export type MuseumPlayer = {
  _id: string
  gameId: string
  modelId: string
  modelDisplayName: string
  modelProvider: string
  tokenColor: string
  textColor?: string
  turnOrder: number
  cash: number
  position: number
  inJail: boolean
  jailTurnsRemaining: number
  getOutOfJailCards: number
  isBankrupt: boolean
  consecutiveDoubles: number
  finalPosition?: number
  finalNetWorth?: number
  bankruptcyTurn?: number
}

export type MuseumProperty = {
  _id: string
  gameId: string
  position: number
  name: string
  group: string
  ownerId?: string
  houses: number
  isMortgaged: boolean
}

export type MuseumTurn = {
  _id: string
  gameId: string
  playerId: string
  turnNumber: number
  diceRoll?: Array<number>
  wasDoubles?: boolean
  positionBefore: number
  positionAfter?: number
  passedGo?: boolean
  landedOn?: string
  cashBefore: number
  cashAfter?: number
  events: Array<string>
  startedAt: number
  endedAt?: number
}

export type MuseumPropertyTransfer = {
  _id: string
  gameId: string
  turnNumber: number
  propertyId: string
  fromOwnerId?: string
  toOwnerId?: string
  reason: string
  price?: number
  createdAt: number
}

export type MuseumPropertyStateEvent = {
  _id: string
  gameId: string
  turnNumber: number
  propertyId: string
  houses?: number
  isMortgaged?: boolean
  reason: string
  createdAt: number
}

export type MuseumGameReplay = {
  game: {
    _id: string
    status: string
    currentPlayerIndex: number
    currentTurnNumber: number
    currentPhase: string
    winnerId?: string
    endingReason?: string
    config: {
      turnLimit?: number
      speedMs: number
      startingMoney: number
    }
    createdAt: number
    startedAt?: number
    endedAt?: number
  }
  players: Array<MuseumPlayer>
  properties: Array<MuseumProperty>
  turns: Array<MuseumTurn>
  propertyTransfers: Array<MuseumPropertyTransfer>
  propertyStateEvents: Array<MuseumPropertyStateEvent>
}

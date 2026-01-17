# LLM Monopoly Arena - Architecture Diagrams

This document contains Mermaid diagrams showing how all components work together

## System Overview

```mermaid
flowchart TB
    subgraph Frontend["Frontend (TanStack Start)"]
        Home["/index.tsx<br/>Home Page"]
        Arena["/play/index.tsx<br/>Arena Mode"]
        LiveGame["/play/$gameId.tsx<br/>Live Game Viewer"]
        History["/games/index.tsx<br/>Game History"]
        Replay["/games/$gameId.tsx<br/>Game Replay"]
        Analytics["/analytics/*<br/>Leaderboard & Stats"]
    end

    subgraph Convex["Convex Backend"]
        subgraph Queries["Queries (Read-only)"]
            GamesQ["games.ts<br/>list, get, getFullState"]
            PlayersQ["players.ts<br/>getByGame, getCurrent"]
            PropsQ["properties.ts<br/>getByGame, getByOwner"]
            TurnsQ["turns.ts<br/>getByGame, getLatest"]
            DecisionsQ["decisions.ts<br/>getByGame, getByPlayer"]
            AnalyticsQ["analytics.ts<br/>getLeaderboard, getHeadToHead"]
        end

        subgraph Mutations["Internal Mutations"]
            GameEngine["gameEngine.ts<br/>startGame, processTurnStep"]
            Executors["llmDecisionExecutors.ts<br/>Execute LLM choices"]
            StatsAgg["statsAggregator.ts<br/>Update analytics"]
        end

        subgraph Actions["Actions (External API)"]
            LLMDecisions["llmDecisions.ts<br/>getLLMDecision"]
        end

        subgraph Cron["Scheduled Jobs"]
            CronJob["crons.ts<br/>Hourly arena game"]
            ArenaScheduler["arenaScheduler.ts<br/>startScheduledGame"]
        end

        subgraph Lib["Pure Logic Libraries"]
            Board["board.ts<br/>Space info, positions"]
            Rent["rent.ts<br/>Rent calculation"]
            Cards["cards.ts<br/>Chance/CC execution"]
            Validation["validation.ts<br/>Action validation"]
            Bankruptcy["bankruptcy.ts<br/>Asset liquidation"]
            Prompts["prompts.ts<br/>LLM prompt building"]
        end

        DB[(Convex Database)]
    end

    subgraph External["External Services"]
        OpenRouter["OpenRouter API<br/>Claude, GPT, Gemini, Grok"]
    end

    %% Frontend to Convex
    Home --> GamesQ
    Arena --> ArenaScheduler
    LiveGame --> GamesQ
    LiveGame --> PlayersQ
    LiveGame --> PropsQ
    LiveGame --> TurnsQ
    History --> GamesQ
    Replay --> TurnsQ
    Replay --> DecisionsQ
    Analytics --> AnalyticsQ

    %% Convex internal flow
    CronJob -->|every hour| ArenaScheduler
    ArenaScheduler --> GameEngine
    GameEngine --> LLMDecisions
    LLMDecisions --> OpenRouter
    LLMDecisions --> Executors
    Executors --> GameEngine
    GameEngine --> StatsAgg

    %% Database connections
    Queries --> DB
    Mutations --> DB
    Actions --> Mutations

    %% Lib usage
    GameEngine --> Lib
    Executors --> Lib
    LLMDecisions --> Prompts
```

## Game Turn Flow

```mermaid
stateDiagram-v2
    [*] --> Setup: Create Game

    Setup --> PreRoll: Start Game

    PreRoll --> Rolling: LLM Pre-Roll Actions<br/>(build, trade, mortgage)

    Rolling --> PostRoll: Roll Dice & Move

    Rolling --> Rolling: Rolled Doubles<br/>(up to 3x)

    Rolling --> Jail: 3 Consecutive Doubles

    PostRoll --> TurnEnd: Handle Landing<br/>(rent, buy, cards)

    PostRoll --> Rolling: Rolled Doubles<br/>(roll again)

    TurnEnd --> PreRoll: Next Player's Turn

    TurnEnd --> GameOver: Only 1 Player Left

    TurnEnd --> GameOver: Turn Limit Reached

    Jail --> Rolling: Exit Jail<br/>(pay, roll doubles, card)

    GameOver --> [*]: Update Stats
```

## LLM Decision Flow

```mermaid
sequenceDiagram
    participant GE as Game Engine
    participant LD as llmDecisions.ts
    participant OR as OpenRouter API
    participant EX as Executors
    participant DB as Database

    GE->>DB: Set waitingForLLM=true
    GE->>LD: Schedule getLLMDecision
    LD->>LD: Build prompts from game state
    LD->>OR: POST /chat/completions
    OR-->>LD: JSON response with action
    LD->>LD: Parse & validate response
    LD->>DB: Log decision record
    LD->>EX: Execute decision
    EX->>DB: Apply game changes
    EX->>DB: Clear waitingForLLM
    EX->>GE: Schedule next step
```

## Database Schema

```mermaid
erDiagram
    games ||--o{ players : has
    games ||--o{ properties : has
    games ||--o{ turns : has
    games ||--o{ trades : has

    players ||--o{ turns : takes
    players ||--o{ decisions : makes
    players ||--o{ properties : owns

    turns ||--o{ decisions : contains

    modelStats ||--|| models : tracks
    headToHead ||--|| modelPairs : compares
    propertyStats ||--|| boardSpaces : tracks

    games {
        id _id PK
        string status
        number currentPlayerIndex
        number currentTurnNumber
        string currentPhase
        id winnerId FK
        object config
        array chanceDeck
        array communityChestDeck
        boolean isPaused
        boolean waitingForLLM
        object pendingDecision
        boolean isScheduledArena
        number createdAt
        number startedAt
        number endedAt
    }

    players {
        id _id PK
        id gameId FK
        string modelId
        string modelDisplayName
        string modelProvider
        string tokenColor
        string textColor
        number turnOrder
        number cash
        number position
        boolean inJail
        number jailTurnsRemaining
        number getOutOfJailCards
        boolean isBankrupt
        number consecutiveDoubles
        number finalPosition
        number finalNetWorth
    }

    properties {
        id _id PK
        id gameId FK
        number position
        string name
        string group
        id ownerId FK
        number houses
        boolean isMortgaged
    }

    turns {
        id _id PK
        id gameId FK
        id playerId FK
        number turnNumber
        array diceRoll
        boolean wasDoubles
        number positionBefore
        number positionAfter
        boolean passedGo
        string landedOn
        number cashBefore
        number cashAfter
        array events
        number startedAt
        number endedAt
    }

    decisions {
        id _id PK
        id gameId FK
        id playerId FK
        id turnId FK
        number turnNumber
        string decisionType
        string context
        array optionsAvailable
        string decisionMade
        string parameters
        string reasoning
        string rawResponse
        number promptTokens
        number completionTokens
        number decisionTimeMs
    }

    trades {
        id _id PK
        id gameId FK
        number turnNumber
        id proposerId FK
        id recipientId FK
        number offerMoney
        array offerProperties
        number offerGetOutOfJailCards
        number requestMoney
        array requestProperties
        number requestGetOutOfJailCards
        string status
        string proposerReasoning
        string recipientReasoning
    }

    modelStats {
        id _id PK
        string modelId UK
        string modelDisplayName
        string modelProvider
        number gamesPlayed
        number wins
        number secondPlace
        number thirdPlace
        number bankruptcies
        number avgFinalNetWorth
        number totalRentCollected
        number totalRentPaid
        number monopoliesCompleted
        number tradesProposed
        number tradesAccepted
        number avgDecisionTimeMs
    }

    headToHead {
        id _id PK
        string pairKey UK
        string modelAId
        string modelBId
        number modelAWins
        number modelBWins
        number totalGames
    }

    propertyStats {
        id _id PK
        string propertyName UK
        string propertyGroup
        number position
        number timesPurchased
        number timesAuctioned
        number avgPurchasePrice
        number totalRentCollected
        number ownerWinRate
    }
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Pages["Route Pages"]
        Index["index.tsx<br/>Landing Page"]
        PlayIndex["play/index.tsx<br/>Arena Mode"]
        PlayGame["play/$gameId.tsx<br/>Live Viewer"]
        GamesIndex["games/index.tsx<br/>History"]
        GamesReplay["games/$gameId.tsx<br/>Replay"]
        AnalyticsIndex["analytics/index.tsx<br/>Dashboard"]
        Leaderboard["analytics/leaderboard.tsx"]
        H2H["analytics/head-to-head.tsx"]
    end

    subgraph GameComponents["Game Components"]
        Board["Board.tsx<br/>11x11 Grid"]
        BoardSpace["BoardSpace.tsx<br/>Individual Space"]
        PlayerPanel["PlayerPanel.tsx<br/>Player Info"]
        ActionLog["ActionLog.tsx<br/>Event Feed"]
        DiceDisplay["DiceDisplay.tsx<br/>Dice Animation"]
        GameControls["GameControls.tsx<br/>Play/Pause"]
        LLMThinking["LLMThinking.tsx<br/>Wait Indicator"]
        TradeModal["TradeModal.tsx<br/>Trade UI"]
    end

    subgraph AnalyticsComponents["Analytics Components"]
        LeaderboardTable["LeaderboardTable.tsx"]
        H2HMatrix["HeadToHeadMatrix.tsx"]
        PropertyHeatmap["PropertyHeatmap.tsx"]
        StrategyProfile["StrategyProfile.tsx"]
        WinRateChart["WinRateChart.tsx"]
    end

    subgraph UIComponents["UI Components"]
        Button["Button.tsx"]
        Card["Card.tsx"]
        Modal["Modal.tsx"]
        Select["Select.tsx"]
        Badge["Badge.tsx"]
        Loading["LoadingStates.tsx"]
    end

    PlayGame --> Board
    PlayGame --> PlayerPanel
    PlayGame --> ActionLog
    PlayGame --> GameControls
    Board --> BoardSpace
    Board --> DiceDisplay
    PlayGame --> LLMThinking
    PlayGame --> TradeModal

    GamesReplay --> Board
    GamesReplay --> PlayerPanel

    Leaderboard --> LeaderboardTable
    H2H --> H2HMatrix
    AnalyticsIndex --> WinRateChart

    GameComponents --> UIComponents
    AnalyticsComponents --> UIComponents
```

## Arena Mode Scheduling

```mermaid
sequenceDiagram
    participant Cron as Convex Cron<br/>(Every Hour)
    participant AS as arenaScheduler
    participant DB as Database
    participant GE as Game Engine
    participant Models as Budget Models

    Cron->>AS: startScheduledGame()
    AS->>DB: Check for active games
    alt Game in progress
        AS-->>Cron: Skip (return null)
    else No active game
        AS->>AS: Shuffle budget models
        AS->>DB: Create game (status=setup)
        loop For each of 5 models
            AS->>DB: Create player
        end
        AS->>DB: Initialize 28 properties
        AS->>DB: Set status=in_progress
        AS->>GE: Schedule processTurnStep
        GE->>Models: Begin game loop
    end
```

## Budget Models

```mermaid
flowchart LR
    subgraph BudgetTier["Budget Tier Models"]
        GPT["GPT-4o Mini<br/>OpenAI"]
        Gemini1["Gemini 2.0 Flash<br/>Google"]
        Gemini2["Gemini 2.5 Flash Lite<br/>Google"]
        Haiku["Claude 3.5 Haiku<br/>Anthropic"]
        Grok["Grok 3 Mini<br/>xAI"]
    end

    subgraph Shuffle["Random Selection"]
        Fisher["Fisher-Yates Shuffle"]
    end

    subgraph Game["Arena Game"]
        P1["Player 1"]
        P2["Player 2"]
        P3["Player 3"]
        P4["Player 4"]
        P5["Player 5"]
    end

    BudgetTier --> Fisher
    Fisher --> Game
```

## Rent Calculation Logic

```mermaid
flowchart TD
    Start["Calculate Rent"] --> CheckOwned{Property Owned?}
    CheckOwned -->|No| Zero1["$0"]
    CheckOwned -->|Yes| CheckMortgage{Mortgaged?}
    CheckMortgage -->|Yes| Zero2["$0"]
    CheckMortgage -->|No| CheckType{Property Type?}

    CheckType -->|Regular| CheckMonopoly{Has Monopoly?}
    CheckMonopoly -->|No| BaseRent["Base Rent"]
    CheckMonopoly -->|Yes| CheckHouses{Houses?}
    CheckHouses -->|0| DoubleBase["2x Base Rent"]
    CheckHouses -->|1-4| HouseRent["House Rent Table"]
    CheckHouses -->|5 Hotel| HotelRent["Hotel Rent"]

    CheckType -->|Railroad| CountRR{How Many RR?}
    CountRR -->|1| RR1["$25"]
    CountRR -->|2| RR2["$50"]
    CountRR -->|3| RR3["$100"]
    CountRR -->|4| RR4["$200"]

    CheckType -->|Utility| CountUtil{How Many Utils?}
    CountUtil -->|1| U1["4x Dice Roll"]
    CountUtil -->|2| U2["10x Dice Roll"]
```

## File Structure

```mermaid
flowchart TB
    subgraph Root["monopoly-llm/"]
        Package["package.json"]
        ConvexJson["convex.json"]
        Vite["vite.config.ts"]
        Tailwind["tailwind.config.js"]
    end

    subgraph Convex["convex/"]
        Schema["schema.ts"]
        Games["games.ts"]
        Players["players.ts"]
        Properties["properties.ts"]
        Turns["turns.ts"]
        Decisions["decisions.ts"]
        Trades["trades.ts"]
        GameEngine2["gameEngine.ts"]
        LLMDecisions["llmDecisions.ts"]
        LLMExecutors["llmDecisionExecutors.ts"]
        LLMActions["llmActions.ts"]
        Analytics2["analytics.ts"]
        StatsAgg2["statsAggregator.ts"]
        Scheduler["scheduler.ts"]
        Crons["crons.ts"]
        ArenaScheduler2["arenaScheduler.ts"]

        subgraph ConvexLib["lib/"]
            Board2["board.ts"]
            Cards2["cards.ts"]
            Constants["constants.ts"]
            Rent2["rent.ts"]
            Validation2["validation.ts"]
            Bankruptcy2["bankruptcy.ts"]
            ParseResponse["parseResponse.ts"]
            Prompts2["prompts.ts"]
            Types["types.ts"]
            Random["random.ts"]
        end
    end

    subgraph Src["src/"]
        subgraph Routes["routes/"]
            RootRoute["__root.tsx"]
            IndexRoute["index.tsx"]
            PlayRoutes["play/..."]
            GamesRoutes["games/..."]
            AnalyticsRoutes["analytics/..."]
        end

        subgraph Components["components/"]
            GameComps["game/..."]
            SetupComps["setup/..."]
            AnalyticsComps["analytics/..."]
            UIComps["ui/..."]
        end

        subgraph SrcLib["lib/"]
            Models["models.ts"]
            Utils["utils.ts"]
        end
    end
```

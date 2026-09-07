export type FallbackProgram = {
  conference?: string
  id: string
  key: string
  name: string
}

export type FallbackGame = {
  awayClassification?: string
  awayConference?: string
  awayProgramId: string
  awaySourceName: string
  homeClassification?: string
  homeConference?: string
  homeProgramId: string
  homeSourceName: string
}

export type FallbackElo = {
  conference?: string
  programId: string
  rating: number
  sourceProgramName: string
}

export type FallbackComposite = {
  confidence: number
  conference?: string
  dataSources: Array<string>
  defense: number
  modelVersion: string
  offense: number
  overall: number
  programId: string
  signalCount: number
  sourceProgramName: string
  specialTeams: number
}

export type FallbackRankingBasis =
  | 'current_season_elo'
  | 'neutral_baseline'
  | 'prior_season_composite'
  | 'prior_season_elo'
  | 'season_composite'

export type FallbackPowerRow = {
  confidence: number
  conference?: string
  dataSources: Array<string>
  defense: number
  modelVersion: string
  offense: number
  power: number
  powerRank: number
  priorWeight: number
  programId: string
  programKey: string
  rankingBasis: FallbackRankingBasis
  signalCount: number
  sourceProgramName: string
  sourceSeason: number | null
  specialTeams: number
  specialTeamsAvailable: boolean
}

const pointsFromElo = (rating: number) => (rating - 1500) / 25
const pointsFromComposite = (rating: number) => (rating - 50) * 0.3
const isPublishedClassification = (value: string | undefined) =>
  value?.toLowerCase() === 'fbs' || value?.toLowerCase() === 'transitioning'

export function buildFallbackPowerField(input: {
  currentComposite: Array<FallbackComposite>
  currentElo: Array<FallbackElo>
  games: Array<FallbackGame>
  previousComposite: Array<FallbackComposite>
  previousElo: Array<FallbackElo>
  previousSeason: number
  programs: Array<FallbackProgram>
}): Array<FallbackPowerRow> {
  const programs = new Map(
    input.programs.map((program) => [program.id, program]),
  )
  const currentElo = new Map(
    input.currentElo.map((row) => [row.programId, row]),
  )
  const currentComposite = new Map(
    input.currentComposite.map((row) => [row.programId, row]),
  )
  const previousComposite = new Map(
    input.previousComposite.map((row) => [row.programId, row]),
  )
  const previousElo = new Map(
    input.previousElo.map((row) => [row.programId, row]),
  )
  const eligible = new Map<
    string,
    { conference?: string; sourceProgramName: string }
  >()

  for (const game of input.games) {
    if (isPublishedClassification(game.homeClassification)) {
      eligible.set(game.homeProgramId, {
        conference: game.homeConference,
        sourceProgramName: game.homeSourceName,
      })
    }
    if (isPublishedClassification(game.awayClassification)) {
      eligible.set(game.awayProgramId, {
        conference: game.awayConference,
        sourceProgramName: game.awaySourceName,
      })
    }
  }
  for (const row of input.currentElo) {
    eligible.set(row.programId, {
      conference: row.conference,
      sourceProgramName: row.sourceProgramName,
    })
  }

  const rows = [...eligible].flatMap<FallbackPowerRow>(
    ([programId, seasonIdentity]) => {
      const program = programs.get(programId)
      if (!program) return []
      const currentCompositeRow = currentComposite.get(programId)
      const current = currentElo.get(programId)
      const priorComposite = previousComposite.get(programId)
      const priorElo = previousElo.get(programId)
      const conference = seasonIdentity.conference ?? program.conference
      const sourceProgramName = seasonIdentity.sourceProgramName || program.name

      if (currentCompositeRow) {
        return [
          {
            confidence: currentCompositeRow.confidence,
            conference,
            dataSources: currentCompositeRow.dataSources,
            defense: pointsFromComposite(currentCompositeRow.defense),
            modelVersion: currentCompositeRow.modelVersion,
            offense: pointsFromComposite(currentCompositeRow.offense),
            power: pointsFromComposite(currentCompositeRow.overall),
            powerRank: 0,
            priorWeight: 0,
            programId,
            programKey: program.key,
            rankingBasis: 'season_composite' as const,
            signalCount: currentCompositeRow.signalCount,
            sourceProgramName,
            sourceSeason: input.previousSeason + 1,
            specialTeams: pointsFromComposite(currentCompositeRow.specialTeams),
            specialTeamsAvailable:
              currentCompositeRow.dataSources.includes('game_stats'),
          },
        ]
      }
      if (current) {
        const power = pointsFromElo(current.rating)
        return [
          {
            confidence: 35,
            conference,
            dataSources: ['elo'],
            defense: power / 2,
            modelVersion: 'elo-fallback',
            offense: power / 2,
            power,
            powerRank: 0,
            priorWeight: 0,
            programId,
            programKey: program.key,
            rankingBasis: 'current_season_elo' as const,
            signalCount: 1,
            sourceProgramName,
            sourceSeason: input.previousSeason + 1,
            specialTeams: 0,
            specialTeamsAvailable: false,
          },
        ]
      }
      if (priorComposite) {
        return [
          {
            confidence: Math.round(priorComposite.confidence * 0.75),
            conference,
            dataSources: [
              ...priorComposite.dataSources,
              'prior_season_carryover',
            ],
            defense: pointsFromComposite(priorComposite.defense),
            modelVersion: 'cfb26-fallback-v2',
            offense: pointsFromComposite(priorComposite.offense),
            power: pointsFromComposite(priorComposite.overall),
            powerRank: 0,
            priorWeight: 1,
            programId,
            programKey: program.key,
            rankingBasis: 'prior_season_composite' as const,
            signalCount: priorComposite.signalCount,
            sourceProgramName,
            sourceSeason: input.previousSeason,
            specialTeams: pointsFromComposite(priorComposite.specialTeams),
            specialTeamsAvailable:
              priorComposite.dataSources.includes('game_stats'),
          },
        ]
      }
      if (priorElo) {
        const power = pointsFromElo(priorElo.rating)
        return [
          {
            confidence: 20,
            conference,
            dataSources: ['elo', 'prior_season_carryover'],
            defense: power / 2,
            modelVersion: 'cfb26-fallback-v2',
            offense: power / 2,
            power,
            powerRank: 0,
            priorWeight: 1,
            programId,
            programKey: program.key,
            rankingBasis: 'prior_season_elo' as const,
            signalCount: 1,
            sourceProgramName,
            sourceSeason: input.previousSeason,
            specialTeams: 0,
            specialTeamsAvailable: false,
          },
        ]
      }
      return [
        {
          confidence: 0,
          conference,
          dataSources: ['neutral_baseline'],
          defense: 0,
          modelVersion: 'cfb26-fallback-v2',
          offense: 0,
          power: 0,
          powerRank: 0,
          priorWeight: 1,
          programId,
          programKey: program.key,
          rankingBasis: 'neutral_baseline' as const,
          signalCount: 0,
          sourceProgramName,
          sourceSeason: null,
          specialTeams: 0,
          specialTeamsAvailable: false,
        },
      ]
    },
  )

  return rows
    .sort(
      (left, right) =>
        right.power - left.power ||
        left.sourceProgramName.localeCompare(right.sourceProgramName),
    )
    .map((row, index) => ({ ...row, powerRank: index + 1 }))
}

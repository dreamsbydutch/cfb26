import type { ProgramAccomplishment } from './programAccomplishments'

// Checked 2026-09-13 against https://www.ncaa.com/history/football/fbs.
// USC's 2003 split title and retained 2004 AP title are also documented at
// https://usctrojans.com/sports/2020/6/24/football-national-championships.aspx.
// The 2004 credit recognizes the AP title, not the vacated BCS participation.
const nationalChampions: ReadonlyArray<readonly [number, string]> = [
  [2000, 'Oklahoma'],
  [2001, 'Miami'],
  [2002, 'Ohio State'],
  [2003, 'LSU'],
  [2003, 'USC'],
  [2004, 'USC'],
  [2005, 'Texas'],
  [2006, 'Florida'],
  [2007, 'LSU'],
  [2008, 'Florida'],
  [2009, 'Alabama'],
  [2010, 'Auburn'],
  [2011, 'Alabama'],
  [2012, 'Alabama'],
  [2013, 'Florida State'],
  [2014, 'Ohio State'],
  [2015, 'Alabama'],
  [2016, 'Clemson'],
  [2017, 'Alabama'],
  [2018, 'Clemson'],
  [2019, 'LSU'],
  [2020, 'Alabama'],
  [2021, 'Georgia'],
  [2022, 'Georgia'],
  [2023, 'Michigan'],
  [2024, 'Ohio State'],
  [2025, 'Indiana'],
]

/** Audited historical fallback where older feeds label the title game as an ordinary bowl. */
export function historicalNationalTitles(
  teams: ReadonlyArray<{ id: string; name: string }>,
  season: number,
  cutoffAt: number,
): Array<ProgramAccomplishment> {
  const byName = new Map(teams.map((team) => [team.name, team.id]))
  return nationalChampions.flatMap(([year, name]) => {
    // Conservative season-end availability; never project this ledger into an unfinished season.
    if (year > season || Date.UTC(year + 1, 2, 1) >= cutoffAt) return []
    const teamId = byName.get(name)
    if (!teamId)
      throw new Error(`Unresolved historical national champion: ${name}.`)
    return [
      { teamId, season: year, conferenceChampion: false, playoffStage: 5 },
    ]
  })
}

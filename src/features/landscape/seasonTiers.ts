type SeasonTeam = { conference: string; sourceProgramName: string }

const powerFour = ['ACC', 'Big Ten', 'Big 12', 'SEC']

function conferenceName(value: string) {
  const name = value.trim()
  if (!name || /^(ind|independent|independents|fbs independents)$/i.test(name))
    return 'Independents'
  if (name === 'Big 10') return 'Big Ten'
  if (name === 'Big XII') return 'Big 12'
  return name
}

export function seasonTiers<T extends SeasonTeam>(rows: Array<T>) {
  const tiers = [
    { title: 'Power Four & Notre Dame', columns: new Map<string, Array<T>>() },
    {
      title: 'Group of Six & other independents',
      columns: new Map<string, Array<T>>(),
    },
  ]
  for (const row of rows) {
    const conference = conferenceName(row.conference)
    const top =
      powerFour.includes(conference) ||
      (conference === 'Independents' &&
        /^notre dame(?: fighting irish)?$/i.test(row.sourceProgramName.trim()))
    const tier = tiers[top ? 0 : 1]
    const group = tier.columns.get(conference) ?? []
    group.push(row)
    tier.columns.set(conference, group)
  }
  return tiers.map((tier) => ({
    title: tier.title,
    columns: [...tier.columns]
      .map(([name, teams]) => ({ name, rows: teams }))
      .sort((a, b) => {
        const order = (name: string) =>
          name === 'Independents'
            ? 100
            : powerFour.includes(name)
              ? powerFour.indexOf(name)
              : 50
        return order(a.name) - order(b.name) || a.name.localeCompare(b.name)
      }),
  }))
}

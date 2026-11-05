import { expect, test } from 'vitest'
import { seasonTiers } from './seasonTiers'

test('places the Power Four and Notre Dame above the other conferences and independents', () => {
  const rows = [
    { conference: 'SEC', sourceProgramName: 'Alabama' },
    { conference: 'Big 12', sourceProgramName: 'Baylor' },
    { conference: 'ACC', sourceProgramName: 'Clemson' },
    { conference: 'Big Ten', sourceProgramName: 'Michigan' },
    { conference: 'Ind', sourceProgramName: 'Notre Dame' },
    { conference: 'Ind', sourceProgramName: 'Connecticut' },
    ...['American', 'MAC', 'CUSA', 'MWC', 'Pac-12', 'Sun Belt'].map(
      (conference) => ({
        conference,
        sourceProgramName: `${conference} team`,
      }),
    ),
  ]
  const [top, bottom] = seasonTiers(rows)
  expect(top.columns.map((column) => column.name)).toEqual([
    'ACC',
    'Big Ten',
    'Big 12',
    'SEC',
    'Independents',
  ])
  expect(top.columns.at(-1)?.rows.map((row) => row.sourceProgramName)).toEqual([
    'Notre Dame',
  ])
  expect(
    bottom.columns.at(-1)?.rows.map((row) => row.sourceProgramName),
  ).toEqual(['Connecticut'])
  expect(bottom.columns).toHaveLength(7)
  const displayed = [...top.columns, ...bottom.columns].flatMap(
    (column) => column.rows,
  )
  expect(displayed).toHaveLength(rows.length)
  expect(new Set(displayed).size).toBe(rows.length)
})

test('normalizes conference aliases without rewriting saved membership', () => {
  const rows = [
    { conference: 'Big 10', sourceProgramName: 'Michigan' },
    { conference: 'Big XII', sourceProgramName: 'Baylor' },
    {
      conference: 'FBS Independents',
      sourceProgramName: 'Notre Dame Fighting Irish',
    },
    { conference: 'Independent', sourceProgramName: 'Connecticut' },
    { conference: 'ACC', sourceProgramName: 'Notre Dame' },
  ]
  const [top, bottom] = seasonTiers(rows)
  expect(top.columns.map((column) => column.name)).toEqual([
    'ACC',
    'Big Ten',
    'Big 12',
    'Independents',
  ])
  expect(bottom.columns.map((column) => column.name)).toEqual(['Independents'])
  expect(rows[0].conference).toBe('Big 10')
  expect(top.columns[0].rows[0].conference).toBe('ACC')
})

import { getFunctionName } from 'convex/server'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NationalSeason } from './NationalSeason'
import type { ReactNode } from 'react'

const fixtures = vi.hoisted(() => ({
  programs: [] as Array<{
    _id: string
    key: string
    name: string
    classification?: string
  }>,
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (reference: Parameters<typeof getFunctionName>[0]) => ({
    queryKey: [getFunctionName(reference)],
  }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: Array<string> }) => ({
    data:
      queryKey[0] === 'teamData:listPrograms'
        ? fixtures.programs
        : queryKey[0] === 'teamData:listStandingsBySeason'
          ? [
              {
                _id: 'snapshot',
                programId: 'historical',
                sourceProgramName: 'Historical FBS team',
                conference: 'Saved conference',
                wins: 8,
                losses: 4,
                winPercentage: 2 / 3,
                conferenceWins: 5,
                conferenceLosses: 3,
                recordSource: 'completed_games',
                throughWeek: 10,
                ties: 0,
              },
            ]
          : null,
    isPending: false,
    isError: false,
  }),
}))
vi.mock('./RatingField', () => ({ conferenceLogo: () => null }))
vi.mock('~/components/AppShell', () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  )
  return {
    PublicShell: Container,
    PageFrame: Container,
    Surface: Container,
    EmptyState: Container,
    ErrorState: Container,
    LoadingState: Container,
    PageHero: () => <h1>Season</h1>,
  }
})

beforeEach(() => {
  vi.stubGlobal('window', undefined)
  fixtures.programs = []
})
afterEach(() => vi.unstubAllGlobals())

test.each(['fcs', undefined])(
  'retains a saved FBS season when current classification is %s',
  (classification) => {
    fixtures.programs = [
      {
        _id: 'historical',
        key: 'historical',
        name: 'Historical FBS team',
        classification,
      },
    ]
    const html = renderToStaticMarkup(<NationalSeason />)
    expect(html).toContain('Historical FBS team')
    expect(html).toContain('Saved conference')
    expect(html).toContain('8–4')
  },
)

test('retains saved standings without a current directory entry', () => {
  expect(renderToStaticMarkup(<NationalSeason />)).toContain(
    'Historical FBS team',
  )
})

test('labels current standings with their completed-game week coverage', () => {
  const html = renderToStaticMarkup(<NationalSeason />)
  expect(html).toContain('Through Week 10')
  expect(html).toContain('Saved completed games')
})

import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/teams/$programKey')({
  ssr: false,
  component: ProgramRoute,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'Team Profile | DbyD CFB' }] }),
})

function ProgramRoute() {
  const { programKey } = Route.useParams()
  return <LandscapeDashboard programKey={programKey} view="teams" />
}

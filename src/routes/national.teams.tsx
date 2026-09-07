import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/teams')({
  ssr: false,
  component: () => <LandscapeDashboard view="teams" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'FBS Team Profiles | DbyD CFB' }] }),
})

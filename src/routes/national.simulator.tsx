import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/simulator')({
  ssr: false,
  component: () => <LandscapeDashboard view="simulator" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'Matchup Simulator | DbyD CFB' }] }),
})

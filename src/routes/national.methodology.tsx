import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/methodology')({
  ssr: false,
  component: () => <LandscapeDashboard view="methodology" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'Ranking Methodology | DbyD CFB' }] }),
})

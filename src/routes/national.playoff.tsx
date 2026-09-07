import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/playoff')({
  ssr: false,
  component: () => <LandscapeDashboard view="playoff" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'DbyD CFB Playoff Projection' }] }),
})

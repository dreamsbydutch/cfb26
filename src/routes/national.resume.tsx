import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/resume')({
  ssr: false,
  component: () => <LandscapeDashboard view="resume" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'DbyD CFB Résumé Rankings' }] }),
})

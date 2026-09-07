import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/ballot')({
  ssr: false,
  component: () => <LandscapeDashboard view="ballot" />,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({
    meta: [
      { title: 'Blind Ballot | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

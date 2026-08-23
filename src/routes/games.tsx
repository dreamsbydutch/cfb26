import { createFileRoute } from '@tanstack/react-router'
import {
  LandscapeDashboard,
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/games')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'College Football Landscape | CFB26' },
      {
        name: 'description',
        content:
          'Explore proprietary college football team ratings, custom head-to-head matchups, and weekly national or Michigan importance.',
      },
    ],
  }),
  component: LandscapeDashboard,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
})

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
          'Rank college football teams and sort the weekly schedule by national importance or Michigan relevance.',
      },
    ],
  }),
  component: LandscapeDashboard,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
})

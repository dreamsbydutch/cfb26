import { createFileRoute } from '@tanstack/react-router'
import { NationalSeason } from '~/features/landscape/NationalSeason'
import {
  LandscapeError,
  LandscapeLoading,
} from '~/features/landscape/LandscapeDashboard'

export const Route = createFileRoute('/national/season')({
  ssr: false,
  component: NationalSeason,
  pendingComponent: LandscapeLoading,
  errorComponent: LandscapeError,
  head: () => ({ meta: [{ title: 'DbyD CFB National Season' }] }),
})

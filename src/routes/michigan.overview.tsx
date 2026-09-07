import { createFileRoute } from '@tanstack/react-router'
import {
  MichiganError,
  MichiganLoading,
  MichiganOverview,
} from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/michigan/overview')({
  ssr: false,
  component: MichiganOverview,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({
    meta: [
      { title: 'Michigan Roster Overview | DbyD CFB' },
      {
        name: 'description',
        content:
          'Michigan roster readiness, construction, performance, and lifecycle intelligence.',
      },
    ],
  }),
})

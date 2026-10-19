import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  MichiganError,
  MichiganFootball,
  MichiganLoading,
} from '~/features/michigan/MichiganWorkspace'
import {
  footballUrl,
  hasRetiredFootballControls,
} from '~/features/michigan/footballNavigation'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: ({ location }) => {
    if (hasRetiredFootballControls(location.searchStr)) {
      throw redirect({ href: footballUrl(location.searchStr), replace: true })
    }
  },
  component: MichiganFootball,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({
    meta: [
      { title: 'Michigan Football | DbyD' },
      {
        name: 'description',
        content:
          'Michigan football roster matrix, season history, and player intelligence.',
      },
    ],
  }),
})

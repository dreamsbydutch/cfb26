import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  MichiganError,
  MichiganLoading,
  MichiganMatrix,
} from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: ({ location }) => {
    const search = new URLSearchParams(location.searchStr)
    const legacyVariant = search.get('variant')?.toUpperCase()
    if (!legacyVariant) return

    search.delete('variant')
    const query = search.toString()
    const pathname = legacyVariant === 'B' ? '/michigan/overview' : '/'
    throw redirect({ href: `${pathname}${query ? `?${query}` : ''}` })
  },
  component: MichiganMatrix,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({
    meta: [
      { title: 'DbyD CFB | Michigan Roster Intelligence' },
      {
        name: 'description',
        content:
          "Dreams by Dutch's live Michigan roster construction, movement, development, and player intelligence workspace.",
      },
    ],
  }),
})

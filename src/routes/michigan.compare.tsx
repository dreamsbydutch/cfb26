import { createFileRoute } from '@tanstack/react-router'
import {
  MichiganCompare,
  MichiganError,
  MichiganLoading,
} from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/michigan/compare')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    players: typeof search.players === 'string' ? search.players : undefined,
    season: typeof search.season === 'number' ? search.season : undefined,
  }),
  component: MichiganCompare,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({ meta: [{ title: 'Compare Michigan Players | DbyD CFB' }] }),
})

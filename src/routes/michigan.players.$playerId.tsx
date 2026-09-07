import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '../../convex/_generated/dataModel'
import { MichiganPlayer } from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/michigan/players/$playerId')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    season: typeof search.season === 'number' ? search.season : undefined,
  }),
  component: PlayerRoute,
  head: () => ({ meta: [{ title: 'Michigan Player | DbyD CFB' }] }),
})

function PlayerRoute() {
  const { playerId } = Route.useParams()
  return <MichiganPlayer playerId={playerId as Id<'players'>} />
}

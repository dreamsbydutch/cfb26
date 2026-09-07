import { createFileRoute } from '@tanstack/react-router'
import type { Id } from '../../convex/_generated/dataModel'
import {
  RosterAdmin,
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/players/$playerId')({
  ssr: false,
  component: PlayerEditorRoute,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
  head: () => ({
    meta: [
      { title: 'Owner Player Editor | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

function PlayerEditorRoute() {
  const { playerId } = Route.useParams()
  return <RosterAdmin playerId={playerId as Id<'players'>} view="roster" />
}

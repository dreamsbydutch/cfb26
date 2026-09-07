import { createFileRoute } from '@tanstack/react-router'
import {
  RosterAdmin,
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/season')({
  ssr: false,
  component: () => <RosterAdmin view="season" />,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
  head: () => ({
    meta: [
      { title: 'Owner Season | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

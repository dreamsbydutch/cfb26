import { createFileRoute } from '@tanstack/react-router'
import { RosterAdmin, RosterAdminLoading } from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster')({
  ssr: false,
  component: RosterAdmin,
  pendingComponent: RosterAdminLoading,
  head: () => ({
    meta: [
      { title: 'Roster Admin | CFB26' },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
})

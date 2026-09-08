import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster')({
  ssr: false,
  component: Outlet,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
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

import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/players')({
  ssr: false,
  component: Outlet,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
  head: () => ({
    meta: [
      { title: 'Owner Roster | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

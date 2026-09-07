import { createFileRoute } from '@tanstack/react-router'
import {
  RosterAdmin,
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/operations')({
  ssr: false,
  component: () => <RosterAdmin view="operations" />,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
  head: () => ({
    meta: [
      { title: 'Owner Operations | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

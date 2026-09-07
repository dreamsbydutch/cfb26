import { createFileRoute } from '@tanstack/react-router'
import {
  RosterAdmin,
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/data')({
  ssr: false,
  component: () => <RosterAdmin view="data" />,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
  head: () => ({
    meta: [
      { title: 'Owner Data | DbyD CFB' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

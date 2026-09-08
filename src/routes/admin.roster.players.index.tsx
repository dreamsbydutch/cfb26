import { createFileRoute } from '@tanstack/react-router'
import {
  RosterAdmin,
  RosterAdminError,
  RosterAdminLoading,
} from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/players/')({
  ssr: false,
  component: () => <RosterAdmin view="roster" />,
  pendingComponent: RosterAdminLoading,
  errorComponent: RosterAdminError,
})

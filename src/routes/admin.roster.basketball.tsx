import { createFileRoute } from '@tanstack/react-router'
import { RosterAdmin } from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/basketball')({
  ssr: false,
  component: () => <RosterAdmin view="basketball" />,
})

import { createFileRoute } from '@tanstack/react-router'
import { RosterAdmin } from '~/features/roster/RosterAdmin'

export const Route = createFileRoute('/admin/roster/hockey')({
  ssr: false,
  component: () => <RosterAdmin view="hockey" />,
})

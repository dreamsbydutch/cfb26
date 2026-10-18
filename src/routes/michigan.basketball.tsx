import { createFileRoute } from '@tanstack/react-router'
import { TeamRoster } from '~/features/teams/TeamRoster'

export const Route = createFileRoute('/michigan/basketball')({
  ssr: false,
  component: () => <TeamRoster sport="basketball" />,
  head: () => ({ meta: [{ title: 'Michigan Men’s Basketball | DbyD' }] }),
})

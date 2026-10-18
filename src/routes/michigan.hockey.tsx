import { createFileRoute } from '@tanstack/react-router'
import { TeamRoster } from '~/features/teams/TeamRoster'

export const Route = createFileRoute('/michigan/hockey')({
  ssr: false,
  component: () => <TeamRoster sport="hockey" />,
  head: () => ({ meta: [{ title: 'Michigan Men’s Hockey | DbyD' }] }),
})

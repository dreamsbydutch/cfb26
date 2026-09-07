import { createFileRoute } from '@tanstack/react-router'
import {
  RosterPrototype,
  RosterPrototypeError,
  RosterPrototypeLoading,
} from '~/features/roster/prototype/RosterPrototype'

export const Route = createFileRoute('/')({
  ssr: false,
  component: RosterPrototype,
  pendingComponent: RosterPrototypeLoading,
  errorComponent: RosterPrototypeError,
  head: () => ({
    meta: [
      { title: 'DbyD CFB | Michigan Roster Intelligence' },
      {
        name: 'description',
        content:
          "Dreams by Dutch's live Michigan roster construction, movement, development, and player intelligence workspace.",
      },
    ],
  }),
})

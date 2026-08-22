import { createFileRoute } from '@tanstack/react-router'
import {
  RosterApp,
  RosterError,
  RosterLoading,
} from '~/features/roster/RosterApp'

export const Route = createFileRoute('/')({
  ssr: false,
  component: RosterApp,
  pendingComponent: RosterLoading,
  errorComponent: RosterError,
})

import { createFileRoute } from '@tanstack/react-router'
import {
  MichiganError,
  MichiganLoading,
  MichiganMovement,
} from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/michigan/movement')({
  ssr: false,
  component: MichiganMovement,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({ meta: [{ title: 'Michigan Roster Movement | DbyD CFB' }] }),
})

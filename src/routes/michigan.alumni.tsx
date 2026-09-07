import { createFileRoute } from '@tanstack/react-router'
import {
  MichiganAlumni,
  MichiganError,
  MichiganLoading,
} from '~/features/michigan/MichiganWorkspace'

export const Route = createFileRoute('/michigan/alumni')({
  ssr: false,
  component: MichiganAlumni,
  pendingComponent: MichiganLoading,
  errorComponent: MichiganError,
  head: () => ({ meta: [{ title: 'Michigan NFL Alumni | DbyD CFB' }] }),
})

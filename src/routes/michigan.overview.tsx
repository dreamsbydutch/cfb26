import { createFileRoute, redirect } from '@tanstack/react-router'
import { footballUrl } from '~/features/michigan/footballNavigation'

export const Route = createFileRoute('/michigan/overview')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: footballUrl(location.searchStr), replace: true })
  },
})

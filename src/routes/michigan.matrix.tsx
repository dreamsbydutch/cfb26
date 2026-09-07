import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/michigan/matrix')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/national/games')({
  beforeLoad: () => {
    throw redirect({ to: '/games' })
  },
})

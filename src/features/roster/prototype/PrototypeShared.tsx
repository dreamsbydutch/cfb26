import type { ReactNode } from 'react'

export function PrototypeEmpty({ children }: { children: ReactNode }) {
  return <div className="prototype-empty">{children}</div>
}

export function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

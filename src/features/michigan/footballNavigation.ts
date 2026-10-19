const retiredControls = ['variant', 'view', 'players', 'preset'] as const

export function footballUrl(searchStr: string) {
  const search = new URLSearchParams(searchStr)
  for (const key of retiredControls) search.delete(key)
  const query = search.toString()
  return `/${query ? `?${query}` : ''}`
}

export function hasRetiredFootballControls(searchStr: string) {
  const search = new URLSearchParams(searchStr)
  return retiredControls.some((key) => search.has(key))
}

const positionOrder = [
  'QB',
  'RB',
  'FB',
  'WR',
  'TE',
  'OT',
  'OG',
  'OC',
  'EDGE',
  'DL',
  'LB',
  'CB',
  'S',
  'K',
  'P',
  'LS',
]

const aliases: Record<string, string> = {
  HB: 'RB',
  SLOT: 'WR',
  LT: 'OT',
  RT: 'OT',
  LG: 'OG',
  RG: 'OG',
  C: 'OC',
  DE: 'EDGE',
  DT: 'DL',
  NT: 'DL',
  ILB: 'LB',
  MLB: 'LB',
  OLB: 'LB',
  FS: 'S',
  SS: 'S',
}

function positionRank(position: string) {
  const normalized = position.trim().toUpperCase()
  const rank = positionOrder.indexOf(aliases[normalized] ?? normalized)
  return rank < 0 ? positionOrder.length : rank
}

type AdminRosterSortKey = {
  position: string
  name: string
  tier: 'starter' | 'rotation' | 'bench' | 'prospect' | 'recruit'
  snaps: number | null
}

const tierOrder = ['starter', 'rotation', 'bench', 'prospect', 'recruit']

export function compareAdminRosterPlayers(
  a: AdminRosterSortKey,
  b: AdminRosterSortKey,
) {
  return (
    positionRank(a.position) - positionRank(b.position) ||
    tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier) ||
    (b.snaps ?? -1) - (a.snaps ?? -1) ||
    a.name.localeCompare(b.name)
  )
}

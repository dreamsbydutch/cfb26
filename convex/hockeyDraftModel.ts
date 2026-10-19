import type { Infer } from 'convex/values'
import type { hockeyDraft } from './hockeyDraftFields'

export type HockeyDraft = Infer<typeof hockeyDraft>
// Reviewed full-name/nickname variants only; no last-name or fuzzy joins.
const aliases: Record<string, string> = {
  joececconi: 'josephcecconi',
  cristovalboonieves: 'cristovalnieves',
  boonieves: 'cristovalnieves',
  alexanderguptill: 'alexguptill',
  nicholasmoldenhauer: 'nickmoldenhauer',
  cameronreid: 'camreid',
}

export function hockeyPlayerKey(name: string) {
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return aliases[key] ?? key
}

export function validateHockeyDraft(draft: HockeyDraft) {
  if (
    !draft.playerName.trim() ||
    draft.playerName.length > 100 ||
    !hockeyPlayerKey(draft.playerName) ||
    !draft.nhlTeam.trim() ||
    draft.nhlTeam.length > 100 ||
    !Number.isInteger(draft.year) ||
    draft.year < 1963 ||
    draft.year > 2200 ||
    !Number.isInteger(draft.round) ||
    draft.round < 1 ||
    draft.round > 25 ||
    !Number.isInteger(draft.overallPick) ||
    draft.overallPick < 1 ||
    draft.overallPick > 500 ||
    (draft.year >= 2005 && draft.round > 7) ||
    !/^[a-f0-9]{64}$/.test(draft.sourceSha256)
  )
    throw new Error('Invalid NHL draft selection or source hash.')
  const url = new URL(draft.sourceUrl)
  if (url.username || url.password || url.hash)
    throw new Error('Invalid draft source URL.')
  if (
    url.href !==
      'https://mgoblue.com/news/2008/6/27/michigan_players_selected_in_the_nhl_draft' &&
    !(
      url.origin === 'https://records.nhl.com' &&
      url.pathname === '/site/api/draft' &&
      /^id=\d+$/.test(url.searchParams.get('cayenneExp') ?? '') &&
      [...url.searchParams.keys()].length === 1
    )
  )
    throw new Error(
      'NHL draft source must be Michigan Athletics or an exact NHL record.',
    )
}

function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:nbsp|amp|quot|apos|rsquo|#39);/g,
      (entity) =>
        ({
          '&nbsp;': ' ',
          '&amp;': '&',
          '&quot;': '"',
          '&apos;': "'",
          '&rsquo;': "'",
          '&#39;': "'",
        })[entity] ?? entity,
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseMichiganDrafts(html: string) {
  if (html.length > 3_000_000) throw new Error('Draft page too large.')
  const content = html.match(
    /id="storyPageContentBody"[^>]*>([\s\S]*?)<\/table>/i,
  )?.[1]
  if (!content || !/Selected prior to attending Michigan/.test(content))
    throw new Error('Michigan draft story is missing.')
  const table = content.match(/<tbody[^>]*>([\s\S]*)/i)?.[1]
  if (!table) throw new Error('Draft table is missing.')
  let year = 0,
    supplemental = false
  const picks: Array<Omit<HockeyDraft, 'sourceUrl' | 'sourceSha256'>> = []
  const seen = new Set<string>()
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => plain(cell[1]),
    )
    if (cells.length === 1) {
      const heading = cells[0].match(
        /^(?:(\d{4}) )?NHL (Entry|Amateur|Supplemental) Draft\b/,
      )
      if (!heading || (!heading[1] && !year))
        throw new Error('Unrecognized draft heading.')
      year = heading[1] ? Number(heading[1]) : year
      supplemental = heading[2] === 'Supplemental'
      continue
    }
    if (cells.length !== 3 || !year) throw new Error('Incomplete draft row.')
    const selection = cells[2].match(/^Rd\. (\d+) \((\d+)\)$/)
    if (!selection) throw new Error('Unrecognized NHL draft pick.')
    // Supplemental drafts are separate events, outside the saved roster era.
    if (supplemental) continue
    const key = `${year}:${selection[2]}`
    if (year >= 2000 && seen.has(key))
      throw new Error('Duplicate NHL draft pick in the roster era.')
    seen.add(key)
    picks.push({
      playerName: cells[0].replace(/\*/g, '').trim(),
      year,
      round: Number(selection[1]),
      overallPick: Number(selection[2]),
      nhlTeam: cells[1],
      priorToMichigan: cells[0].includes('*'),
    })
  }
  if (
    picks.length < 100 ||
    picks.length > 300 ||
    !picks.some((pick) => pick.year === 2026)
  )
    throw new Error('Incomplete Michigan draft archive.')
  return picks
}

import { useState } from 'react'
import nhlTeamLogos from './nhlTeamLogos.json'
import type {
  HockeyDraft,
  HockeyDraftProjection,
} from '../../../convex/hockeyDraftModel'

function teamKey(team: string) {
  return team
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// NHL standings/schedule responses supply these official logo URLs, including
// historical drafting franchises rather than their present-day replacements.
const teamLogos = new Map(
  Object.entries(nhlTeamLogos).map(([team, url]) => [teamKey(team), url]),
)

function DraftTeamLogo({ team }: { team: string }) {
  const url = teamLogos.get(teamKey(team))
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  return url && failedUrl !== url ? (
    <img
      src={url}
      alt={team}
      title={team}
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
      className="size-6 shrink-0 object-contain"
      onError={() => setFailedUrl(url)}
    />
  ) : (
    <span className="max-w-24 whitespace-normal text-[10px] leading-tight">
      {team}
    </span>
  )
}

export function HockeyDraftCell({
  selections,
  projection,
  unavailable = false,
}: {
  selections?: Array<HockeyDraft>
  projection?: HockeyDraftProjection | null
  unavailable?: boolean
}) {
  if (!selections?.length && !projection)
    return (
      <span
        title={
          unavailable
            ? 'Draft history unavailable'
            : 'No NHL selection recorded'
        }
      >
        —
      </span>
    )
  return (
    <>
      {!selections?.length && projection && (
        <span
          className="inline-flex min-h-8 items-center text-[11px]"
          aria-label={`${projection.draftYear} NHL draft projection, ranked ${projection.rank}`}
        >
          <strong className="text-xs text-[#00274c]">
            Proj. #{projection.rank}
          </strong>
          <span className="ml-1 text-[10px] text-slate-500">
            {projection.draftYear}
          </span>
        </span>
      )}
      {(selections ?? []).map((draft) => (
        <div
          key={`${draft.year}:${draft.overallPick}`}
          className="flex min-h-8 items-center gap-1.5 text-[11px]"
          title={draft.nhlTeam}
        >
          <DraftTeamLogo team={draft.nhlTeam} />
          <strong className="text-xs text-[#00274c]">
            #{draft.overallPick}
          </strong>
          <span className="text-[10px] text-slate-500">
            {draft.year} · R{draft.round}
          </span>
        </div>
      ))}
    </>
  )
}

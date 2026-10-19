import type {
  HockeyDraft,
  HockeyDraftProjection,
} from '../../../convex/hockeyDraftModel'

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
        <details
          key={`${draft.year}:${draft.overallPick}`}
          className="text-[11px]"
        >
          <summary
            className="min-h-8 cursor-pointer content-center"
            aria-label={`${draft.year} NHL draft, pick ${draft.overallPick}, round ${draft.round}, ${draft.nhlTeam}`}
          >
            <strong className="text-xs text-[#00274c]">
              #{draft.overallPick}
            </strong>
            <span className="ml-1 text-[10px] text-slate-500">
              {draft.year} · R{draft.round}
            </span>
          </summary>
          <div className="max-w-40 whitespace-normal pb-2 font-normal text-slate-500">
            {draft.nhlTeam}
            {draft.priorToMichigan === true && (
              <span className="block">Selected before Michigan</span>
            )}
          </div>
        </details>
      ))}
    </>
  )
}

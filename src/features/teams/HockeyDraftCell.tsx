import type { HockeyDraft } from '../../../convex/hockeyDraftModel'

export function HockeyDraftCell({
  selections,
  unavailable = false,
}: {
  selections?: Array<HockeyDraft>
  unavailable?: boolean
}) {
  if (!selections?.length)
    return (
      <span
        title={
          unavailable
            ? 'Draft history unavailable'
            : 'No matched NHL selection in the imported history'
        }
      >
        —
      </span>
    )
  return (
    <>
      {selections.map((draft) => (
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
            <a
              href={draft.sourceUrl}
              className="block py-1 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Draft source
            </a>
          </div>
        </details>
      ))}
    </>
  )
}

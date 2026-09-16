import type { ReactNode } from 'react'

export const rankingControlClass =
  'app-control min-h-11 px-3 py-2 text-sm font-bold text-white focus-visible:outline-2'

export type RankingTableRow = {
  details?: Array<{ label: string; value: string }>
  highlight?: boolean
  key?: string
  label: ReactNode
  primary: string
  rank: number
  secondary: string
}

export function RankingTable({
  detailHeadings = [],
  heading,
  primaryHeading,
  rows,
}: {
  detailHeadings?: Array<string>
  heading: string
  primaryHeading: string
  rows: Array<RankingTableRow>
}) {
  return (
    <section className="app-card w-fit max-w-full overflow-hidden p-0">
      <h2 className="app-ranking-header font-display border-b border-white/10 px-3 py-2 text-lg font-extrabold text-white sm:px-4 sm:text-xl">
        {heading}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-max border-collapse text-left text-sm">
          <thead className="app-label bg-black/15">
            <tr>
              <th className="w-11 px-2 py-2 sm:px-3" scope="col">
                Rank
              </th>
              <th
                className="w-36 min-w-36 px-2 py-2 sm:w-48 sm:min-w-48 sm:px-3"
                scope="col"
              >
                Team
              </th>
              <th
                className="w-18 min-w-18 whitespace-nowrap px-2 py-2 text-right sm:w-20 sm:min-w-20 sm:px-3"
                scope="col"
              >
                {primaryHeading}
              </th>
              {detailHeadings.map((detailHeading) => (
                <th
                  className="min-w-20 whitespace-nowrap px-2 py-2 text-right sm:px-3"
                  key={detailHeading}
                  scope="col"
                >
                  {detailHeading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key ?? `${row.rank}:${String(row.label)}`}
                className={`border-t border-white/[0.07] hover:bg-white/[0.025] ${row.highlight ? 'michigan-highlight' : ''}`}
              >
                <td
                  className={`font-display px-2 py-1.5 text-lg font-extrabold tabular-nums sm:px-3 ${row.highlight ? 'michigan-accent' : 'app-accent-text'}`}
                >
                  {row.rank}
                </td>
                <th className="px-2 py-1.5 sm:px-3" scope="row">
                  <span
                    className={`block text-sm leading-4 ${row.highlight ? 'michigan-accent' : ''}`}
                  >
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-3 font-normal text-white/40">
                    {row.secondary}
                  </span>
                </th>
                <td className="font-display whitespace-nowrap px-2 py-1.5 text-right text-base font-extrabold tabular-nums sm:px-3">
                  {row.primary}
                </td>
                {detailHeadings.map((detailHeading) => (
                  <td
                    className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-white/70 sm:px-3"
                    key={detailHeading}
                  >
                    {row.details?.find(
                      (detail) => detail.label === detailHeading,
                    )?.value ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

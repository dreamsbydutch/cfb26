# Michigan basketball and hockey season home pages

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** `/michigan/basketball` and `/michigan/hockey` open a season home page. The starting-year `season` parameter selects the season: `?season=2025` means 2025–26. Season home includes the summary, contributors, postseason results, and complete schedule on one page. Roster & stats (`view=roster`) and Schedule & results (`view=schedule`) remain direct views; existing links continue to work. Section links jump to contributors, postseason, or schedule on the home page. The view controls wrap on narrow screens, and tables scroll with visible keyboard focus and frozen player names.

## Compact presentation

**Current source:** the page uses the football matrix's compact heading scale and page gutters. A single summary band prioritizes the record and postseason finish; conference record, coach, venue splits, and scoring rates are secondary. Championship tags use restrained maize accents. View controls use an underline for the active selection.

At widths of 1280px and above, contributors and the full schedule sit side by side; smaller screens stack them. Leader totals appear in one compact strip above dense player tables. Short rows, navy column headers, subtle row striping, and frozen player names keep values traceable. The full roster view uses the same compact table spacing.

Navy table headers use explicit white text so the light theme's legacy `text-white` remapping cannot reduce their contrast. This applies to contributor tables and the shared season schedule.

Schedule and postseason dates include the abbreviated weekday, such as `Fri, Oct 9`. Dates use the stored calendar day in UTC so viewing time zones cannot shift a game to another day.

The postseason game log and season notes expand on demand. Schedule rows prioritize date, opponent, home/away/neutral designation, result/time, and game notes. Location and tournament appear in a compact Location / event column; box-score and recap links are always visible in a separate Links column. Rows have no per-game Details toggle. These columns wrap when necessary, and narrow tables scroll horizontally. Brief schedule conventions remain in the schedule's notes disclosure. Routine source citations and collection timestamps are omitted from public sports pages; source records remain stored internally. Functional game links, stored facts, filters, and result states are preserved.

## Season facts and accomplishments

`src/features/teams/seasonHistory.ts` retains 42 reviewed historical summaries for 2005–06 through 2025–26, retrieved from Michigan Athletics' [basketball year-by-year results](https://mgoblue.com/sports/2017/6/16/michigan-mens-basketball-year-by-year-results) and [hockey year-by-year results](https://mgoblue.com/sports/2017/6/16/michigan-ice-hockey-year-by-year-results) on 2026-10-18. These checked-in historical facts include the head coach, final overall and conference records, conference affiliation/finish, conference tournament finish, and national postseason result. This is a read-only source snapshot, not a new database table or owner editor. Raw HTML and the extraction review are retained outside Git at `C:/Users/choug/.t3/artifacts/michigan-season-history-20261018`.

National, conference regular-season, and conference tournament championship badges use explicit published finishes. Tied first place produces a co-champion label. A win in a third-place game does not establish a championship. CCHA seasons retain CCHA affiliation. No final finish, coach, championship, or tournament berth is extrapolated into 2026–27 or another unrecorded season.

The explicit [2026–27 basketball staff](https://mgoblue.com/sports/mens-basketball/coaches/2026-27) and [2026–27 hockey staff](https://mgoblue.com/sports/mens-ice-hockey/coaches/2026-27) pages separately verify Mike Boynton Jr. and Brandon Naurato as that season's head coaches. Those staff facts do not establish a final season record or imply a coach for another unrecorded year.

Historical tournament naming is normalized to field size where needed. Michigan's year-by-year basketball table incorrectly labels 2010–11 as Sweet 16; the [contemporary Duke recap](https://mgoblue.com/news/2011/3/20/michigan_rally_falls_short_against_duke_in_ncaa_third_round_thriller) establishes the Round of 32 loss. The 2011–12 second-round label means the Round of 64 under that era's naming. The 2015–16 entry distinguishes a First Four win from a Round of 64 exit.

Both 2019–20 seasons explicitly record [COVID cancellations](https://mgoblue.com/news/2020/3/11/michigan-athletics-covid-19-response-and-updates). Hockey's 2020–21 NCAA berth is distinguished from participation: Michigan [was removed before its opening game](https://mgoblue.com/news/2021/3/26/ice-hockey-removed-from-ncaa-tournament-due-to-covid-protocols). These facts remain visible; their source evidence stays in the documentation and source records.

## Schedule and player evidence

`useTeamSchedule.ts` reads the existing sport-specific schedule query; the other sport's query is skipped. Season home and the dedicated schedule view share that query state. Schedule and roster loading/failure states remain independent.

Live schedule results provide the home/away/neutral splits and scoring averages. Exhibitions and unplayed events are excluded from records. Hockey shootout games retain official ties. Scoring averages require paired recorded scores and state the number of scored games. The postseason trail uses recorded tournament labels and explicit NCAA/Frozen Four recap labels, displays cancellation/no-contest states, and excludes scheduled placeholders. It does not infer advancement or qualification from future fixtures. The [hockey](michigan-hockey-schedules.md) and [basketball](michigan-basketball-schedules.md) schedule contracts own full game semantics.

Contributors require saved games played greater than zero, including anyone subsequently marked Departed. Unknown games played is not zero or evidence of an appearance; those players remain in the full roster according to its existing status policy. Basketball contributors are ordered by total minutes and show per-game scoring, rebounding, assists, minutes, and shooting percentages. Hockey separates skaters ordered by points from goalies ordered by minutes. Unknown sort totals follow measured totals. Leaders use saved season totals, preserve ties, require every component of a combined metric, and retain confirmed zero. No award, All-American selection, recruiting rating, or player role is inferred from these totals.

The home page does not yet include individual awards, final national poll ranks, NCAA seeds, staff history, or a complete standings table. Those need additional sourced contracts. Existing owner edits to roster and player statistics remain available; no new backend deployment or data migration is required for this page.

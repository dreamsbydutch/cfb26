# Michigan hockey NPI

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** hockey season schedules show Michigan's NPI and an opponent NPI column. The active season uses the latest saved rankings for every game, including completed games. Completed seasons use only final rankings. Labels explicitly distinguish Current NPI and Final NPI; neither represents the rank at game time. Expand the compact Michigan NPI line to see the national table. Collection dates and source links stay internal. Exhibitions and unmatched/unlisted teams show a dash, not an invented rank.

## Refresh and retention

The internal `hockeyNpi.refresh` action fetches [College Hockey News NPI](https://www.collegehockeynews.com/ratings/npi) every Monday at 13:07 UTC (9:07 a.m. Toronto daylight time, 8:07 a.m. standard time). This is a weekly refresh, not a continuous live feed. Each successful weekly update replaces the active season's single saved table. Weekly historical snapshots and rank-at-game-time histories are deliberately not retained.

The same job checks the preceding season until a final table is saved. Starting May 1 after a season, it reads the season-specific CHN archive, such as [2025–26](https://www.collegehockeynews.com/ratings/npi/2026), and retains that final table unchanged. May is a conservative cutoff after the NCAA championship; the archive is CHN's final NPI table and does not assert that its underlying calculation includes NCAA tournament games. Failed archive retrieval never promotes an in-season table to final. NPI began in 2025–26; earlier schedules show no ranking column and do not fabricate historical NPI.

`hockeyNpiSeasons` stores one document per starting season with teams, ranks, NPI values, source URL/hash, observed collection time, final status, and bounded refresh/lease metadata. It has a `by_season` index. This is separate from game, roster, player-statistics, and football revisions; full Convex exports cover it. The public `hockeyNpi.forSchedule` query exposes only rankings and refresh availability. All fetch/write functions are internal.

Fetches have a 20-second timeout. A failed attempt preserves the last valid table and schedules at most two retries, 15 minutes apart. Leases prevent concurrent workers, stale completions cannot overwrite a newer worker, and successful repeat runs within the same UTC week are no-ops. Validation requires the correct page season, a complete 40–100-team table, unique school identities and contiguous ranks, finite NPI values, and Michigan's CHN identity. A changed format fails closed. School matching uses canonical names and explicit aliases; CHN team IDs are never joined to unrelated Michigan Athletics IDs.

Michigan Athletics' listed opponent poll ranks are discarded during hockey schedule imports and are not displayed. Current or final NPI is the only schedule ranking indicator. If the latest refresh fails, the expanded ranking disclosure shows a brief delayed-update status.

## Verification and operations

Focused parser and Convex tests cover season validation, school aliases, malformed/duplicate rows, replacement without history growth, repeat runs, failure preservation, stale workers, season isolation, and immutable final tables. A live development fetch must also succeed before promotion. Inspect the registered weekly job in the Convex dashboard's Scheduled Functions/Cron Jobs area. An authorized operator can invoke `hockeyNpi:refresh` with `{}` to initialize current and preceding seasons; supplying `{ "season": 2025 }` targets a single supported season. These are privileged internal actions, not public refresh controls.

**Verified 2026-10-19:** development and production fetched both tables successfully: 57 current 2026–27 teams (Michigan #4) and 63 final 2025–26 teams (Michigan #1). Every named non-exhibition opponent matched; conditional tournament placeholders remain unknown. The deployed cron was read back from Convex's dashboard system query on both environments, with Monday 13:07 UTC and the next run pending. A verified full production backup precedes the additive schema deployment: `C:/Users/choug/Documents/cfb26-backups/pre-hockey-npi-20261019.zip`. The source contract is now 52 tables and 115 indexes. All 258 automated tests, TypeScript, ESLint, 144 Markdown link checks, and the production build passed. Current/final schedule server renders passed; browser visual verification was unavailable in this session.

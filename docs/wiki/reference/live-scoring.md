# Live game scores

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** One Convex job checks the shared FBS scoreboard every five minutes. Browsers subscribe to stored game data; viewer count does not multiply CollegeFootballData requests. This is periodically refreshed scoring, not play-by-play or a continuously running game clock.

## Data and display

- CFBD `/scoreboard?classification=fbs` supplies game IDs, team IDs, status, both scores, quarter/period, and clock. Only existing matching games are updated. Both team IDs must match, and a final cannot regress to in-progress or scheduled.
- `collegeGames.liveScore` stores the latest compact observation. Normal schedule imports preserve it. Official completed game results take precedence; live observations do not enter model training or rewrite official game facts.
- Games with a reported in-progress status show scores, quarter/OT, the reported clock in **Live & started**, above upcoming games. Only confirmed finals emphasize the winner. Scores older than 15 minutes say **Score delayed** and retain the last observation. Kickoff alone never establishes live scoring.
- A completed scoreboard observation moves the game to results immediately. The daily schedule import continues to reconcile official results. Unknown and zero scores remain distinct. Pregame projected spreads disappear once a game starts.

## API budget

- `LIVE_SCORES_ENABLED=true` enables polling in a deployment. Leave development and previews disabled to avoid duplicate provider usage. A missing API key also disables requests.
- Before each network request, a transaction reserves its allowance and the next polling time in the singleton `scoreboardSyncState` row. Concurrent cron/manual runs cannot consume the same polling slot. Failed requests count. Unused reservations are conservative.
- Automatic requests occur only when a known, unresolved FBS game is within ten minutes before kickoff through eight hours afterward. Canceled games, TBD kickoffs, official finals, and scoreboard finals do not keep the poll running. Both current and prior season partitions are checked for January postseason games.
- Maximum **1,500 reserved requests per UTC month** and **250 per UTC day** for this feature, including allowance checks. These limits do not govern existing ingestion jobs.
- `/info` checks scoreboard entitlement and remaining shared account calls before the first active poll and at least hourly while active. Polling pauses with **500 calls remaining**, preserving a reserve for other jobs. The account check is not a lock against unrelated API consumers.
- One scoreboard call covers the whole FBS slate. A fourteen-hour window uses about 168 scoreboard calls plus allowance checks; actual usage depends on the schedule and provider availability.
- Requests time out after 15 seconds and never retry immediately. Network/contract/server failures back off from ten minutes to one hour, `429` waits an hour, and `401`/`403` waits a day. Low allowance waits six hours before checking again. Empty or failed responses never erase the last score.

## Operations

Use the [deployment guard](../guides/deployment.md) before changing a target. Enable only production after development verification:

```powershell
npx convex env set LIVE_SCORES_ENABLED true --deployment doting-chipmunk-7
npx convex run scoreboard:health --deployment doting-chipmunk-7
```

Set the flag to `false` to stop API requests without deleting scores. `scoreboard:health` is internal and reports enabled state, reserved calls, remaining allowance from the last account check, last success, and the last safe error. No key or raw provider response is exposed.

An operator may run the internal `scoreboard:refresh` with `{"verifyAccess":true}` for a one-off provider check outside game windows. It still requires the enable flag and obeys the interval and budget. Normal cron calls never set that flag. Disable development after verification.

The parser, request-budget boundaries, status transitions, stale results, and update protections have offline tests in `tests/scoreboard.test.mjs`. Browser checks use isolated fixtures when no live games are underway; those fixtures are not stored in either deployment.

Provider references: [scoreboard contract](https://api.collegefootballdata.com/api/games), [account allowance](https://api.collegefootballdata.com/api/info), and [Tier 1 scoreboard access](https://collegefootballdata.com/api-tiers).

## Watch now and the three TVs

**Current source:** Games defaults to a third, independent **Watch now** lens. Landscape and Michigan remain available. Watch now covers every active game in the selected week across kickoff windows; finished, canceled, TBD, and unresolved games more than eight hours after kickoff are excluded. A fresh in-progress observation remains eligible even in a long game.

In automatic mode, Michigan is pinned first among active games regardless of score, with no backup and no flipping. Explicit manual selections take precedence as described below. Otherwise fresh live scores precede provisional/delayed games, then descending watch score decides order. The main TV retains its game while it remains in the top three, or reuses its network for another top-three game when possible. B and C hold the best four remaining games: retained games keep their primary/backup slots, then incoming games reuse a vacated network, then remaining slots fill by rank. Initial assignments use #2/#5 and #3/#4; subsequent ranking changes do not reshuffle retained games. The sixth distinct game is the main TV commercial-break pick when Michigan is not on the main TV. Network names are prominent above each matchup. Assignments persist in this browser's local storage (with in-memory fallback); no TV hardware is controlled.

Picks never duplicate. Empty slots use the next kickoff window (earliest future kickoff through 30 minutes afterward), with Michigan first within that window. A later Michigan kickoff does not displace a game currently playing. Finals vacate their slots on the next reactive update. With no eligible games the view explains how to select another week or view results.

Pregame watch score equals Landscape. During play, the 1-99 watch score starts at Landscape and adjusts by reported margin and game-clock urgency:

- Within eight points: +5 to +40 as regulation winds down.
- Nine through sixteen points: -5 to +5.
- Beyond sixteen points: a ten-point penalty plus one per point beyond sixteen, up to triple that penalty late in regulation.
- Overtime: +15 in addition to the margin adjustment.
- Comeback: +22 when a team previously behind by at least 17 scores at least seven points, cuts its deficit by at least ten, and is now within sixteen (or leads by at most eight).

Comebacks use at most six prior in-progress observations from the last 30 wall-clock minutes, stored in optional collegeGames.liveScoreHistory and preserved by normal imports. They start becoming detectable after sufficient real observations accumulate; no history is fabricated. This adds no provider requests. No possession or play-by-play inference is made. Missing clocks use quarter-level urgency, never an invented ticking clock. Observations older than 15 minutes lose live boosts and use Landscape minus 20 with a provisional label. Michigan priority affects ordering, not the numerical watch score. The compact TV view shows network, teams, reported scores, and the pregame model spread beside the projected winner. Zero projections say Projected even; unavailable projections are not invented. Ratings, ranking explanations, kickoff, reported clock, and the full projected winning margin are inside each game dropdown. The remaining game list is collapsed under All games. These are watchability heuristics, not win probabilities. Rankings refresh with stored scores and the existing 30-second browser timer.

Behavioral regressions and TV assignment boundaries are covered by tests/watch-rating.test.mjs and tests/tv-lineup.test.mjs.

Games shows one Latest score update timestamp above the list in every lens, using the newest retained in-progress/final scoreboard observation in the selected week. It ages with the existing browser timer and shows Waiting for score updates when none exists. Per-game update ages are omitted; individual delayed-score states remain available.

### Manual TV events

**Current:** Each TV has an Edit control for its main and flip-to slots. Either slot can reserve a network and event name for another sport or broadcast. A manual main event can disable flipping, reserving both slots on that TV; saving this choice clears its manual backup. Switching a slot to Automatic football clears only that override; Reset this TV clears both. Cancel leaves the current lineup unchanged.

Manual events remain locked until cleared and persist in this browser under `cfb-tv-overrides-v1`. They display the supplied network and event without fabricated scores or API requests. Automatic football selects distinct top games for the remaining capacity, retaining eligible games and networks where possible. Michigan gets the first available automatic main slot (or an available flip slot if all mains are manual); its automatic flip slot is suppressed, while an explicit manual flip remains honored. If every slot is reserved, football recommendations stop occupying the TVs but remain available under All games. No TV hardware is controlled.

Stored overrides are validated, trimmed, and bounded to six slots with 60-character networks and 120-character event names. Storage failures retain the current session selections. Tests cover all 64 manual-slot combinations, no-flip capacity, Michigan priority, reset, channel stability, and malformed stored values.

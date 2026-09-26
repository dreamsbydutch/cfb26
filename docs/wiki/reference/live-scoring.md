# Live game scores

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** One Convex job checks the shared FBS scoreboard every five minutes. Browsers subscribe to stored game data; viewer count does not multiply CollegeFootballData requests. This is periodically refreshed scoring, not play-by-play or a continuously running game clock.

## Data and display

- CFBD `/scoreboard?classification=fbs` supplies game IDs, team IDs, status, both scores, quarter/period, and clock. Only existing matching games are updated. Both team IDs must match, and a final cannot regress to in-progress or scheduled.
- `collegeGames.liveScore` stores the latest compact observation. Normal schedule imports preserve it. Official completed game results take precedence; live observations do not enter model training or rewrite official game facts.
- Games with a reported in-progress status show scores, quarter/OT, the reported clock, and update age in **Live & started**, above upcoming games. Only confirmed finals emphasize the winner. Scores older than 15 minutes say **Score delayed** and retain the last observation. Kickoff alone never establishes live scoring.
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

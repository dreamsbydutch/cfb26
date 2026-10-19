# Michigan hockey NHL draft history

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** hockey uses NHL draft position as its talent indicator. The public Roster & stats tables replace Recruit with NHL draft. Each compact cell shows overall pick, draft year, and round; expanding it shows the drafting team and source. The displayed selection is a career fact and may postdate the selected roster season. Basketball retains recruiting rank/rating. Hockey's owner spreadsheet omits recruiting fields; older saved null recruiting keys remain accepted when editing a roster, but new hockey recruiting values are rejected.

**Hosted coverage:** the requested [Michigan Athletics NHL draft history](https://mgoblue.com/news/2008/6/27/michigan_players_selected_in_the_nhl_draft) is updated through 2026 despite its 2008 URL. Its entry/amateur table matches 82 distinct players in the saved 2005–06 through 2026–27 rosters after reviewed name aliases. Official [NHL draft records](https://records.nhl.com/site/api/draft) add 15 players omitted from that list, including transfers and incoming players. Production contains 97 players' draft selections, matching 261 annual roster entries. Unmatched players show an unknown dash; absence from these sources does not establish undrafted status.

NHL records resolve two disagreements with the Michigan article: Lee Moffie was selected in round 7, pick 188 in 2010 (Michigan lists round 6); Aidan Park was selected at pick 223 in round 7 in 2025 (Michigan lists 233). The NHL records, not the conflicting article values, are retained for these two players. The drafting franchise is a historical fact, not the player's current rights holder. Michigan's explicit pre-attendance marker is retained when the article is the selected source; that status remains unknown for NHL-only records.

## Storage and matching

`hockeyDraftSelections` stores source-backed selections with player name/key, year, round, overall pick, drafting team, nullable pre-Michigan indicator, source URL/hash, and import time. The source hash covers Michigan's raw HTML or the canonical JSON NHL record, respectively. Indexes cover player key/year and year/pick. Draft data is independent of annual roster values, statistics, roster revisions, schedule imports, NPI, and football data. Full Convex exports cover it.

The public `hockeyDrafts.forSeason` query starts with the selected hockey roster (at most 101 entries), then uses indexed per-player reads capped at five career selections. There is no public draft write. Internal `hockeyDrafts.importMatched` validates the source, pick, and matching saved hockey roster IDs; rejects cross-sport/unrelated identities and conflicting picks; and upserts idempotently. Imports neither create players nor rewrite their season values. Draft matching uses normalized full names and explicit nickname aliases, never surname-only or fuzzy joins. Reviewed preparation also checks draft year against the player's saved roster era: the 2025 Cameron Reid must not match the different 2009 draftee of the same name.

## Reproduction and import

The reviewed source directory outside Git contains `source.html`, complete `nhl-draft-records.json` (2000–2026), `nhl-teams.json`, and `rosters-before.json`. Raw public source evidence and review receipts are retained at `C:/Users/choug/.t3/artifacts/michigan-nhl-draft-20261019`. The preparation helper validates article structure and source completeness, keeps source hashes, identifies NHL-only matches, and fails on unreviewed source disagreements. Supplemental drafts are separate events outside the saved roster era and are not imported as entry-draft selections.

```powershell
node --experimental-strip-types scripts/prepare-hockey-drafts.mjs <source-directory> <new-reviewed.json>
node --experimental-strip-types scripts/import-hockey-drafts.mjs <reviewed.json> <deployment-name>
# After target authorization and a fresh full production export:
node --experimental-strip-types scripts/import-hockey-drafts.mjs <reviewed.json> <deployment-name> --apply
```

Preparation never overwrites an existing reviewed output. Import defaults to dry run, resolves roster IDs on the actual target, validates every reviewed selection before writing, and imports at most ten selections per transaction. It verifies every field through the public season query, asserts unchanged roster fields/revisions, and writes a receipt beside the reviewed file. A stopped import can be rerun safely. Development may contain fewer historical rosters than production; rehearsal uses only selections matching existing development players.

**Verified 2026-10-19:** the backend pushed successfully to development before production promotion. Development had no hockey roster entries, so import behavior was exercised with `convex-test`; production preflight matched all 97 reviewed selections. A verified full production export precedes the additive schema/import: `C:/Users/choug/Documents/cfb26-backups/pre-hockey-drafts-20261019.zip`. Production imported 97 records and verified every field across 261 roster appearances, with all hockey roster values and revisions unchanged. The source contract now has 53 tables and 117 indexes. All 265 automated tests, strict TypeScript, ESLint, 145 Markdown link checks, and the production build passed. Server-render checks verified corrected picks, drafting-team/source details, unknown states, and hockey-versus-basketball owner recruiting columns. Browser visual verification was unavailable.

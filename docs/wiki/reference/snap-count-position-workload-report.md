# Position workload from Michigan snap counts

[Reference index](README.md) · [Wiki home](../README.md)

## Bottom line

**Current evidence (analyzed 2026-08-22):** `SnapCounts.json` contains 921 positive-snap Michigan player-seasons from 2015 through 2025. This report analyzes 920 across the requested offensive and defensive groups; the one long-snapper row is outside the framework.

- EDGE averages 7.6 players with snaps: 2.9 lead-load players at 465 snaps each, 1.5 rotation players at 224, and 3.2 depth players at 27. The canonical roster data identifies another 2.4 zero-snap candidates per season on average, subject to the coverage limits below.
- DL is similarly rotational: 7.6 positive-snap players, including 2.5 lead-load players at 480 snaps and 2.1 rotation players at 184.
- Offensive line work is concentrated. OT, OG, and OC consistently produce the expected 2/2/1 lead-load players, averaging 721, 731, and 782 snaps per lead player.
- HB and TE each average about 1.9 lead-load players despite one base slot. FB participation disappears from the source after 2018, apart from isolated package use in 2023 and 2025.
- The three-receiver framework averages 2.6 lead-load WR/SLOT players and 2.5 rotation players. The source labels every receiver `WR`, so it cannot separate slot and outside receiver workloads or reassign flex snaps to a second TE or FB.
- The defense averages 2.6 lead-load corners against three base CB slots and 2.5 lead-load safeties against two base S slots. Season position cannot reveal whether nickel work functionally belonged to a CB, S, or LB.

These are workload descriptions, not official starter or depth-chart designations.

## Overall 2015–2025 averages

Each role cell is `average players × average snaps per player (snaps per source game)`. EDGE's `2.9 × 465 (37.4)`, for example, means an average season had 2.9 EDGE players in the lead-load band, averaging 465 season snaps and 37.4 snaps per source game.

| Group   | Base slots | Positive/year | Room snaps/year |        Lead load |         Rotation |          Depth | Known zero/year |
| ------- | ---------: | ------------: | --------------: | ---------------: | ---------------: | -------------: | --------------: |
| QB      |          1 |           4.3 |             873 | 1.1 × 698 (54.5) | 0.5 × 166 (15.7) | 2.7 × 26 (2.0) |             1.0 |
| HB      |          1 |           6.9 |             873 | 1.9 × 374 (29.0) | 1.0 × 160 (12.2) | 4.0 × 20 (1.5) |             1.7 |
| FB      |          0 |           1.6 |             177 | 0.8 × 184 (13.7) |   0.2 × 53 (4.1) |  0.6 × 6 (0.5) |             0.0 |
| WR/SLOT |          3 |          10.7 |           1,953 | 2.6 × 528 (41.5) | 2.5 × 197 (15.7) | 5.5 × 23 (1.8) |             3.5 |
| TE      |          1 |           7.7 |           1,327 | 1.9 × 500 (39.2) | 1.5 × 202 (16.1) | 4.3 × 25 (2.1) |             1.5 |
| OT      |          2 |           5.5 |           1,841 | 2.0 × 721 (57.0) | 1.3 × 260 (20.9) | 2.3 × 40 (3.5) |             1.5 |
| OG      |          2 |           6.0 |           1,693 | 2.0 × 731 (57.7) | 0.5 × 267 (19.6) | 3.5 × 23 (1.8) |             1.0 |
| OC      |          1 |           2.9 |             880 | 1.0 × 782 (60.7) | 0.2 × 236 (26.0) | 1.7 × 38 (2.8) |             0.6 |
| EDGE    |          2 |           7.6 |           1,712 | 2.9 × 465 (37.4) | 1.5 × 224 (18.4) | 3.2 × 27 (2.1) |             2.4 |
| DL      |          2 |           7.6 |           1,588 | 2.5 × 480 (38.3) | 2.1 × 184 (14.3) | 3.1 × 39 (3.0) |             2.0 |
| LB      |          2 |           8.3 |           1,916 | 2.1 × 645 (52.2) | 1.5 × 275 (22.8) | 4.6 × 26 (2.3) |             3.6 |
| CB      |          3 |           8.2 |           1,961 | 2.6 × 615 (50.2) | 0.9 × 257 (19.5) | 4.6 × 27 (2.1) |             2.6 |
| S       |          2 |           6.2 |           1,967 | 2.5 × 645 (52.1) | 1.3 × 252 (20.4) | 2.5 × 33 (2.5) |             1.8 |

Player counts, room snaps, and known zeroes are arithmetic means across all 11 seasons. Band snap averages are the mean of yearly band averages in seasons where that band exists. “Per source game” divides each season's band average by the highest `GP` in that source season before averaging; it normalizes the six-game 2020 source without claiming an official schedule length.

## Method and limitations

The source-position map is: QB=`QB`; HB=`HB`+`RB`; FB=`FB`; WR/SLOT=`WR`; TE=`TE`; OT=`T`; OG=`G`; OC=`C`; EDGE=`ED`; DL=`DI`; LB=`LB`; CB=`CB`; and S=`S`. The supplied 2 WR plus 1 SLOT become three receiver slots because alignment is unavailable. The single `LS` player-season is excluded.

**Analytical convention:** within each group and season, the lead benchmark is the average snap total of the top `N` players, where `N` is the base-slot count. Lead load is at least 65% of that benchmark; rotation is 20% to less than 65%; and depth is positive but below 20%. For zero-slot FB, the benchmark is the top FB total and “lead” means lead package workload. The adaptive bands can produce more or fewer lead players than base slots when work is shared, a player misses time, or formations shift snaps elsewhere.

`SnapCounts.json` contains participants only. “Known zero” is a separate lower-bound estimate from the `adjoining-opossum-710` development deployment's `seasonalStats.listBySeason` query on 2026-08-22. It counts covering canonical roster stints returned with `stat: null`. The estimate maps roster `RB` to HB; `WR`+`SLOT` to WR/SLOT; `LT`+`RT`+`OT` to OT; `LG`+`RG`+`OG` to OG; and `NICKEL` to CB. It excludes `K`, `P`, and `LS`.

Known zeroes are incomplete because the lifecycle archive omits some historical players, 113 participant names remain source-only, and a stint's current/final position may differ from its historical position. Recent seasons also have better roster coverage. Do not add these estimates to the positive-snap bands or read their trend as roster growth.

## Yearly detail

Each role cell is `players × average season snaps`. A dash means no player in that band.

### 2015 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       2 |   934 |   1 × 870 |        — | 1 × 64 |       1 |
| HB      |     1 |       7 |   879 |   1 × 501 |  1 × 169 | 5 × 42 |       0 |
| FB      |     0 |       3 |   454 |   2 × 220 |        — | 1 × 14 |       0 |
| WR/SLOT |     3 |      10 | 1,838 |   2 × 614 |  3 × 184 | 5 × 12 |       1 |
| TE      |     1 |       7 | 1,422 |   1 × 685 |  2 × 285 | 4 × 42 |       2 |
| OT      |     2 |       6 | 1,893 |   2 × 911 |        — | 4 × 18 |       2 |
| OG      |     2 |       5 | 1,904 |   2 × 901 |        — | 3 × 34 |       0 |
| OC      |     1 |       2 |   937 |   1 × 911 |        — | 1 × 26 |       0 |
| EDGE    |     2 |       3 |   622 |   2 × 298 |        — | 1 × 26 |       2 |
| DL      |     2 |       6 | 2,216 |   3 × 526 |  2 × 306 | 1 × 28 |       0 |
| LB      |     2 |       6 | 2,258 |   2 × 625 |  3 × 333 | 1 × 11 |       0 |
| CB      |     3 |       6 | 2,465 |   2 × 812 |  2 × 391 | 2 × 30 |       0 |
| S       |     2 |       4 | 1,823 |   2 × 762 |  1 × 268 | 1 × 32 |       1 |

### 2016 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       4 |   947 |   1 × 762 |        — | 3 × 62 |       1 |
| HB      |     1 |       7 |   949 |   1 × 502 |  3 × 145 |  3 × 4 |       1 |
| FB      |     0 |       6 |   621 |   2 × 274 |   1 × 57 |  3 × 6 |       0 |
| WR/SLOT |     3 |      10 | 1,709 |   2 × 599 |  2 × 145 | 6 × 37 |       0 |
| TE      |     1 |       9 | 1,455 |   1 × 658 |  3 × 230 | 5 × 22 |       0 |
| OT      |     2 |       5 | 2,180 |   2 × 821 |  2 × 238 | 1 × 63 |       0 |
| OG      |     2 |       5 | 1,663 |   2 × 740 |        — | 3 × 61 |       2 |
| OC      |     1 |       3 |   991 |   1 × 871 |        — | 2 × 60 |       0 |
| EDGE    |     2 |       6 | 1,709 |   2 × 527 |  2 × 300 | 2 × 29 |       1 |
| DL      |     2 |       8 | 1,446 |   3 × 414 |  1 × 131 | 4 × 18 |       0 |
| LB      |     2 |       7 | 1,697 |   2 × 757 |        — | 5 × 37 |       1 |
| CB      |     3 |       8 | 1,818 |   2 × 690 |  2 × 166 | 4 × 27 |       0 |
| S       |     2 |       8 | 2,605 |   3 × 763 |  1 × 172 | 4 × 36 |       0 |

### 2017 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |   Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | ------: | ------: |
| QB      |     1 |       4 |   899 |   2 × 344 |  1 × 209 |   1 × 3 |       1 |
| HB      |     1 |       7 |   886 |   2 × 330 |  1 × 189 |   4 × 9 |       1 |
| FB      |     0 |       4 |   444 |   2 × 197 |   1 × 49 |   1 × 1 |       0 |
| WR/SLOT |     3 |       9 | 1,715 |   3 × 387 |  3 × 142 |  3 × 43 |       1 |
| TE      |     1 |       6 | 1,387 |   2 × 500 |  2 × 184 |  2 × 10 |       1 |
| OT      |     2 |       5 | 2,123 |   2 × 683 |  2 × 328 | 1 × 103 |       3 |
| OG      |     2 |       5 | 1,589 |   2 × 718 |  1 × 148 |   2 × 3 |       1 |
| OC      |     1 |       1 |   838 |   1 × 838 |        — |       — |       0 |
| EDGE    |     2 |       5 | 1,622 |   2 × 704 |  1 × 143 |  2 × 36 |       3 |
| DL      |     2 |       5 | 1,228 |   1 × 644 |  3 × 167 |  1 × 83 |       3 |
| LB      |     2 |       7 | 2,025 |   2 × 777 |  1 × 379 |  4 × 23 |       3 |
| CB      |     3 |       9 | 1,788 |   3 × 550 |        — |  6 × 23 |       0 |
| S       |     2 |       4 | 2,277 |   3 × 756 |        — |   1 × 9 |       0 |

### 2018 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       5 |   923 |   1 × 838 |        — | 4 × 21 |       0 |
| HB      |     1 |       7 |   876 |   1 × 439 |  2 × 190 | 4 × 14 |       2 |
| FB      |     0 |       3 |   171 |   1 × 161 |        — |  2 × 5 |       0 |
| WR/SLOT |     3 |       9 | 2,025 |   2 × 590 |  4 × 204 |  3 × 9 |       1 |
| TE      |     1 |       8 | 1,531 |   2 × 633 |  1 × 186 | 5 × 16 |       1 |
| OT      |     2 |       6 | 1,850 |   2 × 756 |  1 × 261 | 3 × 26 |       1 |
| OG      |     2 |       5 | 1,812 |   2 × 875 |        — | 3 × 21 |       0 |
| OC      |     1 |       3 |   954 |   1 × 873 |        — | 2 × 41 |       0 |
| EDGE    |     2 |       8 | 1,923 |   3 × 457 |  3 × 162 | 2 × 33 |       4 |
| DL      |     2 |       7 | 1,414 |   3 × 346 |  2 × 134 | 2 × 55 |       0 |
| LB      |     2 |       7 | 2,258 |   2 × 657 |  3 × 301 | 2 × 21 |       4 |
| CB      |     3 |       7 | 1,877 |   3 × 572 |  1 × 116 | 3 × 15 |       4 |
| S       |     2 |       4 | 1,609 |   2 × 643 |  1 × 246 | 1 × 77 |       1 |

### 2019 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       4 |   944 |   1 × 853 |        — | 3 × 30 |       1 |
| HB      |     1 |       6 |   940 |   2 × 348 |  2 × 112 | 2 × 11 |       3 |
| FB      |     0 |       0 |     0 |         — |        — |      — |       0 |
| WR/SLOT |     3 |      11 | 2,475 |   4 × 539 |  1 × 173 | 6 × 24 |       3 |
| TE      |     1 |       8 | 1,378 |   2 × 524 |  2 × 125 | 4 × 20 |       0 |
| OT      |     2 |       5 | 1,903 |   2 × 807 |  1 × 257 | 2 × 16 |       2 |
| OG      |     2 |       6 | 1,896 |   2 × 924 |        — | 4 × 12 |       2 |
| OC      |     1 |       2 |   946 |   1 × 919 |        — | 1 × 27 |       1 |
| EDGE    |     2 |       6 | 2,329 |   3 × 618 |  1 × 394 | 2 × 41 |       4 |
| DL      |     2 |       6 | 1,124 |   1 × 609 |  3 × 148 | 2 × 36 |       2 |
| LB      |     2 |      11 | 2,575 |   3 × 745 |        — | 8 × 43 |       3 |
| CB      |     3 |       5 | 1,797 |   3 × 585 |        — | 2 × 21 |       3 |
| S       |     2 |       6 | 1,851 |   2 × 745 |  1 × 333 | 3 × 10 |       3 |

### 2020 (6 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       2 |   395 |   1 × 263 |  1 × 132 |      — |       0 |
| HB      |     1 |       4 |   408 |   4 × 102 |        — |      — |       3 |
| FB      |     0 |       0 |     0 |         — |        — |      — |       0 |
| WR/SLOT |     3 |       8 | 1,020 |   3 × 230 |  3 × 106 |  2 × 6 |       7 |
| TE      |     1 |       5 |   533 |   2 × 198 |   1 × 88 | 2 × 25 |       3 |
| OT      |     2 |       5 |   980 |   2 × 334 |  2 × 134 | 1 × 45 |       1 |
| OG      |     2 |       5 |   661 |   2 × 303 |        — | 3 × 18 |       1 |
| OC      |     1 |       2 |   399 |   1 × 245 |  1 × 154 |      — |       1 |
| EDGE    |     2 |      11 | 1,189 |   3 × 282 |  2 × 129 | 6 × 14 |       1 |
| DL      |     2 |       7 |   685 |   2 × 254 |   2 × 67 | 3 × 15 |       2 |
| LB      |     2 |       8 | 1,443 |   2 × 431 |  2 × 225 | 4 × 33 |       6 |
| CB      |     3 |       5 |   970 |   2 × 464 |        — | 3 × 14 |       4 |
| S       |     2 |       5 | 1,041 |   2 × 396 |  2 × 124 |  1 × 1 |       4 |

### 2021 (14 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       6 | 1,003 |   1 × 800 |  1 × 166 |  4 × 9 |       1 |
| HB      |     1 |       9 | 1,027 |   2 × 420 |  1 × 133 |  6 × 9 |       1 |
| FB      |     0 |       0 |     0 |         — |        — |      — |       0 |
| WR/SLOT |     3 |      12 | 2,439 |   3 × 543 |  3 × 246 | 6 × 12 |       5 |
| TE      |     1 |       9 | 1,503 |   2 × 521 |  1 × 313 | 6 × 25 |       1 |
| OT      |     2 |       7 | 1,999 |   2 × 928 |        — | 5 × 29 |       0 |
| OG      |     2 |       9 | 2,067 |   2 × 715 |  2 × 273 | 5 × 18 |       0 |
| OC      |     1 |       3 |   997 |   1 × 923 |        — | 2 × 37 |       0 |
| EDGE    |     2 |       8 | 2,184 |   2 × 664 |  3 × 261 | 3 × 25 |       1 |
| DL      |     2 |      11 | 1,967 |   2 × 569 |  3 × 214 | 6 × 31 |       3 |
| LB      |     2 |       9 | 1,988 |   2 × 651 |  2 × 281 | 5 × 25 |       2 |
| CB      |     3 |      10 | 1,946 |   2 × 716 |  1 × 376 | 7 × 20 |       2 |
| S       |     2 |       8 | 2,633 |   2 × 817 |  2 × 429 | 4 × 36 |       0 |

### 2022 (14 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |   Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | ------: | ------: |
| QB      |     1 |       8 | 1,000 |   1 × 861 |        — |  7 × 20 |       1 |
| HB      |     1 |       8 |   997 |   2 × 400 |        — |  6 × 33 |       0 |
| FB      |     0 |       0 |     0 |         — |        — |       — |       0 |
| WR/SLOT |     3 |      16 | 2,346 |   2 × 706 |  2 × 304 | 12 × 27 |       4 |
| TE      |     1 |      10 | 1,603 |   2 × 474 |  2 × 251 |  6 × 26 |       1 |
| OT      |     2 |       7 | 1,984 |   2 × 717 |  2 × 241 |  3 × 23 |       0 |
| OG      |     2 |       7 | 2,051 |   2 × 793 |  1 × 367 |  4 × 25 |       0 |
| OC      |     1 |       5 | 1,001 |   1 × 918 |        — |  4 × 21 |       1 |
| EDGE    |     2 |      10 | 1,930 |   4 × 348 |  2 × 222 |  4 × 24 |       2 |
| DL      |     2 |       7 | 1,846 |   2 × 584 |  2 × 234 |  3 × 70 |       4 |
| LB      |     2 |       8 | 1,766 |   2 × 678 |  2 × 160 |  4 × 23 |       5 |
| CB      |     3 |       9 | 2,564 |   4 × 597 |        — |  5 × 36 |       5 |
| S       |     2 |       7 | 1,881 |   3 × 546 |  1 × 163 |  3 × 27 |       2 |

### 2023 (15 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       5 |   945 |   1 × 826 |        — | 4 × 30 |       0 |
| HB      |     1 |      10 | 1,004 |   2 × 421 |        — | 8 × 20 |       1 |
| FB      |     0 |       1 |   238 |   1 × 238 |        — |      — |       0 |
| WR/SLOT |     3 |      11 | 2,057 |   2 × 630 |  3 × 199 | 6 × 34 |       9 |
| TE      |     1 |       8 | 1,323 |   2 × 594 |        — | 6 × 23 |       2 |
| OT      |     2 |       4 | 2,157 |   2 × 738 |  2 × 341 |      — |       3 |
| OG      |     2 |       7 | 1,722 |   2 × 743 |        — | 5 × 47 |       3 |
| OC      |     1 |       4 |   945 |   1 × 845 |        — | 3 × 33 |       2 |
| EDGE    |     2 |       8 | 1,830 |   4 × 412 |        — | 4 × 46 |       4 |
| DL      |     2 |       7 | 1,876 |   3 × 421 |  2 × 256 | 2 × 51 |       4 |
| LB      |     2 |      10 | 1,774 |   2 × 630 |  1 × 338 | 7 × 25 |       9 |
| CB      |     3 |      12 | 2,488 |   3 × 617 |  2 × 170 | 7 × 43 |       4 |
| S       |     2 |       7 | 1,799 |   4 × 416 |        — | 3 × 46 |       2 |

### 2024 (12 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       4 |   742 |   1 × 431 |  2 × 155 |  1 × 1 |       2 |
| HB      |     1 |       6 |   775 |   2 × 358 |        — | 4 × 15 |       5 |
| FB      |     0 |       0 |     0 |         — |        — |      — |       0 |
| WR/SLOT |     3 |       9 | 1,707 |   4 × 341 |  2 × 142 | 3 × 20 |       5 |
| TE      |     1 |       6 | 1,185 |   3 × 358 |        — | 3 × 37 |       4 |
| OT      |     2 |       5 | 1,520 |   2 × 616 |  1 × 168 | 2 × 61 |       4 |
| OG      |     2 |       3 | 1,415 |   2 × 707 |        — |  1 × 2 |       2 |
| OC      |     1 |       5 |   814 |   1 × 491 |  1 × 317 |  3 × 2 |       2 |
| EDGE    |     2 |      10 | 1,584 |   3 × 413 |  1 × 265 | 6 × 13 |       3 |
| DL      |     2 |       8 | 1,708 |   2 × 548 |  3 × 181 | 3 × 24 |       4 |
| LB      |     2 |       9 | 1,554 |   2 × 631 |  1 × 184 | 6 × 18 |       6 |
| CB      |     3 |       9 | 1,987 |   3 × 531 |  1 × 279 | 5 × 23 |       4 |
| S       |     2 |       7 | 1,853 |   2 × 622 |  2 × 243 | 3 × 41 |       5 |

### 2025 (13 source games)

| Group   | Slots | Players | Total | Lead load | Rotation |  Depth | Known 0 |
| ------- | ----: | ------: | ----: | --------: | -------: | -----: | ------: |
| QB      |     1 |       3 |   867 |   1 × 827 |        — | 2 × 20 |       3 |
| HB      |     1 |       5 |   860 |   2 × 300 |  1 × 179 | 2 × 41 |       2 |
| FB      |     0 |       1 |    14 |    1 × 14 |        — |      — |       0 |
| WR/SLOT |     3 |      13 | 2,153 |   2 × 628 |  2 × 327 | 9 × 27 |       3 |
| TE      |     1 |       9 | 1,278 |   2 × 352 |  3 × 157 | 4 × 26 |       1 |
| OT      |     2 |       6 | 1,661 |   2 × 623 |  1 × 373 | 3 × 14 |       1 |
| OG      |     2 |       9 | 1,844 |   2 × 624 |  2 × 278 |  5 × 8 |       0 |
| OC      |     1 |       2 |   859 |   1 × 765 |        — | 1 × 94 |       0 |
| EDGE    |     2 |       9 | 1,906 |   4 × 396 |  2 × 144 | 3 × 12 |       1 |
| DL      |     2 |      12 | 1,963 |   5 × 367 |        — | 7 × 18 |       0 |
| LB      |     2 |       9 | 1,735 |   2 × 513 |  2 × 271 | 5 × 34 |       1 |
| CB      |     3 |      10 | 1,871 |   2 × 636 |  1 × 303 | 7 × 42 |       3 |
| S       |     2 |       8 | 2,264 |   2 × 632 |  3 × 289 | 3 × 45 |       2 |

## Evidence boundary

The analyzed source has SHA-256 `698875556A1D972CB6E706F3CECD467AC7DF9351F425F80D1E3936DBD7BD3C01`, 415 source names, and 921 positive-snap rows. See [Michigan player data interpretation](michigan-player-data-report.md#seasonal-participation-and-pff-grades) for the import and identity-linkage contract.

This report does not infer alignment, personnel packages, injuries, official starts, within-season position changes, or special-teams participation. Those questions require play-level alignment data, official participation/starts, or a complete season-specific roster archive.

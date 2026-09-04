# Contest score dashboard

Last refreshed: 2026-09-04T01:10:05.086Z. Local commit: `97c25a48`.
Leaderboard snapshot: 2026-09-03T17:17:32.745Z. Fork last scored: 2026-09-03T16:41:33.829Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 90/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8498/11265 | 75.44% | 16/44 | 70.09% | 89/2959 |
| Supplemental C suite | 83378/83378 | 100.00% | 374/374 | 4450946/4450946 (100.00%) | 595/2703 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.745**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `97c25a48` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 861/861 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 83378/83378 |
| Cursor positions | 11405/11405 | 83378/83378 |
| Startup and per-turn estimate | 68+0.42/turn | 65+0.14/turn |

## Supplemental failures

0 failing sessions, 0 with runtime errors.

## Supplemental oracle integrity

- Recorder generation rejects out-of-range cursors and leaked OSC 7777 capture markers.
- The dense-map and bones-persistence fixtures were re-recorded after fixing their recorder faults.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.106 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Sessions failed: 12. Failure rate: 13.64%.
- Reported runtime error: `Error: nh_terminate | at really_done (file:///home/runner/work/teleport-judge/teleport-judge/play/rohitgandikota/js/end.js:660:17)`.
- Early abort: false. Total scored moves: 17657.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-04T01:10:05.086Z | `97c25a48` | 11405/11405 | 83378/83378 | 8498/11265 | 3 |
| 2026-09-04T00:50:32.711Z | `2b554b3f` | 11405/11405 | 82994/83379 | 8498/11265 | 3 |
| 2026-09-04T00:39:44.767Z | `d6e69b1c` | 11405/11405 | 82988/83379 | 8498/11265 | 3 |
| 2026-09-04T00:26:43.306Z | `8ee9f882` | 11405/11405 | 82961/83379 | 8498/11265 | 3 |
| 2026-09-04T00:14:29.830Z | `61b0d977` | 11405/11405 | 82956/83379 | 8498/11265 | 3 |
| 2026-09-03T23:21:51.745Z | `5a60130a` | 11405/11405 | 82883/83306 | 8498/11265 | 3 |
| 2026-09-03T23:12:47.814Z | `4b040f4e` | 11405/11405 | 82877/83300 | 8498/11265 | 3 |
| 2026-09-03T22:58:47.934Z | `c8b33539` | 11405/11405 | 82867/83290 | 8498/11265 | 3 |
| 2026-09-03T22:48:32.328Z | `84487eb8` | 11405/11405 | 82845/83268 | 8498/11265 | 3 |
| 2026-09-03T22:38:40.719Z | `6f1d75c8` | 11405/11405 | 82840/83263 | 8498/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

# Contest score dashboard

Last refreshed: 2026-09-04T13:38:03.166Z. Local commit: `39479cd6`.
Leaderboard snapshot: 2026-09-03T17:17:32.745Z. Fork last scored: 2026-09-03T16:41:33.829Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 1462/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8498/11265 | 75.44% | 16/44 | 70.09% | 89/2959 |
| Supplemental C suite | 103842/103842 | 100.00% | 398/398 | 5194865/5194865 (100.00%) | 3179/3179 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.745**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `39479cd6` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 1111/1111 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 103842/103842 |
| Cursor positions | 11405/11405 | 103842/103842 |
| Startup and per-turn estimate | 60+0.44/turn | 66+0.14/turn |

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
| 2026-09-04T13:38:03.166Z | `39479cd6` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |
| 2026-09-04T13:16:05.104Z | `a502805e` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |
| 2026-09-04T12:58:14.422Z | `1ca65be2` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |
| 2026-09-04T12:47:23.991Z | `56ee925e` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |
| 2026-09-04T12:22:07.912Z | `7bc4164a` | 11405/11405 | 103658/103658 | 8498/11265 | 3 |
| 2026-09-04T12:01:58.869Z | `ab285007` | 11405/11405 | 103012/103012 | 8498/11265 | 3 |
| 2026-09-04T11:35:14.589Z | `2f08f440` | 11405/11405 | 102254/102254 | 8498/11265 | 3 |
| 2026-09-04T11:30:00.685Z | `7d53d307-dirty` | 11405/11405 | 102254/102254 | 8498/11265 | 3 |
| 2026-09-04T11:12:12.088Z | `afb1a0a5` | 11405/11405 | 102043/102043 | 8498/11265 | 3 |
| 2026-09-04T10:56:24.611Z | `5cb44a91` | 11405/11405 | 101543/101543 | 8498/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

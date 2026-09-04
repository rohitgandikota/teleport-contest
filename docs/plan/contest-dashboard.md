# Contest score dashboard

Last refreshed: 2026-09-04T20:30:15.659Z. Local commit: `c362e5c4`.
Leaderboard snapshot: 2026-09-04T17:12:00.022Z. Fork last scored: 2026-09-04T16:36:40.529Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 1462/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8831/11265 | 78.39% | 17/44 | 76.34% | 89/2959 |
| Supplemental C suite | 111997/111997 | 100.00% | 413/413 | 5767200/5767200 (100.00%) | 3227/3227 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.774**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `c362e5c4` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 1279/1279 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 111997/111997 |
| Cursor positions | 11405/11405 | 111997/111997 |
| Startup and per-turn estimate | 61+0.42/turn | 66+0.14/turn |

## Supplemental failures

0 failing sessions, 0 with runtime errors.

## Supplemental oracle integrity

- Recorder generation rejects out-of-range cursors and leaked OSC 7777 capture markers.
- The dense-map and bones-persistence fixtures were re-recorded after fixing their recorder faults.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.019 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Sessions failed: 11. Failure rate: 12.50%.
- Reported runtime error: `Error: nh_terminate | at really_done (file:///home/runner/work/teleport-judge/teleport-judge/play/rohitgandikota/js/end.js:660:17)`.
- Early abort: false. Total scored moves: 18009.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-04T20:30:15.659Z | `c362e5c4` | 11405/11405 | 111997/111997 | 8831/11265 | 3 |
| 2026-09-04T19:42:01.382Z | `4254ffb7` | 11405/11405 | 110842/110842 | 8498/11265 | 3 |
| 2026-09-04T19:33:25.903Z | `17ed35f2-dirty` | 11405/11405 | 110842/110842 | 8498/11265 | 3 |
| 2026-09-04T17:50:41.411Z | `134c35b2` | 11405/11405 | 108920/108920 | 8498/11265 | 3 |
| 2026-09-04T17:12:29.789Z | `b307ca32` | 11405/11405 | 107959/107959 | 8498/11265 | 3 |
| 2026-09-04T16:38:31.213Z | `62bd8d78-dirty` | 11405/11405 | 107583/107583 | 8498/11265 | 3 |
| 2026-09-04T15:49:40.537Z | `41a3a011` | 11405/11405 | 106521/106521 | 8498/11265 | 3 |
| 2026-09-04T15:26:09.898Z | `226a9e15` | 11405/11405 | 104648/104648 | 8498/11265 | 3 |
| 2026-09-04T13:38:03.166Z | `39479cd6` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |
| 2026-09-04T13:16:05.104Z | `a502805e` | 11405/11405 | 103842/103842 | 8498/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

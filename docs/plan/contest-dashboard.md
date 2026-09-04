# Contest score dashboard

Last refreshed: 2026-09-04T03:40:21.134Z. Local commit: `b3482fcf`.
Leaderboard snapshot: 2026-09-03T17:17:32.745Z. Fork last scored: 2026-09-03T16:41:33.829Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 90/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8498/11265 | 75.44% | 16/44 | 70.09% | 89/2959 |
| Supplemental C suite | 89557/89557 | 100.00% | 382/382 | 4641076/4641076 (100.00%) | 637/2717 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.745**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `b3482fcf` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 934/934 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 89557/89557 |
| Cursor positions | 11405/11405 | 89557/89557 |
| Startup and per-turn estimate | 62+0.44/turn | 67+0.14/turn |

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
| 2026-09-04T03:40:21.134Z | `b3482fcf` | 11405/11405 | 89557/89557 | 8498/11265 | 3 |
| 2026-09-04T02:55:40.695Z | `5b669251` | 11405/11405 | 88022/88022 | 8498/11265 | 3 |
| 2026-09-04T02:03:34.568Z | `25f79c3c-dirty` | 11405/11405 | 84839/84839 | 8498/11265 | 3 |
| 2026-09-04T02:01:52.397Z | `fff0763e-dirty` | 11405/11405 | 84839/84839 | 8498/11265 | 3 |
| 2026-09-04T01:41:32.150Z | `9b78fe06` | 11405/11405 | 84352/84352 | 8498/11265 | 3 |
| 2026-09-04T01:26:31.981Z | `666cdf8c` | 11405/11405 | 83946/83946 | 8498/11265 | 3 |
| 2026-09-04T01:10:05.086Z | `97c25a48` | 11405/11405 | 83378/83378 | 8498/11265 | 3 |
| 2026-09-04T00:50:32.711Z | `2b554b3f` | 11405/11405 | 82994/83379 | 8498/11265 | 3 |
| 2026-09-04T00:39:44.767Z | `d6e69b1c` | 11405/11405 | 82988/83379 | 8498/11265 | 3 |
| 2026-09-04T00:26:43.306Z | `8ee9f882` | 11405/11405 | 82961/83379 | 8498/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

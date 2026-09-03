# Contest score dashboard

Last refreshed: 2026-09-03T19:37:05.473Z. Local commit: `88f0b19`.
Leaderboard snapshot: 2026-09-03T17:17:32.745Z. Fork last scored: 2026-09-03T16:41:33.829Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 90/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8498/11265 | 75.44% | 16/44 | 70.09% | 89/2959 |
| Supplemental C suite | 82652/83075 | 99.49% | 349/356 | 4360229/4374841 (99.67%) | 594/2701 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.745**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `88f0b19` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 830/830 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 83030/83075 |
| Cursor positions | 11405/11405 | 82682/83075 |
| Startup and per-turn estimate | 62+0.44/turn | 67+0.14/turn |

## Supplemental failures

7 failing sessions, 0 with runtime errors.

| Session | Identical screens | RNG calls | Failure |
|---|---:|---:|---|
| `bones-persistence.session.json` | 719/721 | 36988/36988 | Output mismatch |
| `floor-object-cancellation.session.json` | 442/443 | 16441/19365 | Output mismatch |
| `gehennom-tour.session.json` | 107/490 | 366071/366071 | Output mismatch |
| `mhurtle-hero-collision.session.json` | 311/316 | 5659/8262 | Output mismatch |
| `rider-behavior.session.json` | 395/399 | 16657/20676 | Output mismatch |
| `vamp-stone-reversion.session.json` | 359/381 | 4523/9589 | Output mismatch |
| `variant-world-tour.session.json` | 827/833 | 123614/123614 | Output mismatch |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

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
| 2026-09-03T19:37:05.473Z | `88f0b19` | 11405/11405 | 82652/83075 | 8498/11265 | 3 |
| 2026-09-03T19:25:20.592Z | `61a8fe3` | 11405/11405 | 82648/83071 | 8498/11265 | 3 |
| 2026-09-03T19:15:31.884Z | `9120513` | 11405/11405 | 82636/83059 | 8498/11265 | 3 |
| 2026-09-03T19:04:53.282Z | `5cba454` | 11405/11405 | 82632/83055 | 8498/11265 | 3 |
| 2026-09-03T18:42:50.383Z | `c98d2c5` | 11405/11405 | 82578/83001 | 8498/11265 | 3 |
| 2026-09-03T18:17:38.154Z | `a80b4d7` | 11405/11405 | 82568/82991 | 8498/11265 | 3 |
| 2026-09-03T18:03:36.092Z | `5593394` | 11405/11405 | 82560/82983 | 8498/11265 | 3 |
| 2026-09-03T17:38:05.276Z | `97bcf38` | 11405/11405 | 82247/82670 | 8498/11265 | 3 |
| 2026-09-03T17:23:13.282Z | `7e6587e` | 11405/11405 | 82194/82617 | 7959/11265 | 3 |
| 2026-09-03T17:11:40.007Z | `6a0b6c7` | 11405/11405 | 82191/82617 | 7959/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

# Contest score dashboard

Last refreshed: 2026-09-03T22:58:47.934Z. Local commit: `c8b33539`.
Leaderboard snapshot: 2026-09-03T17:17:32.745Z. Fork last scored: 2026-09-03T16:41:33.829Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 90/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 8498/11265 | 75.44% | 16/44 | 70.09% | 89/2959 |
| Supplemental C suite | 82867/83290 | 99.49% | 359/366 | 4410674/4425286 (99.67%) | 594/2701 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.745**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `c8b33539` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 849/849 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 83245/83290 |
| Cursor positions | 11405/11405 | 82897/83290 |
| Startup and per-turn estimate | 79+0.58/turn | 68+0.16/turn |

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
| 2026-09-03T22:58:47.934Z | `c8b33539` | 11405/11405 | 82867/83290 | 8498/11265 | 3 |
| 2026-09-03T22:48:32.328Z | `84487eb8` | 11405/11405 | 82845/83268 | 8498/11265 | 3 |
| 2026-09-03T22:38:40.719Z | `6f1d75c8` | 11405/11405 | 82840/83263 | 8498/11265 | 3 |
| 2026-09-03T22:18:25.920Z | `5ec1c896` | 11405/11405 | 82831/83254 | 8498/11265 | 3 |
| 2026-09-03T21:54:56.506Z | `00f28a4d` | 11405/11405 | 82768/83191 | 8498/11265 | 3 |
| 2026-09-03T21:42:32.773Z | `6742816` | 11405/11405 | 82738/83161 | 8498/11265 | 3 |
| 2026-09-03T20:45:41.610Z | `94592c2` | 11405/11405 | 82731/83154 | 8498/11265 | 3 |
| 2026-09-03T19:37:05.473Z | `88f0b19` | 11405/11405 | 82652/83075 | 8498/11265 | 3 |
| 2026-09-03T19:25:20.592Z | `61a8fe3` | 11405/11405 | 82648/83071 | 8498/11265 | 3 |
| 2026-09-03T19:15:31.884Z | `9120513` | 11405/11405 | 82636/83059 | 8498/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

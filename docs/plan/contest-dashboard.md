# Contest score dashboard

Last refreshed: 2026-09-03T15:46:13.842Z. Local commit: `85203f6-dirty`.
Leaderboard snapshot: 2026-09-03T12:06:14.352Z. Fork last scored: 2026-09-03T11:29:19.411Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 90/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 90/1483 |
| Held-out leaderboard | 7959/11265 | 70.65% | 15/44 | 67.94% | 89/2959 |
| Supplemental C suite | 81320/81760 | 99.46% | 331/343 | 4241290/4282242 (99.04%) | 594/2700 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.698**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `85203f6-dirty` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 99/106 | 7 | 0 |
| Explicit C branches | 792/792 | 0 | 0 |

Coverage counts describe declared scenarios, not proof that every C branch is ported or passing.

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 81698/81760 |
| Cursor positions | 11405/11405 | 81361/81760 |
| Startup and per-turn estimate | 60+0.59/turn | 77+0.18/turn |

## Supplemental failures

12 failing sessions, 0 with runtime errors.

| Session | Identical screens | RNG calls | Failure |
|---|---:|---:|---|
| `bones-persistence.session.json` | 719/721 | 36988/36988 | Output mismatch |
| `corpse-pickup-safety.session.json` | 327/329 | 23030/27674 | Output mismatch |
| `floor-object-cancellation.session.json` | 442/443 | 16441/19365 | Output mismatch |
| `gehennom-tour.session.json` | 107/490 | 366071/366071 | Output mismatch |
| `mhurtle-hero-collision.session.json` | 311/316 | 5659/8262 | Output mismatch |
| `passiveum-controls.session.json` | 1519/1521 | 55468/55468 | Output mismatch |
| `rider-behavior.session.json` | 395/399 | 16657/20676 | Output mismatch |
| `vamp-stone-reversion.session.json` | 359/381 | 4523/9589 | Output mismatch |
| `variant-world-tour.session.json` | 827/833 | 123614/123614 | Output mismatch |
| `wand-opening-falling-traps.session.json` | 226/233 | 2695/24363 | Output mismatch |
| `wand-self-opening-sticky-holder.session.json` | 107/110 | 2858/2886 | Output mismatch |
| `wand-self-revival.session.json` | 114/117 | 4883/4883 | Output mismatch |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.13 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Sessions failed: 13. Failure rate: 14.77%.
- Reported runtime error: `ReferenceError: Luck is not defined | at altar_wrath (file:///home/runner/work/teleport-judge/teleport-judge/play/rohitgandikota/js/pray.js:1691:9)`.
- Early abort: false. Total scored moves: 16901.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-03T15:46:13.842Z | `85203f6-dirty` | 11405/11405 | 81320/81760 | 7959/11265 | 3 |
| 2026-09-03T15:39:19.297Z | `85203f6` | 11405/11405 | 79324/81760 | 7959/11265 | 3 |
| 2026-09-01T19:30:31.080Z | `a85b128` | 11405/11405 | 77222/77607 | 6032/11265 | 3 |
| 2026-09-01T19:01:51.164Z | `09994d6` | 11405/11405 | 77001/77386 | 6032/11265 | 3 |
| 2026-09-01T17:49:45.921Z | `4dbf578` | 11405/11405 | 75810/76195 | 6032/11265 | 3 |
| 2026-09-01T16:27:12.272Z | `88b8bc1` | 11405/11405 | 71919/72304 | 6032/11265 | 3 |
| 2026-09-01T15:44:44.013Z | `fbf6bb9` | 11405/11405 | 71732/72117 | 6032/11265 | 3 |
| 2026-09-01T14:39:33.452Z | `b52e2eb` | 11405/11405 | 71612/71997 | 6032/11265 | 3 |
| 2026-09-01T14:13:27.900Z | `901bb85` | 11405/11405 | 71484/71869 | 6032/11265 | 3 |
| 2026-09-01T14:06:58.254Z | `b315524` | 11405/11405 | 71484/71869 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

# Contest score dashboard

Last refreshed: 2026-09-01T09:55:24.471Z. Local commit: `68eede2`.
Leaderboard snapshot: 2026-09-01T05:44:27.234Z. Fork last scored: 2026-09-01T05:17:01.923Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 68028/68413 | 99.44% | 309/311 | 3698514/3698514 (100.00%) | 289/2482 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `68eede2` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 106/106 | 0 | 0 |
| Explicit C branches | 629/629 | 0 | 0 |

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 68406/68413 |
| Cursor positions | 11405/11405 | 68028/68413 |
| Startup and per-turn estimate | 100+0.83/turn | 119+0.26/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.318 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-01T09:55:24.471Z | `68eede2` | 11405/11405 | 68028/68413 | 6032/11265 | 3 |
| 2026-09-01T09:27:21.985Z | `e4a62a3` | 11405/11405 | 67920/68305 | 6032/11265 | 3 |
| 2026-09-01T08:52:58.592Z | `8626841` | 11405/11405 | 67729/68114 | 6032/11265 | 3 |
| 2026-09-01T08:19:00.689Z | `91cacdc` | 11405/11405 | 67366/67751 | 6032/11265 | 3 |
| 2026-09-01T07:42:39.207Z | `e74de6c` | 11405/11405 | 66619/67004 | 6032/11265 | 3 |
| 2026-09-01T07:16:42.812Z | `231da99` | 11405/11405 | 66438/66823 | 6032/11265 | 3 |
| 2026-09-01T06:55:57.826Z | `4ece7de` | 11405/11405 | 66392/66777 | 6032/11265 | 3 |
| 2026-09-01T06:21:28.549Z | `eec8373` | 11405/11405 | 65358/65743 | 6032/11265 | 3 |
| 2026-09-01T05:31:08.528Z | `4163f88` | 11405/11405 | 64757/65142 | 6032/11265 | 3 |
| 2026-09-01T05:11:11.393Z | `4a3a8d8` | 11405/11405 | 64579/64964 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

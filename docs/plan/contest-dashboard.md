# Contest score dashboard

Last refreshed: 2026-08-31T03:48:09.109Z. Local commit: `69bd621`.
Leaderboard snapshot: 2026-08-30T21:56:37.955Z. Fork last scored: 2026-08-30T21:20:33.472Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 47149/47534 | 99.19% | 256/258 | 3004569/3004569 (100.00%) | 88/1938 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `69bd621` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 47527/47534 |
| Cursor positions | 11405/11405 | 47149/47534 |
| Startup and per-turn estimate | 62+0.44/turn | 73+0.17/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.094 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-31T03:48:09.109Z | `69bd621` | 11405/11405 | 47149/47534 | 6032/11265 | 3 |
| 2026-08-31T03:26:18.690Z | `55e1f90` | 11405/11405 | 46766/47151 | 6032/11265 | 3 |
| 2026-08-31T03:10:30.679Z | `a7abc7e` | 11405/11405 | 46468/46853 | 6032/11265 | 3 |
| 2026-08-31T02:52:34.148Z | `254999c` | 11405/11405 | 46263/46648 | 6032/11265 | 3 |
| 2026-08-31T02:19:08.760Z | `fd04dd5` | 11405/11405 | 45908/46293 | 6032/11265 | 3 |
| 2026-08-31T02:08:17.736Z | `1cec4fb` | 11405/11405 | 45802/46187 | 6032/11265 | 3 |
| 2026-08-31T01:49:58.741Z | `43b2a2d` | 11405/11405 | 45649/46034 | 6032/11265 | 3 |
| 2026-08-31T01:35:22.366Z | `2650931` | 11405/11405 | 45159/45544 | 6032/11265 | 3 |
| 2026-08-31T01:04:23.350Z | `f4200e3` | 11405/11405 | 44467/44852 | 6032/11265 | 3 |
| 2026-08-31T00:46:56.712Z | `bad147e` | 11405/11405 | 43910/44295 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

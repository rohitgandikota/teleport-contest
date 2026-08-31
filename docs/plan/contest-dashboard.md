# Contest score dashboard

Last refreshed: 2026-08-31T04:32:51.757Z. Local commit: `48873e8`.
Leaderboard snapshot: 2026-08-30T21:56:37.955Z. Fork last scored: 2026-08-30T21:20:33.472Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 47351/47736 | 99.19% | 259/261 | 3029858/3029858 (100.00%) | 88/1938 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `48873e8` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 47729/47736 |
| Cursor positions | 11405/11405 | 47351/47736 |
| Startup and per-turn estimate | 68+0.54/turn | 99+0.24/turn |

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
| 2026-08-31T04:32:51.757Z | `48873e8` | 11405/11405 | 47351/47736 | 6032/11265 | 3 |
| 2026-08-31T04:20:04.120Z | `3efe0c4` | 11405/11405 | 47240/47625 | 6032/11265 | 3 |
| 2026-08-31T04:03:48.455Z | `986209a` | 11405/11405 | 47175/47560 | 6032/11265 | 3 |
| 2026-08-31T03:48:09.109Z | `69bd621` | 11405/11405 | 47149/47534 | 6032/11265 | 3 |
| 2026-08-31T03:26:18.690Z | `55e1f90` | 11405/11405 | 46766/47151 | 6032/11265 | 3 |
| 2026-08-31T03:10:30.679Z | `a7abc7e` | 11405/11405 | 46468/46853 | 6032/11265 | 3 |
| 2026-08-31T02:52:34.148Z | `254999c` | 11405/11405 | 46263/46648 | 6032/11265 | 3 |
| 2026-08-31T02:19:08.760Z | `fd04dd5` | 11405/11405 | 45908/46293 | 6032/11265 | 3 |
| 2026-08-31T02:08:17.736Z | `1cec4fb` | 11405/11405 | 45802/46187 | 6032/11265 | 3 |
| 2026-08-31T01:49:58.741Z | `43b2a2d` | 11405/11405 | 45649/46034 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

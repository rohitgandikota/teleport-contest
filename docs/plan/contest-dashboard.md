# Contest score dashboard

Last refreshed: 2026-08-25T17:02:51.106Z. Local commit: `e3b2a1f`.
Leaderboard snapshot: 2026-08-25T13:53:33.751Z. Fork last scored: 2026-08-25T13:18:07.116Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 8356/11405 | 73.27% | 36/44 | 506337/792838 (63.86%) | 6/1483 |
| Public leaderboard | 6642/11405 | 58.24% | 34/44 | 49.80% | 6/1483 |
| Held-out leaderboard | 4256/11265 | 37.78% | 1/44 | 16.82% | 0/2959 |
| Supplemental C suite | 1999/3739 | 53.46% | 15/40 | 379320/470994 (80.54%) | 0/75 |

## Contest position and generalization

- Held-out rank: **5/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.641**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 8360/11405 | 1999/3739 |
| Cursor positions | 9632/11405 | 2695/3739 |
| Startup and per-turn estimate | 73+0.37/turn | 57+0.49/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.337 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 17867.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T17:01:55.529Z | `e3b2a1f` | 8356/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T16:45:58.101Z | `c65c42c` | 8250/11405 | 1999/3739 | 4256/11265 | 5 |
| 2026-08-25T16:14:16.087Z | `45353be` | 7844/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T15:25:05.130Z | `cc78177` | 7573/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T15:12:55.263Z | `ac97e0e` | 7542/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T14:28:48.855Z | `1550a55` | 7455/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T14:03:54.059Z | `e9cc351` | 7345/11405 | 2002/3739 | 4256/11265 | 5 |
| 2026-08-25T13:37:42.085Z | `2e69485` | 7041/11405 | 2002/3739 | 3506/11265 | 5 |
| 2026-08-25T13:22:36.821Z | `9c8c6a0` | 6795/11405 | 2002/3739 | 3506/11265 | 5 |
| 2026-08-25T12:26:31.748Z | `c27bbdc` | 6642/11405 | 1869/3739 | 3506/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

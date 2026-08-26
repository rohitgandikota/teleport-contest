# Contest score dashboard

Last refreshed: 2026-08-26T21:46:25.651Z. Local commit: `86131a3`.
Leaderboard snapshot: 2026-08-26T20:46:06.095Z. Fork last scored: 2026-08-26T20:10:00.451Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5852/11265 | 51.95% | 9/44 | 42.15% | 0/2959 |
| Supplemental C suite | 6424/6807 | 94.37% | 59/60 | 1104088/1104088 (100.00%) | 7/259 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.513**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 6802/6807 |
| Cursor positions | 11405/11405 | 6424/6807 |
| Startup and per-turn estimate | 58+0.43/turn | 36+0.83/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.581 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T21:46:25.651Z | `86131a3` | 11405/11405 | 6424/6807 | 5852/11265 | 3 |
| 2026-08-26T21:29:26.757Z | `dcd21fd` | 11405/11405 | 6405/6788 | 5852/11265 | 3 |
| 2026-08-26T20:34:17.199Z | `0ce4393` | 11405/11405 | 6061/6444 | 5795/11265 | 3 |
| 2026-08-26T20:17:23.420Z | `0ca99d6` | 11405/11405 | 5782/6165 | 5795/11265 | 3 |
| 2026-08-26T19:45:27.825Z | `d45b837` | 11405/11405 | 5463/5846 | 5795/11265 | 3 |
| 2026-08-26T19:10:54.753Z | `bcc5427` | 11405/11405 | 5342/5725 | 5795/11265 | 3 |
| 2026-08-26T18:54:46.649Z | `b320750` | 11405/11405 | 5200/5583 | 5795/11265 | 3 |
| 2026-08-26T18:35:41.702Z | `d5ce83d` | 11405/11405 | 5088/5471 | 5795/11265 | 3 |
| 2026-08-26T18:15:06.474Z | `ffd3fbc` | 11405/11405 | 5014/5397 | 5795/11265 | 3 |
| 2026-08-26T16:57:56.297Z | `81efd08` | 11405/11405 | 4870/5253 | 5795/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

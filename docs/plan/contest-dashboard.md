# Contest score dashboard

Last refreshed: 2026-08-26T19:45:27.825Z. Local commit: `d45b837`.
Leaderboard snapshot: 2026-08-26T14:00:33.654Z. Fork last scored: 2026-08-26T13:23:40.913Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5795/11265 | 51.44% | 8/44 | 41.78% | 0/2959 |
| Supplemental C suite | 5463/5846 | 93.45% | 55/56 | 1062287/1062287 (100.00%) | 7/91 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.508**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 5841/5846 |
| Cursor positions | 11405/11405 | 5463/5846 |
| Startup and per-turn estimate | -45+1.24/turn | 55+1.12/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.518 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T19:45:27.825Z | `d45b837` | 11405/11405 | 5463/5846 | 5795/11265 | 3 |
| 2026-08-26T19:10:54.753Z | `bcc5427` | 11405/11405 | 5342/5725 | 5795/11265 | 3 |
| 2026-08-26T18:54:46.649Z | `b320750` | 11405/11405 | 5200/5583 | 5795/11265 | 3 |
| 2026-08-26T18:35:41.702Z | `d5ce83d` | 11405/11405 | 5088/5471 | 5795/11265 | 3 |
| 2026-08-26T18:15:06.474Z | `ffd3fbc` | 11405/11405 | 5014/5397 | 5795/11265 | 3 |
| 2026-08-26T16:57:56.297Z | `81efd08` | 11405/11405 | 4870/5253 | 5795/11265 | 3 |
| 2026-08-26T16:05:21.349Z | `edc04f5` | 11405/11405 | 4763/4763 | 5795/11265 | 3 |
| 2026-08-26T15:48:47.499Z | `fc65dda` | 11405/11405 | 4503/4503 | 5795/11265 | 3 |
| 2026-08-26T15:16:57.500Z | `1431900` | 11405/11405 | 4405/4405 | 5795/11265 | 3 |
| 2026-08-26T15:04:12.541Z | `bd53529` | 11405/11405 | 4385/4385 | 5795/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

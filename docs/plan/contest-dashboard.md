# Contest score dashboard

Last refreshed: 2026-08-27T07:06:22.008Z. Local commit: `1975f32`.
Leaderboard snapshot: 2026-08-26T20:46:06.095Z. Fork last scored: 2026-08-26T20:10:00.451Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5852/11265 | 51.95% | 9/44 | 42.15% | 0/2959 |
| Supplemental C suite | 9704/10087 | 96.20% | 68/69 | 1338420/1338420 (100.00%) | 14/296 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.513**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 10082/10087 |
| Cursor positions | 11405/11405 | 9704/10087 |
| Startup and per-turn estimate | 58+0.42/turn | 51+0.60/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.581 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-27T07:06:22.008Z | `1975f32` | 11405/11405 | 9704/10087 | 5852/11265 | 3 |
| 2026-08-27T06:14:51.887Z | `0ff43c5` | 11405/11405 | 9538/9921 | 5852/11265 | 3 |
| 2026-08-27T05:41:43.943Z | `f55ccec` | 11405/11405 | 9139/9522 | 5852/11265 | 3 |
| 2026-08-27T05:08:42.537Z | `3803dc5` | 11405/11405 | 8673/9056 | 5852/11265 | 3 |
| 2026-08-27T04:31:42.083Z | `721ca4f` | 11405/11405 | 8577/8960 | 5852/11265 | 3 |
| 2026-08-27T04:11:40.543Z | `ae64f3c` | 11405/11405 | 8494/8877 | 5852/11265 | 3 |
| 2026-08-27T03:36:25.157Z | `8cbc4e9` | 11405/11405 | 8211/8594 | 5852/11265 | 3 |
| 2026-08-27T01:25:32.487Z | `c9280f9` | 11405/11405 | 7336/7719 | 5852/11265 | 3 |
| 2026-08-27T00:57:54.800Z | `5d81fda` | 11405/11405 | 6958/7341 | 5852/11265 | 3 |
| 2026-08-27T00:05:26.547Z | `38bca0a` | 11405/11405 | 6775/7158 | 5852/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

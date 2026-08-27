# Contest score dashboard

Last refreshed: 2026-08-27T04:11:40.543Z. Local commit: `ae64f3c`.
Leaderboard snapshot: 2026-08-26T20:46:06.095Z. Fork last scored: 2026-08-26T20:10:00.451Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5852/11265 | 51.95% | 9/44 | 42.15% | 0/2959 |
| Supplemental C suite | 8494/8877 | 95.69% | 64/65 | 1214692/1214692 (100.00%) | 14/278 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.513**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 8872/8877 |
| Cursor positions | 11405/11405 | 8494/8877 |
| Startup and per-turn estimate | 67+0.56/turn | 64+0.65/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.581 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-27T04:11:40.543Z | `ae64f3c` | 11405/11405 | 8494/8877 | 5852/11265 | 3 |
| 2026-08-27T03:36:25.157Z | `8cbc4e9` | 11405/11405 | 8211/8594 | 5852/11265 | 3 |
| 2026-08-27T01:25:32.487Z | `c9280f9` | 11405/11405 | 7336/7719 | 5852/11265 | 3 |
| 2026-08-27T00:57:54.800Z | `5d81fda` | 11405/11405 | 6958/7341 | 5852/11265 | 3 |
| 2026-08-27T00:05:26.547Z | `38bca0a` | 11405/11405 | 6775/7158 | 5852/11265 | 3 |
| 2026-08-26T23:29:32.020Z | `2feaf98` | 11405/11405 | 6568/6951 | 5852/11265 | 3 |
| 2026-08-26T21:46:25.651Z | `86131a3` | 11405/11405 | 6424/6807 | 5852/11265 | 3 |
| 2026-08-26T21:29:26.757Z | `dcd21fd` | 11405/11405 | 6405/6788 | 5852/11265 | 3 |
| 2026-08-26T20:34:17.199Z | `0ce4393` | 11405/11405 | 6061/6444 | 5795/11265 | 3 |
| 2026-08-26T20:17:23.420Z | `0ca99d6` | 11405/11405 | 5782/6165 | 5795/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

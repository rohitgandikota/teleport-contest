# Contest score dashboard

Last refreshed: 2026-08-26T06:21:58.746Z. Local commit: `866359e`.
Leaderboard snapshot: 2026-08-26T02:34:58.612Z. Fork last scored: 2026-08-26T02:04:19.098Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 9967/11405 | 87.39% | 41/44 | 740773/792838 (93.43%) | 9/1483 |
| Public leaderboard | 9219/11405 | 80.83% | 40/44 | 70.92% | 7/1483 |
| Held-out leaderboard | 5235/11265 | 46.47% | 5/44 | 22.43% | 0/2959 |
| Supplemental C suite | 3113/3739 | 83.26% | 39/40 | 395111/470994 (83.89%) | 4/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.568**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 9971/11405 | 3113/3739 |
| Cursor positions | 10941/11405 | 3310/3739 |
| Startup and per-turn estimate | 57+0.41/turn | 57+0.51/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 1.97 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 17647.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T06:21:58.746Z | `866359e` | 9967/11405 | 3113/3739 | 5235/11265 | 3 |
| 2026-08-26T06:09:25.227Z | `d9a1d8f` | 9855/11405 | 3113/3739 | 5235/11265 | 3 |
| 2026-08-26T05:50:10.019Z | `ef893fb` | 9795/11405 | 3113/3739 | 5235/11265 | 3 |
| 2026-08-26T05:20:58.411Z | `2967e16` | 9712/11405 | 3113/3739 | 5235/11265 | 3 |
| 2026-08-26T04:32:06.792Z | `e57f4e7` | 9616/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T04:02:24.531Z | `eed3e59` | 9608/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T03:37:47.232Z | `0828737` | 9536/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T03:09:57.054Z | `8c1e994` | 9508/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T02:34:34.948Z | `edfeefb` | 9384/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T02:23:38.502Z | `2522f0e` | 9318/11405 | 3106/3739 | 4884/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

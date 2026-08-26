# Contest score dashboard

Last refreshed: 2026-08-26T04:32:06.792Z. Local commit: `e57f4e7`.
Leaderboard snapshot: 2026-08-26T02:34:58.612Z. Fork last scored: 2026-08-26T02:04:19.098Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 9616/11405 | 84.31% | 40/44 | 616569/792838 (77.77%) | 9/1483 |
| Public leaderboard | 9219/11405 | 80.83% | 40/44 | 70.92% | 7/1483 |
| Held-out leaderboard | 5235/11265 | 46.47% | 5/44 | 22.43% | 0/2959 |
| Supplemental C suite | 3105/3739 | 83.04% | 39/40 | 395088/470994 (83.88%) | 4/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.568**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 9620/11405 | 3105/3739 |
| Cursor positions | 10578/11405 | 3278/3739 |
| Startup and per-turn estimate | 51+0.38/turn | 50+0.50/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 1.97 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 17647.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T04:32:06.792Z | `e57f4e7` | 9616/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T04:02:24.531Z | `eed3e59` | 9608/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T03:37:47.232Z | `0828737` | 9536/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T03:09:57.054Z | `8c1e994` | 9508/11405 | 3105/3739 | 5235/11265 | 3 |
| 2026-08-26T02:34:34.948Z | `edfeefb` | 9384/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T02:23:38.502Z | `2522f0e` | 9318/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T01:57:47.506Z | `dc5fe33` | 9219/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T01:13:56.111Z | `a74e973` | 8933/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T01:02:44.318Z | `f97efd6` | 8933/11405 | 3022/3739 | 4884/11265 | 3 |
| 2026-08-25T23:34:37.645Z | `bee9f43` | 8860/11405 | 3106/3739 | 4884/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

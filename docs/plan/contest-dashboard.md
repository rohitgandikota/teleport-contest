# Contest score dashboard

Last refreshed: 2026-08-26T01:57:47.506Z. Local commit: `dc5fe33`.
Leaderboard snapshot: 2026-08-25T19:39:15.748Z. Fork last scored: 2026-08-25T19:03:55.987Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 9219/11405 | 80.83% | 40/44 | 562243/792838 (70.92%) | 7/1483 |
| Public leaderboard | 8713/11405 | 76.40% | 39/44 | 64.79% | 6/1483 |
| Held-out leaderboard | 4884/11265 | 43.36% | 3/44 | 20.85% | 0/2959 |
| Supplemental C suite | 3106/3739 | 83.07% | 39/40 | 395210/470994 (83.91%) | 4/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.561**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 9223/11405 | 3106/3739 |
| Cursor positions | 10011/11405 | 3286/3739 |
| Startup and per-turn estimate | 64+0.36/turn | 56+0.52/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.609 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 15836.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T01:57:47.506Z | `dc5fe33` | 9219/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T01:13:56.111Z | `a74e973` | 8933/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-26T01:02:44.318Z | `f97efd6` | 8933/11405 | 3022/3739 | 4884/11265 | 3 |
| 2026-08-25T23:34:37.645Z | `bee9f43` | 8860/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-25T23:24:07.513Z | `74245c8` | 8760/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-25T23:20:13.946Z | `8c61dd4` | 8760/11405 | 3106/3739 | 4884/11265 | 3 |
| 2026-08-25T22:15:52.824Z | `e14f247` | 8713/11405 | 2684/3739 | 4884/11265 | 3 |
| 2026-08-25T21:59:00.267Z | `8f591da` | 8713/11405 | 2683/3739 | 4884/11265 | 3 |
| 2026-08-25T21:50:44.920Z | `8d5f81e` | 8713/11405 | 2633/3739 | 4884/11265 | 3 |
| 2026-08-25T21:38:50.809Z | `e899d24` | 8713/11405 | 2554/3739 | 4884/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

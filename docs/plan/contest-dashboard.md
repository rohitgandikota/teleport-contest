# Contest score dashboard

Last refreshed: 2026-08-26T09:57:33.061Z. Local commit: `3f77596`.
Leaderboard snapshot: 2026-08-26T07:52:17.275Z. Fork last scored: 2026-08-26T07:15:33.569Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 10846/11405 | 95.10% | 42/44 | 740773/792838 (93.43%) | 9/1483 |
| Public leaderboard | 10076/11405 | 88.35% | 42/44 | 93.43% | 9/1483 |
| Held-out leaderboard | 5587/11265 | 49.60% | 7/44 | 28.70% | 0/2959 |
| Supplemental C suite | 3162/3739 | 84.57% | 39/40 | 404472/470994 (85.88%) | 4/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.554**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 10851/11405 | 3162/3739 |
| Cursor positions | 10990/11405 | 3329/3739 |
| Startup and per-turn estimate | 60+0.40/turn | 60+0.48/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.386 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18713.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T09:57:33.061Z | `3f77596` | 10846/11405 | 3162/3739 | 5587/11265 | 3 |
| 2026-08-26T09:49:07.745Z | `9f734fd` | 10774/11405 | 3162/3739 | 5587/11265 | 3 |
| 2026-08-26T09:15:02.864Z | `c8c96e6` | 10846/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T09:08:58.669Z | `dd14655` | 10841/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T09:00:03.342Z | `c9120d7` | 10836/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T08:52:38.695Z | `09e0145` | 10830/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T08:43:36.003Z | `101e113` | 10821/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T08:34:04.250Z | `3d3578f` | 10825/11405 | 3105/3739 | 5587/11265 | 3 |
| 2026-08-26T08:20:41.354Z | `cf65f7e` | 10812/11405 | 3113/3739 | 5587/11265 | 3 |
| 2026-08-26T08:06:43.757Z | `a8a48d6` | 10791/11405 | 3113/3739 | 5587/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

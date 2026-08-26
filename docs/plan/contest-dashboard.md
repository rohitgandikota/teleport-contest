# Contest score dashboard

Last refreshed: 2026-08-26T13:03:40.576Z. Local commit: `7f81244`.
Leaderboard snapshot: 2026-08-26T07:52:17.275Z. Fork last scored: 2026-08-26T07:15:33.569Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 10076/11405 | 88.35% | 42/44 | 93.43% | 9/1483 |
| Held-out leaderboard | 5587/11265 | 49.60% | 7/44 | 28.70% | 0/2959 |
| Supplemental C suite | 3465/3739 | 92.67% | 39/40 | 454422/470994 (96.48%) | 4/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.554**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 3465/3739 |
| Cursor positions | 11405/11405 | 3594/3739 |
| Startup and per-turn estimate | 62+0.43/turn | 65+0.60/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.386 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18713.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T13:03:40.576Z | `7f81244` | 11405/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:18:13.235Z | `f28d39d` | 11379/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:06:17.542Z | `81d5bd8` | 11364/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:01:31.077Z | `efc241a` | 10903/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T09:57:33.061Z | `3f77596` | 10846/11405 | 3162/3739 | 5587/11265 | 3 |
| 2026-08-26T09:49:07.745Z | `9f734fd` | 10774/11405 | 3162/3739 | 5587/11265 | 3 |
| 2026-08-26T09:15:02.864Z | `c8c96e6` | 10846/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T09:08:58.669Z | `dd14655` | 10841/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T09:00:03.342Z | `c9120d7` | 10836/11405 | 3114/3739 | 5587/11265 | 3 |
| 2026-08-26T08:52:38.695Z | `09e0145` | 10830/11405 | 3114/3739 | 5587/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

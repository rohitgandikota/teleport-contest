# Contest score dashboard

Last refreshed: 2026-08-27T14:49:30.342Z. Local commit: `b22fb43`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 10917/11302 | 96.59% | 74/76 | 1412164/1412164 (100.00%) | 14/364 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 11295/11302 |
| Cursor positions | 11405/11405 | 10917/11302 |
| Startup and per-turn estimate | 64+0.43/turn | 60+0.54/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.452 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-27T14:49:30.342Z | `b22fb43` | 11405/11405 | 10917/11302 | 6032/11265 | 3 |
| 2026-08-27T14:35:34.591Z | `604b497` | 11405/11405 | 10889/11274 | 6032/11265 | 3 |
| 2026-08-27T14:31:00.226Z | `2cef13f` | 11405/11405 | 10872/11257 | 6032/11265 | 3 |
| 2026-08-27T14:13:10.104Z | `5acfbc5` | 11405/11405 | 10832/11217 | 6032/11265 | 3 |
| 2026-08-27T14:01:24.536Z | `efcc502` | 11405/11405 | 9965/10348 | 6032/11265 | 3 |
| 2026-08-27T13:51:52.609Z | `e3e330a` | 11405/11405 | 9848/10231 | 6032/11265 | 3 |
| 2026-08-27T07:06:22.008Z | `1975f32` | 11405/11405 | 9704/10087 | 5852/11265 | 3 |
| 2026-08-27T06:14:51.887Z | `0ff43c5` | 11405/11405 | 9538/9921 | 5852/11265 | 3 |
| 2026-08-27T05:41:43.943Z | `f55ccec` | 11405/11405 | 9139/9522 | 5852/11265 | 3 |
| 2026-08-27T05:08:42.537Z | `3803dc5` | 11405/11405 | 8673/9056 | 5852/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

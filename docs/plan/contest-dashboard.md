# Contest score dashboard

Last refreshed: 2026-08-26T15:04:12.541Z. Local commit: `bd53529`.
Leaderboard snapshot: 2026-08-26T14:00:33.654Z. Fork last scored: 2026-08-26T13:23:40.913Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5795/11265 | 51.44% | 8/44 | 41.78% | 0/2959 |
| Supplemental C suite | 4385/4385 | 100.00% | 45/45 | 484610/484610 (100.00%) | 6/84 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.508**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 4385/4385 |
| Cursor positions | 11405/11405 | 4385/4385 |
| Startup and per-turn estimate | 63+0.44/turn | 46+0.61/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.518 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T15:04:12.541Z | `bd53529` | 11405/11405 | 4385/4385 | 5795/11265 | 3 |
| 2026-08-26T14:35:48.036Z | `8b8ba5b` | 11405/11405 | 4108/4108 | 5795/11265 | 3 |
| 2026-08-26T14:17:23.597Z | `0738218` | 11405/11405 | 3977/3977 | 5795/11265 | 3 |
| 2026-08-26T14:04:40.532Z | `196254d` | 11405/11405 | 3914/3914 | 5795/11265 | 3 |
| 2026-08-26T13:49:23.527Z | `c503b11` | 11405/11405 | 3739/3739 | 5587/11265 | 3 |
| 2026-08-26T13:42:48.793Z | `db101ff` | 11405/11405 | 3711/3739 | 5587/11265 | 3 |
| 2026-08-26T13:20:51.454Z | `ac1322b` | 11405/11405 | 3584/3739 | 5587/11265 | 3 |
| 2026-08-26T13:03:40.576Z | `7f81244` | 11405/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:18:13.235Z | `f28d39d` | 11379/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:06:17.542Z | `81d5bd8` | 11364/11405 | 3465/3739 | 5587/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

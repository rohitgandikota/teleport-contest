# Contest score dashboard

Last refreshed: 2026-08-26T14:04:40.532Z. Local commit: `196254d`.
Leaderboard snapshot: 2026-08-26T14:00:33.654Z. Fork last scored: 2026-08-26T13:23:40.913Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 5795/11265 | 51.44% | 8/44 | 41.78% | 0/2959 |
| Supplemental C suite | 3914/3914 | 100.00% | 41/41 | 473573/473573 (100.00%) | 4/77 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.508**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 3914/3914 |
| Cursor positions | 11405/11405 | 3914/3914 |
| Startup and per-turn estimate | 51+0.52/turn | 49+0.69/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.518 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-26T14:04:40.532Z | `196254d` | 11405/11405 | 3914/3914 | 5795/11265 | 3 |
| 2026-08-26T13:49:23.527Z | `c503b11` | 11405/11405 | 3739/3739 | 5587/11265 | 3 |
| 2026-08-26T13:42:48.793Z | `db101ff` | 11405/11405 | 3711/3739 | 5587/11265 | 3 |
| 2026-08-26T13:20:51.454Z | `ac1322b` | 11405/11405 | 3584/3739 | 5587/11265 | 3 |
| 2026-08-26T13:03:40.576Z | `7f81244` | 11405/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:18:13.235Z | `f28d39d` | 11379/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:06:17.542Z | `81d5bd8` | 11364/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T12:01:31.077Z | `efc241a` | 10903/11405 | 3465/3739 | 5587/11265 | 3 |
| 2026-08-26T09:57:33.061Z | `3f77596` | 10846/11405 | 3162/3739 | 5587/11265 | 3 |
| 2026-08-26T09:49:07.745Z | `9f734fd` | 10774/11405 | 3162/3739 | 5587/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

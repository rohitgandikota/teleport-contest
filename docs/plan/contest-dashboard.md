# Contest score dashboard

Last refreshed: 2026-08-28T12:41:35.596Z. Local commit: `5ed63e2`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T09:54:42.000Z. The page reported Updated 5h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 24757/25142 | 98.47% | 143/145 | 1839678/1839678 (100.00%) | 14/442 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `5ed63e2` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 25135/25142 |
| Cursor positions | 11405/11405 | 24757/25142 |
| Startup and per-turn estimate | 75+0.52/turn | 104+0.17/turn |

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
| 2026-08-28T12:41:35.596Z | `5ed63e2` | 11405/11405 | 24757/25142 | 6032/11265 | 3 |
| 2026-08-28T12:33:36.996Z | `056da44` | 11405/11405 | 24539/24924 | 6032/11265 | 3 |
| 2026-08-28T12:25:32.816Z | `aa03b11` | 11405/11405 | 24441/24826 | 6032/11265 | 3 |
| 2026-08-28T12:12:52.202Z | `ddc8b68` | 11405/11405 | 24206/24591 | 6032/11265 | 3 |
| 2026-08-28T11:49:49.296Z | `c6558b4` | 11405/11405 | 24013/24398 | 6032/11265 | 3 |
| 2026-08-28T11:35:33.071Z | `2b3d69e` | 11405/11405 | 23879/24264 | 6032/11265 | 3 |
| 2026-08-28T11:28:13.573Z | `f365227` | 11405/11405 | 23845/24230 | 6032/11265 | 3 |
| 2026-08-28T11:16:52.813Z | `21ea60f` | 11405/11405 | 23765/24150 | 6032/11265 | 3 |
| 2026-08-28T11:06:09.050Z | `d2ecef7` | 11405/11405 | 23669/24054 | 6032/11265 | 3 |
| 2026-08-28T10:57:46.705Z | `ca65d7d` | 11405/11405 | 23611/23996 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

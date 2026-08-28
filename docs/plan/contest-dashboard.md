# Contest score dashboard

Last refreshed: 2026-08-28T12:12:52.202Z. Local commit: `ddc8b68`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T09:54:42.000Z. The page reported Updated 5h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 24206/24591 | 98.43% | 140/142 | 1831639/1831639 (100.00%) | 14/442 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `ddc8b68` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 24584/24591 |
| Cursor positions | 11405/11405 | 24206/24591 |
| Startup and per-turn estimate | 71+0.50/turn | 95+0.15/turn |

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
| 2026-08-28T12:12:52.202Z | `ddc8b68` | 11405/11405 | 24206/24591 | 6032/11265 | 3 |
| 2026-08-28T11:49:49.296Z | `c6558b4` | 11405/11405 | 24013/24398 | 6032/11265 | 3 |
| 2026-08-28T11:35:33.071Z | `2b3d69e` | 11405/11405 | 23879/24264 | 6032/11265 | 3 |
| 2026-08-28T11:28:13.573Z | `f365227` | 11405/11405 | 23845/24230 | 6032/11265 | 3 |
| 2026-08-28T11:16:52.813Z | `21ea60f` | 11405/11405 | 23765/24150 | 6032/11265 | 3 |
| 2026-08-28T11:06:09.050Z | `d2ecef7` | 11405/11405 | 23669/24054 | 6032/11265 | 3 |
| 2026-08-28T10:57:46.705Z | `ca65d7d` | 11405/11405 | 23611/23996 | 6032/11265 | 3 |
| 2026-08-28T10:51:31.915Z | `d92a710` | 11405/11405 | 23556/23941 | 6032/11265 | 3 |
| 2026-08-28T10:36:58.958Z | `cec55f8` | 11405/11405 | 23446/23831 | 6032/11265 | 3 |
| 2026-08-28T10:00:21.112Z | `eeb128b` | 11405/11405 | 23354/23739 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

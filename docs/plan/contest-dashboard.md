# Contest score dashboard

Last refreshed: 2026-08-28T10:51:31.915Z. Local commit: `d92a710`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T09:54:42.000Z. The page reported Updated 5h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 23556/23941 | 98.39% | 132/134 | 1807040/1807040 (100.00%) | 14/442 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `d92a710` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 23934/23941 |
| Cursor positions | 11405/11405 | 23556/23941 |
| Startup and per-turn estimate | 70+0.51/turn | 101+0.16/turn |

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
| 2026-08-28T10:51:31.915Z | `d92a710` | 11405/11405 | 23556/23941 | 6032/11265 | 3 |
| 2026-08-28T10:36:58.958Z | `cec55f8` | 11405/11405 | 23446/23831 | 6032/11265 | 3 |
| 2026-08-28T10:00:21.112Z | `eeb128b` | 11405/11405 | 23354/23739 | 6032/11265 | 3 |
| 2026-08-28T09:52:43.551Z | `d848b21` | 11405/11405 | 23247/23632 | 6032/11265 | 3 |
| 2026-08-28T09:33:42.902Z | `745c180` | 11405/11405 | 22830/23215 | 6032/11265 | 3 |
| 2026-08-28T09:13:38.505Z | `63d7794` | 11405/11405 | 22641/23026 | 6032/11265 | 3 |
| 2026-08-28T08:56:49.272Z | `c20df35` | 11405/11405 | 22392/22777 | 6032/11265 | 3 |
| 2026-08-28T08:38:55.773Z | `781f93a` | 11405/11405 | 22303/22688 | 6032/11265 | 3 |
| 2026-08-28T08:29:16.471Z | `eb38d8d` | 11405/11405 | 22219/22604 | 6032/11265 | 3 |
| 2026-08-28T08:24:07.244Z | `0589dfd` | 11405/11405 | 22136/22521 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

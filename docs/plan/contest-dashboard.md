# Contest score dashboard

Last refreshed: 2026-08-28T00:17:57.537Z. Local commit: `fce5151`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T00:20:28.654Z. The page reported Updated 1h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 13569/13954 | 97.24% | 100/102 | 1557969/1557969 (100.00%) | 14/417 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `fce5151` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 13947/13954 |
| Cursor positions | 11405/11405 | 13569/13954 |
| Startup and per-turn estimate | 83+0.64/turn | 46+0.83/turn |

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
| 2026-08-28T00:17:57.537Z | `fce5151` | 11405/11405 | 13569/13954 | 6032/11265 | 3 |
| 2026-08-27T20:35:47.000Z | `2542ee1` | 11405/11405 | 13537/13922 | 6032/11265 | 3 |
| 2026-08-27T18:56:19.000Z | `b35e8f1` | 11405/11405 | 12945/13330 | 6032/11265 | 3 |
| 2026-08-27T18:49:39.000Z | `6b5afd6` | 11405/11405 | 12842/13227 | 6032/11265 | 3 |
| 2026-08-27T18:05:48.000Z | `f1fe94f` | 11405/11405 | 11991/12376 | 6032/11265 | 3 |
| 2026-08-27T17:32:37.000Z | `7b8e2ae` | 11405/11405 | 11884/12269 | 6032/11265 | 3 |
| 2026-08-27T17:26:14.000Z | `81362f9` | 11405/11405 | 11815/12200 | 6032/11265 | 3 |
| 2026-08-27T16:45:59.000Z | `841b6f8` | 11405/11405 | 11433/11818 | 6032/11265 | 3 |
| 2026-08-27T16:10:26.000Z | `705b190` | 11405/11405 | 11140/11525 | 6032/11265 | 3 |
| 2026-08-27T16:04:54.000Z | `9291d9b` | 11405/11405 | 11058/11443 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

# Contest score dashboard

Last refreshed: 2026-08-29T06:26:41.370Z. Local commit: `7b3ec5c`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-29T06:29:00.000Z. The page reported Last scored: 8/28/2026, 7:11:18 PM and displayed 11405 + 6032 points, 71.9% PRNG, 76.9% screen, 9 animations, 439+1.6 speed, playable no, and 44 + 9 sessions. Its tooltip reported a successful browser load and 2.05 ms per move across 18,402 moves, below the 5 ms threshold, despite the visible playable value.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 32990/33375 | 98.85% | 173/175 | 2286919/2286919 (100.00%) | 19/752 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `7b3ec5c` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 33368/33375 |
| Cursor positions | 11405/11405 | 32990/33375 |
| Startup and per-turn estimate | 74+0.47/turn | 90+0.15/turn |

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
| 2026-08-29T06:26:41.370Z | `7b3ec5c` | 11405/11405 | 32990/33375 | 6032/11265 | 3 |
| 2026-08-29T05:58:05.442Z | `8645f0a` | 11405/11405 | 32828/33213 | 6032/11265 | 3 |
| 2026-08-29T05:26:23.597Z | `bafffc5` | 11405/11405 | 32040/32425 | 6032/11265 | 3 |
| 2026-08-29T05:07:42.919Z | `8b75a80` | 11405/11405 | 31963/32348 | 6032/11265 | 3 |
| 2026-08-29T04:43:03.732Z | `6ad9490` | 11405/11405 | 31700/32085 | 6032/11265 | 3 |
| 2026-08-29T04:25:14.060Z | `e6c8c25` | 11405/11405 | 31476/31861 | 6032/11265 | 3 |
| 2026-08-29T04:06:56.388Z | `3f0167c` | 11405/11405 | 31167/31552 | 6032/11265 | 3 |
| 2026-08-29T03:49:24.948Z | `4b628b5` | 11405/11405 | 30906/31291 | 6032/11265 | 3 |
| 2026-08-29T03:31:33.587Z | `95e94eb` | 11405/11405 | 30523/30908 | 6032/11265 | 3 |
| 2026-08-29T03:09:21.242Z | `29fbdf2` | 11405/11405 | 30229/30614 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.

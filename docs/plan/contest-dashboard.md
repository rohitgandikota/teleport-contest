# Contest score dashboard

Last refreshed: 2026-08-30T18:40:25.838Z. Local commit: `1e344aa`.
Leaderboard snapshot: 2026-08-30T14:28:34.299Z. Fork last scored: 2026-08-30T14:03:27.572Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-30T16:38:28.000Z. The page reported Last scored: 8/30/2026, 10:28:34 AM and displayed 11405 + 6032 points, 71.9% PRNG, 76.9% screen, 9 animations, 251+0.9 speed, playable yes, and 44 + 9 sessions. Its tooltip reported a 251.3 + 0.876 per-move fit and 1.14 ms per move under the 25 ms threshold.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 37936/38321 | 99.00% | 203/205 | 2574411/2574411 (100.00%) | 88/1282 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `1e344aa` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 38314/38321 |
| Cursor positions | 11405/11405 | 37936/38321 |
| Startup and per-turn estimate | 59+0.53/turn | 100+0.22/turn |

## Latest local expansion

- The Ice Box tipping oracle matches 89381/89381 C RNG events and 692/692 screens, cells, and cursors.
- It freezes a corpse for 300 turns, thaws it onto the floor and into another container, and verifies resumed rot in both locations.
- It freezes a glob, resumes shrinkage on the floor and inside a carried sack, checks both visible weight thresholds, and verifies complete dissolution.
- The run also covers the tty status join for simultaneous hunger and encumbrance.
- The deterministic corpus covers 105/105 game elements and 113/113 named branches.
- Public remains 44/44, the hang gate remains 44/44, and 80 fresh games across 13 roles reached no unported path.
- This checkpoint has not been scored by the hidden judge.

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.141 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T18:40:25.838Z | `1e344aa` | 11405/11405 | 37936/38321 | 6032/11265 | 3 |
| 2026-08-30T18:10:36.798Z | `715ed63` | 11405/11405 | 37244/37629 | 6032/11265 | 3 |
| 2026-08-30T18:00:43.993Z | `1b21bb8` | 11405/11405 | 37051/37436 | 6032/11265 | 3 |
| 2026-08-30T17:44:51.360Z | `a53e7a8` | 11405/11405 | 36382/36767 | 6032/11265 | 3 |
| 2026-08-30T17:29:28.653Z | `10061f3` | 11405/11405 | 36021/36406 | 6032/11265 | 3 |
| 2026-08-30T17:16:29.022Z | `7736dc4` | 11405/11405 | 35827/36212 | 6032/11265 | 3 |
| 2026-08-30T17:07:17.502Z | `a12bdd3` | 11405/11405 | 35768/36153 | 6032/11265 | 3 |
| 2026-08-30T16:56:09.173Z | `5b8eeda` | 11405/11405 | 35220/35605 | 6032/11265 | 3 |
| 2026-08-30T16:34:52.583Z | `537285e` | 11405/11405 | 34901/35286 | 6032/11265 | 3 |
| 2026-08-29T10:31:01.764Z | `e0bfa28` | 11405/11405 | 34116/34501 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
